/**
 * RENIX vNext — Documents Frame Data Contracts
 * 
 * Canon v1.4 Compliant — Phase 5, Workstream 5B
 */

import { z } from 'zod';
import { BaseEntitySchema } from './base';

export const MediaAssetTypeSchema = z.enum(['image', 'video', 'audio', 'document', 'other']);

export type MediaAssetType = z.infer<typeof MediaAssetTypeSchema>;

export const MediaAssetSchema = BaseEntitySchema.extend({
  type: MediaAssetTypeSchema,
  uri: z.string(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const DocumentSchema = BaseEntitySchema.extend({
  title: z.string(),
  uri: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;
