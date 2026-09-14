/**
 * RENIX vNext — AI Routes
 * 
 * Extracted from server/routes.ts
 * Contains all AI-related routes including:
 * - /api/ai/message - AI conversation
 * - /api/ai/message/stream - Streaming AI response
 * - /api/projects/:projectId/ai/confirm-quote - AI-driven quote creation
 * - /api/proposals - Proposal management
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { writeCanonicalMemory } from "../aiContextAssembly";
import { centsToUnits } from "../localeUtils";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { unlinkAndDeleteDocument } from "../storage/documentCleanup";
import { invalidateOverviewCache } from "./overview";

export function registerAiRoutes(app: Express): void {
  // ============================================
  // AI-DRIVEN QUOTE CREATION (after scope confirmation)
  // ============================================
  
  app.post('/api/projects/:projectId/ai/confirm-quote', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { 
        documentId, 
        scopeId,
        scopeName,
        scopeComment,
        objectPath,
      } = req.body;
      
      console.log('[confirm-quote] Request received:', {
        projectId,
        userId: user.id,
        documentId,
        scopeId,
        scopeName,
        scopeComment,
        objectPath
      });
      
      if (!documentId) {
        return res.status(400).json({ 
          message: 'Document ID is required',
          code: 'MISSING_DOCUMENT_ID'
        });
      }
      
      if (!scopeId) {
        return res.status(400).json({ 
          message: 'Scope confirmation is required before creating a quote. Please select a scope.',
          code: 'SCOPE_REQUIRED'
        });
      }
      
      const document = await storage.getDocumentById(documentId, user.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (document.projectId !== projectId) {
        return res.status(403).json({ message: 'Document does not belong to this project' });
      }
      
      const existingDocs = await storage.getDocumentsByProject(projectId, user.id);
      const duplicateDoc = existingDocs.find(d => 
        d.id !== documentId && 
        d.fileName === document.fileName && 
        d.confirmed === true
      );

      if (duplicateDoc && !req.body.forceReplace) {
        const associations = await storage.getAssociationsByDocument(duplicateDoc.id, user.id);
        const quoteAssoc = associations.find(a => a.associationType === 'quote');
        const scopeAssoc = associations.find(a => a.associationType === 'scope');
        
        return res.status(409).json({
          code: 'DUPLICATE_DOCUMENT',
          message: `A document named "${document.fileName}" already exists in this project.`,
          existingDocument: {
            id: duplicateDoc.id,
            fileName: duplicateDoc.fileName,
            uploadedAt: duplicateDoc.uploadedAt,
            linkedQuoteId: quoteAssoc?.entityId || null,
            linkedScopeName: scopeAssoc?.entityLabel || null,
          },
        });
      }

      console.log('[confirm-quote] Looking up scope:', { scopeId, scopeName, userId: user.id });
      let scope = await storage.getScopeNodeById(scopeId, user.id);
      console.log('[confirm-quote] Scope lookup result:', scope ? { id: scope.id, name: scope.name, projectId: scope.projectId } : 'NOT FOUND');
      
      if (!scope && scopeName) {
        const allScopes = await storage.getScopeNodesByProject(projectId, user.id);
        console.log('[confirm-quote] Scope ID not found, trying name fallback:', scopeName);
        console.log('[confirm-quote] All project scopes:', allScopes.map(s => ({ id: s.id, name: s.name })));
        
        const scopeByName = allScopes.find(s => s.name === scopeName);
        if (scopeByName) {
          console.log('[confirm-quote] Found scope by name match:', { id: scopeByName.id, name: scopeByName.name });
          scope = scopeByName;
        }
      }
      
      if (!scope) {
        const allScopes = await storage.getScopeNodesByProject(projectId, user.id);
        console.log('[confirm-quote] FAILED - All project scopes:', allScopes.map(s => ({ id: s.id, name: s.name })));
        return res.status(404).json({ message: 'Scope not found' });
      }
      if (scope.projectId !== projectId) {
        return res.status(403).json({ message: 'Scope does not belong to this project' });
      }
      
      const extractionPath = objectPath || document.fileDataUrl;
      let extraction: any = null;
      
      if (extractionPath) {
        try {
          console.log(`[AI Quote Confirm] Extracting from: ${extractionPath}`);
          const { extractFromObjectPath } = await import('../replit_integrations/document/index');
          extraction = await extractFromObjectPath(extractionPath);
          console.log(`[AI Quote Confirm] Extracted: vendor=${extraction.vendorName}, total=${extraction.total}`);
        } catch (extractErr) {
          console.error('[AI Quote Confirm] Extraction failed:', extractErr);
        }
      }
      
      let vendorId: string | null = null;
      if (extraction?.vendorName) {
        const vendors = await storage.getVendorsByProject(projectId, user.id);
        const existingVendor = vendors.find(v => 
          v.name.toLowerCase() === extraction.vendorName.toLowerCase()
        );
        
        if (existingVendor) {
          vendorId = existingVendor.id;
        } else {
          const newVendor = await storage.createVendor({
            projectId,
            userId: user.id,
            name: extraction.vendorName,
          });
          vendorId = newVendor.id;
        }
      }
      
      const sourceDoc = await storage.createSourceDocument({
        projectId,
        userId: user.id,
        fileName: document.fileName || 'quote-document',
        fileType: document.mimeType || 'application/pdf',
        objectStoragePath: objectPath || document.fileDataUrl || null,
        documentId: document.id,
        ingestionState: 'ingested',
        classificationTypes: [{ type: 'quote', confidence: 'high' }],
        interpretationState: 'interpreted',
      });

      const quote = await storage.createQuote({
        projectId,
        userId: user.id,
        scopeId: scope.id,
        vendorId,
        status: 'new',
        sourceDocumentId: sourceDoc.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        validUntil: null,
        notes: null,
      });
      
      const version = await storage.createQuoteVersion({
        quoteId: quote.id,
        projectId,
        userId: user.id,
        versionNumber: 1,
        sourceDocumentId: sourceDoc.id,
        validUntil: null,
        notes: null,
      });

      await storage.updateQuote(quote.id, user.id, { legacyVersionId: version.id, lineageId: quote.id });

      if (vendorId && extraction) {
        try {
          await storage.createVendorSnapshot({
            quoteVersionId: version.id,
            projectId,
            userId: user.id,
            name: extraction.vendorName || '',
            contactDetails: { 
              contact: extraction.vendorContact || '', 
              email: extraction.vendorEmail || '', 
              phone: extraction.vendorPhone || '', 
              address: extraction.vendorAddress || '' 
            },
            confidence: 'high',
          });
        } catch (e) {
          console.error('[confirm-quote] Vendor snapshot creation error:', e);
        }
      }

      if (extraction) {
        try {
          await storage.createQuoteMetadata({
            quoteVersionId: version.id,
            projectId,
            userId: user.id,
            quoteNumber: extraction.reference || '',
            quoteDate: extraction.date ? new Date(extraction.date) : null,
            validUntil: extraction.validUntil ? new Date(extraction.validUntil) : null,
            currency: extraction.currency || 'EUR',
          });
        } catch (e) {
          console.error('[confirm-quote] Quote metadata creation error:', e);
        }
      }

      if (extraction) {
        await storage.createQuoteFinancials({
          quoteId: quote.id,
          quoteVersionId: version.id,
          projectId,
          userId: user.id,
          netAmount: extraction.subtotal ? Math.round(extraction.subtotal * 100) : null,
          taxRate: extraction.taxRate || null,
          taxAmount: extraction.tax ? Math.round(extraction.tax * 100) : null,
          grossAmount: extraction.total ? Math.round(extraction.total * 100) : null,
          currency: extraction.currency || 'EUR',
          extractedConfidence: 'high',
          isUserCorrected: false,
        });
        
        if (extraction.lineItems && extraction.lineItems.length > 0) {
          console.log(`[confirm-quote] Persisting ${extraction.lineItems.length} line items`);
          for (let i = 0; i < extraction.lineItems.length; i++) {
            const item = extraction.lineItems[i];
            await storage.createQuoteLineItem({
              projectId,
              userId: user.id,
              quoteVersionId: version.id,
              originalNumber: String(i + 1),
              description: item.description || '',
              quantity: item.quantity ?? null,
              unit: item.unit ?? null,
              unitPrice: item.unitPrice != null ? Math.round(item.unitPrice * 100) : null,
              totalPrice: item.amount != null ? Math.round(item.amount * 100) : null,
            });
          }
        }
      }
      
      const coverageSummary = extraction?.coverageSummary || scopeComment;
      if (coverageSummary) {
        await storage.createQuoteCoverageNote({
          quoteId: quote.id,
          projectId,
          userId: user.id,
          coverageSummary,
          inferredByAi: !scopeComment,
        });
      }
      
      await storage.createAssociation({
        documentId: document.id,
        projectId,
        userId: user.id,
        associationType: 'scope',
        entityId: scopeId,
        entityLabel: scope.name,
      });
      
      await storage.createAssociation({
        documentId: document.id,
        projectId,
        userId: user.id,
        associationType: 'quote',
        entityId: quote.id,
        entityLabel: `Quote for ${scope.name}`,
      });
      
      console.log(`[AI Quote Confirm] Created quote ${quote.id} under scope ${scopeId} with document associations`);
      
      // Confirm the document - makes it visible in Documents frame
      await storage.confirmDocument(document.id, user.id);
      console.log(`[confirm-quote] Document ${document.id} confirmed and now visible`);
      
      if (duplicateDoc && req.body.forceReplace) {
        console.log(`[confirm-quote] Force replacing: cleaning up old document ${duplicateDoc.id} using canonical unlink procedure`);
        const cleanupResult = await unlinkAndDeleteDocument(duplicateDoc.id, projectId, user.id);
        console.log(`[confirm-quote] Cleanup complete:`, cleanupResult);
      }
      
      return res.json({
        success: true,
        quote: {
          id: quote.id,
          scopeId,
          scopeName: scope.name,
          vendorId,
          vendorName: extraction?.vendorName || null,
          status: 'new',
          total: extraction?.total || null,
          currency: extraction?.currency || 'EUR',
        },
        message: `Quote added under ${scope.name}. Nothing is committed yet.`,
      });
    } catch (error: any) {
      console.error('Error confirming quote:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
      return res.status(500).json({ 
        message: 'Failed to create quote',
        details: error?.message || 'Unknown error'
      });
    }
  });

  // ============================================
  // AI-DRIVEN QUOTE VERSION CREATION (link to existing quote)
  // ============================================

  app.post('/api/projects/:projectId/ai/confirm-quote-version', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;

      const { z } = await import('zod');
      const confirmQuoteVersionSchema = z.object({
        documentId: z.string().min(1, 'Document ID is required'),
        existingQuoteId: z.string().min(1, 'Existing quote ID is required'),
        scopeId: z.string().optional(),
        objectPath: z.string().optional(),
      });

      const parsed = confirmQuoteVersionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: parsed.error.errors });
      }
      const { documentId, existingQuoteId, scopeId, objectPath } = parsed.data;

      const document = await storage.getDocumentById(documentId, user.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (document.projectId !== projectId) {
        return res.status(403).json({ message: 'Document does not belong to this project' });
      }

      const allQuotes = await storage.getQuotesByProject(projectId, user.id);
      const existingQuote = allQuotes.find(q => q.id === existingQuoteId);
      if (!existingQuote) {
        return res.status(404).json({ 
          message: 'Existing quote not found',
          details: `Quote ID "${existingQuoteId}" was not found in this project. The quote may have been deleted. Please try uploading the document as a new quote instead.`
        });
      }

      if (scopeId && existingQuote.scopeId && scopeId !== existingQuote.scopeId) {
        const requestedScope = await storage.getScopeNodeById(scopeId, user.id);
        const quoteScope = await storage.getScopeNodeById(existingQuote.scopeId, user.id);
        console.warn(`[confirm-quote-version] Scope mismatch: requested scopeId=${scopeId} (${requestedScope?.name}), but quote ${existingQuoteId} belongs to scopeId=${existingQuote.scopeId} (${quoteScope?.name})`);
        return res.status(400).json({
          message: 'Scope mismatch',
          details: `This document was assigned to "${requestedScope?.name || scopeId}" but the selected quote belongs to "${quoteScope?.name || existingQuote.scopeId}". Please select a quote from the correct scope, or upload as a new separate quote.`
        });
      }

      const existingVersions = await storage.getVersionsByQuote(existingQuoteId, user.id);

      const extractionPath = objectPath || document.fileDataUrl;
      let extraction: any = null;

      if (extractionPath) {
        try {
          console.log(`[confirm-quote-version] Extracting from: ${extractionPath}`);
          const { extractFromObjectPath } = await import('../replit_integrations/document/index');
          extraction = await extractFromObjectPath(extractionPath);
          console.log(`[confirm-quote-version] Extracted: vendor=${extraction.vendorName}, total=${extraction.total}`);
        } catch (extractErr) {
          console.error('[confirm-quote-version] Extraction failed:', extractErr);
        }
      }

      let vendorId: string | null = existingQuote.vendorId;
      if (extraction?.vendorName) {
        const vendors = await storage.getVendorsByProject(projectId, user.id);
        const existingVendor = vendors.find(v =>
          v.name.toLowerCase() === extraction.vendorName.toLowerCase()
        );
        if (existingVendor) {
          vendorId = existingVendor.id;
        } else {
          const newVendor = await storage.createVendor({
            projectId,
            userId: user.id,
            name: extraction.vendorName,
          });
          vendorId = newVendor.id;
        }
      }

      const sourceDoc = await storage.createSourceDocument({
        projectId,
        userId: user.id,
        fileName: document.fileName || 'quote-document',
        fileType: document.mimeType || 'application/pdf',
        objectStoragePath: objectPath || document.fileDataUrl || null,
        documentId: document.id,
        ingestionState: 'ingested',
        classificationTypes: [{ type: 'quote', confidence: 'high' }],
        interpretationState: 'interpreted',
      });

      const newVersionNumber = existingVersions.length + 1;
      const existingLineageId = (existingQuote as any).lineageId || existingQuoteId;

      const newQuote = await storage.createQuote({
        projectId,
        userId: user.id,
        scopeId: existingQuote.scopeId,
        vendorId,
        status: 'new',
        sourceDocumentId: sourceDoc.id,
        versionNumber: newVersionNumber,
        extractionStatus: 'draft',
        commitmentStatus: null,
        lineageId: existingLineageId,
        previousQuoteId: existingQuoteId,
        description: existingQuote.description || '',
      });

      const version = await storage.createQuoteVersion({
        quoteId: existingQuoteId,
        projectId,
        userId: user.id,
        versionNumber: newVersionNumber,
        sourceDocumentId: sourceDoc.id,
      });

      await storage.updateQuote(newQuote.id, user.id, { legacyVersionId: version.id });

      const existingQuoteData = await storage.getQuoteById(existingQuoteId, user.id);
      if (existingQuoteData?.commitmentStatus) {
        await storage.updateQuote(existingQuoteId, user.id, { commitmentStatus: 'superseded' });
      }

      for (const v of existingVersions) {
        if (v.commitmentStatus && v.commitmentStatus !== 'superseded') {
          await storage.updateQuoteVersion(v.id, user.id, { commitmentStatus: 'superseded' });
        }
      }

      if (vendorId && extraction) {
        try {
          await storage.createVendorSnapshot({
            quoteVersionId: version.id,
            projectId,
            userId: user.id,
            name: extraction.vendorName || '',
            contactDetails: { 
              contact: extraction.vendorContact || '', 
              email: extraction.vendorEmail || '', 
              phone: extraction.vendorPhone || '', 
              address: extraction.vendorAddress || '' 
            },
            confidence: 'high',
          });
        } catch (e) {
          console.error('[confirm-quote-version] Vendor snapshot creation error:', e);
        }
      }

      if (extraction) {
        try {
          await storage.createQuoteMetadata({
            quoteVersionId: version.id,
            projectId,
            userId: user.id,
            quoteNumber: extraction.reference || '',
            quoteDate: extraction.date ? new Date(extraction.date) : null,
            validUntil: extraction.validUntil ? new Date(extraction.validUntil) : null,
            currency: extraction.currency || 'EUR',
          });
        } catch (e) {
          console.error('[confirm-quote-version] Quote metadata creation error:', e);
        }

        await storage.createQuoteFinancials({
          quoteId: newQuote.id,
          quoteVersionId: version.id,
          projectId,
          userId: user.id,
          netAmount: extraction.subtotal ? Math.round(extraction.subtotal * 100) : null,
          taxRate: extraction.taxRate || null,
          taxAmount: extraction.tax ? Math.round(extraction.tax * 100) : null,
          grossAmount: extraction.total ? Math.round(extraction.total * 100) : null,
          currency: extraction.currency || 'EUR',
          extractedConfidence: 'high',
          isUserCorrected: false,
        });

        if (extraction.lineItems && extraction.lineItems.length > 0) {
          console.log(`[confirm-quote-version] Persisting ${extraction.lineItems.length} line items`);
          for (let i = 0; i < extraction.lineItems.length; i++) {
            const item = extraction.lineItems[i];
            await storage.createQuoteLineItem({
              projectId,
              userId: user.id,
              quoteVersionId: version.id,
              originalNumber: String(i + 1),
              description: item.description || '',
              quantity: item.quantity ?? null,
              unit: item.unit ?? null,
              unitPrice: item.unitPrice != null ? Math.round(item.unitPrice * 100) : null,
              totalPrice: item.amount != null ? Math.round(item.amount * 100) : null,
            });
          }
        }
      }

      const coverageSummary = extraction?.coverageSummary;
      if (coverageSummary) {
        await storage.createQuoteCoverageNote({
          quoteId: newQuote.id,
          projectId,
          userId: user.id,
          coverageSummary,
          inferredByAi: true,
        });
      }

      let scope = existingQuote.scopeId ? await storage.getScopeNodeById(existingQuote.scopeId, user.id) : null;

      await storage.createAssociation({
        documentId: document.id,
        projectId,
        userId: user.id,
        associationType: 'quote',
        entityId: newQuote.id,
        entityLabel: `Quote v${newVersionNumber} for ${scope?.name || 'Unknown Scope'}`,
      });

      if (scope) {
        await storage.createAssociation({
          documentId: document.id,
          projectId,
          userId: user.id,
          associationType: 'scope',
          entityId: scope.id,
          entityLabel: scope.name,
        });
      }

      await storage.confirmDocument(document.id, user.id);
      console.log(`[confirm-quote-version] Created new flat quote ${newQuote.id} (v${newVersionNumber}) for lineage ${existingLineageId}`);

      return res.json({
        success: true,
        versionNumber: newVersionNumber,
        quote: {
          id: newQuote.id,
          scopeId: existingQuote.scopeId,
          scopeName: scope?.name || null,
          vendorId,
          vendorName: extraction?.vendorName || null,
          status: existingQuote.status,
          total: extraction?.total || null,
          currency: extraction?.currency || 'EUR',
          versionNumber: newVersionNumber,
          lineageId: existingLineageId,
          previousQuoteId: existingQuoteId,
        },
        message: `New version (v${newVersionNumber}) added to existing quote under ${scope?.name || 'Unknown Scope'}.`,
      });
    } catch (error: any) {
      console.error('[confirm-quote-version] Error confirming quote version:', error?.message || error);
      console.error('[confirm-quote-version] Stack:', error?.stack);
      return res.status(500).json({
        message: 'Failed to create quote version',
        details: error?.message || 'An unexpected error occurred while creating the quote version'
      });
    }
  });

  // ============================================
  // AI-DRIVEN INVOICE CREATION (after document classification)
  // ============================================
  
  app.post('/api/projects/:projectId/ai/confirm-invoice', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { 
        documentId, 
        objectPath,
        scopeId, // Optional: explicit scope assignment from user
        extractedData, // Optional: pre-extracted data from upload-time extraction
      } = req.body;
      
      console.log('[confirm-invoice] Request received:', {
        projectId,
        userId: user.id,
        documentId,
        objectPath,
        scopeId
      });
      
      if (!documentId) {
        return res.status(400).json({ 
          message: 'Document ID is required',
          code: 'MISSING_DOCUMENT_ID'
        });
      }
      
      const document = await storage.getDocumentById(documentId, user.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      if (document.projectId !== projectId) {
        return res.status(403).json({ message: 'Document does not belong to this project' });
      }
      
      const existingDocs = await storage.getDocumentsByProject(projectId, user.id);
      const duplicateDoc = existingDocs.find(d => 
        d.id !== documentId && 
        d.fileName === document.fileName && 
        d.confirmed === true
      );

      if (duplicateDoc && !req.body.forceReplace) {
        const associations = await storage.getAssociationsByDocument(duplicateDoc.id, user.id);
        const invoiceAssoc = associations.find(a => a.associationType === 'invoice');
        const scopeAssoc = associations.find(a => a.associationType === 'scope');
        
        return res.status(409).json({
          code: 'DUPLICATE_DOCUMENT',
          message: `A document named "${document.fileName}" already exists in this project.`,
          existingDocument: {
            id: duplicateDoc.id,
            fileName: duplicateDoc.fileName,
            uploadedAt: duplicateDoc.uploadedAt,
            linkedInvoiceId: invoiceAssoc?.entityId || null,
            linkedScopeName: scopeAssoc?.entityLabel || null,
          },
        });
      }

      const extractionPath = objectPath || document.fileDataUrl;
      let extraction: any = null;
      
      if (extractedData) {
        console.log('[confirm-invoice] Using pre-extracted data from upload-time (avoiding re-extraction):', extractedData);
        extraction = {
          vendorName: extractedData.vendorName,
          invoiceNumber: extractedData.reference,
          invoiceDate: extractedData.date,
          subtotal: extractedData.financials?.netTotal ?? null,
          tax: extractedData.financials?.taxAmount ?? null,
          taxRate: (extractedData.financials?.taxAmount && extractedData.financials?.netTotal) 
            ? extractedData.financials.taxAmount / extractedData.financials.netTotal 
            : null,
          total: extractedData.financials?.grossTotal ?? null,
          currency: extractedData.currency || 'EUR',
          lineItems: [],
          notes: null,
        };
        console.log(`[confirm-invoice] Mapped extraction from extractedData: vendor=${extraction.vendorName}, invoiceNumber=${extraction.invoiceNumber}, total=${extraction.total}`);
      } else if (extractionPath) {
        try {
          console.log(`[confirm-invoice] No extractedData provided, re-extracting from: ${extractionPath}`);
          const { extractInvoiceFromObjectPath } = await import('../replit_integrations/document/index');
          extraction = await extractInvoiceFromObjectPath(extractionPath);
          console.log(`[confirm-invoice] Re-extracted: vendor=${extraction.vendorName}, invoiceNumber=${extraction.invoiceNumber}, total=${extraction.total}`);
        } catch (extractErr) {
          console.error('[confirm-invoice] Extraction failed:', extractErr);
        }
      }
      
      // Find or create vendor
      let vendorId: string | null = null;
      const vendorName = extraction?.vendorName || 'Unknown Vendor';
      if (vendorName) {
        const vendors = await storage.getVendorsByProject(projectId, user.id);
        const existingVendor = vendors.find(v => 
          v.name.toLowerCase() === vendorName.toLowerCase()
        );
        
        if (existingVendor) {
          vendorId = existingVendor.id;
        } else {
          const newVendor = await storage.createVendor({
            projectId,
            userId: user.id,
            name: vendorName,
          });
          vendorId = newVendor.id;
        }
      }
      
      // Fetch scope nodes for intelligent scope matching
      const scopeNodes = await storage.getScopeNodesByProject(projectId, user.id);
      
      // Determine scope assignment - either explicit from request or AI-matched
      let assignedScopeId: string | null = null;
      let assignedScopeName: string | null = null;
      
      // Validate explicit scopeId if provided - must belong to this project
      if (scopeId) {
        const explicitNode = scopeNodes.find(n => n.id === scopeId);
        if (explicitNode) {
          assignedScopeId = explicitNode.id;
          assignedScopeName = explicitNode.name;
          console.log(`[confirm-invoice] Using explicit scope: ${assignedScopeName} (${assignedScopeId})`);
        } else {
          console.warn(`[confirm-invoice] Explicit scopeId ${scopeId} not found in project, will try AI matching`);
        }
      }
      
      // Try AI matching if no valid explicit scope
      if (!assignedScopeId && scopeNodes.length > 0 && (extraction?.vendorName || extraction?.lineItems?.length)) {
        try {
          const { matchInvoiceToScope } = await import('../ai/scopeMatcher');
          const matchResult = await matchInvoiceToScope({
            vendorName: extraction?.vendorName || vendorName,
            lineItems: extraction?.lineItems || [],
            total: extraction?.total,
            scopeNodes,
          });
          // Only use AI result if confidence is high enough and scopeId is valid
          if (matchResult?.scopeId && matchResult.confidence >= 0.5) {
            const matchedNode = scopeNodes.find(n => n.id === matchResult.scopeId);
            if (matchedNode) {
              assignedScopeId = matchedNode.id;
              assignedScopeName = matchedNode.name; // Use DB name, not AI-returned name
              console.log(`[confirm-invoice] AI matched invoice to scope: ${assignedScopeName} (${assignedScopeId}) confidence=${matchResult.confidence}`);
            } else {
              console.warn(`[confirm-invoice] AI returned invalid scopeId: ${matchResult.scopeId}`);
            }
          } else if (matchResult) {
            console.log(`[confirm-invoice] AI match confidence too low (${matchResult.confidence}), leaving unassigned`);
          }
        } catch (matchErr) {
          console.error('[confirm-invoice] Scope matching failed, invoice will be unassigned:', matchErr);
        }
      }
      
      // Create the invoice (directly finalized - no draft state for invoices)
      const invoice = await storage.createInvoice({
        projectId,
        userId: user.id,
        createdBy: user.id,
        vendorId,
        vendorName,
        scopeId: assignedScopeId,
        reference: extraction?.invoiceNumber || `INV-${Date.now()}`,
        status: 'finalized', // Invoices go directly to finalized state
        notes: extraction?.notes || null,
      });
      
      console.log(`[confirm-invoice] Created invoice ${invoice.id} (finalized)`);
      
      // Create line items (scope is on invoice, not lines)
      // Filter out subtotal/total rows — those are aggregate lines from the PDF,
      // not actual work items. Their values are already captured in extraction.subtotal / extraction.total.
      if (extraction?.lineItems && extraction.lineItems.length > 0) {
        const actualItems = extraction.lineItems.filter((item: any) => {
          if (item.lineType && item.lineType !== 'item') return false;
          const desc = (item.description || '').toLowerCase();
          if (desc === 'zwischensumme' || desc === 'gesamtbetrag' || desc === 'endsumme'
            || desc === 'gesamtsumme' || desc === 'gesamtsumme brutto' || desc === 'gesamtsumme netto'
            || desc === 'subtotal' || desc === 'total' || desc === 'grand total') return false;
          return true;
        });
        const skippedCount = extraction.lineItems.length - actualItems.length;
        console.log(`[confirm-invoice] Persisting ${actualItems.length} line items (filtered out ${skippedCount} subtotal/total rows)`);

        // Check if any extracted line item already represents VAT/tax
        const extractionAlreadyHasVatLine = actualItems.some((item: any) => {
          const desc = (item.description || '').toLowerCase();
          return desc.includes('mwst') || desc.includes('ust') || desc.includes('umsatzsteuer')
            || desc.includes('vat') || desc.includes('tax') || desc.includes('mehrwertsteuer');
        });

        for (const item of actualItems) {
          await storage.createInvoiceLine({
            invoiceId: invoice.id,
            projectId,
            userId: user.id,
            label: item.description || 'Line Item',
            description: item.description || null,
            amount: item.amount != null ? Math.round(item.amount * 100) : 0, // Convert to cents (net amount)
          });
        }
        
        // Add VAT/Tax as separate line item ONLY if:
        // 1. Tax amount exists in the extraction totals
        // 2. No extracted line item already represents VAT/tax (avoid double-counting)
        if (extraction?.tax && extraction.tax > 0 && !extractionAlreadyHasVatLine) {
          const taxRate = extraction.taxRate ? ` (${Math.round(extraction.taxRate * 100)}%)` : '';
          await storage.createInvoiceLine({
            invoiceId: invoice.id,
            projectId,
            userId: user.id,
            label: `VAT/Tax${taxRate}`,
            description: 'Value Added Tax',
            amount: Math.round(extraction.tax * 100), // Tax in cents
          });
          console.log(`[confirm-invoice] Added VAT line item: ${extraction.tax} (${extraction.taxRate ? Math.round(extraction.taxRate * 100) + '%' : 'rate unknown'})`);
        } else if (extractionAlreadyHasVatLine) {
          console.log(`[confirm-invoice] Skipped adding separate VAT line — extraction line items already include a VAT/tax row`);
        }
      } else if (extraction?.total) {
        // Create a single line item for the total if no line items extracted
        // Use gross total directly (already includes tax)
        await storage.createInvoiceLine({
          invoiceId: invoice.id,
          projectId,
          userId: user.id,
          label: 'Invoice Total',
          description: null,
          amount: Math.round(extraction.total * 100), // Convert to cents (gross amount)
        });
      }
      
      // Create document associations
      await storage.createAssociation({
        documentId: document.id,
        projectId,
        userId: user.id,
        associationType: 'invoice',
        entityId: invoice.id,
        entityLabel: `Invoice ${extraction?.invoiceNumber || invoice.reference}`,
      });
      
      if (assignedScopeId && assignedScopeName) {
        await storage.createAssociation({
          documentId: document.id,
          projectId,
          userId: user.id,
          associationType: 'scope',
          entityId: assignedScopeId,
          entityLabel: assignedScopeName,
        });
        console.log(`[confirm-invoice] Created scope association: ${assignedScopeName} (${assignedScopeId})`);
      }
      
      console.log(`[confirm-invoice] Created invoice ${invoice.id} with document associations`);
      
      // Confirm the document - makes it visible in Documents frame
      await storage.confirmDocument(document.id, user.id);
      console.log(`[confirm-invoice] Document ${document.id} confirmed and now visible`);
      
      if (duplicateDoc && req.body.forceReplace) {
        console.log(`[confirm-invoice] Force replacing: cleaning up old document ${duplicateDoc.id} using canonical unlink procedure`);
        const cleanupResult = await unlinkAndDeleteDocument(duplicateDoc.id, projectId, user.id);
        console.log(`[confirm-invoice] Cleanup complete:`, cleanupResult);
      }
      
      return res.json({
        success: true,
        invoice: {
          id: invoice.id,
          vendorId,
          vendorName,
          reference: invoice.reference,
          status: 'finalized',
          total: extraction?.total || null,
          currency: extraction?.currency || 'EUR',
        },
        message: `Invoice from ${vendorName} has been recorded and finalized. You can view it in the Invoices frame.`,
      });
    } catch (error: any) {
      console.error('Error confirming invoice:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
      return res.status(500).json({ 
        message: 'Failed to create invoice',
        details: error?.message || 'Unknown error'
      });
    }
  });

  // ============================================
  // CANCEL INGESTION - Delete unconfirmed document
  // ============================================
  
  app.post('/api/projects/:projectId/ai/cancel-ingestion', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { documentId } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ message: 'Document ID is required' });
      }
      
      console.log(`[cancel-ingestion] Cancelling ingestion for document ${documentId}`);
      
      // Verify document exists and belongs to user
      const document = await storage.getDocumentById(documentId, user.id);
      if (!document) {
        // Document might have already been deleted, consider this success
        console.log(`[cancel-ingestion] Document ${documentId} not found (may already be deleted)`);
        return res.json({ success: true, message: 'Document not found (may already be deleted)' });
      }
      
      // Only delete if not confirmed (prevent accidental deletion of confirmed docs)
      if (document.confirmed) {
        return res.status(400).json({ 
          message: 'Cannot cancel ingestion for a confirmed document. Use the Documents frame to delete it.',
        });
      }
      
      const result = await unlinkAndDeleteDocument(documentId, projectId, user.id, true);
      
      if (result.documentDeleted) {
        console.log(`[cancel-ingestion] Successfully deleted unconfirmed document ${documentId} (unlinkedQuotes=${result.unlinkedQuotes})`);
        return res.json({ success: true, message: 'Document upload cancelled.' });
      } else {
        return res.status(500).json({ message: 'Failed to delete document' });
      }
    } catch (error: any) {
      console.error('Error cancelling ingestion:', error);
      return res.status(500).json({ 
        message: 'Failed to cancel ingestion',
        details: error?.message || 'Unknown error'
      });
    }
  });

  // ============================================================================
  // AI SERVICE ROUTES
  // ============================================================================

  app.post('/api/ai/message', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { projectId, message, conversationHistory = [], activeFrame, isSessionResume, isAutoUpload, attachment, pendingQuoteContext } = req.body;
    
    if (!message && !attachment) {
      return res.status(400).json({ message: 'Message or attachment is required' });
    }
    
    if (projectId) {
      try {
        const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
        if (lifecycleState === 'closed') {
        }
        if (lifecycleState === 'deleted') {
          return res.status(404).json({ 
            message: 'Project not found',
            code: 'PROJECT_DELETED',
          });
        }
      } catch (error) {
        console.error('[LIFECYCLE GUARD] Error checking AI message access:', error);
        return res.status(503).json({ 
          message: 'Unable to verify project access. Please try again.',
          code: 'LIFECYCLE_CHECK_FAILED',
        });
      }
    }
    
    try {
      let attachmentResult: { 
        quoteId?: string; 
        documentId?: string; 
        extracting?: boolean;
        classification?: {
          documentType: string;
          confidence: string;
          explanation: string;
          coverageSummary?: string | null;
        };
        extraction?: {
          vendorName?: string | null;
          total?: number | null;
          currency?: string | null;
        };
        requiresConfirmation?: boolean;
        requiresScopeSelection?: boolean;
        autoConfirmed?: boolean;
        recommendedTags?: string[];
        objectPath?: string;
        pendingQuoteData?: {
          projectId: string;
          documentId: string;
          objectPath?: string;
          vendorName?: string | null;
          total?: number | null;
          currency?: string;
          coverageSummary?: string | null;
        } | null;
        fileName?: string;
        extractedData?: {
          vendorName: string | null;
          date: string | null;
          reference: string | null;
          financials: {
            netTotal: number | null;
            taxAmount: number | null;
            grossTotal: number | null;
          };
          currency: string;
          lineItemCount: number;
        } | null;
      } | undefined;
      
      if (attachment && attachment.uploadToken && projectId) {
        try {
          if (!attachment.fileName || typeof attachment.fileName !== 'string') {
            return res.status(400).json({ error: 'Invalid attachment: fileName is required' });
          }
          
          const pendingUpload = await storage.getPendingUpload(attachment.uploadToken);
          
          if (!pendingUpload) {
            return res.status(400).json({ error: 'Invalid upload token' });
          }
          if (pendingUpload.consumed) {
            return res.status(400).json({ error: 'Upload token already used' });
          }
          if (pendingUpload.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Upload token expired' });
          }
          if (pendingUpload.projectId !== projectId) {
            return res.status(403).json({ error: 'Upload token does not match project' });
          }
          if (pendingUpload.userId !== user.id) {
            return res.status(403).json({ error: 'Upload token does not belong to this user' });
          }
          
          const mimeType = attachment.fileType || pendingUpload.contentType || 'application/octet-stream';
          
          const allowedMimeTypes = new Set([
            'application/pdf', 
            'image/jpeg', 
            'image/png', 
            'image/webp', 
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ]);
          if (!allowedMimeTypes.has(mimeType)) {
            return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
          }
          
          const docType = mimeType === 'application/pdf' ? 'pdf' : 
                         mimeType.startsWith('image/') ? 'image' : 
                         (mimeType === 'text/csv' || mimeType.includes('spreadsheet')) ? 'spreadsheet' : 'other';
          
          const document = await storage.createDocument({
            projectId,
            userId: user.id,
            fileName: attachment.fileName,
            fileSize: pendingUpload.fileSize || 0,
            mimeType,
            documentType: docType,
            title: attachment.fileName,
            uploadedBy: user.id,
            fileDataUrl: pendingUpload.objectPath,
          });
          
          const sourceDocForIngestion = await storage.createSourceDocument({
            projectId,
            userId: user.id,
            fileName: attachment.fileName,
            fileType: mimeType,
            objectStoragePath: pendingUpload.objectPath,
            documentId: document.id,
            ingestionState: 'stored',
            classificationTypes: null,
            interpretationState: null,
          });
          
          await storage.consumePendingUpload(attachment.uploadToken);
          
          const { classifyDocumentOnly } = await import('../replit_integrations/document/index');
          const classificationResult = await classifyDocumentOnly(pendingUpload.objectPath);
          
          console.log(`[AI Attachment] Classification ONLY: ${classificationResult.classification.documentType} (${classificationResult.classification.confidence})`);
          
          let extractedData: any = null;
          try {
            const classifiedType = classificationResult.classification.documentType;
            if (classifiedType === 'quote') {
              const { extractFromObjectPath } = await import('../replit_integrations/document/index');
              const extraction = await extractFromObjectPath(pendingUpload.objectPath);
              extractedData = {
                vendorName: extraction.vendorName || null,
                date: extraction.date || null,
                reference: extraction.reference || null,
                financials: {
                  netTotal: extraction.subtotal ?? null,
                  taxAmount: extraction.tax ?? null,
                  grossTotal: extraction.total ?? null,
                },
                currency: extraction.currency || 'EUR',
                lineItemCount: extraction.lineItems?.length || 0,
              };
            } else if (classifiedType === 'invoice') {
              const { extractInvoiceFromObjectPath } = await import('../replit_integrations/document/index');
              const extraction = await extractInvoiceFromObjectPath(pendingUpload.objectPath);
              extractedData = {
                vendorName: extraction.vendorName || null,
                date: extraction.invoiceDate || null,
                reference: extraction.invoiceNumber || null,
                financials: {
                  netTotal: extraction.subtotal ?? null,
                  taxAmount: extraction.tax ?? null,
                  grossTotal: extraction.total ?? null,
                },
                currency: extraction.currency || 'EUR',
                lineItemCount: extraction.lineItems?.length || 0,
              };
            }
            console.log('[AI Attachment] Extracted data:', extractedData);
          } catch (extractErr) {
            console.error('[AI Attachment] Data extraction failed (non-fatal):', extractErr);
          }
          
          const confidenceMap: Record<string, 'low' | 'medium' | 'high'> = {
            'high': 'high', 'medium': 'medium', 'low': 'low'
          };
          const classifiedDocType = classificationResult.classification.documentType || 'unknown';
          const confidence = confidenceMap[classificationResult.classification.confidence] || 'medium';
          
          await storage.updateSourceDocument(sourceDocForIngestion.id, user.id, {
            ingestionState: 'classified',
            classificationTypes: [{ type: classifiedDocType, confidence }],
          });
          
          const contextualTags: Record<string, string[]> = {};
          
          if (classifiedDocType === 'quote') {
            contextualTags.document_type = ['quote', 'vendor_submission'];
          } else if (classifiedDocType === 'invoice') {
            contextualTags.document_type = ['invoice', 'financial_record'];
          } else if (classifiedDocType === 'contract') {
            contextualTags.document_type = ['contract', 'legally_binding'];
          } else {
            contextualTags.document_type = [classifiedDocType];
          }
          
          if (confidence === 'high') {
            contextualTags.classification_quality = ['high_confidence'];
          } else if (confidence === 'medium') {
            contextualTags.classification_quality = ['medium_confidence', 'requires_review'];
          } else {
            contextualTags.classification_quality = ['low_confidence', 'requires_review'];
          }
          
          if (classificationResult.classification.coverageSummary) {
            const summary = classificationResult.classification.coverageSummary.toLowerCase();
            const workDomains: string[] = [];
            if (summary.includes('facade') || summary.includes('fassade')) workDomains.push('facade');
            if (summary.includes('kitchen') || summary.includes('küche')) workDomains.push('kitchen');
            if (summary.includes('bathroom') || summary.includes('bad')) workDomains.push('bathroom');
            if (summary.includes('roof') || summary.includes('dach')) workDomains.push('roofing');
            if (summary.includes('electrical') || summary.includes('elektro')) workDomains.push('electrical');
            if (summary.includes('plumbing') || summary.includes('sanitär')) workDomains.push('plumbing');
            if (summary.includes('window') || summary.includes('fenster')) workDomains.push('windows');
            if (workDomains.length > 0) {
              contextualTags.work_domain = workDomains;
            }
          }
          
          await storage.updateSourceDocument(sourceDocForIngestion.id, user.id, {
            ingestionState: 'tagged',
            contextualTags,
          });
          
          await storage.updateSourceDocument(sourceDocForIngestion.id, user.id, {
            ingestionState: 'ingested',
          });
          
          const isQuoteOrInvoice = classifiedDocType === 'quote' || classifiedDocType === 'invoice';
          if (!isQuoteOrInvoice) {
            await storage.confirmDocument(document.id, user.id);
            console.log(`[AI Attachment] Auto-confirmed non-quote/invoice document ${document.id} (type: ${classifiedDocType})`);
          }
          
          (async () => {
            try {
              const { extractAndSummarizeDocument } = await import('../textExtraction');
              await extractAndSummarizeDocument(document.id);
            } catch (extractErr) {
              console.error('[AI Attachment] Text extraction/summarization failed:', extractErr);
            }
          })();
          
          const isQuote = classificationResult.classification.documentType === 'quote';
          const isInvoice = classificationResult.classification.documentType === 'invoice';
          const isHighConfidence = classificationResult.classification.confidence === 'high';
          
          attachmentResult = {
            documentId: document.id,
            extracting: false,
            classification: classificationResult.classification,
            objectPath: pendingUpload.objectPath,
            fileName: attachment.fileName,
            requiresConfirmation: isQuote ? !isHighConfidence : isInvoice ? true : false,
            requiresScopeSelection: isQuote,
            autoConfirmed: !isQuote && !isInvoice,
            extractedData,
            recommendedTags: contextualTags.work_domain || [],
            pendingQuoteData: isQuote ? {
              projectId,
              documentId: document.id,
              objectPath: pendingUpload.objectPath,
              vendorName: extractedData?.vendorName || null,
              total: extractedData?.financials?.grossTotal || null,
              currency: extractedData?.currency || 'EUR',
              coverageSummary: classificationResult.classification.coverageSummary || null,
            } : null,
          };
        } catch (attachErr) {
          console.error('[AI Attachment] Failed to process attachment:', attachErr);
          return res.status(500).json({ error: 'Failed to process attachment' });
        }
      }
      
      const { processUserMessage } = await import('../renixAiService');
      
      let mode: 'PROJECT_DISCOVERY' | 'PROJECT_VALIDATION' | 'PROJECT_PLANNING' = 'PROJECT_DISCOVERY';
      let pendingProjectProposal: any = null;
      
      const userProposals = await storage.getProposalsByUser(user.id);
      const pendingProjectProposals = userProposals.filter(
        p => p.targetFrame === 'project' && p.status === 'pending'
      );
      if (pendingProjectProposals.length > 0) {
        pendingProjectProposal = pendingProjectProposals[0];
        mode = 'PROJECT_VALIDATION';
      }
      
      const allPendingProposals = userProposals.filter(p => p.status === 'pending');
      
      let context: any = {
        projectId: null,
        userId: user.id,
        projectName: 'RENIX',
        projectStatus: 'none',
        activeFrame: activeFrame || 'overview',
        mode,
        pendingProjectProposal,
        pendingProposals: allPendingProposals,
        isSessionResume: isSessionResume === true,
      };
      
      if (projectId) {
        const project = await storage.getProjectById(projectId, user.id);
        if (project) {
          context.projectId = project.id;
          context.projectName = project.name;
          context.projectDescription = project.description || '';
          context.projectType = project.type;
          context.projectStatus = project.status;
          context.currency = (project.regionalContext as any)?.currency || 'USD';
          context.mode = 'PROJECT_PLANNING';
          
          const scopeNodes = await storage.getScopeNodesByProject(projectId, user.id);
          context.scopes = scopeNodes;
          
          const budget = await storage.getBudgetByProject(projectId, user.id);
          context.budgetIntent = budget?.totalBudget;
          if (budget) {
            context.contingencyMode = budget.contingencyMode;
            context.contingencyValue = budget.contingencyValue;
            const allocations = await storage.getAllocationsByBudget(budget.id, user.id);
            context.budgetAllocations = allocations?.map(a => ({
              label: a.label,
              amount: a.amount,
              target: a.target,
            }));
          }
          
          const financingSources = await storage.getSourcesByProject(projectId, user.id);
          if (financingSources?.length) {
            const confirmedTotal = financingSources
              .filter((s: any) => s.status === 'Confirmed' || s.status === 'confirmed')
              .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
            const monthlyLiabilities = financingSources.reduce((sum: number, s: any) => sum + (s.monthlyLiability || 0), 0);
            context.financingSources = financingSources.map((s: any) => ({
              name: s.name,
              type: s.type,
              amount: s.amount,
              status: s.status,
              monthlyLiability: s.monthlyLiability || null,
            }));
            context.totalConfirmedFinancing = confirmedTotal;
            context.totalMonthlyLiabilities = monthlyLiabilities;
            if (budget?.totalBudget) {
              context.fundingGap = confirmedTotal - budget.totalBudget;
            }
          }
        }
      }
      
      if (attachmentResult) {
        context.attachment = attachmentResult;
        console.log('[AI Context] Attachment added to context:', {
          documentId: attachmentResult.documentId,
          classification: attachmentResult.classification,
          objectPath: attachmentResult.objectPath ? '[present]' : '[missing]',
          isInvoice: attachmentResult.classification?.documentType === 'invoice',
        });
      }
      else if (pendingQuoteContext?.documentId) {
        context.attachment = {
          documentId: pendingQuoteContext.documentId,
          objectPath: pendingQuoteContext.objectPath,
          fileName: pendingQuoteContext.fileName,
          classification: pendingQuoteContext.classification,
          requiresScopeSelection: true,
        };
        
        if (pendingQuoteContext.extractedData) {
          context.pendingQuoteExtraction = {
            vendorName: pendingQuoteContext.extractedData.vendorName,
            quoteDate: pendingQuoteContext.extractedData.quoteDate,
            netAmount: centsToUnits(pendingQuoteContext.extractedData.netAmount),
            taxAmount: centsToUnits(pendingQuoteContext.extractedData.taxAmount),
            grossAmount: centsToUnits(pendingQuoteContext.extractedData.grossAmount),
            currency: pendingQuoteContext.extractedData.currency,
            lineItems: pendingQuoteContext.extractedData.lineItems?.slice(0, 10)?.map((li: any) => ({
              description: li.description,
              amount: centsToUnits(li.totalPrice || li.amount),
            })),
          };
        }
      }
      
      if (isAutoUpload && attachmentResult) {
        context.isAutoUpload = true;
        context.requiresAcknowledgement = true;
      }
      
      const response = await processUserMessage(
        message,
        conversationHistory,
        context
      );
      
      if (attachmentResult) {
        (response as any).attachment = attachmentResult;
      }
      
      if (response.proposals && response.proposals.length > 0) {
        let canSaveProposals = true;
        let proposalsBlockedReason: string | null = null;
        
        if (projectId) {
          try {
            const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
            if (lifecycleState === 'closed') {
              canSaveProposals = false;
              proposalsBlockedReason = 'closed';
              console.log('[LIFECYCLE GUARD] Blocking AI proposals for closed project:', projectId);
            } else if (lifecycleState === 'deleted') {
              canSaveProposals = false;
              proposalsBlockedReason = 'deleted';
              console.log('[LIFECYCLE GUARD] Blocking AI proposals for deleted project:', projectId);
            }
          } catch (error) {
            canSaveProposals = false;
            proposalsBlockedReason = 'error';
            console.error('[LIFECYCLE GUARD] Error checking lifecycle for proposal save, blocking proposals:', error);
          }
        }
        
        if (canSaveProposals) {
          for (const proposal of response.proposals) {
            const impacts = Array.isArray(proposal.downstream_impacts) 
              ? proposal.downstream_impacts 
              : [];
            
            await storage.createProposal({
              projectId: proposal.target_frame === 'project' ? undefined : projectId,
              userId: user.id,
              model: (proposal.provenance as any)?.model || 'gpt-5.2',
              targetFrame: proposal.target_frame || 'project',
              targetEntities: proposal.target_entities || [],
              proposedDiff: proposal.proposed_diff,
              rationale: proposal.rationale || 'AI-generated proposal',
              assumptions: proposal.assumptions || [],
              downstreamImpacts: impacts as string[],
              riskLevel: proposal.risk_level || 'low',
              provenance: proposal.provenance,
            });
          }
        } else if (proposalsBlockedReason) {
          (response as any).proposalsBlocked = true;
          (response as any).proposalsBlockedReason = proposalsBlockedReason === 'closed' 
            ? 'Project is closed. AI can explain and explore but cannot propose changes.'
            : proposalsBlockedReason === 'deleted'
            ? 'Project not found.'
            : 'Unable to verify project access.';
        }
      }
      
      // ========================================================================
      // CONVERSATION PERSISTENCE (Phase C-0.1)
      // Persist user and assistant messages to database for reload safety
      // Transactional safety: conversation + first message in single transaction
      // Error visibility: persistence failures prevent optimistic UI state
      // ========================================================================
      if (projectId) {
        const userMessageContent = message?.trim() || (attachment ? `[Attachment: ${attachment.fileName}]` : '');
        const assistantMessageContent = response.content || '';
        
        if (userMessageContent || assistantMessageContent) {
          try {
            // Check if conversation already exists
            const existingConversation = await storage.getProjectConversation(projectId, user.id);
            
            const assistantMetadata: Record<string, any> = {};
            
            // 1. responseType - from response.type
            if (response.type) assistantMetadata.responseType = response.type;
            
            // 2. ingestionSuccess - passed from frontend when document is successfully ingested
            if ((response as any).ingestionSuccess) {
              assistantMetadata.ingestionSuccess = (response as any).ingestionSuccess;
            }
            
            // 3. classificationData - from attachment classification
            const respAttachment = (response as any).attachment;
            if (respAttachment?.classification) {
              assistantMetadata.classificationData = {
                documentType: respAttachment.classification.documentType,
                confidence: respAttachment.classification.confidence,
                coverageSummary: respAttachment.classification.coverageSummary,
              };
            }
            
            // 4. preConfirmData - passed from frontend when showing pre-confirmation summary
            if ((response as any).preConfirmData) {
              assistantMetadata.preConfirmData = (response as any).preConfirmData;
            }
            
            // 5. hasProposal and 6. affectedFrames - from response.proposals
            const responseProposals = response.proposals;
            if (responseProposals && responseProposals.length > 0) {
              assistantMetadata.hasProposal = true;
              assistantMetadata.affectedFrames = responseProposals.map((p: any) => p.target_frame).filter(Boolean);
            }
            
            // 7. sessionOrientation - from response.session_orientation
            if (response.session_orientation) assistantMetadata.sessionOrientation = response.session_orientation;

            if (existingConversation) {
              if (userMessageContent) {
                await storage.createMessage({
                  conversationId: existingConversation.id,
                  role: 'user',
                  content: userMessageContent,
                });
                console.log(`[ConversationPersistence] Saved user message to conversation ${existingConversation.id}`);
              }
              
              if (assistantMessageContent) {
                await storage.createMessage({
                  conversationId: existingConversation.id,
                  role: 'assistant',
                  content: assistantMessageContent,
                  metadata: Object.keys(assistantMetadata).length > 0 ? assistantMetadata : undefined,
                });
                console.log(`[ConversationPersistence] Saved assistant message to conversation ${existingConversation.id}`);
              }
            } else {
              // No conversation exists - use transactional creation for atomicity
              // This ensures conversation + first messages are created together or not at all
              const metaArg = Object.keys(assistantMetadata).length > 0 ? assistantMetadata : undefined;
              if (userMessageContent && assistantMessageContent) {
                await storage.createConversationWithFirstMessage(
                  projectId,
                  user.id,
                  userMessageContent,
                  assistantMessageContent,
                  metaArg
                );
                console.log(`[ConversationPersistence] Created conversation with first messages (transactional)`);
              } else if (userMessageContent || assistantMessageContent) {
                const singleMessage = userMessageContent || assistantMessageContent;
                const role = userMessageContent ? 'user' : 'assistant';
                await storage.createConversationWithFirstMessage(
                  projectId,
                  user.id,
                  role === 'user' ? singleMessage : '',
                  role === 'assistant' ? singleMessage : '',
                  role === 'assistant' ? metaArg : undefined
                );
                console.log(`[ConversationPersistence] Created conversation with single ${role} message (transactional)`);
              }
            }
          } catch (persistError) {
            // ERROR VISIBILITY: Log error AND propagate to response
            // This prevents optimistic UI state when persistence fails
            console.error('[ConversationPersistence] CRITICAL: Failed to persist messages:', persistError);
            (response as any).persistenceError = true;
            (response as any).persistenceErrorMessage = 'Message may not have been saved. Please try again.';
          }
        }
      }
      
      if (projectId && response.assist_options) {
        try {
          const confirmQuoteOptions = response.assist_options.filter(
            (opt: any) => opt.action === 'confirm_quote' && opt.quoteData?.scopeId
          );
          if (confirmQuoteOptions.length > 0) {
            const allQuotes = await storage.getQuotesByProject(projectId, user.id);
            const allVendors = await storage.getVendorsByProject(projectId, user.id);
            const vendorMap = new Map(allVendors.map((v: any) => [v.id, v.name]));
            for (const opt of confirmQuoteOptions) {
              const scopeId = opt.quoteData!.scopeId;
              const scopeQuotes = allQuotes
                .filter((q: any) => q.scopeId === scopeId && (q.commitmentStatus === 'active' || q.commitmentStatus === 'accepted'))
                .slice(0, 5);
              if (scopeQuotes.length > 0) {
                opt.quoteData!.existingQuoteCandidates = await Promise.all(scopeQuotes.map(async (q: any) => {
                  const lookupId = q.legacyVersionId || q.id;
                  const fin = await storage.getFinancialsByVersion(lookupId, user.id);
                  const snapshot = await storage.getVendorSnapshotByVersion(lookupId, user.id);
                  const metadata = await storage.getQuoteMetadataByVersion(lookupId, user.id);
                  return {
                    id: q.id,
                    reference: metadata?.quoteNumber || '',
                    vendorName: snapshot?.name || (q.vendorId ? vendorMap.get(q.vendorId) || null : null),
                    total: fin?.grossAmount != null ? fin.grossAmount / 100 : null,
                    versionNumber: q.versionNumber || 1,
                    commitmentStatus: q.commitmentStatus,
                  };
                }));
              }
            }
          }
        } catch (enrichErr) {
          console.error('[AI Enrichment] Failed to enrich quote candidates:', enrichErr);
        }
      }

      return res.json(response);
    } catch (error) {
      console.error('AI message error:', error);
      return res.status(500).json({ message: 'Failed to process AI message' });
    }
  });

  // ============================================================================
  // GET CONVERSATION HISTORY (Phase C-0.1)
  // Load persisted messages for a project's AI conversation
  // NOTE: Does NOT create conversation on read - only returns existing data
  // ============================================================================
  app.get('/api/projects/:projectId/ai/conversation', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      // Only get existing conversation - don't create on read
      const conversation = await storage.getProjectConversation(projectId, user.id);
      
      if (!conversation) {
        // No conversation yet - return empty messages (will be created on first POST)
        console.log(`[ConversationPersistence] No conversation exists yet for project ${projectId}`);
        return res.json({
          conversationId: null,
          messages: [],
        });
      }
      
      const messages = await storage.getMessagesByConversation(conversation.id, user.id);
      
      console.log(`[ConversationPersistence] Loaded ${messages.length} messages for project ${projectId}`);
      
      return res.json({
        conversationId: conversation.id,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
          metadata: m.metadata,
        })),
      });
    } catch (error) {
      console.error('Error loading conversation:', error);
      return res.status(500).json({ message: 'Failed to load conversation' });
    }
  });

  app.post('/api/ai/message/stream', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { projectId, message, conversationHistory = [], activeFrame } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    if (projectId) {
      try {
        const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
        if (lifecycleState === 'deleted') {
          return res.status(404).json({ 
            message: 'Project not found',
            code: 'PROJECT_DELETED',
          });
        }
      } catch (error) {
        console.error('[LIFECYCLE GUARD] Error checking AI stream access:', error);
        return res.status(503).json({ 
          message: 'Unable to verify project access. Please try again.',
          code: 'LIFECYCLE_CHECK_FAILED',
        });
      }
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const { streamProcessUserMessage } = await import('../renixAiService');
      
      let context: any = {
        projectId: projectId || 'general',
        projectName: 'RENIX',
        projectStatus: 'open',
        activeFrame: activeFrame || 'overview',
      };
      
      if (projectId) {
        const project = await storage.getProjectById(projectId, user.id);
        if (project) {
          context.projectId = project.id;
          context.projectName = project.name;
          context.projectDescription = project.description || '';
          context.projectType = project.type;
          context.projectStatus = project.status;
          context.currency = (project.regionalContext as any)?.currency || 'USD';
        }
      }
      
      const response = await streamProcessUserMessage(
        message,
        conversationHistory,
        context,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );
      
      res.write(`data: ${JSON.stringify({ done: true, response })}\n\n`);
      res.end();
    } catch (error) {
      console.error('AI stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Failed to process message' })}\n\n`);
      res.end();
    }
  });

  // ============================================================================
  // PROPOSALS ROUTES
  // ============================================================================

  app.get('/api/proposals', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const projectId = req.query.projectId as string | undefined;
    
    try {
      const proposals = await storage.getProposalsByUser(user.id, projectId);
      return res.json({ proposals });
    } catch (error) {
      console.error('Error fetching proposals:', error);
      return res.status(500).json({ message: 'Failed to fetch proposals' });
    }
  });

  app.post('/api/proposals', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const proposalData = req.body;
    
    try {
      if (proposalData.projectId) {
        const lifecycleState = await storage.getProjectLifecycleState(proposalData.projectId, user.id);
        if (lifecycleState === 'closed') {
          return res.status(403).json({ 
            message: 'This project is closed. AI can only explain and explore, not propose changes.',
            code: 'AI_PROPOSALS_BLOCKED',
            lifecycleState: 'closed',
          });
        }
        if (lifecycleState === 'deleted') {
          return res.status(404).json({ 
            message: 'Project not found',
            code: 'PROJECT_DELETED',
          });
        }
      }
      
      const proposal = await storage.createProposal({
        ...proposalData,
        userId: user.id,
        status: 'pending',
      });
      return res.status(201).json(proposal);
    } catch (error) {
      console.error('Error creating proposal:', error);
      return res.status(500).json({ message: 'Failed to create proposal' });
    }
  });

  app.post('/api/proposals/:id/accept', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const proposalId = req.params.id;
    
    try {
      const proposal = await storage.getProposal(proposalId, user.id);
      if (!proposal) {
        return res.status(404).json({ message: 'Proposal not found' });
      }
      
      if (proposal.status !== 'pending') {
        return res.status(400).json({ message: 'Proposal is not pending' });
      }
      
      if (proposal.targetFrame === 'project') {
        const proposedDiff = proposal.proposedDiff as { before: any; after: any } | null;
        const proposedData = proposedDiff?.after;
        if (!proposedData || !proposedData.name) {
          return res.status(400).json({ message: 'Invalid project proposal data' });
        }
        
        const colors = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'indigo'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const createdProject = await storage.createProject({
          userId: user.id,
          name: proposedData.name,
          type: proposedData.project_type || 'renovation',
          description: proposedData.description || '',
          status: 'open',
          color: randomColor,
          regionalContext: {
            region: proposedData.location?.country || 'US',
            currency: proposedData.currency || 'USD',
          },
          members: [],
        });
        
        await storage.updateProposalStatus(proposalId, user.id, 'accepted');
        
        await writeCanonicalMemory(
          createdProject.id,
          user.id,
          'proposal_accepted',
          `Project "${createdProject.name}" was created`,
          ['project'],
          { projectId: createdProject.id }
        );
        
        return res.json({ 
          success: true, 
          projectId: createdProject.id,
          message: 'Project created successfully.',
          redirectTo: `/project/${createdProject.id}/overview`
        });
      }
      
      if (proposal.targetFrame === 'budget' && proposal.projectId) {
        const proposedDiff = proposal.proposedDiff as { before: any; after: any } | null;
        const proposedData = proposedDiff?.after;
        
        if (proposedData) {
          const currentBudget = await storage.getBudgetByProject(proposal.projectId, user.id);
          
          if (currentBudget) {
            const updates: any = {};
            const budgetIntent = proposedData.budget_intent ?? proposedData.budget_intent_total ?? proposedData.total_budget_intent ?? proposedData.budget_intent_eur;
            if (budgetIntent !== undefined) {
              updates.totalBudget = Math.round(budgetIntent);
            }
            if (proposedData.currency !== undefined) {
              updates.currency = proposedData.currency;
            }
            if (proposedData.notes !== undefined) {
              updates.notes = proposedData.notes;
            }
            if (proposedData.contingency_percent !== undefined) {
              updates.contingencyMode = 'percent';
              updates.contingencyValue = proposedData.contingency_percent;
            } else if (proposedData.contingency_fixed !== undefined) {
              updates.contingencyMode = 'fixed';
              updates.contingencyValue = Math.round(proposedData.contingency_fixed);
            } else if (proposedData.contingency && typeof proposedData.contingency === 'object') {
              const ct = proposedData.contingency;
              if (ct.type === 'percent' || ct.type === 'percentage') {
                updates.contingencyMode = 'percent';
                updates.contingencyValue = ct.value ?? ct.amount ?? 0;
              } else if (ct.type === 'fixed') {
                updates.contingencyMode = 'fixed';
                updates.contingencyValue = Math.round(ct.value ?? ct.amount ?? 0);
              }
            }
            
            await storage.updateBudget(currentBudget.id, user.id, updates);
            
            if (proposedData.allocations && Array.isArray(proposedData.allocations)) {
              const existingAllocations = await storage.getAllocationsByBudget(currentBudget.id, user.id);
              for (const existing of existingAllocations) {
                await storage.deleteAllocation(existing.id, user.id);
              }
              
              const projectScopeNodes = await storage.getScopeNodesByProject(proposal.projectId, user.id);
              const scopeNameToId = new Map(projectScopeNodes.map(s => [s.name.toLowerCase(), s.id]));
              
              for (const alloc of proposedData.allocations) {
                let scopeId = alloc.scopeId || alloc.scope_id;
                const scopeName = alloc.scopeName || alloc.scope_name || alloc.label || 'Unlabeled';
                
                if (!scopeId && scopeName) {
                  scopeId = scopeNameToId.get(scopeName.toLowerCase());
                }
                
                await storage.createAllocation({
                  budgetId: currentBudget.id,
                  projectId: proposal.projectId,
                  userId: user.id,
                  createdBy: user.id,
                  label: scopeName,
                  amount: Math.round(alloc.amount_eur || alloc.amount || 0),
                  target: scopeId ? { type: 'scope', scopeId, scopeName } : { type: 'unassigned' },
                  notes: alloc.notes || null,
                });
              }
            }
          } else {
            const budgetIntentForCreate = proposedData.budget_intent ?? proposedData.budget_intent_total ?? proposedData.total_budget_intent ?? proposedData.budget_intent_eur ?? 0;
            const newBudget = await storage.createBudget({
              projectId: proposal.projectId,
              userId: user.id,
              totalBudget: Math.round(budgetIntentForCreate),
              currency: proposedData.currency || 'EUR',
              notes: proposedData.notes || '',
            });
            
            if (proposedData.allocations && Array.isArray(proposedData.allocations)) {
              const projectScopeNodes = await storage.getScopeNodesByProject(proposal.projectId, user.id);
              const scopeNameToId = new Map(projectScopeNodes.map(s => [s.name.toLowerCase(), s.id]));
              
              for (const alloc of proposedData.allocations) {
                let scopeId = alloc.scopeId || alloc.scope_id;
                const scopeName = alloc.scopeName || alloc.scope_name || alloc.label || 'Unlabeled';
                
                if (!scopeId && scopeName) {
                  scopeId = scopeNameToId.get(scopeName.toLowerCase());
                }
                
                await storage.createAllocation({
                  budgetId: newBudget.id,
                  projectId: proposal.projectId,
                  userId: user.id,
                  createdBy: user.id,
                  label: scopeName,
                  amount: Math.round(alloc.amount_eur || alloc.amount || 0),
                  target: scopeId ? { type: 'scope', scopeId, scopeName } : { type: 'unassigned' },
                  notes: alloc.notes || null,
                });
              }
            }
          }
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          await writeCanonicalMemory(
            proposal.projectId,
            user.id,
            'budget_change',
            `Budget was updated: ${proposedData.budget_intent ? `intent set to ${proposedData.budget_intent}` : 'allocations updated'}`,
            ['budget'],
            { proposalId }
          );
          
          return res.json({ 
            success: true, 
            message: 'Budget updated successfully based on proposal.' 
          });
        }
      }
      
      if (proposal.targetFrame === 'scope' && proposal.projectId) {
        const proposedDiff = proposal.proposedDiff as { before: any; after: any } | null;
        
        if (proposedDiff?.after === null && proposedDiff?.before?.name) {
          const scopeNameToDelete = proposedDiff.before.name;
          
          const scopes = await storage.getScopesByProject(proposal.projectId, user.id);
          const scopeToDelete = scopes.find(s => s.name === scopeNameToDelete);
          
          if (scopeToDelete) {
            await storage.deleteScope(scopeToDelete.id, user.id);
            
            await storage.updateProposalStatus(proposalId, user.id, 'accepted');
            
            await writeCanonicalMemory(
              proposal.projectId,
              user.id,
              'scope_removal',
              `Scope "${scopeNameToDelete}" was removed from the project`,
              ['scope'],
              { scopeName: scopeNameToDelete }
            );
            
            return res.json({ 
              success: true, 
              message: `Scope "${scopeNameToDelete}" has been removed.`
            });
          } else {
            await storage.updateProposalStatus(proposalId, user.id, 'accepted');
            
            await writeCanonicalMemory(
              proposal.projectId,
              user.id,
              'scope_removal',
              `Scope "${scopeNameToDelete}" removal accepted (scope was not found, may have already been removed)`,
              ['scope'],
              { scopeName: scopeNameToDelete, wasNoOp: true }
            );
            
            return res.json({ 
              success: true, 
              message: `Scope "${scopeNameToDelete}" was not found (may have already been removed).`
            });
          }
        }
        
        if (proposedDiff?.before?.scopes && proposedDiff?.after?.scopes) {
          const beforeScopes = proposedDiff.before.scopes || [];
          const afterScopes = proposedDiff.after.scopes || [];
          const removedScopes = beforeScopes.filter((s: string) => !afterScopes.includes(s));
          
          if (removedScopes.length > 0) {
            const scopeNameToDelete = removedScopes[0];
            const scopes = await storage.getScopesByProject(proposal.projectId, user.id);
            const scopeToDelete = scopes.find(s => s.name === scopeNameToDelete);
            
            if (scopeToDelete) {
              await storage.deleteScope(scopeToDelete.id, user.id);
              await storage.updateProposalStatus(proposalId, user.id, 'accepted');
              
              return res.json({ 
                success: true, 
                message: `Scope "${scopeNameToDelete}" has been removed.`
              });
            }
          }
        }
        
        // ---- Hierarchical restructuring proposals (scopes with children arrays) ----
        if (proposedDiff?.after?.scopes) {
          const afterScopes = proposedDiff.after.scopes as any[];
          const hasHierarchical = afterScopes.some((s: any) => s && typeof s === 'object' && Array.isArray(s.children));
          
          if (hasHierarchical) {
            const existingNodes = await storage.getScopeNodesByProject(proposal.projectId, user.id);
            const existingScopes = await storage.getScopesByProject(proposal.projectId, user.id);
            const beforeScopes = (proposedDiff.before?.scopes || []) as any[];
            
            const findNodeByName = (name: string) =>
              existingNodes.find(n => n.name.toLowerCase() === name.toLowerCase());
            const findScopeByName = (name: string) =>
              existingScopes.find(s => s.name.toLowerCase() === name.toLowerCase());
            
            const createdNodeIds: string[] = [];
            const movedNodeIds: string[] = [];
            const renamedNodes: string[] = [];
            const allNames: string[] = [];
            
            for (const parentSpec of afterScopes) {
              if (!parentSpec || typeof parentSpec !== 'object' || !parentSpec.name) continue;
              
              const parentName: string = parentSpec.name;
              const parentNotes: string | null = parentSpec.notes || parentSpec.description || null;
              const children: any[] = Array.isArray(parentSpec.children) ? parentSpec.children : [];
              allNames.push(parentName);
              
              let parentNode = findNodeByName(parentName);
              
              if (!parentNode && beforeScopes.length > 0) {
                const beforeName = beforeScopes.find((bs: any) => {
                  const bName = typeof bs === 'string' ? bs : bs?.name;
                  return bName && bName.toLowerCase() !== parentName.toLowerCase();
                });
                if (beforeName) {
                  const oldName = typeof beforeName === 'string' ? beforeName : beforeName.name;
                  parentNode = findNodeByName(oldName);
                  if (parentNode) {
                    await storage.updateScopeNode(parentNode.id, user.id, { name: parentName });
                    const matchingScope = findScopeByName(oldName);
                    if (matchingScope) {
                      await storage.updateScope(matchingScope.id, user.id, { name: parentName });
                    }
                    renamedNodes.push(`${oldName} → ${parentName}`);
                  }
                }
              }
              
              if (!parentNode) {
                const newScope = await storage.createScope({
                  projectId: proposal.projectId,
                  userId: user.id,
                  name: parentName,
                  description: parentNotes,
                  isOptional: false,
                  createdBy: 'AI',
                });
                const nodeData: any = {
                  projectId: proposal.projectId,
                  userId: user.id,
                  parentId: null,
                  name: parentName,
                  description: parentNotes,
                  tags: [],
                  isArchived: false,
                  isExpanded: true,
                  createdBy: 'AI',
                };
                if (typeof parentSpec.sort_order === 'number') {
                  nodeData.sortOrder = parentSpec.sort_order;
                }
                parentNode = await storage.createScopeNode(nodeData);
                createdNodeIds.push(parentNode.id);
              }
              
              if (parentNotes && parentNode && !createdNodeIds.includes(parentNode.id)) {
                await storage.updateScopeNode(parentNode.id, user.id, { description: parentNotes });
              }
              
              for (let ci = 0; ci < children.length; ci++) {
                const child = children[ci];
                if (!child || !child.name) continue;
                
                const childName: string = child.name;
                const childNotes: string | null = child.notes || child.description || null;
                const childSortOrder = typeof child.sort_order === 'number' ? child.sort_order : (ci + 1) * 1000;
                allNames.push(childName);
                
                const existingChild = findNodeByName(childName);
                
                if (existingChild) {
                  await storage.moveScopeNode(existingChild.id, user.id, parentNode.id, childSortOrder);
                  if (childNotes) {
                    await storage.updateScopeNode(existingChild.id, user.id, { description: childNotes });
                  }
                  movedNodeIds.push(existingChild.id);
                } else {
                  const childScope = await storage.createScope({
                    projectId: proposal.projectId,
                    userId: user.id,
                    name: childName,
                    description: childNotes,
                    isOptional: false,
                    createdBy: 'AI',
                  });
                  const childNode = await storage.createScopeNode({
                    projectId: proposal.projectId,
                    userId: user.id,
                    parentId: parentNode.id,
                    name: childName,
                    description: childNotes,
                    tags: [],
                    isArchived: false,
                    isExpanded: true,
                    createdBy: 'AI',
                    sortOrder: childSortOrder,
                  });
                  createdNodeIds.push(childNode.id);
                }
              }
            }
            
            await storage.updateProposalStatus(proposalId, user.id, 'accepted');
            
            const parts: string[] = [];
            if (createdNodeIds.length > 0) parts.push(`${createdNodeIds.length} scope(s) created`);
            if (movedNodeIds.length > 0) parts.push(`${movedNodeIds.length} scope(s) reparented`);
            if (renamedNodes.length > 0) parts.push(`renamed: ${renamedNodes.join(', ')}`);
            const detail = parts.length > 0 ? parts.join('; ') : 'structure updated';
            
            await writeCanonicalMemory(
              proposal.projectId,
              user.id,
              'scope_change',
              `Scope restructuring accepted: ${detail}. Scopes: ${allNames.join(', ')}`,
              ['scope'],
              { createdNodeIds, movedNodeIds, renamedNodes }
            );
            
            return res.json({
              success: true,
              createdNodeIds,
              movedNodeIds,
              renamedNodes,
              message: `Scope restructuring complete: ${detail}.`,
            });
          }
        }
        
        const getScopeName = (s: any): string => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && s.name) return s.name;
          return String(s);
        };
        
        let scopesToCreate: Array<{ name: string; description: string | null; sortOrder?: number }> = [];
        
        if (proposedDiff?.after?.new_scope?.name) {
          scopesToCreate.push({
            name: proposedDiff.after.new_scope.name,
            description: proposedDiff.after.new_scope.description || null,
          });
        }
        else if (proposedDiff?.after?.scopes) {
          const beforeScopes = proposedDiff?.before?.scopes || [];
          const afterScopes = proposedDiff.after.scopes || [];
          
          const beforeNames = beforeScopes.map(getScopeName);
          
          const newScopes = afterScopes.filter((s: any) => !beforeNames.includes(getScopeName(s)));
          
          for (const scope of newScopes) {
            const scopeName = getScopeName(scope);
            let scopeDescription: string | null = null;
            
            if (typeof scope === 'object' && scope !== null) {
              scopeDescription = scope.notes || scope.description || null;
            } else {
              const scopeDetails = proposedDiff.after[scopeName];
              if (scopeDetails && typeof scopeDetails === 'object') {
                if (scopeDetails.description) {
                  scopeDescription = scopeDetails.description;
                } else if (scopeDetails.notes) {
                  scopeDescription = scopeDetails.notes;
                } else if (scopeDetails.included_work && Array.isArray(scopeDetails.included_work)) {
                  scopeDescription = scopeDetails.included_work.slice(0, 3).join(', ');
                }
              }
            }
            
            const sortOrder = (typeof scope === 'object' && scope !== null && typeof scope.sort_order === 'number')
              ? scope.sort_order : undefined;
            scopesToCreate.push({ name: scopeName, description: scopeDescription, sortOrder });
          }
        }
        
        if (scopesToCreate.length > 0) {
          const createdScopes = [];
          const createdNodes = [];
          for (const scope of scopesToCreate) {
            const createdScope = await storage.createScope({
              projectId: proposal.projectId,
              userId: user.id,
              name: scope.name,
              description: scope.description,
              isOptional: false,
              createdBy: 'AI',
            });
            createdScopes.push(createdScope);
            
            const nodeData: any = {
              projectId: proposal.projectId,
              userId: user.id,
              parentId: null,
              name: scope.name,
              description: scope.description,
              tags: [],
              isArchived: false,
              isExpanded: true,
              createdBy: 'AI',
            };
            if (scope.sortOrder !== undefined) {
              nodeData.sortOrder = scope.sortOrder;
            }
            const createdNode = await storage.createScopeNode(nodeData);
            createdNodes.push(createdNode);
          }
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          const scopeNames = scopesToCreate.map(s => s.name).join(', ');
          await writeCanonicalMemory(
            proposal.projectId,
            user.id,
            'scope_change',
            `Scope${scopesToCreate.length > 1 ? 's' : ''} created: ${scopeNames}`,
            ['scope'],
            { scopeNames: scopesToCreate.map(s => s.name), scopeIds: createdScopes.map(s => s.id) }
          );
          
          const message = scopesToCreate.length === 1 
            ? `Scope "${scopesToCreate[0].name}" created successfully.`
            : `${scopesToCreate.length} scopes created successfully.`;
          
          return res.json({ 
            success: true, 
            scopeIds: createdScopes.map(s => s.id),
            nodeIds: createdNodes.map(n => n.id),
            message
          });
        }
      }
      
      if (proposal.targetFrame === 'financing' && proposal.projectId) {
        const proposedDiff = proposal.proposedDiff as { before: any; after: any } | null;
        const proposedData = proposedDiff?.after;
        
        if (proposedData) {
          const createdSources: any[] = [];
          
          if (proposedData.name && proposedData.amount !== undefined) {
            const source = await storage.createSource({
              projectId: proposal.projectId,
              userId: user.id,
              createdBy: user.id,
              name: proposedData.name,
              type: proposedData.type || 'other',
              amount: Math.round(proposedData.amount),
              status: proposedData.status || 'planned',
              notes: proposedData.notes || null,
              monthlyLiability: proposedData.monthly_liability || proposedData.monthlyLiability || null,
            });
            createdSources.push(source);
          }
          
          if (proposedData.sources && Array.isArray(proposedData.sources)) {
            for (const sourceData of proposedData.sources) {
              if (sourceData.name && sourceData.amount !== undefined) {
                const source = await storage.createSource({
                  projectId: proposal.projectId,
                  userId: user.id,
                  createdBy: user.id,
                  name: sourceData.name,
                  type: sourceData.type || 'other',
                  amount: Math.round(sourceData.amount),
                  status: sourceData.status || 'planned',
                  notes: sourceData.notes || null,
                  monthlyLiability: sourceData.monthly_liability || sourceData.monthlyLiability || null,
                });
                createdSources.push(source);
              }
            }
          }
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          if (createdSources.length > 0) {
            const sourceNames = createdSources.map(s => s.name).join(', ');
            const totalAmount = createdSources.reduce((sum, s) => sum + s.amount, 0);
            await writeCanonicalMemory(
              proposal.projectId,
              user.id,
              'financing_change',
              `Financing source${createdSources.length > 1 ? 's' : ''} added: ${sourceNames} (total: ${totalAmount})`,
              ['financing'],
              { sourceIds: createdSources.map(s => s.id), totalAmount }
            );
          }
          
          const message = createdSources.length === 1
            ? `Financing source "${createdSources[0].name}" created successfully.`
            : createdSources.length > 1
              ? `${createdSources.length} financing sources created successfully.`
              : 'Financing proposal accepted.';
          
          return res.json({ 
            success: true, 
            sourceIds: createdSources.map(s => s.id),
            message
          });
        }
      }
      
      if (proposal.targetFrame === 'budget' && proposal.projectId) {
        const diff = proposal.proposedDiff as any;
        const afterData = diff?.after || {};
        
        if (afterData.allocations && Array.isArray(afterData.allocations)) {
          let budget = await storage.getBudgetByProject(proposal.projectId, user.id);
          
          if (!budget) {
            budget = await storage.createBudget({
              projectId: proposal.projectId,
              userId: user.id,
              totalBudget: afterData.budget_intent_eur || afterData.base_budget_eur || 0,
              currency: 'EUR',
              notes: '',
              contingencyMode: 'percentage',
              contingencyValue: afterData.contingency_percent || 10,
            });
          } else {
            if (afterData.contingency_percent !== undefined) {
              await storage.updateBudget(budget.id, user.id, {
                contingencyMode: 'percentage',
                contingencyValue: afterData.contingency_percent,
              });
            }
          }
          
          const existingAllocations = await storage.getAllocationsByBudget(budget.id, user.id);
          
          const createdAllocations: any[] = [];
          for (const alloc of afterData.allocations) {
            const scopeId = alloc.scopeId || alloc.scope_id;
            const exists = existingAllocations.some(ea => {
              const target = ea.target as any;
              return target?.scopeId === scopeId || target?.scopeNodeId === scopeId;
            });
            
            if (!exists && scopeId) {
              const created = await storage.createAllocation({
                budgetId: budget.id,
                projectId: proposal.projectId,
                userId: user.id,
                label: alloc.scopeName || alloc.label || 'Allocation',
                amount: alloc.base_amount_eur || alloc.amount || 0,
                target: { type: 'scope', scopeId: scopeId, scopeName: alloc.scopeName || alloc.label || '' },
                notes: alloc.notes || null,
                createdBy: 'ai_proposal',
              });
              createdAllocations.push(created);
            }
          }
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          const totalAllocated = createdAllocations.reduce((sum, a) => sum + a.amount, 0);
          await writeCanonicalMemory(
            proposal.projectId,
            user.id,
            'budget_change',
            `Budget allocations created: ${createdAllocations.length} allocations totaling ${totalAllocated}`,
            ['budget'],
            { allocationIds: createdAllocations.map(a => a.id), totalAllocated }
          );
          
          return res.json({
            success: true,
            allocationIds: createdAllocations.map(a => a.id),
            message: `${createdAllocations.length} budget allocations created successfully.`
          });
        }
        
        if (afterData.contingency_percent !== undefined) {
          let budget = await storage.getBudgetByProject(proposal.projectId, user.id);
          
          if (budget) {
            await storage.updateBudget(budget.id, user.id, {
              contingencyMode: 'percentage',
              contingencyValue: afterData.contingency_percent,
            });
            
            await storage.updateProposalStatus(proposalId, user.id, 'accepted');
            
            await writeCanonicalMemory(
              proposal.projectId,
              user.id,
              'budget_change',
              `Contingency updated to ${afterData.contingency_percent}%`,
              ['budget'],
              { contingencyValue: afterData.contingency_percent }
            );
            
            return res.json({
              success: true,
              message: `Contingency updated to ${afterData.contingency_percent}%.`
            });
          }
        }
      }
      
      if (proposal.targetFrame === 'vendor' && proposal.projectId) {
        const diff = proposal.proposedDiff as any;
        const afterData = diff?.after || {};
        
        if (afterData.name || afterData.vendor_name) {
          const vendorData = {
            projectId: proposal.projectId,
            userId: user.id,
            name: afterData.name || afterData.vendor_name,
            email: afterData.email || afterData.contact_email || null,
            phone: afterData.phone || afterData.contact_phone || null,
            address: afterData.address || null,
            notes: afterData.notes || null,
          };
          
          const vendor = await storage.createVendor(vendorData);
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          await writeCanonicalMemory(
            proposal.projectId,
            user.id,
            'vendor_added',
            `Vendor "${vendor.name}" was added to the project`,
            ['quotes'],
            { vendorId: vendor.id, vendorName: vendor.name }
          );
          
          return res.json({
            success: true,
            vendorId: vendor.id,
            message: `Vendor "${vendor.name}" created successfully.`
          });
        }
      }
      
      if (proposal.targetFrame === 'invoices' && proposal.projectId) {
        const diff = proposal.proposedDiff as any;
        const afterData = diff?.after || {};
        
        if (afterData.reference || afterData.invoice_number) {
          const invoiceData = {
            projectId: proposal.projectId,
            userId: user.id,
            createdBy: user.id,
            vendorName: afterData.vendorName || afterData.vendor_name || 'Unknown Vendor',
            vendorId: afterData.vendorId || afterData.vendor_id || null,
            reference: afterData.reference || afterData.invoice_number,
            status: 'draft' as const,
            notes: afterData.notes || null,
          };
          
          const invoice = await storage.createInvoice(invoiceData);
          
          const lineItems = afterData.line_items || afterData.lineItems || [];
          for (const line of lineItems) {
            await storage.createInvoiceLine({
              invoiceId: invoice.id,
              projectId: proposal.projectId,
              userId: user.id,
              label: line.label || line.description || 'Line Item',
              description: line.description || null,
              amount: Math.round(line.total_price || line.totalPrice || line.amount || 0),
              scopeItemId: line.scope_id || line.scopeId || null,
              scopeItemName: line.scope_name || line.scopeName || null,
            });
          }
          
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          
          await writeCanonicalMemory(
            proposal.projectId,
            user.id,
            'invoice_created',
            `Invoice "${invoice.reference}" was created`,
            ['invoices'],
            { invoiceId: invoice.id, reference: invoice.reference }
          );
          
          return res.json({
            success: true,
            invoiceId: invoice.id,
            message: `Invoice "${invoice.reference}" created successfully.`
          });
        }
      }

      if (proposal.targetFrame === 'execution' && proposal.projectId) {
        const diff = proposal.proposedDiff as any;
        const afterData = diff?.after || {};
        const taskItems = afterData.tasks || [afterData];
        const validTasks = taskItems.filter((t: any) => t && (t.label || t.title || t.name));

        if (validTasks.length === 0) {
          await storage.updateProposalStatus(proposalId, user.id, 'accepted');
          return res.json({
            success: true,
            message: 'Execution proposal accepted but no valid tasks found to create.'
          });
        }

        const createdTasks: any[] = [];
        const VALID_STATUSES = ['to_do', 'in_progress', 'done'];

        for (const t of validTasks) {
          const rawStart = t.plannedStart || t.planned_start;
          const rawEnd = t.plannedEnd || t.planned_end;
          const parsedStart = rawStart ? new Date(rawStart) : null;
          const parsedEnd = rawEnd ? new Date(rawEnd) : null;

          const status = VALID_STATUSES.includes(t.status) ? t.status : 'to_do';

          const resp = t.responsibility && typeof t.responsibility === 'object' && t.responsibility.type
            ? t.responsibility
            : { type: 'me' };

          const taskData = {
            projectId: proposal.projectId,
            userId: user.id,
            createdBy: user.id,
            label: String(t.label || t.title || t.name),
            description: t.description ? String(t.description) : null,
            status,
            scopeItemId: t.scopeItemId || t.scope_item_id || null,
            scopeItemName: t.scopeItemName || t.scope_item_name || null,
            plannedStart: parsedStart && !isNaN(parsedStart.getTime()) ? parsedStart : null,
            plannedEnd: parsedEnd && !isNaN(parsedEnd.getTime()) ? parsedEnd : null,
            responsibility: resp,
            notes: t.notes ? String(t.notes) : null,
            assignee: t.assignee ? String(t.assignee) : null,
            linkedDocuments: t.linkedDocuments || t.linked_documents || null,
            linkedInvoices: t.linkedInvoices || t.linked_invoices || null,
          };

          const created = await storage.createTask(taskData);
          createdTasks.push(created);
        }

        await storage.updateProposalStatus(proposalId, user.id, 'accepted');
        invalidateOverviewCache(proposal.projectId);

        const taskLabels = createdTasks.map((t: any) => t.label).join(', ');
        await writeCanonicalMemory(
          proposal.projectId,
          user.id,
          'execution_tasks_created',
          `Created ${createdTasks.length} execution task(s): ${taskLabels}`,
          ['execution'],
          { taskIds: createdTasks.map((t: any) => t.id), count: createdTasks.length }
        );

        return res.json({
          success: true,
          taskIds: createdTasks.map((t: any) => t.id),
          executionTasksCreated: createdTasks.length,
          message: createdTasks.length === 1
            ? `Task "${createdTasks[0].label}" created successfully.`
            : `${createdTasks.length} tasks created successfully.`
        });
      }
      
      const updated = await storage.updateProposalStatus(proposalId, user.id, 'accepted');
      
      if (proposal.projectId) {
        await writeCanonicalMemory(
          proposal.projectId,
          user.id,
          'proposal_accepted',
          `Proposal for ${proposal.targetFrame} was accepted`,
          [proposal.targetFrame],
          { proposalId }
        );
      }
      
      return res.json({ 
        success: true, 
        proposal: updated,
        message: 'Proposal accepted.'
      });
    } catch (error) {
      console.error('Error accepting proposal:', error);
      return res.status(500).json({ message: 'Failed to accept proposal' });
    }
  });

  app.post('/api/proposals/:id/reject', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const proposalId = req.params.id;
    const { reason } = req.body;
    
    try {
      const proposal = await storage.getProposal(proposalId, user.id);
      if (!proposal) {
        return res.status(404).json({ message: 'Proposal not found' });
      }
      
      if (proposal.status !== 'pending') {
        return res.status(400).json({ message: 'Proposal is not pending' });
      }
      
      const updated = await storage.updateProposalStatus(proposalId, user.id, 'rejected', reason);
      
      if (proposal.projectId) {
        const summary = reason 
          ? `Proposal for ${proposal.targetFrame} was rejected: ${reason}`
          : `Proposal for ${proposal.targetFrame} was rejected (no reason given)`;
        await writeCanonicalMemory(
          proposal.projectId,
          user.id,
          'proposal_rejected',
          summary,
          [proposal.targetFrame],
          { proposalId, reason: reason || null, targetFrame: proposal.targetFrame }
        );
      }
      
      return res.json({ success: true, proposal: updated });
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      return res.status(500).json({ message: 'Failed to reject proposal' });
    }
  });
}
