/**
 * RENIX vNext — Documents Routes
 * 
 * Document management endpoints including uploads, associations,
 * tags, and document link management.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertDocumentSchema,
  insertDocumentAssociationSchema,
  documentAnnotations,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, eq } from "drizzle-orm";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { unlinkAndDeleteDocument } from "../storage/documentCleanup";
import { invalidateOverviewCache } from './overview';

export function registerDocumentsRoutes(app: Express): void {
  // ============================================
  // DOCUMENTS ROUTES
  // ============================================

  app.get('/api/projects/:projectId/documents', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const documents = await storage.getDocumentsByProject(projectId, user.id);
      const associationsMap: Record<string, any[]> = {};

      const allInvoices = await storage.getInvoicesByProject(projectId, user.id);
      const invoiceById = new Map<string, typeof allInvoices[number]>();
      for (const inv of allInvoices) {
        invoiceById.set(inv.id, inv);
      }

      for (const doc of documents) {
        const explicitAssociations = await storage.getAssociationsByDocument(doc.id, user.id);

        const enrichedExplicit = explicitAssociations.map((assoc: any) => {
          if (assoc.associationType === 'invoice') {
            const invoice = invoiceById.get(assoc.entityId);
            return { ...assoc, vendorName: invoice?.vendorName || null };
          }
          return assoc;
        });

        associationsMap[doc.id] = enrichedExplicit;
      }

      const annotationRows = await db.select().from(documentAnnotations)
        .where(and(eq(documentAnnotations.projectId, projectId), eq(documentAnnotations.userId, user.id)))
        .orderBy(asc(documentAnnotations.createdAt));
      const annotationsMap: Record<string, typeof annotationRows> = {};
      for (const doc of documents) annotationsMap[doc.id] = [];
      for (const row of annotationRows) {
        if (annotationsMap[row.documentId]) annotationsMap[row.documentId].push(row);
      }

      return res.json({ documents, associations: associationsMap, annotations: annotationsMap });
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get a single document by ID
  app.get('/api/projects/:projectId/documents/:docId', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId } = req.params;
      const document = await storage.getDocumentById(docId, user.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      return res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/documents', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertDocumentSchema.safeParse({ 
        ...req.body, 
        projectId, 
        userId: user.id,
        uploadedBy: user.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const document = await storage.createDocument(parsed.data, { confirmed: true });
      invalidateOverviewCache(projectId);
      
      // Extract text and generate summary for AI context (async, non-blocking)
      if (document.fileDataUrl) {
        (async () => {
          try {
            const { extractAndSummarizeDocument } = await import('../textExtraction');
            await extractAndSummarizeDocument(document.id);
          } catch (extractErr) {
            console.error('[Document] Text extraction/summarization failed:', extractErr);
          }
        })();
      }
      
      return res.status(201).json(document);
    } catch (error) {
      console.error('Error creating document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/documents/:docId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId } = req.params;
      const document = await storage.updateDocument(docId, user.id, req.body);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(document);
    } catch (error) {
      console.error('Error updating document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/documents/:docId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId, projectId } = req.params;
      
      const result = await unlinkAndDeleteDocument(docId, projectId, user.id, true);
      if (!result.documentDeleted) {
        return res.status(404).json({ message: 'Document not found' });
      }
      invalidateOverviewCache(projectId);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Document duplicate check - check if a document with same checksum exists
  app.post('/api/projects/:projectId/documents/check-duplicate', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { checksum, fileName } = req.body;
      
      if (!checksum) {
        return res.status(400).json({ message: 'Checksum is required' });
      }
      
      const existingDoc = await storage.getDocumentByChecksum(projectId, user.id, checksum);
      
      if (existingDoc) {
        return res.json({
          isDuplicate: true,
          existingDocument: {
            id: existingDoc.id,
            fileName: existingDoc.fileName,
            uploadedAt: existingDoc.uploadedAt,
          }
        });
      }
      
      return res.json({ isDuplicate: false });
    } catch (error) {
      console.error('Error checking document duplicate:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });


  app.post('/api/projects/:projectId/documents/:docId/tags', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId } = req.params;
      const { tag } = req.body;
      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ message: 'Tag is required' });
      }
      const normalizedTag = tag.trim().toLowerCase();
      if (!normalizedTag) {
        return res.status(400).json({ message: 'Tag cannot be empty' });
      }
      const doc = await storage.getDocumentById(docId, user.id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      const currentTags = (doc.tags as string[]) || [];
      if (currentTags.includes(normalizedTag)) {
        return res.json(doc);
      }
      const updatedDoc = await storage.updateDocument(docId, user.id, {
        tags: [...currentTags, normalizedTag] as any,
      });
      return res.json(updatedDoc);
    } catch (error) {
      console.error('Error adding tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/documents/:docId/tags/:tag', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId, tag } = req.params;
      const normalizedTag = decodeURIComponent(tag).trim().toLowerCase();
      const doc = await storage.getDocumentById(docId, user.id);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }
      const currentTags = (doc.tags as string[]) || [];
      const updatedTags = currentTags.filter(t => t !== normalizedTag);
      const updatedDoc = await storage.updateDocument(docId, user.id, {
        tags: updatedTags as any,
      });
      return res.json(updatedDoc);
    } catch (error) {
      console.error('Error removing tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/documents/:docId/associations', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, docId } = req.params;
      const parsed = insertDocumentAssociationSchema.safeParse({ ...req.body, projectId, documentId: docId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const association = await storage.createAssociation(parsed.data);
      return res.status(201).json(association);
    } catch (error) {
      console.error('Error creating association:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  /** Remove an association by document + type + entity (shape used by the client). */
  app.delete('/api/projects/:projectId/documents/:docId/associations/:associationType/:entityId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId, associationType, entityId } = req.params;
      const associations = await storage.getAssociationsByDocument(docId, user.id);
      const match = associations.find(a => a.associationType === associationType && a.entityId === entityId);
      if (!match) {
        return res.status(404).json({ message: 'Association not found' });
      }
      await storage.deleteAssociation(match.id, user.id);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting association:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/document-associations/:assocId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { assocId } = req.params;
      const deleted = await storage.deleteAssociation(assocId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Association not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting association:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // DOCUMENT ANNOTATIONS (append-only notes)
  // ============================================

  app.get('/api/projects/:projectId/documents/:docId/annotations', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, docId } = req.params;
      const rows = await db.select().from(documentAnnotations)
        .where(and(
          eq(documentAnnotations.documentId, docId),
          eq(documentAnnotations.projectId, projectId),
          eq(documentAnnotations.userId, user.id),
        ))
        .orderBy(asc(documentAnnotations.createdAt));
      return res.json({ annotations: rows });
    } catch (error) {
      console.error('Error fetching annotations:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/documents/:docId/annotations', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, docId } = req.params;
      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
      if (!content) {
        return res.status(400).json({ message: 'Annotation content is required' });
      }
      if (content.length > 5000) {
        return res.status(400).json({ message: 'Annotation is too long (max 5000 characters)' });
      }

      const document = await storage.getDocumentById(docId, user.id);
      if (!document || document.projectId !== projectId) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const [created] = await db.insert(documentAnnotations).values({
        documentId: docId,
        projectId,
        userId: user.id,
        content,
        createdBy: user.name || user.email || user.id,
      }).returning();

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error creating annotation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // DOCUMENT ALL-LINKS (2-step deletion: Step 1)
  // Returns ALL links for a document in one structured response
  // ============================================
  app.get('/api/projects/:projectId/documents/:docId/all-links', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId, projectId } = req.params;

      const [associations, sourceDocQuotes] = await Promise.all([
        storage.getAssociationsByDocument(docId, user.id),
        storage.getQuotesLinkedViaSourceDocuments(docId, user.id),
      ]);

      const quoteLinks: { associationId: string; entityId: string; entityLabel: string }[] = [];
      const invoiceLinks: { associationId: string; entityId: string; entityLabel: string }[] = [];

      for (const assoc of associations) {
        if (assoc.associationType === 'quote') {
          quoteLinks.push({ associationId: assoc.id, entityId: assoc.entityId, entityLabel: assoc.entityLabel });
        } else if (assoc.associationType === 'invoice') {
          invoiceLinks.push({ associationId: assoc.id, entityId: assoc.entityId, entityLabel: assoc.entityLabel });
        }
      }

      const existingQuoteEntityIds = new Set(quoteLinks.map(q => q.entityId));

      for (const sdq of sourceDocQuotes) {
        if (!existingQuoteEntityIds.has(sdq.quoteId)) {
          quoteLinks.push({
            associationId: `source-doc-${sdq.sourceDocumentId}`,
            entityId: sdq.quoteId,
            entityLabel: sdq.quoteReference,
          });
          existingQuoteEntityIds.add(sdq.quoteId);
        }
      }

      const hasLinks = quoteLinks.length > 0 || invoiceLinks.length > 0;

      return res.json({ quoteLinks, invoiceLinks, hasLinks });
    } catch (error) {
      console.error('Error getting document all-links:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // DOCUMENT UNLINK (2-step deletion: Step 2)
  // Removes all entity associations, deletes linked quotes/invoices,
  // removes scope allocations. After this, document can be safely deleted.
  // ============================================
  app.post('/api/projects/:projectId/documents/:docId/unlink', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId, projectId } = req.params;

      const result = await unlinkAndDeleteDocument(docId, projectId, user.id, false);

      return res.json({ success: true, unlinkedQuotes: result.unlinkedQuotes, unlinkedInvoices: result.unlinkedInvoices, unlinkedScopes: result.unlinkedScopes });
    } catch (error) {
      console.error('Error unlinking document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // RAG BACKFILL — Index existing documents for AI retrieval
  // ============================================
  app.post('/api/projects/:projectId/documents/rag-backfill', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { backfillProjectDocuments } = await import('../ai/ragPipeline');
      const result = await backfillProjectDocuments(projectId, user.id);
      return res.json(result);
    } catch (error) {
      console.error('Error running RAG backfill:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

}
