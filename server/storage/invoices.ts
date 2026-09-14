import {
  type Invoice,
  type InsertInvoice,
  invoices,
  type InvoiceLine,
  type InsertInvoiceLine,
  invoiceLines,
  type InvoicePayment,
  type InsertInvoicePayment,
  invoicePayments,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getInvoicesByProject(db: Db, projectId: string, userId: string): Promise<Invoice[]> {
  return await db.select().from(invoices)
    .where(and(eq(invoices.projectId, projectId), eq(invoices.userId, userId)))
    .orderBy(desc(invoices.createdAt));
}

export async function createInvoice(db: Db, invoice: InsertInvoice): Promise<Invoice> {
  const [created] = await db.insert(invoices).values(invoice).returning();
  return created;
}

export async function updateInvoice(db: Db, id: string, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
  const [updated] = await db.update(invoices)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .returning();
  return updated;
}

export async function deleteInvoice(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getLinesByInvoice(db: Db, invoiceId: string, userId: string): Promise<InvoiceLine[]> {
  return await db.select().from(invoiceLines)
    .where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.userId, userId)))
    .orderBy(desc(invoiceLines.createdAt));
}

export async function createInvoiceLine(db: Db, line: InsertInvoiceLine): Promise<InvoiceLine> {
  const [created] = await db.insert(invoiceLines).values(line).returning();
  return created;
}

export async function updateInvoiceLine(db: Db, id: string, userId: string, updates: Partial<InsertInvoiceLine>): Promise<InvoiceLine | undefined> {
  const [updated] = await db.update(invoiceLines)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(invoiceLines.id, id), eq(invoiceLines.userId, userId)))
    .returning();
  return updated;
}

export async function deleteInvoiceLine(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(invoiceLines)
    .where(and(eq(invoiceLines.id, id), eq(invoiceLines.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// INVOICE PAYMENTS (Append-only)
// ============================================================================

export async function getPaymentsByInvoice(db: Db, invoiceId: string, userId: string): Promise<InvoicePayment[]> {
  return await db.select().from(invoicePayments)
    .where(and(eq(invoicePayments.invoiceId, invoiceId), eq(invoicePayments.userId, userId)))
    .orderBy(desc(invoicePayments.paymentDate));
}

export async function getPaymentsByProject(db: Db, projectId: string, userId: string): Promise<InvoicePayment[]> {
  return await db.select().from(invoicePayments)
    .where(and(eq(invoicePayments.projectId, projectId), eq(invoicePayments.userId, userId)))
    .orderBy(desc(invoicePayments.paymentDate));
}

export async function createInvoicePayment(db: Db, payment: InsertInvoicePayment): Promise<InvoicePayment> {
  const [created] = await db.insert(invoicePayments).values(payment).returning();
  return created;
}

export async function deleteInvoicePayment(db: Db, paymentId: string, userId: string): Promise<boolean> {
  const result = await db.delete(invoicePayments)
    .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getInvoiceTotalAmount(db: Db, invoiceId: string, userId: string): Promise<number> {
  const lines = await getLinesByInvoice(db, invoiceId, userId);
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export async function getInvoicePaidAmount(db: Db, invoiceId: string, userId: string): Promise<number> {
  const payments = await getPaymentsByInvoice(db, invoiceId, userId);
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export async function getInvoiceOutstandingAmount(db: Db, invoiceId: string, userId: string): Promise<number> {
  const total = await getInvoiceTotalAmount(db, invoiceId, userId);
  const paid = await getInvoicePaidAmount(db, invoiceId, userId);
  return Math.max(0, total - paid);
}

export async function deleteInvoiceCascade(
  db: Db,
  invoiceId: string,
  userId: string,
  cleanupEntityDocumentsFn: (tx: Db, entityType: string, entityId: string, userId: string) => Promise<{ deletedDocuments: number; removedAssociations: number }>
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const payments = await getPaymentsByInvoice(tx as unknown as Db, invoiceId, userId);
    for (const payment of payments) {
      await deleteInvoicePayment(tx as unknown as Db, payment.id, userId);
    }

    const lines = await getLinesByInvoice(tx as unknown as Db, invoiceId, userId);
    for (const line of lines) {
      await deleteInvoiceLine(tx as unknown as Db, line.id, userId);
    }

    await cleanupEntityDocumentsFn(tx as unknown as Db, 'invoice', invoiceId, userId);

    const result = await deleteInvoice(tx as unknown as Db, invoiceId, userId);
    return result;
  });
}
