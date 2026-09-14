/**
 * RENIX vNext — Base Entity Contract
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';

export const MoneySchema = z.object({
  currency: z.string().length(3),
  value: z.number(),
});

export type Money = z.infer<typeof MoneySchema>;

export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  version: z.number().int().nonnegative(),
  archivedAt: z.string().datetime().optional(),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;
