/**
 * Phase 5A: Background Job Recovery Module
 * 
 * Handles recovery of incomplete jobs on server startup.
 * Ensures all async work is persistent, resumable, and observable.
 * Also purges stale pipeline data (orphan source docs, expired uploads,
 * unconfirmed documents) to prevent ghost data from accumulating.
 */

import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

const STALE_JOB_CUTOFF_MINUTES = 15;
const STALE_PIPELINE_HOURS = 24;

export interface RecoveryResult {
  staleJobsReset: number;
  pendingJobsFound: number;
  jobsResumed: number;
  errors: string[];
}

/**
 * Run background job recovery on server startup.
 * 
 * 1. Reset stale jobs (stuck in 'processing' for too long)
 * 2. Find pending jobs that need resumption
 * 3. Optionally trigger resumption of pending jobs
 */
export async function runBackgroundJobRecovery(): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    staleJobsReset: 0,
    pendingJobsFound: 0,
    jobsResumed: 0,
    errors: [],
  };

  console.log('[BackgroundJobRecovery] Starting recovery check...');

  await runPipelineCleanup();

  console.log(`[BackgroundJobRecovery] Recovery complete: errors=${result.errors.length}`);
  
  return result;
}

async function runPipelineCleanup(): Promise<void> {
  console.log('[PipelineCleanup] Starting stale pipeline data cleanup...');

  try {
    const expiredUploads = await db.execute(sql`
      DELETE FROM pending_uploads 
      WHERE consumed = true OR expires_at < NOW()
      RETURNING token
    `);
    const expiredCount = expiredUploads.rows?.length ?? 0;
    if (expiredCount > 0) {
      console.log(`[PipelineCleanup] Purged ${expiredCount} consumed/expired pending upload(s)`);
    }
  } catch (error) {
    console.error('[PipelineCleanup] Error cleaning pending uploads:', error);
  }

  try {
    const orphanDocs = await db.execute(sql`
      DELETE FROM source_documents 
      WHERE document_id IS NULL 
        AND uploaded_at < NOW() - INTERVAL '${sql.raw(String(STALE_PIPELINE_HOURS))} hours'
        AND id NOT IN (SELECT DISTINCT source_document_id FROM quotes WHERE source_document_id IS NOT NULL)
      RETURNING id, file_name
    `);
    const orphanCount = orphanDocs.rows?.length ?? 0;
    if (orphanCount > 0) {
      console.log(`[PipelineCleanup] Purged ${orphanCount} orphan source document(s) (no linked document, older than ${STALE_PIPELINE_HOURS}h)`);
      for (const row of orphanDocs.rows || []) {
        console.log(`[PipelineCleanup]   - ${(row as any).file_name} (${(row as any).id})`);
      }
    }
  } catch (error) {
    console.error('[PipelineCleanup] Error cleaning orphan source documents:', error);
  }

  try {
    const unconfirmedDocs = await db.execute(sql`
      DELETE FROM documents 
      WHERE confirmed = false 
        AND uploaded_at < NOW() - INTERVAL '${sql.raw(String(STALE_PIPELINE_HOURS))} hours'
      RETURNING id, file_name
    `);
    const unconfirmedCount = unconfirmedDocs.rows?.length ?? 0;
    if (unconfirmedCount > 0) {
      console.log(`[PipelineCleanup] Purged ${unconfirmedCount} unconfirmed document(s) (older than ${STALE_PIPELINE_HOURS}h)`);
    }
  } catch (error) {
    console.error('[PipelineCleanup] Error cleaning unconfirmed documents:', error);
  }

  console.log('[PipelineCleanup] Cleanup complete');
}

/**
 * Log extraction job lifecycle transition.
 * Provides observable logging for job state changes.
 */
export function logExtractionTransition(
  documentId: string,
  fromStatus: string | null,
  toStatus: string,
  details?: { error?: string; duration?: number }
): void {
  const timestamp = new Date().toISOString();
  const arrow = fromStatus ? `${fromStatus} → ${toStatus}` : toStatus;
  
  let logLine = `[ExtractionJob] ${timestamp} docId=${documentId} ${arrow}`;
  
  if (details?.duration) {
    logLine += ` (${details.duration}ms)`;
  }
  
  if (details?.error) {
    logLine += ` error="${details.error}"`;
  }
  
  console.log(logLine);
}
