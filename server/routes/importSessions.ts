import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

interface ImportSession {
  id: string;
  projectId: string;
  scopeId: string;
  userId: string;
  documentId: string | null;
  quoteVersionId: string | null;
  state: 'uploading' | 'extracting' | 'reviewing' | 'allocating' | 'completed' | 'cancelled';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const sessions = new Map<string, ImportSession>();

const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  'uploading': ['extracting', 'cancelled'],
  'extracting': ['reviewing', 'cancelled'],
  'reviewing': ['allocating', 'cancelled'],
  'allocating': ['completed', 'cancelled'],
  'completed': [],
  'cancelled': [],
};

function findActiveSession(projectId: string, scopeId: string, userId: string): ImportSession | null {
  for (const session of Array.from(sessions.values())) {
    if (
      session.projectId === projectId &&
      session.scopeId === scopeId &&
      session.userId === userId &&
      session.state !== 'completed' &&
      session.state !== 'cancelled'
    ) {
      return session;
    }
  }
  return null;
}

export function registerImportSessionRoutes(app: Express): void {
  app.get('/api/projects/:projectId/scopes/:scopeId/import-session', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, scopeId } = req.params;
      const session = findActiveSession(projectId, scopeId, user.id);
      return res.json({ session: session || null });
    } catch (error) {
      console.error('Error getting import session:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scopes/:scopeId/import-session', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, scopeId } = req.params;

      const existing = findActiveSession(projectId, scopeId, user.id);
      if (existing) {
        return res.status(409).json({
          message: 'An active import session already exists for this scope',
          session: existing,
        });
      }

      const now = new Date().toISOString();
      const session: ImportSession = {
        id: randomUUID(),
        projectId,
        scopeId,
        userId: user.id,
        documentId: null,
        quoteVersionId: null,
        state: 'uploading',
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(session.id, session);

      return res.status(201).json({ session });
    } catch (error) {
      console.error('Error creating import session:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/import-sessions/:sessionId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { sessionId } = req.params;
      const { state, documentId, quoteVersionId, errorMessage } = req.body;

      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) {
        return res.status(404).json({ message: 'Import session not found' });
      }

      if (state && state !== session.state) {
        const validTransitions = VALID_STATE_TRANSITIONS[session.state] || [];
        if (!validTransitions.includes(state)) {
          return res.status(400).json({
            message: `Invalid state transition from '${session.state}' to '${state}'`,
            validTransitions,
          });
        }
      }

      if (state !== undefined) session.state = state;
      if (documentId !== undefined) session.documentId = documentId;
      if (quoteVersionId !== undefined) session.quoteVersionId = quoteVersionId;
      if (errorMessage !== undefined) session.errorMessage = errorMessage;
      session.updatedAt = new Date().toISOString();

      return res.json({ session });
    } catch (error) {
      console.error('Error updating import session:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/import-sessions/:sessionId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { sessionId } = req.params;

      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) {
        return res.status(404).json({ message: 'Import session not found' });
      }

      sessions.delete(sessionId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting import session:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scopes/:scopeId/allocate-quote', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, scopeId } = req.params;
      const { sessionId, acceptedData, selectedRowIds } = req.body;

      console.log('[allocate-quote] Received request:', {
        projectId,
        scopeId,
        sessionId,
        hasAcceptedData: !!acceptedData,
        treeLength: acceptedData?.tree?.length ?? 0,
        selectedRowIds: selectedRowIds?.length ?? 'allocate all',
      });

      if (!acceptedData) {
        return res.status(400).json({ message: 'Missing acceptedData' });
      }

      if (!acceptedData.tree || !Array.isArray(acceptedData.tree) || acceptedData.tree.length === 0) {
        return res.status(400).json({ message: 'No rows to allocate. Please ensure the extraction has at least one line item.' });
      }

      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) {
        return res.status(404).json({ message: 'Import session not found' });
      }
      if (session.state !== 'allocating') {
        return res.status(400).json({ message: 'Session is not in allocating state' });
      }
      if (!session.documentId) {
        return res.status(400).json({ message: 'Session has no document attached' });
      }

      const document = await storage.getDocumentById(session.documentId, user.id);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      let vendorId: string | null = null;
      if (acceptedData.vendor) {
        if (acceptedData.vendor.type === 'existing') {
          vendorId = acceptedData.vendor.vendorId;
        } else if (acceptedData.vendor.type === 'new' && acceptedData.vendor.vendorName) {
          const newVendor = await storage.createVendor({
            projectId,
            userId: user.id,
            name: acceptedData.vendor.vendorName,
          });
          vendorId = newVendor.id;
        }
      }

      const sourceDoc = await storage.createSourceDocument({
        projectId,
        userId: user.id,
        fileName: document.fileName || document.title || 'Uploaded Quote',
        fileType: document.mimeType || 'application/pdf',
        fileDataUrl: document.fileDataUrl || null,
        documentId: document.id,
      });

      const calcTotal = (nodes: any[]): number => {
        let sum = 0;
        for (const node of nodes) {
          const hasChildren = node.children && node.children.length > 0;
          if (node.totalPrice != null && node.rowType === 'line_item' && !hasChildren) {
            sum += Math.round(node.totalPrice * 100);
          }
          if (hasChildren) {
            sum += calcTotal(node.children);
          }
        }
        return sum;
      };

      const rawTotal = acceptedData.financials?.grossTotal ?? acceptedData.financials?.netTotal ?? null;
      const totalFromTree = calcTotal(acceptedData.tree || []);
      const total = Number.isFinite(rawTotal) ? Math.round(rawTotal * 100) : totalFromTree;

      const quote = await storage.createQuote({
        vendorId,
        projectId,
        userId: user.id,
        description: acceptedData.vendor?.vendorName
          ? `Quote from ${acceptedData.vendor.vendorName}`
          : 'Imported Quote',
        status: 'new',
        scopeId,
        sourceDocumentId: sourceDoc.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        lineageId: undefined,
      });

      const quoteVersion = await storage.createQuoteVersion({
        projectId,
        userId: user.id,
        quoteId: quote.id,
        sourceDocumentId: sourceDoc.id,
        versionNumber: 1,
        extractionStatus: 'draft',
        commitmentStatus: null,
        notes: 'Initial version from import pipeline',
      });

      await storage.updateQuote(quote.id, user.id, {
        legacyVersionId: quoteVersion.id,
        lineageId: quote.id,
      });

      if (acceptedData.vendor) {
        const vendorName = acceptedData.vendor.type === 'new'
          ? acceptedData.vendor.vendorName
          : null;
        if (vendorName) {
          try {
            await storage.createVendorSnapshot({
              projectId,
              userId: user.id,
              quoteVersionId: quoteVersion.id,
              name: vendorName,
              confidence: 'high',
              contactDetails: {},
            });
          } catch (e) {
            console.error('[allocate-quote] Vendor snapshot creation error:', e);
          }
        }
      }

      try {
        await storage.createQuoteMetadata({
          projectId,
          userId: user.id,
          quoteVersionId: quoteVersion.id,
          quoteNumber: acceptedData.quoteReference ?? null,
          quoteDate: acceptedData.quoteDate ? new Date(acceptedData.quoteDate) : null,
          currency: acceptedData.currency ?? 'EUR',
        });
      } catch (e) {
        console.error('[allocate-quote] Quote metadata creation error:', e);
      }

      const flattenTree = (nodes: any[], orderStart: number = 0): { items: any[]; nextOrder: number } => {
        const items: any[] = [];
        let orderIndex = orderStart;
        for (const node of nodes) {
          items.push({
            nodeId: node.id || null,
            originalNumber: node.number || null,
            description: node.description || '',
            quantity: node.quantity ?? null,
            unit: node.unit ?? null,
            unitPrice: node.unitPrice != null ? Math.round(node.unitPrice * 100) : null,
            totalPrice: node.totalPrice != null ? Math.round(node.totalPrice * 100) : null,
            lineType: node.rowType || 'item',
            orderIndex,
          });
          orderIndex++;
          if (node.children && node.children.length > 0) {
            const childResult = flattenTree(node.children, orderIndex);
            items.push(...childResult.items);
            orderIndex = childResult.nextOrder;
          }
        }
        return { items, nextOrder: orderIndex };
      };

      const { items: allFlatItems } = flattenTree(acceptedData.tree || []);

      let flatItems = allFlatItems;
      if (selectedRowIds && Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
        const selectedSet = new Set(selectedRowIds);
        flatItems = allFlatItems.filter((item: any) => item.nodeId && selectedSet.has(item.nodeId));
      }

      console.log(`[allocate-quote] Persisting ${flatItems.length} line items (of ${allFlatItems.length} total)`);

      for (const item of flatItems) {
        await storage.createQuoteLineItem({
          projectId,
          userId: user.id,
          quoteVersionId: quoteVersion.id,
          originalNumber: item.originalNumber ? String(item.originalNumber) : String(item.orderIndex + 1),
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          lineType: item.lineType,
        });
      }

      const netTotal = acceptedData.financials?.netTotal != null
        ? Math.round(acceptedData.financials.netTotal * 100)
        : null;
      const taxAmount = acceptedData.financials?.taxAmount != null
        ? Math.round(acceptedData.financials.taxAmount * 100)
        : null;
      const grossTotal = acceptedData.financials?.grossTotal != null
        ? Math.round(acceptedData.financials.grossTotal * 100)
        : null;

      await storage.createQuoteTotals({
        projectId,
        userId: user.id,
        quoteVersionId: quoteVersion.id,
        subtotal: netTotal,
        totalTax: taxAmount,
        grandTotal: grossTotal ?? total,
      });

      await storage.confirmDocument(document.id, user.id);

      session.quoteVersionId = quoteVersion.id;
      session.state = 'completed';
      session.updatedAt = new Date().toISOString();

      invalidateOverviewCache(projectId);

      console.log(`[allocate-quote] Success: quote=${quote.id}, version=${quoteVersion.id}, lineItems=${flatItems.length}`);

      return res.status(201).json({
        success: true,
        quoteId: quote.id,
        quoteVersionId: quoteVersion.id,
        allocatedRowCount: flatItems.length,
      });
    } catch (error) {
      console.error('Error allocating quote:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
