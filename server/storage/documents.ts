import {
  type Document,
  type InsertDocument,
  documents,
  type DocumentAssociation,
  type InsertDocumentAssociation,
  documentAssociations,
  type SourceDocument,
  type InsertSourceDocument,
  sourceDocuments,
  quoteVersions,
  quotes,
  quoteMetadata,
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getDocumentsByProject(db: Db, projectId: string, userId: string): Promise<Document[]> {
  return await db.select().from(documents)
    .where(and(
      eq(documents.projectId, projectId), 
      eq(documents.userId, userId),
      eq(documents.confirmed, true)
    ))
    .orderBy(desc(documents.uploadedAt));
}

export async function getDocumentsByProjectIncludingUnconfirmed(db: Db, projectId: string, userId: string): Promise<Document[]> {
  return await db.select().from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.userId, userId)))
    .orderBy(desc(documents.uploadedAt));
}

export async function getDocumentById(db: Db, documentId: string, userId: string): Promise<Document | undefined> {
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  return doc;
}

export async function getDocumentByChecksum(db: Db, projectId: string, userId: string, checksum: string): Promise<Document | null> {
  const [existing] = await db.select().from(documents)
    .where(and(
      eq(documents.projectId, projectId),
      eq(documents.userId, userId),
      eq(documents.checksum, checksum)
    ));
  return existing || null;
}

export async function createDocument(db: Db, doc: InsertDocument, opts?: { confirmed?: boolean }): Promise<Document> {
  const values = opts?.confirmed ? { ...doc, confirmed: true } : doc;
  const [created] = await db.insert(documents).values(values).returning();
  return created;
}

export async function updateDocument(db: Db, id: string, userId: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
  const [updated] = await db.update(documents)
    .set(updates)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  return updated;
}

export async function confirmDocument(db: Db, id: string, userId: string): Promise<Document | undefined> {
  const [updated] = await db.update(documents)
    .set({ confirmed: true })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  return updated;
}

export async function deleteDocument(db: Db, id: string, userId: string): Promise<boolean> {
  await db.delete(documentAssociations)
    .where(and(eq(documentAssociations.documentId, id), eq(documentAssociations.userId, userId)));

  const linkedSourceDocs = await db.select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.documentId, id));

  if (linkedSourceDocs.length > 0) {
    const sourceDocIds = linkedSourceDocs.map(sd => sd.id);

    const referencedByQuoteVersions = await db.select({ sourceDocumentId: quoteVersions.sourceDocumentId })
      .from(quoteVersions)
      .where(inArray(quoteVersions.sourceDocumentId, sourceDocIds));
    const referencedIds = new Set(referencedByQuoteVersions.map(r => r.sourceDocumentId));

    const deletableIds = sourceDocIds.filter(id => !referencedIds.has(id));
    const preserveIds = sourceDocIds.filter(id => referencedIds.has(id));

    if (deletableIds.length > 0) {
      await db.delete(sourceDocuments)
        .where(inArray(sourceDocuments.id, deletableIds));
    }

    if (preserveIds.length > 0) {
      await db.update(sourceDocuments)
        .set({ documentId: null })
        .where(inArray(sourceDocuments.id, preserveIds));
    }
  }

  const result = await db.delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getAssociationsByDocument(db: Db, documentId: string, userId: string): Promise<DocumentAssociation[]> {
  return await db.select().from(documentAssociations)
    .where(and(eq(documentAssociations.documentId, documentId), eq(documentAssociations.userId, userId)));
}

export async function createAssociation(db: Db, assoc: InsertDocumentAssociation): Promise<DocumentAssociation> {
  const [created] = await db.insert(documentAssociations).values(assoc).returning();
  return created;
}

export async function deleteAssociation(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(documentAssociations)
    .where(and(eq(documentAssociations.id, id), eq(documentAssociations.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function deleteAssociationsByEntity(db: Db, associationType: string, entityId: string, userId: string): Promise<number> {
  const result = await db.delete(documentAssociations)
    .where(and(
      eq(documentAssociations.associationType, associationType),
      eq(documentAssociations.entityId, entityId),
      eq(documentAssociations.userId, userId),
    ));
  return result.rowCount ?? 0;
}

export async function getAssociationsByEntity(db: Db, associationType: string, entityId: string, userId: string): Promise<DocumentAssociation[]> {
  return await db.select().from(documentAssociations)
    .where(and(
      eq(documentAssociations.associationType, associationType),
      eq(documentAssociations.entityId, entityId),
      eq(documentAssociations.userId, userId),
    ));
}

export async function getSourceDocumentsByProject(db: Db, projectId: string, userId: string): Promise<SourceDocument[]> {
  return await db.select().from(sourceDocuments)
    .where(and(eq(sourceDocuments.projectId, projectId), eq(sourceDocuments.userId, userId)))
    .orderBy(desc(sourceDocuments.uploadedAt));
}

export async function getSourceDocumentByChecksum(db: Db, projectId: string, userId: string, checksum: string): Promise<SourceDocument | null> {
  const [existing] = await db.select().from(sourceDocuments)
    .where(and(
      eq(sourceDocuments.projectId, projectId),
      eq(sourceDocuments.userId, userId),
      eq(sourceDocuments.checksum, checksum)
    ));
  return existing || null;
}

export async function createSourceDocument(db: Db, doc: InsertSourceDocument): Promise<SourceDocument> {
  const [created] = await db.insert(sourceDocuments).values(doc).returning();
  return created;
}

export async function getQuotesLinkedViaSourceDocuments(
  db: Db,
  documentId: string,
  userId: string
): Promise<{ quoteId: string; quoteReference: string; sourceDocumentId: string }[]> {
  const linkedSourceDocs = await db.select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(and(
      eq(sourceDocuments.documentId, documentId),
      eq(sourceDocuments.userId, userId)
    ));

  if (linkedSourceDocs.length === 0) return [];

  const sourceDocIds = linkedSourceDocs.map(sd => sd.id);
  const linkedVersions = await db.select({
    quoteId: quoteVersions.quoteId,
    sourceDocumentId: quoteVersions.sourceDocumentId,
  })
    .from(quoteVersions)
    .where(and(
      inArray(quoteVersions.sourceDocumentId, sourceDocIds),
      eq(quoteVersions.userId, userId)
    ));

  if (linkedVersions.length === 0) return [];

  const uniqueQuoteIds = Array.from(new Set(linkedVersions.map(v => v.quoteId)));
  const linkedQuotes = await db.select({ id: quotes.id, legacyVersionId: quotes.legacyVersionId })
    .from(quotes)
    .where(and(inArray(quotes.id, uniqueQuoteIds), eq(quotes.userId, userId)));

  const versionIds = linkedQuotes.map(q => q.legacyVersionId).filter(Boolean) as string[];
  const metadataRows = versionIds.length > 0
    ? await db.select().from(quoteMetadata)
        .where(and(inArray(quoteMetadata.quoteVersionId, versionIds), eq(quoteMetadata.userId, userId)))
    : [];
  const metaMap = new Map(metadataRows.map(m => [m.quoteVersionId, m.reference || '']));

  const quoteMap = new Map(linkedQuotes.map(q => [q.id, metaMap.get(q.legacyVersionId || '') || '']));

  return linkedVersions
    .filter(v => quoteMap.has(v.quoteId))
    .map(v => ({
      quoteId: v.quoteId,
      quoteReference: quoteMap.get(v.quoteId) || `Quote (source document)`,
      sourceDocumentId: v.sourceDocumentId,
    }));
}

export async function updateSourceDocument(db: Db, id: string, userId: string, updates: Partial<{
  ingestionState: string;
  classificationTypes: Array<{type: string, confidence: 'low' | 'medium' | 'high'}>;
  contextualTags: Record<string, string[]>;
  interpretationState: string | null;
}>): Promise<SourceDocument | null> {
  const [updated] = await db.update(sourceDocuments)
    .set(updates)
    .where(and(eq(sourceDocuments.id, id), eq(sourceDocuments.userId, userId)))
    .returning();
  return updated || null;
}

export async function deleteSourceDocument(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(sourceDocuments)
    .where(and(eq(sourceDocuments.id, id), eq(sourceDocuments.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}
