/**
 * RENIX vNext — Execution Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema } from './base';

export const ExecutionStatusSchema = z.enum(['pending', 'active', 'paused', 'completed']);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ExecutionRecordSchema = BaseEntitySchema.extend({
  workItemId: z.string().uuid(),
  status: ExecutionStatusSchema,
  note: z.string().optional(),
});

export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;
