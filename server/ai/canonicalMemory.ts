/**
 * RENIX vNext — AI Canonical Memory Module (Layer 2)
 * 
 * Layer 2 — CANONICAL MEMORY
 *   Append-only, immutable, curated decision log.
 *   Loaded on AI invocation as immutable historical truth.
 *   
 *   NEVER modified after creation.
 *   Represents decisions and accepted proposals.
 */

import { db } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { CanonicalMemoryEntry } from './types';

export async function loadCanonicalMemory(
  projectId: string,
  userId: string,
  limit: number = 50
): Promise<CanonicalMemoryEntry[]> {
  const memories = await db
    .select()
    .from(schema.canonicalMemory)
    .where(and(
      eq(schema.canonicalMemory.projectId, projectId),
      eq(schema.canonicalMemory.userId, userId)
    ))
    .orderBy(desc(schema.canonicalMemory.createdAt))
    .limit(limit);

  return memories.map(m => ({
    id: m.id,
    type: m.type,
    summary: m.summary,
    relatedFrames: m.relatedFrames,
    createdAt: m.createdAt,
  }));
}

export async function writeCanonicalMemory(
  projectId: string,
  userId: string,
  type: schema.CanonicalMemoryType,
  summary: string,
  relatedFrames: string[],
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(schema.canonicalMemory).values({
    projectId,
    userId,
    type,
    summary,
    relatedFrames,
    metadata: metadata || null,
  });
}
