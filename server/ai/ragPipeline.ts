/**
 * RENIX vNext — RAG Pipeline
 * 
 * Document chunking and full-text search retrieval for AI context enrichment.
 * Uses PostgreSQL tsvector/tsquery for efficient keyword-based retrieval.
 * 
 * Pipeline:
 *   1. chunkAndStoreDocument() — Called after text extraction, splits text
 *      into overlapping chunks and stores them with auto-generated tsvector.
 *   2. retrieveRelevantChunks() — Called at chat time, runs a full-text
 *      query against project-scoped chunks and returns top-K ranked passages.
 */

import { db } from '../db';
import { documentChunks, documents } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const MIN_CHUNK_LENGTH = 50;
const MAX_CHUNKS_PER_DOCUMENT = 200;
const DEFAULT_TOP_K = 8;
const MAX_CONTEXT_CHARS = 6000;

const backfilledProjects = new Set<string>();

interface ChunkMetadata {
  fileName?: string;
  documentType?: string;
  pageNumber?: number;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  rank: number;
  metadata: ChunkMetadata | null;
}

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters.
 * Tries to break at sentence boundaries to preserve readability.
 */
export function splitTextIntoChunks(text: string): string[] {
  if (!text || text.trim().length < MIN_CHUNK_LENGTH) return [];

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);

    if (end < cleaned.length) {
      const searchWindow = cleaned.substring(end - 100, end + 100);
      const sentenceBreak = searchWindow.search(/[.!?]\s/);
      if (sentenceBreak !== -1 && sentenceBreak < 150) {
        end = (end - 100) + sentenceBreak + 2;
      } else {
        const wordBreak = cleaned.lastIndexOf(' ', end);
        if (wordBreak > start + CHUNK_SIZE / 2) {
          end = wordBreak + 1;
        }
      }
    }

    const chunk = cleaned.substring(start, end).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

/**
 * Chunk a document's extracted text and store chunks in the database.
 * Called after text extraction completes. Idempotent — deletes existing
 * chunks for the document before inserting new ones.
 */
export async function chunkAndStoreDocument(
  documentId: string,
  projectId: string,
  userId: string,
  extractedText: string,
  meta?: ChunkMetadata
): Promise<number> {
  const chunks = splitTextIntoChunks(extractedText);
  if (chunks.length === 0) {
    console.log(`[RAG] No chunks generated for document ${documentId} (text too short)`);
    return 0;
  }

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

  let charOffset = 0;
  const rows = chunks.map((content, i) => {
    const charStart = charOffset;
    charOffset = charStart + content.length;
    return {
      documentId,
      projectId,
      userId,
      chunkIndex: i,
      content,
      charStart,
      charEnd: charOffset,
      metadata: meta || null,
    };
  });

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(documentChunks).values(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`[RAG] Stored ${chunks.length} chunks for document ${documentId}`);
  return chunks.length;
}

/**
 * Delete all chunks for a given document.
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  console.log(`[RAG] Deleted chunks for document ${documentId}`);
}

/**
 * Retrieve the most relevant document chunks for a user query,
 * scoped to a specific project. Uses PostgreSQL full-text search
 * with ts_rank for relevance scoring.
 */
export async function retrieveRelevantChunks(
  projectId: string,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(documentChunks)
      .where(eq(documentChunks.projectId, projectId));
    const chunkCount = Number(countResult?.count || 0);

    if (chunkCount === 0 && !backfilledProjects.has(projectId)) {
      const docCount = await db.select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(and(eq(documents.projectId, projectId), eq(documents.confirmed, true)));
      if (docCount[0] && Number(docCount[0].count) > 0) {
        console.log(`[RAG] Lazy backfill: no chunks for project ${projectId}, backfilling...`);
        try {
          await backfillProjectDocuments(projectId, 'system');
          backfilledProjects.add(projectId);
        } catch (err) {
          console.error(`[RAG] Lazy backfill failed for project ${projectId}:`, err);
        }
      } else {
        backfilledProjects.add(projectId);
      }
    } else if (chunkCount > 0) {
      backfilledProjects.add(projectId);
    }
  } catch (err) {
    console.error(`[RAG] Lazy backfill check failed:`, err);
  }

  const sanitizedQuery = query
    .replace(/[^\w\s'-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1)
    .slice(0, 20)
    .join(' | ');

  if (!sanitizedQuery) return [];

  let rows: any[];
  try {
    const results = await db.execute(sql`
      SELECT
        dc.id,
        dc.document_id AS "documentId",
        dc.content,
        dc.chunk_index AS "chunkIndex",
        dc.metadata,
        ts_rank(dc.search_vector, to_tsquery('english', ${sanitizedQuery})) AS rank
      FROM document_chunks dc
      WHERE dc.project_id = ${projectId}
        AND dc.search_vector @@ to_tsquery('english', ${sanitizedQuery})
      ORDER BY rank DESC
      LIMIT ${topK}
    `);
    rows = (results as any).rows || results;
    if (!Array.isArray(rows)) return [];
  } catch (err) {
    console.error(`[RAG] Full-text search query failed (search_vector column may be missing):`, err);
    return [];
  }

  let totalChars = 0;
  const filtered: RetrievedChunk[] = [];

  for (const row of rows) {
    if (totalChars + row.content.length > MAX_CONTEXT_CHARS) break;
    totalChars += row.content.length;
    filtered.push({
      id: row.id,
      documentId: row.documentId,
      content: row.content,
      chunkIndex: row.chunkIndex,
      rank: parseFloat(row.rank) || 0,
      metadata: row.metadata,
    });
  }

  console.log(`[RAG] Retrieved ${filtered.length} chunks for query in project ${projectId} (${totalChars} chars)`);
  return filtered;
}

/**
 * Fallback retrieval: when keyword search returns no results, check if the user
 * mentions a document by name and load its full extracted text directly from the DB.
 * This ensures the AI can always answer questions about known documents.
 */
export async function retrieveDocumentByNameFallback(
  projectId: string,
  query: string
): Promise<RetrievedChunk[]> {
  try {
    const projectDocs = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        extractedText: documents.extractedText,
        documentType: documents.documentType,
        summary: documents.summary,
      })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.confirmed, true)
        )
      );

    if (projectDocs.length === 0) return [];

    const queryLower = query.toLowerCase();

    const matchedDoc = projectDocs.find(doc => {
      const nameWithoutExt = doc.fileName.replace(/\.[^.]+$/, '').toLowerCase();
      const nameParts = nameWithoutExt.split(/[\s_\-\.]+/).filter(p => p.length > 2);
      return nameParts.some(part => queryLower.includes(part)) ||
        queryLower.includes(nameWithoutExt);
    });

    if (!matchedDoc) return [];

    const text = matchedDoc.extractedText || matchedDoc.summary || '';
    if (!text || text.trim().length < 10) return [];

    const truncatedText = text.length > MAX_CONTEXT_CHARS
      ? text.substring(0, MAX_CONTEXT_CHARS) + '\n[Content truncated...]'
      : text;

    console.log(`[RAG] Fallback: matched document "${matchedDoc.fileName}" by name for query`);

    return [{
      id: matchedDoc.id,
      documentId: matchedDoc.id,
      content: truncatedText,
      chunkIndex: 0,
      rank: 1.0,
      metadata: {
        fileName: matchedDoc.fileName,
        documentType: matchedDoc.documentType || undefined,
      },
    }];
  } catch (err) {
    console.error('[RAG] Document name fallback failed:', err);
    return [];
  }
}

/**
 * Format retrieved chunks into a text block suitable for injection
 * into the AI system prompt context.
 */
export function formatChunksForContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  const lines = chunks.map((chunk, i) => {
    const source = chunk.metadata?.fileName || 'Unknown document';
    return `[Document: ${source}, Chunk ${chunk.chunkIndex + 1}]\n${chunk.content}`;
  });

  return `\n--- RELEVANT DOCUMENT PASSAGES ---\n${lines.join('\n\n')}\n--- END DOCUMENT PASSAGES ---\n`;
}

/**
 * Backfill: chunk all confirmed documents in a project that don't yet have chunks.
 */
export async function backfillProjectDocuments(projectId: string, userId: string): Promise<{ processed: number; skipped: number; errors: number }> {
  const allDocs = await db
    .select({
      id: documents.id,
      extractedText: documents.extractedText,
      fileName: documents.fileName,
      documentType: documents.documentType,
    })
    .from(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.confirmed, true)
      )
    );

  const existingChunkDocs = await db
    .select({ documentId: documentChunks.documentId })
    .from(documentChunks)
    .where(eq(documentChunks.projectId, projectId))
    .groupBy(documentChunks.documentId);

  const chunkedDocIds = new Set(existingChunkDocs.map(r => r.documentId));
  let processed = 0, skipped = 0, errors = 0;

  for (const doc of allDocs) {
    if (chunkedDocIds.has(doc.id)) {
      skipped++;
      continue;
    }
    if (!doc.extractedText || doc.extractedText.trim().length < MIN_CHUNK_LENGTH) {
      skipped++;
      continue;
    }
    try {
      await chunkAndStoreDocument(doc.id, projectId, userId, doc.extractedText, {
        fileName: doc.fileName,
        documentType: doc.documentType,
      });
      processed++;
    } catch (err) {
      console.error(`[RAG] Error chunking document ${doc.id}:`, err);
      errors++;
    }
  }

  console.log(`[RAG] Backfill complete for project ${projectId}: ${processed} processed, ${skipped} skipped, ${errors} errors`);
  return { processed, skipped, errors };
}
