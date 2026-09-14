/**
 * RENIX vNext — Vision Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema } from './base';

export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const VisionSchema = BaseEntitySchema.extend({
  narrative: z.string(),
  confidenceLevel: ConfidenceLevelSchema.optional(),
});

export type Vision = z.infer<typeof VisionSchema>;

export const InspirationBoardSchema = BaseEntitySchema.extend({
  title: z.string(),
});

export type InspirationBoard = z.infer<typeof InspirationBoardSchema>;

export const InspirationItemSchema = BaseEntitySchema.extend({
  boardId: z.string().uuid(),
  mediaAssetId: z.string().uuid().optional(),
  note: z.string().optional(),
});

export type InspirationItem = z.infer<typeof InspirationItemSchema>;
