/**
 * RENIX vNext — Quotes Routes
 * 
 * Extracted from server/routes.ts
 * Contains all quote-related routes including:
 * - Vendors
 * - Quotes
 * - Quote versions
 * - Source documents
 * - Vendor snapshots
 * - Quote metadata
 * - Quote line items
 * - Quote totals
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { extractFromObjectPath } from "../replit_integrations/document";
import {
  insertVendorSchema,
  insertQuoteSchema,
  insertQuoteVersionSchema,
  insertSourceDocumentSchema,
  insertVendorSnapshotSchema,
  insertQuoteMetadataSchema,
  insertQuoteLineItemSchema,
  insertQuoteTotalSchema,
  quoteAssessments,
  quotes,
  quoteFinancials,
  quoteMetadata,
  quoteLineItems,
  vendorSnapshots,
  budgetAllocations,
  projects,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { completeText, parseJsonLoose, CLAUDE_MODEL } from "../ai/claude";

export function registerQuotesRoutes(app: Express): void {
  // ============================================
  // QUOTES ROUTES
  // ============================================

  app.get('/api/projects/:projectId/scopes/:scopeId/quotes-summary', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, scopeId } = req.params;

      const allQuotes = await storage.getQuotesByProject(projectId, user.id);
      const scopeQuotes = allQuotes.filter(q => q.scopeId === scopeId);

      const vendors = await storage.getVendorsByProject(projectId, user.id);
      const vendorMap = new Map(vendors.map(v => [v.id, v.name]));

      const quoteSummaries = await Promise.all(scopeQuotes.map(async (quote) => {
        const lineageQuotes = allQuotes.filter(q => 
          q.lineageId === (quote.lineageId || quote.id) || q.id === (quote.lineageId || quote.id)
        );
        const lookupId = quote.legacyVersionId || quote.id;
        const financials = await storage.getFinancialsByVersion(lookupId, user.id);
        const snapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
        const vendorName = snapshot?.name || (quote.vendorId ? (vendorMap.get(quote.vendorId) || 'Unknown') : 'Unknown');
        const latestTotal = financials?.grossAmount != null ? financials.grossAmount / 100 : 0;
        return {
          id: quote.id,
          vendorName,
          status: quote.status,
          latestTotal,
          versionCount: lineageQuotes.length,
          versionNumber: quote.versionNumber ?? null,
        };
      }));

      return res.json({ quotes: quoteSummaries });
    } catch (error) {
      console.error('Error fetching quotes summary for scope:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId/quotes', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const vendors = await storage.getVendorsByProject(projectId, user.id);
      const quotes = await storage.getQuotesByProject(projectId, user.id);
      const versionsMap: Record<string, any[]> = {};
      const lineItemsMap: Record<string, any[]> = {};
      const financialsMap: Record<string, any> = {};

      const vendorContactMap = new Map<string, any>();
      for (const quote of quotes) {
        if (quote.vendorId) {
          const lookupId = quote.legacyVersionId || quote.id;
          const snapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
          if (snapshot?.contactDetails) {
            vendorContactMap.set(quote.vendorId, snapshot.contactDetails);
          }
        }
      }
      const enrichedVendors = vendors.map(v => ({
        ...v,
        contactDetails: vendorContactMap.get(v.id) || null,
      }));

      for (const quote of quotes) {
        const legacyVersionId = quote.legacyVersionId || quote.id;
        const quoteFinancials = await storage.getFinancialsByVersion(legacyVersionId, user.id);
        
        if (quoteFinancials) {
          financialsMap[quote.id] = {
            netAmount: quoteFinancials.netAmount != null ? quoteFinancials.netAmount / 100 : null,
            taxRate: quoteFinancials.taxRate ?? null,
            taxAmount: quoteFinancials.taxAmount != null ? quoteFinancials.taxAmount / 100 : null,
            grossAmount: quoteFinancials.grossAmount != null ? quoteFinancials.grossAmount / 100 : null,
            currency: quoteFinancials.currency,
          };
        }

        const canonicalTotal = quoteFinancials?.grossAmount != null
          ? quoteFinancials.grossAmount / 100
          : 0;
        
        const syntheticVersion = {
          id: legacyVersionId,
          quoteId: quote.id,
          projectId: quote.projectId,
          userId: quote.userId,
          sourceDocumentId: quote.sourceDocumentId,
          versionNumber: quote.versionNumber,
          total: canonicalTotal,
          validUntil: quote.validUntil,
          notes: quote.notes,
          extractionStatus: quote.extractionStatus,
          commitmentStatus: quote.commitmentStatus,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
        };
        
        versionsMap[quote.id] = [syntheticVersion];
        
        const lineItems = await storage.getLineItemsByVersion(legacyVersionId, user.id);
        lineItemsMap[legacyVersionId] = lineItems.map((item: any) => ({
          ...item,
          unitPrice: item.unitPrice != null ? item.unitPrice / 100 : null,
          totalPrice: item.totalPrice != null ? item.totalPrice / 100 : null,
        }));
      }
      const normalizedQuotes = quotes.map(q => {
        const lookupId = q.legacyVersionId || q.id;
        const fin = financialsMap[q.id];
        return {
          ...q,
          total: fin?.grossAmount ?? 0,
        };
      });
      return res.json({ vendors: enrichedVendors, quotes: normalizedQuotes, versions: versionsMap, lineItems: lineItemsMap, financials: financialsMap });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vendors', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertVendorSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const vendor = await storage.createVendor(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(vendor);
    } catch (error) {
      console.error('Error creating vendor:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/vendors/:vendorId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { vendorId } = req.params;
      const vendor = await storage.updateVendor(vendorId, user.id, req.body);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(vendor);
    } catch (error) {
      console.error('Error updating vendor:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/vendors/:vendorId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { vendorId } = req.params;
      const deleted = await storage.deleteVendor(vendorId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quotes', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      if (!req.body.sourceDocumentId) {
        return res.status(400).json({ message: 'sourceDocumentId is required — a quote cannot exist without its source document' });
      }
      // All new quotes start in 'new' status per state machine rules
      const parsed = insertQuoteSchema.safeParse({ 
        ...req.body, 
        projectId, 
        userId: user.id,
        status: 'new',  // Always override to 'new' for creation
      });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const quote = await storage.createQuote(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(quote);
    } catch (error) {
      console.error('Error creating quote:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quotes/from-upload', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { uploadToken, fileName, fileType } = req.body;

      if (!uploadToken || !fileName) {
        return res.status(400).json({ message: 'uploadToken and fileName are required' });
      }

      // Validate and consume the upload token
      // Security: Upload tokens bind object paths to project/user at presign time
      const pendingUpload = await storage.getPendingUpload(uploadToken);
      
      if (!pendingUpload) {
        return res.status(400).json({ message: 'Invalid upload token' });
      }
      
      if (pendingUpload.consumed) {
        return res.status(400).json({ message: 'Upload token has already been used' });
      }
      
      if (pendingUpload.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Upload token has expired' });
      }
      
      if (pendingUpload.projectId !== projectId) {
        return res.status(400).json({ message: 'Upload token does not match this project' });
      }
      
      if (pendingUpload.userId !== user.id) {
        return res.status(400).json({ message: 'Upload token does not belong to this user' });
      }

      // Get the object path from the verified token
      const objectPath = pendingUpload.objectPath;

      // Verify the object still exists in storage
      const objectStorage = new ObjectStorageService();
      try {
        await objectStorage.getObjectEntityFile(objectPath);
      } catch (err) {
        console.error('Object verification failed:', err);
        return res.status(400).json({ message: 'Object not found in storage - upload may have failed' });
      }

      // Consume the token (mark as used)
      const consumed = await storage.consumePendingUpload(uploadToken);
      if (!consumed) {
        return res.status(400).json({ message: 'Failed to consume upload token - may have been used concurrently' });
      }

      const sourceDocument = await storage.createSourceDocument({
        projectId,
        userId: user.id,
        fileName,
        fileType: fileType || 'application/octet-stream',
        fileDataUrl: objectPath,
      });

      // Create quote with null vendorId - vendor is populated after extraction
      // Per scope-centric architecture: quotes are document-first, vendor assignment is secondary
      // Status is 'new' until scope is assigned and quote is reviewed
      const { scopeId } = req.body;
      const quote = await storage.createQuote({
        projectId,
        userId: user.id,
        vendorId: null,
        description: `Imported from ${fileName}`,
        status: 'new',
        scopeId: scopeId || null,
        sourceDocumentId: sourceDocument.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        lineageId: undefined,
      });

      const version = await storage.createQuoteVersion({
        projectId,
        userId: user.id,
        quoteId: quote.id,
        sourceDocumentId: sourceDocument.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        notes: `Initial version from document upload`,
      });

      await storage.updateQuote(quote.id, user.id, { legacyVersionId: version.id, lineageId: quote.id });

      // Trigger automatic extraction in the background
      // This runs asynchronously to not block the response
      (async () => {
        try {
          console.log(`[Auto-Extraction] Starting extraction for version ${version.id}, objectPath: ${objectPath}`);
          const extracted = await extractFromObjectPath(objectPath);
          console.log(`[Auto-Extraction] Extraction complete:`, {
            vendorName: extracted.vendorName,
            reference: extracted.reference,
            lineItemCount: extracted.lineItems.length,
            total: extracted.total,
          });

          // Save extracted line items to the database
          if (extracted.lineItems && extracted.lineItems.length > 0) {
            for (let i = 0; i < extracted.lineItems.length; i++) {
              const item = extracted.lineItems[i];
              await storage.createQuoteLineItem({
                projectId,
                userId: user.id,
                quoteVersionId: version.id,
                originalNumber: String(i + 1),
                description: item.description || '',
                quantity: item.quantity ?? null,
                unit: item.unit ?? null,
                unitPrice: item.unitPrice ? Math.round(item.unitPrice * 100) : null,
                totalPrice: item.amount ? Math.round(item.amount * 100) : null,
                lineType: item.lineType || 'item',
              });
            }
            console.log(`[Auto-Extraction] Saved ${extracted.lineItems.length} line items`);
          }

          // Save totals
          if (extracted.subtotal || extracted.total || extracted.tax) {
            await storage.createQuoteTotals({
              projectId,
              userId: user.id,
              quoteVersionId: version.id,
              subtotal: extracted.subtotal ? Math.round(extracted.subtotal * 100) : null,
              totalTax: extracted.tax ? Math.round(extracted.tax * 100) : null,
              grandTotal: extracted.total ? Math.round(extracted.total * 100) : null,
            });
            console.log(`[Auto-Extraction] Saved totals - subtotal: ${extracted.subtotal}, tax: ${extracted.tax}, total: ${extracted.total}`);
          }

          // Save vendor snapshot if vendor info was extracted
          if (extracted.vendorName) {
            await storage.createVendorSnapshot({
              projectId,
              userId: user.id,
              quoteVersionId: version.id,
              name: extracted.vendorName,
              confidence: 'high',
              contactDetails: {
                address: extracted.vendorAddress ?? null,
                email: extracted.vendorEmail ?? null,
                phone: extracted.vendorPhone ?? null,
                contact: extracted.vendorContact ?? null,
              },
            });
            console.log(`[Auto-Extraction] Saved vendor snapshot: ${extracted.vendorName}`);
          }

          // Save quote metadata
          if (extracted.reference || extracted.date || extracted.currency) {
            await storage.createQuoteMetadata({
              projectId,
              userId: user.id,
              quoteVersionId: version.id,
              quoteNumber: extracted.reference ?? null,
              quoteDate: extracted.date ? new Date(extracted.date) : null,
              currency: extracted.currency ?? 'EUR',
            });
            console.log(`[Auto-Extraction] Saved quote metadata - ref: ${extracted.reference}, date: ${extracted.date}`);
          }

          console.log(`[Auto-Extraction] Complete for version ${version.id}`);
        } catch (extractionError) {
          console.error(`[Auto-Extraction] Error extracting from ${objectPath}:`, extractionError);
          // Don't fail the upload - extraction errors are logged but don't block the workflow
        }
      })();

      invalidateOverviewCache(projectId);
      return res.status(201).json({
        quote: {
          id: quote.id,
          vendorId: quote.vendorId,
        },
        version: {
          id: version.id,
          versionNumber: version.versionNumber,
          sourceDocumentId: sourceDocument.id,
        },
        sourceDocument: {
          id: sourceDocument.id,
          fileName: sourceDocument.fileName,
          fileType: sourceDocument.fileType,
          fileDataUrl: objectPath,
        },
      });
    } catch (error) {
      console.error('Error creating quote from upload:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create quote from an existing document (Document Backbone model)
  app.post('/api/projects/:projectId/quotes/from-existing-document', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { documentId } = req.body;

      // Validate required input
      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ message: 'documentId is required and must be a string' });
      }

      // Security: Fetch documents scoped to this project AND user only
      // This ensures users cannot access documents from other projects
      const documents = await storage.getDocumentsByProject(projectId, user.id);
      const existingDoc = documents.find(d => d.id === documentId);
      
      if (!existingDoc) {
        return res.status(404).json({ message: 'Document not found in this project' });
      }

      // Validate that the document has required fields
      if (!existingDoc.fileName) {
        return res.status(400).json({ message: 'Document is missing required fileName' });
      }

      // Create source document record that links to the existing document
      const sourceDocData = {
        projectId,
        userId: user.id,
        fileName: existingDoc.fileName,
        fileType: existingDoc.mimeType || 'application/octet-stream',
        fileDataUrl: existingDoc.fileDataUrl || null,
        documentId: documentId, // Link to the Document Backbone
      };
      
      // Validate source document data
      const sourceDocParsed = insertSourceDocumentSchema.safeParse(sourceDocData);
      if (!sourceDocParsed.success) {
        console.error('Source document validation failed:', sourceDocParsed.error.errors);
        return res.status(400).json({ message: 'Invalid document data', errors: sourceDocParsed.error.errors });
      }
      
      const sourceDocument = await storage.createSourceDocument(sourceDocParsed.data);

      // Create quote data with validation
      // Status is 'new' until scope is assigned and quote is reviewed
      const { scopeId } = req.body;
      const quoteData = {
        projectId,
        userId: user.id,
        vendorId: null,
        description: `From existing document: ${existingDoc.title || existingDoc.fileName}`,
        status: 'new' as const,
        scopeId: scopeId || null,
        sourceDocumentId: sourceDocument.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
      };
      
      const quoteParsed = insertQuoteSchema.safeParse(quoteData);
      if (!quoteParsed.success) {
        console.error('Quote validation failed:', quoteParsed.error.errors);
        return res.status(400).json({ message: 'Invalid quote data', errors: quoteParsed.error.errors });
      }
      
      const quote = await storage.createQuote(quoteParsed.data);

      const version = await storage.createQuoteVersion({
        projectId,
        userId: user.id,
        quoteId: quote.id,
        sourceDocumentId: sourceDocument.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        notes: `Created from existing document: ${documentId}`,
      });

      await storage.updateQuote(quote.id, user.id, { legacyVersionId: version.id, lineageId: quote.id });

      invalidateOverviewCache(projectId);
      return res.status(201).json({
        quote: {
          id: quote.id,
          vendorId: quote.vendorId,
        },
        version: {
          id: version.id,
          versionNumber: version.versionNumber,
          sourceDocumentId: sourceDocument.id,
        },
        sourceDocument: {
          id: sourceDocument.id,
          fileName: sourceDocument.fileName,
          fileType: sourceDocument.fileType,
          fileDataUrl: existingDoc.fileDataUrl,
        },
      });
    } catch (error) {
      console.error('Error creating quote from existing document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/quotes/:quoteId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { quoteId } = req.params;
      
      // Validate update payload with Zod partial schema
      const updateSchema = insertQuoteSchema.partial().omit({ projectId: true, userId: true });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid update data', errors: parsed.error.errors });
      }
      
      const updates = parsed.data;
      
      // Validate status transitions if status is being changed
      if (updates.status) {
        const existingQuote = await storage.getQuoteById(quoteId, user.id);
        if (!existingQuote) {
          return res.status(404).json({ message: 'Quote not found' });
        }
        
        // State machine: new -> draft -> committed -> accepted
        // new: Initial state, awaiting scope assignment and review
        // draft: Scope assigned, under review
        // committed: Binding quote, no longer editable
        // accepted: Formally accepted by user
        const validTransitions: Record<string, string[]> = {
          'new': ['draft'],           // Can only transition to draft (scope assigned)
          'draft': ['committed'],     // Can only transition to committed
          'committed': ['accepted'],  // Can only transition to accepted
          'accepted': [],             // Terminal state
        };
        
        const currentStatus = existingQuote.status;
        const newStatus = updates.status;
        
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
          return res.status(400).json({ 
            message: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
            validTransitions: validTransitions[currentStatus] || []
          });
        }
        
        // When transitioning from 'new' to 'draft', scope must be assigned
        if (currentStatus === 'new' && newStatus === 'draft') {
          const scopeId = updates.scopeId || existingQuote.scopeId;
          if (!scopeId) {
            return res.status(400).json({ 
              message: 'Scope must be assigned before transitioning from new to draft',
              hint: 'Include scopeId in the request or update scopeId first'
            });
          }
        }
      }
      
      const quote = await storage.updateQuote(quoteId, user.id, updates);
      if (!quote) {
        return res.status(404).json({ message: 'Quote not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(quote);
    } catch (error) {
      console.error('Error updating quote:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/quotes/:quoteId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { quoteId } = req.params;
      await storage.cleanupEntityDocuments('quote', quoteId, user.id);

      const deleted = await storage.deleteQuote(quoteId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Quote not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting quote:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quotes/:quoteId/versions', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, quoteId } = req.params;
      const parsed = insertQuoteVersionSchema.safeParse({ ...req.body, projectId, quoteId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const version = await storage.createQuoteVersion(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(version);
    } catch (error) {
      console.error('Error creating quote version:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/quote-versions/:versionId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { versionId } = req.params;
      const version = await storage.updateQuoteVersion(versionId, user.id, req.body);
      if (!version) {
        return res.status(404).json({ message: 'Quote version not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(version);
    } catch (error) {
      console.error('Error updating quote version:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // QUOTE VERSION COMMIT (Authoritative Spec Section 7)
  // "Commit" means: "I confirm this extracted structure matches the document."
  // It does NOT: Accept the quote, Lock edits, or Trigger budget changes.
  // ============================================
  app.post('/api/projects/:projectId/quote-versions/:versionId/commit', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;

      const flatQuote = await storage.getQuoteByLegacyVersionId(versionId, user.id);

      if (flatQuote && flatQuote.lineageId) {
        const allProjectQuotes = await storage.getQuotesByProject(projectId, user.id);
        const lineageSiblings = allProjectQuotes.filter(
          (q: any) => q.lineageId === flatQuote.lineageId && q.id !== flatQuote.id && q.commitmentStatus === 'active'
        );
        for (const sibling of lineageSiblings) {
          await storage.updateQuote(sibling.id, user.id, { commitmentStatus: 'superseded' });
          if (sibling.legacyVersionId) {
            await storage.updateQuoteVersion(sibling.legacyVersionId, user.id, { commitmentStatus: 'superseded' }).catch(() => {});
          }
          console.log(`[Commit] Superseded lineage sibling quote ${sibling.id} in lineage ${flatQuote.lineageId}`);
        }
      }

      const version = await storage.updateQuoteVersion(versionId, user.id, {
        extractionStatus: 'verified',
        commitmentStatus: 'active',
      });
      
      if (!version) {
        return res.status(404).json({ message: 'Quote version not found' });
      }

      if (flatQuote) {
        await storage.updateQuote(flatQuote.id, user.id, {
          extractionStatus: 'verified',
          commitmentStatus: 'active',
        });
      }
      
      const deletedCount = await storage.deleteSubtotalAndTotalLineItems(versionId, user.id);
      if (deletedCount > 0) {
        console.log(`[Verification Cleanup] Removed ${deletedCount} subtotal/total line items from version ${versionId}`);
      }

      invalidateOverviewCache(projectId);
      return res.json({ success: true, version });
    } catch (error) {
      console.error('Error committing quote version:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // UPDATE VERSION STATUS (two-axis enum model)
  // ============================================
  app.patch('/api/projects/:projectId/versions/:versionId/status', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const { extractionStatus, commitmentStatus } = req.body;

      if (!extractionStatus && !commitmentStatus) {
        return res.status(400).json({ message: 'At least one of extractionStatus or commitmentStatus must be provided' });
      }

      if (extractionStatus && !['draft', 'verified'].includes(extractionStatus)) {
        return res.status(400).json({ message: 'extractionStatus must be "draft" or "verified"' });
      }

      if (commitmentStatus && !['active', 'superseded', 'accepted'].includes(commitmentStatus)) {
        return res.status(400).json({ message: 'commitmentStatus must be "active", "superseded", or "accepted"' });
      }

      if (commitmentStatus && !extractionStatus) {
        const existingVersion = await storage.getQuoteVersionById(versionId, user.id);
        const existingQuote = await storage.getQuoteByLegacyVersionId(versionId, user.id);
        const currentExtractionStatus = existingVersion?.extractionStatus || existingQuote?.extractionStatus;
        if (currentExtractionStatus !== 'verified') {
          return res.status(400).json({ message: 'Cannot set commitmentStatus on an unverified quote. Verify the extraction first.' });
        }
      }

      let effectiveCommitmentStatus = commitmentStatus;
      if (extractionStatus === 'verified' && !commitmentStatus) {
        effectiveCommitmentStatus = 'active';
      }

      const flatQuote = await storage.getQuoteByLegacyVersionId(versionId, user.id);

      if (effectiveCommitmentStatus === 'active' && flatQuote && flatQuote.scopeId) {
        const allProjectQuotes = await storage.getQuotesByProject(projectId, user.id);
        const scopeSiblings = allProjectQuotes.filter(
          (q: any) => q.scopeId === flatQuote.scopeId && q.id !== flatQuote.id && q.commitmentStatus === 'active'
        );
        for (const sibling of scopeSiblings) {
          await storage.updateQuote(sibling.id, user.id, { commitmentStatus: 'superseded' });
          if (sibling.legacyVersionId) {
            await storage.updateVersionStatus(sibling.legacyVersionId, user.id, { commitmentStatus: 'superseded' }).catch(() => {});
          }
        }
      }

      const version = await storage.updateVersionStatus(versionId, user.id, {
        extractionStatus,
        commitmentStatus: effectiveCommitmentStatus,
      });

      if (flatQuote) {
        const flatUpdates: Record<string, any> = {};
        if (extractionStatus) {
          flatUpdates.extractionStatus = extractionStatus;
          if (extractionStatus === 'verified') {
            const deletedCount = await storage.deleteSubtotalAndTotalLineItems(versionId, user.id);
            if (deletedCount > 0) {
              console.log(`[Verification Cleanup] Removed ${deletedCount} subtotal/total line items from version ${versionId}`);
            }
          }
        }
        if (effectiveCommitmentStatus) {
          flatUpdates.commitmentStatus = effectiveCommitmentStatus;
        }
        await storage.updateQuote(flatQuote.id, user.id, flatUpdates);
      } else if (!version) {
        return res.status(404).json({ message: 'Quote version not found' });
      }

      invalidateOverviewCache(projectId);
      return res.json({ success: true, version: version || flatQuote });
    } catch (error: any) {
      if (error.message?.includes('Cannot set')) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error updating version status:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // QUOTE VERSION EXTRACTION DATA
  // Returns document URL and extracted data for ExtractionReviewScreen
  // ============================================
  app.get('/api/projects/:projectId/quote-versions/:versionId/extraction', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      
      let version = await storage.getQuoteVersionById(versionId, user.id);
      let lookupId = versionId;
      let sourceDocumentId: string | null = null;
      let quoteId: string | null = null;
      let flatQuote: any = null;
      
      if (version) {
        sourceDocumentId = version.sourceDocumentId;
        quoteId = version.quoteId;
      } else {
        flatQuote = await storage.getQuoteById(versionId, user.id);
        if (!flatQuote) {
          return res.status(404).json({ message: 'Quote version not found' });
        }
        lookupId = flatQuote.legacyVersionId || versionId;
        sourceDocumentId = flatQuote.sourceDocumentId;
        quoteId = flatQuote.id;
      }
      
      let sourceDoc = null;
      if (sourceDocumentId) {
        const allDocs = await storage.getSourceDocumentsByProject(projectId, user.id);
        sourceDoc = allDocs.find(d => d.id === sourceDocumentId) || null;
      }
      
      const lineItems = await storage.getLineItemsByVersion(lookupId, user.id);
      
      let metadata = await storage.getQuoteMetadataByVersion(lookupId, user.id);
      const totals = await storage.getTotalsByVersion(lookupId, user.id);
      let vendorSnapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
      
      const financials = await storage.getFinancialsByVersion(lookupId, user.id)
        || (quoteId ? await storage.getFinancialsByQuote(quoteId, user.id) : null);
      
      const hasVendorData = !!(vendorSnapshot?.name);
      const hasHeaderData = !!(metadata?.quoteNumber || metadata?.quoteDate);

      if (!hasVendorData || !hasHeaderData) {
        const lineageId = flatQuote?.lineageId || (version as any)?.quoteId;
        if (lineageId) {
          const allProjectQuotes = await storage.getQuotesByProject(projectId, user.id);
          const lineageQuotes = allProjectQuotes.filter((q: any) => 
            (q.lineageId === lineageId || q.id === lineageId) && q.id !== versionId
          );
          for (const prevQ of lineageQuotes) {
            const prevLookupId = (prevQ as any).legacyVersionId || prevQ.id;
            if (!hasVendorData && !vendorSnapshot?.name) {
              const prevVendor = await storage.getVendorSnapshotByVersion(prevLookupId, user.id);
              if (prevVendor?.name) {
                vendorSnapshot = prevVendor;
                console.log(`[Extraction] Inherited vendor data from lineage version ${prevQ.id}: ${prevVendor.name}`);
              }
            }
            if (!hasHeaderData && !(metadata?.quoteNumber || metadata?.quoteDate)) {
              const prevMeta = await storage.getQuoteMetadataByVersion(prevLookupId, user.id);
              if (prevMeta?.quoteNumber || prevMeta?.quoteDate) {
                metadata = { ...metadata, ...prevMeta, id: metadata?.id || prevMeta.id } as any;
                console.log(`[Extraction] Inherited header data from lineage version ${prevQ.id}`);
              }
            }
            if (vendorSnapshot?.name && (metadata?.quoteNumber || metadata?.quoteDate)) break;
          }
        }
      }

      let documentUrl = '';
      if (sourceDoc?.objectStoragePath) {
        documentUrl = sourceDoc.objectStoragePath;
      } else if (sourceDoc?.fileDataUrl) {
        documentUrl = sourceDoc.fileDataUrl;
      }
      
      const buildTree = () => {
        if (lineItems && lineItems.length > 0) {
          return lineItems.map((item: any, index: number) => ({
            id: item.id || `item-${index}`,
            number: item.originalNumber || String(index + 1),
            rowType: 'item' as const,
            description: item.description || '',
            quantity: item.quantity ?? null,
            unit: item.unit ?? null,
            unitPrice: item.unitPrice ? item.unitPrice / 100 : null,
            totalPrice: item.totalPrice ? item.totalPrice / 100 : null,
            children: [],
          }));
        }
        return [];
      };
      
      let extractedData: any = {
        vendorName: vendorSnapshot?.name || null,
        vendorContact: (vendorSnapshot?.contactDetails as any)?.contact || null,
        vendorEmail: (vendorSnapshot?.contactDetails as any)?.email || null,
        vendorPhone: (vendorSnapshot?.contactDetails as any)?.phone || null,
        vendorAddress: (vendorSnapshot?.contactDetails as any)?.address || null,
        vendorConfidence: vendorSnapshot?.name ? 'high' : undefined,
        quoteReference: metadata?.quoteNumber || null,
        quoteDate: metadata?.quoteDate ? metadata.quoteDate.toISOString().split('T')[0] : null,
        validUntil: metadata?.validUntil ? metadata.validUntil.toISOString().split('T')[0] : null,
        currency: metadata?.currency || financials?.currency || 'EUR',
        notes: null,
        tree: buildTree(),
        financials: {
          netTotal: financials?.netAmount 
            ? financials.netAmount / 100 
            : (totals?.subtotal ? totals.subtotal / 100 : null),
          taxAmount: financials?.taxAmount 
            ? financials.taxAmount / 100 
            : (totals?.totalTax ? totals.totalTax / 100 : null),
          grossTotal: financials?.grossAmount 
            ? financials.grossAmount / 100 
            : (totals?.grandTotal 
                ? totals.grandTotal / 100 
                : null),
          taxRate: financials?.taxRate ?? null,
          taxLabel: null,
        },
      };

      const stillMissingVendor = !extractedData.vendorName;
      const stillMissingHeader = !extractedData.quoteReference && !extractedData.quoteDate;
      
      if ((stillMissingVendor || stillMissingHeader) && documentUrl) {
        try {
          console.log(`[Extraction] Server-side re-extraction from PDF: ${documentUrl}`);
          const reExtracted = await extractFromObjectPath(documentUrl);
          console.log(`[Extraction] Re-extraction result: vendor=${reExtracted.vendorName}, ref=${reExtracted.reference}, date=${reExtracted.date}`);
          
          let enrichedVendor = false;
          let enrichedHeader = false;
          
          if (stillMissingVendor && reExtracted.vendorName) {
            extractedData.vendorName = reExtracted.vendorName;
            extractedData.vendorContact = reExtracted.vendorContact || null;
            extractedData.vendorEmail = reExtracted.vendorEmail || null;
            extractedData.vendorPhone = reExtracted.vendorPhone || null;
            extractedData.vendorConfidence = 'high';
            enrichedVendor = true;
          }
          if (!extractedData.quoteReference && reExtracted.reference) {
            extractedData.quoteReference = reExtracted.reference;
            enrichedHeader = true;
          }
          if (!extractedData.quoteDate && reExtracted.date) {
            extractedData.quoteDate = reExtracted.date;
            enrichedHeader = true;
          }
          if (!extractedData.validUntil && reExtracted.validUntil) {
            extractedData.validUntil = reExtracted.validUntil;
            enrichedHeader = true;
          }

          if (enrichedVendor) {
            const contactDetails = {
              contact: extractedData.vendorContact,
              email: extractedData.vendorEmail,
              phone: extractedData.vendorPhone,
            };
            const existingSnapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
            if (existingSnapshot) {
              await storage.updateVendorSnapshot(existingSnapshot.id, user.id, {
                name: extractedData.vendorName,
                contactDetails,
                confidence: 'high',
              });
            } else {
              await storage.createVendorSnapshot({
                quoteVersionId: lookupId,
                projectId,
                userId: user.id,
                name: extractedData.vendorName,
                contactDetails,
                confidence: 'high',
              });
            }
            console.log(`[Extraction] Persisted enriched vendor: ${extractedData.vendorName}`);
          }
          
          if (enrichedHeader) {
            const existingMeta = await storage.getQuoteMetadataByVersion(lookupId, user.id);
            if (existingMeta) {
              await storage.updateQuoteMetadata(existingMeta.id, user.id, {
                quoteNumber: extractedData.quoteReference || existingMeta.quoteNumber,
                quoteDate: extractedData.quoteDate ? new Date(extractedData.quoteDate) : existingMeta.quoteDate,
                validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : existingMeta.validUntil,
              });
            } else {
              try {
                await storage.createQuoteMetadata({
                  quoteVersionId: lookupId,
                  projectId,
                  userId: user.id,
                  quoteNumber: extractedData.quoteReference,
                  quoteDate: extractedData.quoteDate ? new Date(extractedData.quoteDate) : null,
                  validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
                  currency: extractedData.currency || 'EUR',
                  nativeExtractionData: null,
                });
              } catch (e) {
                console.error('[Extraction] Failed to create metadata:', e);
              }
            }
            console.log(`[Extraction] Persisted enriched header: ref=${extractedData.quoteReference}, date=${extractedData.quoteDate}`);
          }
        } catch (reExtractError) {
          console.error('[Extraction] Server-side re-extraction failed:', reExtractError);
        }
      }
      
      return res.json({
        documentId: sourceDocumentId,
        documentUrl,
        extractedData,
        nativeExtractionData: metadata?.nativeExtractionData || null,
      });
    } catch (error) {
      console.error('Error fetching extraction data:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });


  // ============================================
  // QUOTE EXTRACTED DATA - BULK SAVE
  // Persists AI-extracted (or user-edited) quote data to database
  // Uses canonical tables: quote_versions, quote_totals, quote_metadata, 
  // vendor_snapshots, quote_line_items
  // ============================================

  // Helper to convert currency amount to cents (integer)
  const toCents = (amount: number | undefined): number | undefined => {
    if (amount === undefined || amount === null) return undefined;
    return Math.round(amount * 100);
  };

  app.put('/api/projects/:projectId/quote-versions/:versionId/extracted-data', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const { 
        vendorName, vendorContact, vendorEmail, vendorPhone, vendorAddress,
        reference, date, validUntil,
        subtotal, tax, taxRate, total, currency, notes,
        lineItems, nativeExtractionData
      } = req.body;

      // Resolve lookupId: try old quoteVersions table, fall back to flat quotes table
      let lookupId = versionId;
      let updatedVersion: any = null;
      let resolvedQuoteId: string | null = null;

      const oldVersion = await storage.getQuoteVersionById(versionId, user.id);
      if (oldVersion) {
        lookupId = versionId;
        resolvedQuoteId = oldVersion.quoteId;
        updatedVersion = oldVersion;
      } else {
        const flatQuote = await storage.getQuoteById(versionId, user.id);
        if (!flatQuote) {
          return res.status(404).json({ message: 'Quote version not found' });
        }
        lookupId = flatQuote.legacyVersionId || versionId;
        resolvedQuoteId = flatQuote.id;
        updatedVersion = flatQuote;
      }
      if (!updatedVersion) {
        return res.status(404).json({ message: 'Quote version not found' });
      }

      // 2. Update or create vendor snapshot (canonical)
      if (vendorName) {
        const contactDetails = { contact: vendorContact, email: vendorEmail, phone: vendorPhone, address: vendorAddress };
        const existingSnapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
        if (existingSnapshot) {
          await storage.updateVendorSnapshot(existingSnapshot.id, user.id, {
            name: vendorName,
            contactDetails,
            confidence: 'high',
          });
        } else {
          await storage.createVendorSnapshot({
            quoteVersionId: lookupId,
            projectId,
            userId: user.id,
            name: vendorName,
            contactDetails,
            confidence: 'high',
          });
        }
      }

      // 4. Create/update quote metadata
      if (date || validUntil || currency || reference || nativeExtractionData) {
        const existingMetadata = await storage.getQuoteMetadataByVersion(lookupId, user.id);
        if (existingMetadata) {
          await storage.updateQuoteMetadata(existingMetadata.id, user.id, {
            quoteNumber: reference || existingMetadata.quoteNumber,
            quoteDate: date ? new Date(date) : existingMetadata.quoteDate,
            validUntil: validUntil ? new Date(validUntil) : existingMetadata.validUntil,
            currency: currency || existingMetadata.currency,
            nativeExtractionData: nativeExtractionData || existingMetadata.nativeExtractionData,
          });
        } else {
          try {
            await storage.createQuoteMetadata({
              quoteVersionId: lookupId,
              projectId,
              userId: user.id,
              quoteNumber: reference,
              quoteDate: date ? new Date(date) : null,
              validUntil: validUntil ? new Date(validUntil) : null,
              currency: currency || 'EUR',
              nativeExtractionData: nativeExtractionData || null,
            });
          } catch (e) {
            // Metadata may already exist, ignore error
          }
        }
      }

      // 5. Create/update quote totals
      if (subtotal !== undefined || tax !== undefined || total !== undefined) {
        const existingTotals = await storage.getTotalsByVersion(lookupId, user.id);
        const totalsData = {
          subtotal: toCents(subtotal),
          totalTax: toCents(tax),
          grandTotal: toCents(total),
        };
        
        if (existingTotals) {
          await storage.updateQuoteTotals(existingTotals.id, user.id, totalsData);
        } else {
          try {
            await storage.createQuoteTotals({
              quoteVersionId: lookupId,
              projectId,
              userId: user.id,
              ...totalsData,
            });
          } catch (e) {
            // Totals may already exist, ignore error
          }
        }
      }

      // 6. Update quote_line_items (canonical table for structured line items)
      if (lineItems && Array.isArray(lineItems)) {
        const existingLineItems = await storage.getLineItemsByVersion(lookupId, user.id);
        for (const item of existingLineItems) {
          await storage.deleteQuoteLineItem(item.id, user.id);
        }
        
        for (const item of lineItems) {
          const unitPriceCents = toCents(item.unitPrice);
          const totalPriceCents = toCents(item.amount);
          await storage.createQuoteLineItem({
            quoteVersionId: lookupId,
            projectId,
            userId: user.id,
            originalNumber: item.originalNumber || null,
            description: item.description || 'Unnamed item',
            quantity: item.quantity ?? null,
            unit: item.unit || null,
            unitPrice: unitPriceCents ?? null,
            totalPrice: totalPriceCents ?? null,
            lineType: item.lineType || 'item',
          });
        }
      }

      const lineItemsResult = await storage.getLineItemsByVersion(lookupId, user.id);

      invalidateOverviewCache(projectId);
      return res.json({ 
        success: true, 
        version: updatedVersion,
        lineItemsCount: lineItemsResult.length,
      });
    } catch (error) {
      console.error('Error saving extracted quote data:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // SOURCE DOCUMENTS ROUTES
  // ============================================

  app.get('/api/projects/:projectId/source-documents', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const docs = await storage.getSourceDocumentsByProject(projectId, user.id);
      return res.json(docs);
    } catch (error) {
      console.error('Error fetching source documents:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/source-documents', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertSourceDocumentSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const doc = await storage.createSourceDocument(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(doc);
    } catch (error) {
      console.error('Error creating source document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/source-documents/:docId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { docId } = req.params;
      const deleted = await storage.deleteSourceDocument(docId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Source document not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting source document:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // VENDOR SNAPSHOTS ROUTES
  // ============================================

  app.get('/api/projects/:projectId/quote-versions/:versionId/vendor-snapshot', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { versionId } = req.params;
      const snapshot = await storage.getVendorSnapshotByVersion(versionId, user.id);
      return res.json(snapshot);
    } catch (error) {
      console.error('Error fetching vendor snapshot:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quote-versions/:versionId/vendor-snapshot', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const parsed = insertVendorSnapshotSchema.safeParse({ ...req.body, projectId, quoteVersionId: versionId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const snapshot = await storage.createVendorSnapshot(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(snapshot);
    } catch (error) {
      console.error('Error creating vendor snapshot:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // QUOTE METADATA ROUTES
  // ============================================

  app.get('/api/projects/:projectId/quote-versions/:versionId/metadata', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { versionId } = req.params;
      const metadata = await storage.getQuoteMetadataByVersion(versionId, user.id);
      return res.json(metadata);
    } catch (error) {
      console.error('Error fetching quote metadata:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quote-versions/:versionId/metadata', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const parsed = insertQuoteMetadataSchema.safeParse({ ...req.body, projectId, quoteVersionId: versionId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const metadata = await storage.createQuoteMetadata(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(metadata);
    } catch (error) {
      console.error('Error creating quote metadata:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/quote-metadata/:metaId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { metaId } = req.params;
      const metadata = await storage.updateQuoteMetadata(metaId, user.id, req.body);
      if (!metadata) {
        return res.status(404).json({ message: 'Quote metadata not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(metadata);
    } catch (error) {
      console.error('Error updating quote metadata:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // QUOTE LINE ITEMS ROUTES
  // ============================================

  app.get('/api/projects/:projectId/quote-versions/:versionId/line-items', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { versionId } = req.params;
      const items = await storage.getLineItemsByVersion(versionId, user.id);
      return res.json(items.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice != null ? item.unitPrice / 100 : item.unitPrice,
        totalPrice: item.totalPrice != null ? item.totalPrice / 100 : item.totalPrice,
      })));
    } catch (error) {
      console.error('Error fetching quote line items:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quote-versions/:versionId/line-items', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const parsed = insertQuoteLineItemSchema.safeParse({ ...req.body, projectId, quoteVersionId: versionId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const item = await storage.createQuoteLineItem(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(item);
    } catch (error) {
      console.error('Error creating quote line item:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/quote-line-items/:itemId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { itemId } = req.params;
      const item = await storage.updateQuoteLineItem(itemId, user.id, req.body);
      if (!item) {
        return res.status(404).json({ message: 'Quote line item not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({
        ...item,
        unitPrice: item.unitPrice != null ? item.unitPrice / 100 : item.unitPrice,
        totalPrice: item.totalPrice != null ? item.totalPrice / 100 : item.totalPrice,
      });
    } catch (error) {
      console.error('Error updating quote line item:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/quote-line-items/:itemId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { itemId } = req.params;
      const deleted = await storage.deleteQuoteLineItem(itemId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Quote line item not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting quote line item:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // QUOTE TOTALS ROUTES
  // ============================================

  app.get('/api/projects/:projectId/quote-versions/:versionId/totals', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { versionId } = req.params;
      const totals = await storage.getTotalsByVersion(versionId, user.id);
      if (totals) {
        return res.json({
          ...totals,
          subtotal: totals.subtotal != null ? totals.subtotal / 100 : totals.subtotal,
          totalTax: totals.totalTax != null ? totals.totalTax / 100 : totals.totalTax,
          grandTotal: totals.grandTotal != null ? totals.grandTotal / 100 : totals.grandTotal,
        });
      }
      return res.json(totals);
    } catch (error) {
      console.error('Error fetching quote totals:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quote-versions/:versionId/totals', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, versionId } = req.params;
      const parsed = insertQuoteTotalSchema.safeParse({ ...req.body, projectId, quoteVersionId: versionId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const total = await storage.createQuoteTotals(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(total);
    } catch (error) {
      console.error('Error creating quote totals:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/quote-totals/:totalId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { totalId } = req.params;
      const total = await storage.updateQuoteTotals(totalId, user.id, req.body);
      if (!total) {
        return res.status(404).json({ message: 'Quote totals not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(total);
    } catch (error) {
      console.error('Error updating quote totals:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // AI Assessment for a quote
  app.get('/api/projects/:projectId/quotes/:quoteId/assessment', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, quoteId } = req.params;

      const [quoteRow] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.projectId, projectId)));
      if (!quoteRow) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      const lookupId = quoteRow.legacyVersionId || quoteRow.id;

      const [financials] = await db.select().from(quoteFinancials).where(eq(quoteFinancials.quoteId, quoteId));

      const siblingQuotes = quoteRow.scopeId
        ? await db.select().from(quotes).where(and(eq(quotes.projectId, projectId), eq(quotes.scopeId, quoteRow.scopeId!)))
        : [];
      const siblings = siblingQuotes.filter(q => q.id !== quoteId);

      let budgetAmount = 0;
      if (quoteRow.scopeId) {
        const allocations = await db.select().from(budgetAllocations).where(
          and(
            eq(budgetAllocations.projectId, projectId),
            sql`${budgetAllocations.target}->>'scopeId' = ${quoteRow.scopeId}`
          )
        );
        budgetAmount = allocations.reduce((sum, a) => sum + (a.amount ?? 0), 0);
      }

      const [meta] = await db.select().from(quoteMetadata).where(eq(quoteMetadata.quoteVersionId, lookupId));
      const lineItemRows = await db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteVersionId, lookupId));
      const [vendorSnap] = await db.select().from(vendorSnapshots).where(eq(vendorSnapshots.quoteVersionId, lookupId));

      const grossAmount = financials?.grossAmount ?? 0;
      const netAmount = financials?.netAmount ?? 0;
      const taxAmount = financials?.taxAmount ?? 0;
      const lineItemHash = lineItemRows.map(li => `${li.description}:${li.totalPrice ?? 0}`).join(',');
      const contextHashInput = [
        grossAmount, netAmount, taxAmount,
        quoteRow.scopeId || '',
        siblings.length, budgetAmount,
        vendorSnap?.name || '',
        meta?.validUntil ? new Date(meta.validUntil).toISOString() : '',
        meta?.quoteNumber || '',
        lineItemRows.length, lineItemHash,
      ].join('|');
      let hash = 0;
      for (let i = 0; i < contextHashInput.length; i++) {
        const char = contextHashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      const contextHash = String(hash);

      const [cached] = await db.select().from(quoteAssessments).where(eq(quoteAssessments.quoteId, quoteId));
      if (cached && cached.contextHash === contextHash) {
        return res.json({
          assessment: cached.assessment,
          cached: true,
          generatedAt: cached.createdAt.toISOString(),
        });
      }

      let siblingFinancials: { grossAmount: number | null }[] = [];
      if (siblings.length > 0) {
        siblingFinancials = await Promise.all(
          siblings.map(async (s) => {
            const [sf] = await db.select().from(quoteFinancials).where(eq(quoteFinancials.quoteId, s.id));
            return { grossAmount: sf?.grossAmount ?? null };
          })
        );
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      const regional = project?.regionalContext as any;
      const currencySymbol = regional?.currencySymbol || regional?.currency || '\u20AC';

      const grossDisplay = grossAmount / 100;
      const netDisplay = netAmount / 100;

      let contextBlock = `Quote: ${currencySymbol}${grossDisplay.toLocaleString()} gross`;
      if (vendorSnap) contextBlock += ` from ${vendorSnap.name}`;
      if (meta?.quoteNumber) contextBlock += ` (Ref: ${meta.quoteNumber})`;
      if (meta?.validUntil) contextBlock += `, valid until ${new Date(meta.validUntil).toLocaleDateString()}`;
      if (meta?.currency) contextBlock += `, currency: ${meta.currency}`;
      contextBlock += `\nNet: ${currencySymbol}${netDisplay.toLocaleString()}`;
      contextBlock += `\nLine items: ${lineItemRows.length}`;

      if (lineItemRows.length > 0) {
        const topItems = lineItemRows.slice(0, 5).map(li =>
          `- ${li.description}: ${currencySymbol}${((li.totalPrice ?? 0) / 100).toLocaleString()}`
        ).join('\n');
        contextBlock += `\n${topItems}`;
      }

      if (budgetAmount > 0) {
        contextBlock += `\nBudget allocated for this scope: ${currencySymbol}${budgetAmount.toLocaleString()}`;
        const diff = grossDisplay - budgetAmount;
        const pct = ((diff / budgetAmount) * 100).toFixed(1);
        contextBlock += ` (quote is ${diff >= 0 ? '+' : ''}${pct}% vs budget)`;
      }

      if (siblings.length > 0) {
        contextBlock += `\nSibling quotes for same scope: ${siblings.length}`;
        siblingFinancials.forEach((sf, i) => {
          if (sf.grossAmount != null) {
            contextBlock += `\n- Sibling ${i + 1}: ${currencySymbol}${(sf.grossAmount / 100).toLocaleString()} gross`;
          }
        });
      }

      const model = CLAUDE_MODEL;

      const assessment = await completeText({
        system: `You are a construction project financial analyst. Write exactly 2-3 sentences as a single paragraph. Use markdown **bold** for key figures and terms. Cover the most relevant of: budget alignment (% over/under), competitive position (if sibling quotes exist), line item clarity concerns (vague lump-sum items), validity/expiry status. Be observational, never prescriptive — state facts, never give advice. Use the currency symbol: ${currencySymbol}`,
        messages: [{ role: 'user', content: contextBlock }],
        effort: 'low',
      });

      await db.delete(quoteAssessments).where(eq(quoteAssessments.quoteId, quoteId));
      await db.insert(quoteAssessments).values({
        quoteId,
        projectId,
        userId: user.id,
        assessment,
        model,
        contextHash,
      });

      return res.json({
        assessment,
        cached: false,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating quote assessment:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/quotes/compare-insight', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const user = (req as any).user;
      const { quoteIds } = req.body;

      if (!Array.isArray(quoteIds) || quoteIds.length < 2) {
        return res.status(400).json({ message: 'At least 2 quoteIds required' });
      }

      const selectedQuotes = await db.select().from(quotes).where(
        and(eq(quotes.projectId, projectId))
      );
      const matchedQuotes = selectedQuotes.filter(q => quoteIds.includes(q.id));

      if (matchedQuotes.length < 2) {
        return res.status(404).json({ message: 'Quotes not found' });
      }

      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      const regional = project?.regionalContext as any;
      const currencySymbol = regional?.currencySymbol || regional?.currency || '\u20AC';

      const quoteDescriptions = await Promise.all(matchedQuotes.map(async (q) => {
        const lookupId = q.legacyVersionId || q.id;
        const lineItemRows = await db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteVersionId, lookupId));
        const [financials] = await db.select().from(quoteFinancials).where(eq(quoteFinancials.quoteId, q.id));
        const [vendorSnap] = await db.select().from(vendorSnapshots).where(eq(vendorSnapshots.quoteVersionId, lookupId));

        const grossAmount = financials?.grossAmount
          ? Number(financials.grossAmount) / 100
          : 0;

        const itemList = lineItemRows.map((li, idx) => {
          const price = li.totalPrice ? Number(li.totalPrice) / 100 : null;
          return `  ${idx + 1}. ${li.description}${price != null ? ` — ${currencySymbol}${price.toLocaleString()}` : ''}`;
        }).join('\n');

        return `Quote from ${vendorSnap?.name || 'Unknown Vendor'}:
Total: ${currencySymbol}${grossAmount.toLocaleString()}
Line items:
${itemList || '  (no line items)'}`;
      }));

      const contextBlock = quoteDescriptions.join('\n\n---\n\n');

      const raw = (await completeText({
        system: `You are a construction project financial analyst helping a homeowner compare contractor quotes for the same scope of work. Analyze the quotes and produce exactly 3 to 5 factual bullet points. Each bullet should be a single sentence. Cover the most relevant of: total price difference and percentage, line items that appear in one quote but not the other, differences in granularity (lump-sum vs itemized), any notable price outliers for similar items. Be observational and factual — state what you see, never give advice or recommendations. Use the currency symbol: ${currencySymbol}. Return ONLY a JSON array of strings, no markdown, no wrapping.`,
        messages: [{ role: 'user', content: contextBlock }],
        effort: 'low',
      })) || '[]';
      let insights: string[];
      try {
        insights = parseJsonLoose(raw);
        if (!Array.isArray(insights)) insights = [raw];
      } catch {
        insights = raw.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^[-•*]\s*/, ''));
      }

      return res.json({ insights });
    } catch (error) {
      console.error('Error generating quote comparison insight:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
