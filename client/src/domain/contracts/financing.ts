/**
 * RENIX vNext — Financing Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema, MoneySchema } from './base';

export const FinancingTypeSchema = z.enum(['loan', 'savings', 'grant', 'other']);

export type FinancingType = z.infer<typeof FinancingTypeSchema>;

export const FinancingSourceSchema = BaseEntitySchema.extend({
  type: FinancingTypeSchema,
  provider: z.string().optional(),
  amount: MoneySchema.optional(),
});

export type FinancingSource = z.infer<typeof FinancingSourceSchema>;
