/**
 * RENIX vNext — Quotes Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema, MoneySchema } from './base';

export const VendorSchema = BaseEntitySchema.extend({
  name: z.string(),
});

export type Vendor = z.infer<typeof VendorSchema>;

export const QuoteSchema = BaseEntitySchema.extend({
  vendorId: z.string().uuid(),
});

export type Quote = z.infer<typeof QuoteSchema>;

export const QuoteRowTypeEnum = z.enum(['section', 'line_item', 'note', 'subtotal', 'total']);
export type QuoteRowType = z.infer<typeof QuoteRowTypeEnum>;

export const NativeQuoteRowSchema = BaseEntitySchema.extend({
  versionId: z.string().uuid(),
  rowType: QuoteRowTypeEnum,
  originalCells: z.record(z.string(), z.any()),
  orderIndex: z.number(),
  sourceOcrBlocks: z.array(z.string()).optional(),
  confidenceMap: z.record(z.string(), z.number()).optional(),
});

export type NativeQuoteRow = z.infer<typeof NativeQuoteRowSchema>;

export const DerivedQuoteRowSchema = BaseEntitySchema.extend({
  versionId: z.string().uuid(),
  rowType: QuoteRowTypeEnum,
  derivedFields: z.object({
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
    amount: z.number().optional(),
    notes: z.string().optional(),
  }),
  sourceNativeRowIds: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export type DerivedQuoteRow = z.infer<typeof DerivedQuoteRowSchema>;

export const NativeExtractionSchema = z.object({
  nativeRows: z.array(z.object({
    rowType: QuoteRowTypeEnum,
    originalCells: z.record(z.string(), z.any()),
    orderIndex: z.number(),
    confidenceMap: z.record(z.string(), z.number()).optional(),
  })),
  columnHeaders: z.array(z.string()),
  language: z.string().optional(),
  confidence: z.number(),
});

export type NativeExtraction = z.infer<typeof NativeExtractionSchema>;

export const FullExtractionResultSchema = z.object({
  native: NativeExtractionSchema,
  derived: z.object({
    vendorName: z.string().nullable().optional(),
    vendorContact: z.string().nullable().optional(),
    vendorEmail: z.string().nullable().optional(),
    vendorPhone: z.string().nullable().optional(),
    vendorAddress: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    lineItems: z.array(z.object({
      description: z.string(),
      quantity: z.number().optional(),
      unit: z.string().optional(),
      unitPrice: z.number().optional(),
      amount: z.number(),
    })),
    subtotal: z.number().nullable().optional(),
    tax: z.number().nullable().optional(),
    taxRate: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    confidence: z.number(),
  }),
});

export type FullExtractionResult = z.infer<typeof FullExtractionResultSchema>;
