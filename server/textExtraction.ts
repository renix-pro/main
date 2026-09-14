import { PDFParse } from "pdf-parse";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { db } from "./db";
import { documents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { completeText } from "./ai/openai";

const MAX_EXTRACTED_TEXT_LENGTH = 50000;

async function downloadFileAsBuffer(objectPath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const objectStorageService = new ObjectStorageService();
  
  console.log(`[TextExtraction] Looking for file at: ${objectPath}`);
  
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  
  const [metadata] = await file.getMetadata();
  const mimeType = (metadata.contentType as string) || 'application/octet-stream';
  
  console.log(`[TextExtraction] Downloading file, mimeType: ${mimeType}`);
  const [contents] = await file.download();
  
  return { buffer: contents, mimeType };
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParser = new PDFParse({ data: buffer });
    const result = await pdfParser.getText();
    
    const text = result.text || '';
    console.log(`[TextExtraction] PDF parsed: ${result.total || 1} pages, ${text.length} characters`);
    
    pdfParser.destroy();
    
    return text;
  } catch (error) {
    console.error('[TextExtraction] PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

function extractTextFromTextFile(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

function isTextMimeType(mimeType: string): boolean {
  const textTypes = [
    'text/plain',
    'text/csv',
    'text/html',
    'text/markdown',
    'text/xml',
    'application/json',
    'application/xml',
    'application/javascript',
  ];
  return textTypes.includes(mimeType) || mimeType.startsWith('text/');
}

export async function extractTextFromFile(objectPath: string): Promise<string | null> {
  try {
    const { buffer, mimeType } = await downloadFileAsBuffer(objectPath);
    
    let extractedText: string | null = null;
    
    if (mimeType === 'application/pdf') {
      extractedText = await extractTextFromPdf(buffer);
    } else if (isTextMimeType(mimeType)) {
      extractedText = extractTextFromTextFile(buffer);
    } else {
      console.log(`[TextExtraction] Unsupported mime type for text extraction: ${mimeType}`);
      return null;
    }
    
    if (extractedText && extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
      console.log(`[TextExtraction] Truncating text from ${extractedText.length} to ${MAX_EXTRACTED_TEXT_LENGTH} characters`);
      extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) + '\n\n[Text truncated due to length...]';
    }
    
    return extractedText;
  } catch (error) {
    console.error('[TextExtraction] Error extracting text:', error);
    return null;
  }
}

export async function extractAndStoreDocumentText(documentId: string): Promise<boolean> {
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    
    if (!doc) {
      console.error(`[TextExtraction] Document not found: ${documentId}`);
      return false;
    }
    
    if (!doc.fileDataUrl) {
      console.log(`[TextExtraction] Document has no file URL: ${documentId}`);
      return false;
    }
    
    const extractedText = await extractTextFromFile(doc.fileDataUrl);
    
    if (extractedText) {
      await db.update(documents)
        .set({
          extractedText,
          extractedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
      
      console.log(`[TextExtraction] Stored extracted text for document ${documentId}: ${extractedText.length} characters`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[TextExtraction] Error processing document ${documentId}:`, error);
    return false;
  }
}

export async function extractTextForAllDocumentsInProject(projectId: string): Promise<number> {
  const projectDocs = await db.select()
    .from(documents)
    .where(eq(documents.projectId, projectId));
  
  let extractedCount = 0;
  
  for (const doc of projectDocs) {
    if (!doc.extractedText && doc.fileDataUrl) {
      const success = await extractAndStoreDocumentText(doc.id);
      if (success) {
        extractedCount++;
      }
    }
  }
  
  console.log(`[TextExtraction] Extracted text for ${extractedCount} documents in project ${projectId}`);
  return extractedCount;
}

const MAX_TEXT_FOR_SUMMARY = 30000;

async function generateSummary(text: string, fileName: string): Promise<string | null> {
  try {
    const truncatedText = text.length > MAX_TEXT_FOR_SUMMARY 
      ? text.substring(0, MAX_TEXT_FOR_SUMMARY) + '\n\n[Content truncated for summarization...]'
      : text;

    const summary = await completeText({
      system: `You are a document summarization assistant for a construction project management system. 
Create a concise summary of the document that captures:
1. Document type (quote, invoice, contract, specification, etc.)
2. Key parties/vendors mentioned
3. Main items, services, or scope covered
4. Important amounts, totals, or financial figures
5. Key dates (quote dates, validity periods, due dates)
6. Any notable terms or conditions

Keep the summary under 500 words. Focus on information useful for project planning and cost analysis.`,
      messages: [{ role: "user", content: `Summarize this document (filename: ${fileName}):\n\n${truncatedText}` }],
      effort: "low",
    });
    if (summary) {
      console.log(`[TextExtraction] Generated summary for ${fileName}: ${summary.length} characters`);
      return summary;
    }
    return null;
  } catch (error) {
    console.error('[TextExtraction] Error generating summary:', error);
    return null;
  }
}

export async function summarizeDocument(documentId: string): Promise<boolean> {
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    
    if (!doc) {
      console.error(`[TextExtraction] Document not found for summary: ${documentId}`);
      return false;
    }
    
    if (!doc.extractedText) {
      console.log(`[TextExtraction] Document has no extracted text for summary: ${documentId}`);
      return false;
    }
    
    if (doc.summary) {
      console.log(`[TextExtraction] Document already has summary: ${documentId}`);
      return true;
    }
    
    const summary = await generateSummary(doc.extractedText, doc.fileName);
    
    if (summary) {
      await db.update(documents)
        .set({
          summary,
          summaryGeneratedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
      
      console.log(`[TextExtraction] Stored summary for document ${documentId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[TextExtraction] Error summarizing document ${documentId}:`, error);
    return false;
  }
}

export async function extractAndSummarizeDocument(documentId: string): Promise<boolean> {
  const extracted = await extractAndStoreDocumentText(documentId);
  
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  
  if (!doc) {
    console.error(`[TextExtraction] Document not found for summarization: ${documentId}`);
    return false;
  }
  
  if (doc.extractedText && !doc.summary) {
    await summarizeDocument(documentId);
  }
  
  if (doc.extractedText) {
    try {
      const { chunkAndStoreDocument } = await import('./ai/ragPipeline');
      await chunkAndStoreDocument(doc.id, doc.projectId, doc.userId, doc.extractedText, {
        fileName: doc.fileName,
        documentType: doc.documentType,
      });
    } catch (err) {
      console.error(`[TextExtraction] RAG chunking failed for document ${documentId}:`, err);
    }
  }
  
  return extracted || doc.extractedText !== null;
}

export async function summarizeAllDocumentsInProject(projectId: string): Promise<number> {
  const projectDocs = await db.select()
    .from(documents)
    .where(eq(documents.projectId, projectId));
  
  let summarizedCount = 0;
  
  for (const doc of projectDocs) {
    if (doc.extractedText && !doc.summary) {
      const success = await summarizeDocument(doc.id);
      if (success) {
        summarizedCount++;
      }
    }
  }
  
  console.log(`[TextExtraction] Summarized ${summarizedCount} documents in project ${projectId}`);
  return summarizedCount;
}
