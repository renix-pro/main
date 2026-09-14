/**
 * RENIX vNext — Invoices Routes
 * 
 * Canon v1.4 Compliant — Phase 10.1
 * 
 * Core invariants:
 * - Invoice creation via AI ingestion only (no direct create in UI)
 * - Payments are append-only
 * - Payment cannot exceed outstanding amount
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertInvoiceSchema,
  insertInvoiceLineSchema,
  insertInvoicePaymentSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

export function registerInvoicesRoutes(app: Express): void {
  app.get('/api/projects/:projectId/invoices', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const invoices = await storage.getInvoicesByProject(projectId, user.id);
      const payments = await storage.getPaymentsByProject(projectId, user.id);
      const linesMap: Record<string, any[]> = {};
      const paymentsMap: Record<string, any[]> = {};
      for (const invoice of invoices) {
        const lines = await storage.getLinesByInvoice(invoice.id, user.id);
        linesMap[invoice.id] = lines.map((line: any) => ({
          ...line,
          amount: line.amount != null ? line.amount / 100 : line.amount,
        }));
        paymentsMap[invoice.id] = payments
          .filter(p => p.invoiceId === invoice.id)
          .map((p: any) => ({
            ...p,
            amount: p.amount != null ? p.amount / 100 : p.amount,
          }));
      }
      return res.json({ invoices, lines: linesMap, payments: paymentsMap });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invoice creation is restricted to AI ingestion process only (Canon v1.4)
  // This endpoint requires a special header to prevent direct UI creation
  app.post('/api/projects/:projectId/invoices', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      // Check for AI ingestion header - only AI document processing can create invoices
      const aiIngestionHeader = req.headers['x-renix-ai-ingestion'];
      if (aiIngestionHeader !== 'true') {
        return res.status(403).json({ 
          message: 'Invoice creation is restricted to AI document ingestion only',
          code: 'AI_INGESTION_REQUIRED',
        });
      }
      
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertInvoiceSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const invoice = await storage.createInvoice(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(invoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/invoices/:invoiceId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { invoiceId } = req.params;
      const invoice = await storage.updateInvoice(invoiceId, user.id, req.body);
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(invoice);
    } catch (error) {
      console.error('Error updating invoice:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/invoices/:invoiceId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, invoiceId } = req.params;

      const deleted = await storage.deleteInvoiceCascade(invoiceId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/invoices/:invoiceId/lines', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, invoiceId } = req.params;
      const amountCents = req.body.amount != null ? Math.round(req.body.amount * 100) : req.body.amount;
      const parsed = insertInvoiceLineSchema.safeParse({ ...req.body, amount: amountCents, projectId, invoiceId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const line = await storage.createInvoiceLine(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(line);
    } catch (error) {
      console.error('Error creating invoice line:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/invoice-lines/:lineId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { lineId } = req.params;
      const updates = { ...req.body };
      if (updates.amount != null) {
        updates.amount = Math.round(updates.amount * 100);
      }
      const line = await storage.updateInvoiceLine(lineId, user.id, updates);
      if (!line) {
        return res.status(404).json({ message: 'Invoice line not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(line);
    } catch (error) {
      console.error('Error updating invoice line:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/invoice-lines/:lineId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { lineId } = req.params;
      const deleted = await storage.deleteInvoiceLine(lineId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Invoice line not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting invoice line:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // INVOICE PAYMENTS (Append-only - No update/delete)
  // ============================================================================

  app.get('/api/projects/:projectId/invoices/:invoiceId/payments', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { invoiceId } = req.params;
      const payments = await storage.getPaymentsByInvoice(invoiceId, user.id);
      return res.json({ payments: payments.map((p: any) => ({
        ...p,
        amount: p.amount != null ? p.amount / 100 : p.amount,
      })) });
    } catch (error) {
      console.error('Error fetching invoice payments:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/invoices/:invoiceId/payments', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, invoiceId } = req.params;
      
      // Validate amount > 0 AND amount <= outstanding
      // Frontend sends amount in whole currency units; convert to cents for storage
      const outstanding = await storage.getInvoiceOutstandingAmount(invoiceId, user.id);
      const amount = req.body.amount;
      
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Payment amount must be greater than 0' });
      }
      
      const amountCents = Math.round(amount * 100);
      
      if (amountCents > outstanding) {
        return res.status(400).json({ 
          message: 'Payment amount cannot exceed outstanding amount',
          outstanding: outstanding / 100,
          requested: amount,
        });
      }
      
      const parsed = insertInvoicePaymentSchema.safeParse({ 
        ...req.body, 
        amount: amountCents,
        projectId, 
        invoiceId, 
        userId: user.id,
        createdBy: user.id,
        paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      });
      
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      
      const payment = await storage.createInvoicePayment(parsed.data);
      
      // Auto-update invoice status if fully paid
      const newOutstanding = await storage.getInvoiceOutstandingAmount(invoiceId, user.id);
      if (newOutstanding === 0) {
        await storage.updateInvoice(invoiceId, user.id, {
          status: 'paid',
          paidAt: new Date(),
        });
      } else {
        // Ensure invoice is at least finalized if partially paid
        const invoices = await storage.getInvoicesByProject(projectId, user.id);
        const invoice = invoices.find(i => i.id === invoiceId);
        if (invoice && invoice.status === 'draft') {
          await storage.updateInvoice(invoiceId, user.id, {
            status: 'finalized',
            finalizedAt: new Date(),
          });
        }
      }
      
      invalidateOverviewCache(projectId);
      return res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating invoice payment:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/invoices/:invoiceId/payments/:paymentId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, invoiceId, paymentId } = req.params;

      const payments = await storage.getPaymentsByInvoice(invoiceId, user.id);
      const payment = payments.find(p => p.id === paymentId);
      if (!payment || payment.projectId !== projectId) {
        return res.status(404).json({ message: 'Payment not found for this invoice' });
      }

      const deleted = await storage.deleteInvoicePayment(paymentId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      const outstanding = await storage.getInvoiceOutstandingAmount(invoiceId, user.id);
      if (outstanding > 0) {
        const invoices = await storage.getInvoicesByProject(projectId, user.id);
        const invoice = invoices.find(i => i.id === invoiceId);
        if (invoice && invoice.status === 'paid') {
          await storage.updateInvoice(invoiceId, user.id, {
            status: 'finalized',
            paidAt: null,
          });
        }
      }

      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting invoice payment:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/invoices/manual', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { vendorName, reference, issueDate, dueDate, notes, scopeId, lines } = req.body;

      if (!scopeId) {
        return res.status(400).json({ message: 'scopeId is required for manual invoice creation' });
      }

      if (!vendorName || typeof vendorName !== 'string' || !vendorName.trim()) {
        return res.status(400).json({ message: 'vendorName is required' });
      }

      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ message: 'At least one line item is required' });
      }

      const scopeNode = await storage.getScopeNodeById(scopeId, user.id);
      if (!scopeNode) {
        return res.status(404).json({ message: 'Scope not found' });
      }
      if (scopeNode.costType !== 'direct') {
        return res.status(403).json({ message: 'Manual invoice creation is only allowed for direct-cost scopes' });
      }

      const invoiceData = {
        projectId,
        userId: user.id,
        vendorName: vendorName.trim(),
        reference: reference || null,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        scopeId,
        status: 'finalized',
        createdBy: user.id,
        finalizedAt: new Date(),
      };

      const parsed = insertInvoiceSchema.safeParse(invoiceData);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid invoice data', errors: parsed.error.errors });
      }

      for (const line of lines) {
        if (!line.label || typeof line.amount !== 'number') {
          return res.status(400).json({
            message: 'Each line item requires a "label" (string) and an "amount" (number)',
            invalidLine: line,
          });
        }
      }

      const invoice = await storage.createInvoice(parsed.data);

      const createdLines = [];
      for (const line of lines) {
        if (!line.label || typeof line.amount !== 'number') {
          // Reject rather than silently skipping — skipping produced invoices
          // with a zero total and no lines.
          return res.status(400).json({
            message: 'Each line item requires a "label" (string) and an "amount" (number)',
            invalidLine: line,
          });
        }
        const lineParsed = insertInvoiceLineSchema.safeParse({
          invoiceId: invoice.id,
          projectId,
          userId: user.id,
          label: line.label,
          description: line.description || null,
          amount: line.amount,
        });
        if (lineParsed.success) {
          const createdLine = await storage.createInvoiceLine(lineParsed.data);
          createdLines.push(createdLine);
        }
      }

      invalidateOverviewCache(projectId);
      return res.status(201).json({ ...invoice, lines: createdLines });
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get enhanced invoice data with computed amounts
  app.get('/api/projects/:projectId/invoices-enhanced', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      const invoices = await storage.getInvoicesByProject(projectId, user.id);
      const payments = await storage.getPaymentsByProject(projectId, user.id);
      
      const linesMap: Record<string, any[]> = {};
      const paymentsMap: Record<string, any[]> = {};
      const amountsMap: Record<string, { total: number; paid: number; outstanding: number }> = {};
      
      for (const invoice of invoices) {
        const lines = await storage.getLinesByInvoice(invoice.id, user.id);
        linesMap[invoice.id] = lines.map((line: any) => ({
          ...line,
          amount: line.amount != null ? line.amount / 100 : line.amount,
        }));
        
        const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);
        paymentsMap[invoice.id] = invoicePayments.map((p: any) => ({
          ...p,
          amount: p.amount != null ? p.amount / 100 : p.amount,
        }));
        
        const total = lines.reduce((sum, l) => sum + l.amount, 0) / 100;
        const paid = invoicePayments.reduce((sum, p) => sum + p.amount, 0) / 100;
        amountsMap[invoice.id] = {
          total,
          paid,
          outstanding: Math.max(0, total - paid),
        };
      }
      
      return res.json({ 
        invoices, 
        lines: linesMap, 
        payments: paymentsMap,
        amounts: amountsMap,
      });
    } catch (error) {
      console.error('Error fetching enhanced invoices:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
