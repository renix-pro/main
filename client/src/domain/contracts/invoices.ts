/**
 * RENIX vNext — Invoices Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema, MoneySchema } from './base';

export const InvoiceSchema = BaseEntitySchema.extend({
  vendorId: z.string().uuid(),
  reference: z.string().optional(),
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  total: MoneySchema.optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceLineSchema = BaseEntitySchema.extend({
  invoiceId: z.string().uuid(),
  label: z.string(),
  amount: MoneySchema,
});

export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;
