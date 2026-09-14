/**
 * RENIX vNext — Scope Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema } from './base';

export const ScopeSchema = BaseEntitySchema.extend({
  description: z.string().optional(),
});

export type Scope = z.infer<typeof ScopeSchema>;

export const AreaSchema = BaseEntitySchema.extend({
  scopeId: z.string().uuid(),
  name: z.string(),
});

export type Area = z.infer<typeof AreaSchema>;

export const WorkItemSchema = BaseEntitySchema.extend({
  areaId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
});

export type WorkItem = z.infer<typeof WorkItemSchema>;
