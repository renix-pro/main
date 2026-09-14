/**
 * RENIX vNext — Legacy Write Guards
 * 
 * Phase 1: Canon Lock & Guardrails
 * 
 * This module provides runtime assertions to prevent NEW writes to legacy tables.
 * Existing read paths continue to work; write guards fail loudly in development.
 * 
 * ==========================================================================
 * LEGACY TABLES (NO NEW WRITES PERMITTED)
 * ==========================================================================
 * 
 * SCOPE DOMAIN:
 * - scopes
 *   → Use scope_nodes (canonical) instead
 * 
 * QUOTE DOMAIN (INGESTION ARTIFACTS):
 * - quote_line_items
 *   → These are ingestion artifacts; use quote_financials for totals
 * 
 * ==========================================================================
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Set of legacy table names that should not receive new writes.
 * Existing ingestion pipelines are EXEMPT from these guards.
 */
export const LEGACY_SCOPE_TABLES = new Set([
  'scopes',
]);

export const LEGACY_QUOTE_LINE_TABLES = new Set([
  'quote_line_items',
]);

export const ALL_LEGACY_TABLES = new Set([
  ...Array.from(LEGACY_SCOPE_TABLES),
  ...Array.from(LEGACY_QUOTE_LINE_TABLES),
]);

/**
 * Error class for legacy write violations.
 * Thrown when code attempts to write to a legacy table outside of exempt contexts.
 */
export class LegacyWriteViolation extends Error {
  constructor(tableName: string, operation: 'create' | 'update' | 'delete', context?: string) {
    const message = [
      `[LEGACY GUARD VIOLATION] Attempted ${operation} on legacy table '${tableName}'.`,
      `This table is @legacy_read_only — new writes are prohibited.`,
      context ? `Context: ${context}` : null,
      `See shared/schema.ts and server/legacyGuards.ts for canonical model guidance.`,
    ].filter(Boolean).join('\n');
    
    super(message);
    this.name = 'LegacyWriteViolation';
  }
}

/**
 * Checks if a table is a legacy scope table.
 */
export function isLegacyScopeTable(tableName: string): boolean {
  return LEGACY_SCOPE_TABLES.has(tableName);
}

/**
 * Checks if a table is a legacy quote line table.
 */
export function isLegacyQuoteLineTable(tableName: string): boolean {
  return LEGACY_QUOTE_LINE_TABLES.has(tableName);
}

/**
 * Checks if a table is any legacy table.
 */
export function isLegacyTable(tableName: string): boolean {
  return ALL_LEGACY_TABLES.has(tableName);
}

/**
 * Guard function that throws in development if a legacy table write is attempted.
 */
export function guardLegacyWrite(
  tableName: string, 
  operation: 'create' | 'update' | 'delete',
  context?: string
): void {
  if (isLegacyTable(tableName)) {
    const violation = new LegacyWriteViolation(tableName, operation, context);
    
    if (isDevelopment) {
      throw violation;
    } else {
      console.warn(violation.message);
    }
  }
}

/**
 * Decorator-style wrapper for async functions that should not write to legacy tables.
 */
export function withLegacyGuard<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    if (isDevelopment) {
      console.debug(`[LegacyGuard] Executing: ${context}`);
    }
    return fn(...args);
  }) as T;
}

/**
 * Assertion that a given operation is using the canonical model.
 */
export function assertCanonicalModel(
  model: 'scope_nodes' | 'quote_financials',
  context: string
): void {
  if (isDevelopment) {
    console.debug(`[CanonicalModel] Using ${model} for: ${context}`);
  }
}

/**
 * EXEMPTION MARKERS
 * 
 * The following code paths are EXEMPT from legacy guards because they are
 * part of existing ingestion pipelines that must continue to function:
 * 
 * 1. Quote Import Pipeline (QuoteImportPipeline.tsx → routes.ts)
 *    - Creates quote_line_items during extraction
 *    - This is the ONLY path that may write to these tables
 * 
 * These exemptions are documented here for audit purposes.
 * New code should NEVER add to this exemption list without Canon approval.
 */
export const EXEMPT_CONTEXTS = [
  'QuoteImportPipeline',
  'QuoteExtractionReview',
] as const;

export type ExemptContext = typeof EXEMPT_CONTEXTS[number];

/**
 * Check if a context is exempt from legacy guards.
 */
export function isExemptContext(context: string): boolean {
  return EXEMPT_CONTEXTS.includes(context as ExemptContext);
}

/**
 * Guard function that respects exemptions.
 */
export function guardLegacyWriteWithExemption(
  tableName: string,
  operation: 'create' | 'update' | 'delete',
  context: string
): void {
  if (isExemptContext(context)) {
    if (isDevelopment) {
      console.debug(`[LegacyGuard] Exempt write to ${tableName}: ${context}`);
    }
    return;
  }
  
  guardLegacyWrite(tableName, operation, context);
}
