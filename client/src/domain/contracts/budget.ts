/**
 * RENIX vNext — Budget Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema, MoneySchema } from './base';

export const BudgetLineSchema = BaseEntitySchema.extend({
  label: z.string(),
  amount: MoneySchema,
  notes: z.string().optional(),
});

export type BudgetLine = z.infer<typeof BudgetLineSchema>;
