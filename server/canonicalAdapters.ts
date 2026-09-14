/**
 * RENIX vNext — Canonical Read Adapters
 * 
 * Phase 2: Semantic Isolation & Canonical Read/Write Normalization
 * 
 * ==========================================================================
 * PURPOSE
 * ==========================================================================
 * 
 * This module provides thin adapter functions that centralize reads from
 * CANONICAL models. These adapters:
 * 
 * 1. Provide a single source of truth for reading canonical data
 * 2. Do NOT change return shapes or runtime behavior
 * 3. Centralize any model ambiguity in one place
 * 4. Make it explicit when code is reading from canonical vs legacy models
 * 
 * ==========================================================================
 * CANONICAL MODELS
 * ==========================================================================
 * 
 * SCOPE: scope_nodes (@canonical)
 *   - Use getCanonicalScopeTree() for tree structure
 *   - Use getCanonicalScopeNode() for single node lookup
 * 
 * QUOTES: quote_financials (@canonical)
 *   - Use getCanonicalQuoteTotals() for authoritative totals
 *   - Legacy quote_line_items still exist for display but NOT for totals
 * 
 * ==========================================================================
 * LEGACY READS (DOCUMENTED)
 * ==========================================================================
 * 
 * The following legacy read paths REMAIN for backward compatibility:
 * 
 * 1. storage.getScopesByProject() — legacy scope model (migration only)
 * 2. storage.getScopeAreasByProject() — legacy scope model (migration only)
 * 3. storage.getScopeItemsByProject() — legacy scope model (migration only)
 * 4. storage.getQuoteLineItems() — ingestion artifacts (display only)
 * 
 * These paths are NOT removed but are documented as legacy-only.
 * 
 * ==========================================================================
 */

import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { centsToUnits } from './localeUtils';
import { 
  MoneyValue, 
  fromMinorUnits, 
  fromCentsNullable 
} from '@shared/money';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical scope node representation.
 * Matches the scope_nodes table structure.
 */
export interface CanonicalScopeNode {
  id: string;
  projectId: string;
  userId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  tags: string[];
  sortOrder: number;
  isArchived: boolean;
  isExpanded: boolean;
  createdAt: Date;
  createdBy: string;
}

/**
 * Canonical scope tree representation.
 * Nodes are returned in a flat array; callers build tree structure as needed.
 */
export interface CanonicalScopeTree {
  nodes: CanonicalScopeNode[];
  totalCount: number;
  archivedCount: number;
}

/**
 * Canonical quote totals from quote_financials.
 * This is the AUTHORITATIVE source for quote totals.
 */
export interface CanonicalQuoteTotals {
  quoteId: string;
  /** Gross amount (including tax) in minor units (cents) */
  grossAmount: number | null;
  /** Net amount (excluding tax) in minor units (cents) */
  netAmount: number | null;
  /** Tax amount in minor units (cents) */
  taxAmount: number | null;
  /** Currency code (e.g., 'EUR', 'USD') */
  currency: string;
}

/**
 * Canonical quote totals as MoneyValue (type-safe).
 */
export interface CanonicalQuoteTotalsTyped {
  quoteId: string;
  grossAmount: MoneyValue | null;
  netAmount: MoneyValue | null;
  taxAmount: MoneyValue | null;
}

// ============================================================================
// SCOPE ADAPTERS
// ============================================================================

/**
 * Get the canonical scope tree for a project.
 * 
 * Reads from scope_nodes (@canonical) — the ONLY authoritative scope model.
 * 
 * @param projectId - Project ID
 * @param userId - User ID
 * @returns Canonical scope tree with all nodes
 */
export async function getCanonicalScopeTree(
  projectId: string,
  userId: string
): Promise<CanonicalScopeTree> {
  const nodes = await db.select()
    .from(schema.scopeNodes)
    .where(and(
      eq(schema.scopeNodes.projectId, projectId),
      eq(schema.scopeNodes.userId, userId)
    ))
    .orderBy(schema.scopeNodes.sortOrder);
  
  return {
    nodes: nodes.map(n => ({
      id: n.id,
      projectId: n.projectId,
      userId: n.userId,
      parentId: n.parentId,
      name: n.name,
      description: n.description,
      tags: n.tags || [],
      sortOrder: n.sortOrder,
      isArchived: n.isArchived,
      isExpanded: n.isExpanded,
      createdAt: n.createdAt,
      createdBy: n.createdBy,
    })),
    totalCount: nodes.filter(n => !n.isArchived).length,
    archivedCount: nodes.filter(n => n.isArchived).length,
  };
}

/**
 * Get a single canonical scope node by ID.
 * 
 * @param nodeId - Scope node ID
 * @param userId - User ID
 * @returns Canonical scope node or null
 */
export async function getCanonicalScopeNode(
  nodeId: string,
  userId: string
): Promise<CanonicalScopeNode | null> {
  const [node] = await db.select()
    .from(schema.scopeNodes)
    .where(and(
      eq(schema.scopeNodes.id, nodeId),
      eq(schema.scopeNodes.userId, userId)
    ))
    .limit(1);
  
  if (!node) return null;
  
  return {
    id: node.id,
    projectId: node.projectId,
    userId: node.userId,
    parentId: node.parentId,
    name: node.name,
    description: node.description,
    tags: node.tags || [],
    sortOrder: node.sortOrder,
    isArchived: node.isArchived,
    isExpanded: node.isExpanded,
    createdAt: node.createdAt,
    createdBy: node.createdBy,
  };
}

/**
 * Lookup scope node name by ID.
 * Convenience function for common pattern.
 * 
 * @param nodeId - Scope node ID
 * @param userId - User ID
 * @returns Scope name or null
 */
export async function getScopeNodeName(
  nodeId: string,
  userId: string
): Promise<string | null> {
  const node = await getCanonicalScopeNode(nodeId, userId);
  return node?.name || null;
}

// ============================================================================
// QUOTE TOTALS ADAPTERS
// ============================================================================

/**
 * Get canonical quote totals from quote_financials.
 * 
 * This is the AUTHORITATIVE source for quote totals.
 * Do NOT use quote_line_items or quoteVersions.total for totals.
 * 
 * @param quoteId - Quote ID
 * @param userId - User ID
 * @returns Canonical quote totals or null
 */
export async function getCanonicalQuoteTotals(
  quoteId: string,
  userId: string
): Promise<CanonicalQuoteTotals | null> {
  const [financials] = await db.select()
    .from(schema.quoteFinancials)
    .where(and(
      eq(schema.quoteFinancials.quoteId, quoteId),
      eq(schema.quoteFinancials.userId, userId)
    ))
    .limit(1);
  
  if (!financials) return null;
  
  return {
    quoteId: financials.quoteId,
    grossAmount: financials.grossAmount,
    netAmount: financials.netAmount,
    taxAmount: financials.taxAmount,
    currency: financials.currency || 'EUR',
  };
}

/**
 * Get canonical quote totals as type-safe MoneyValue.
 * 
 * @param quoteId - Quote ID
 * @param userId - User ID
 * @returns Typed quote totals or null
 */
export async function getCanonicalQuoteTotalsTyped(
  quoteId: string,
  userId: string
): Promise<CanonicalQuoteTotalsTyped | null> {
  const totals = await getCanonicalQuoteTotals(quoteId, userId);
  if (!totals) return null;
  
  return {
    quoteId: totals.quoteId,
    grossAmount: fromCentsNullable(totals.grossAmount, totals.currency),
    netAmount: fromCentsNullable(totals.netAmount, totals.currency),
    taxAmount: fromCentsNullable(totals.taxAmount, totals.currency),
  };
}

/**
 * Get all quote totals for a project.
 * 
 * @param projectId - Project ID
 * @param userId - User ID
 * @returns Array of canonical quote totals
 */
export async function getCanonicalQuoteTotalsForProject(
  projectId: string,
  userId: string
): Promise<CanonicalQuoteTotals[]> {
  const financials = await db.select()
    .from(schema.quoteFinancials)
    .where(and(
      eq(schema.quoteFinancials.projectId, projectId),
      eq(schema.quoteFinancials.userId, userId)
    ));
  
  return financials.map(f => ({
    quoteId: f.quoteId,
    grossAmount: f.grossAmount,
    netAmount: f.netAmount,
    taxAmount: f.taxAmount,
    currency: f.currency || 'EUR',
  }));
}

/**
 * Build a quoteId → totals lookup map for efficient access.
 * 
 * @param projectId - Project ID
 * @param userId - User ID
 * @returns Map of quoteId to totals
 */
export async function buildQuoteTotalsMap(
  projectId: string,
  userId: string
): Promise<Map<string, CanonicalQuoteTotals>> {
  const totals = await getCanonicalQuoteTotalsForProject(projectId, userId);
  const map = new Map<string, CanonicalQuoteTotals>();
  for (const t of totals) {
    map.set(t.quoteId, t);
  }
  return map;
}

// ============================================================================
// LEGACY READ DOCUMENTATION
// ============================================================================

/**
 * @deprecated LEGACY READ PATH — Use getCanonicalScopeTree() instead.
 * 
 * This documents that storage.getScopesByProject() is a legacy read path
 * that should ONLY be used for migration purposes.
 * 
 * The function does not exist here — it remains in storage.ts.
 * This documentation serves as a pointer.
 */
export const LEGACY_SCOPE_READS = {
  getScopesByProject: 'LEGACY — migration only',
  getScopeAreasByProject: 'LEGACY — migration only',
  getScopeItemsByProject: 'LEGACY — migration only',
} as const;

/**
 * @deprecated LEGACY READ PATH — Display only, NOT for totals.
 * 
 * Quote line items (quoteLineItems) are ingestion artifacts.
 * For totals, use getCanonicalQuoteTotals().
 */
export const LEGACY_QUOTE_READS = {
  getQuoteLineItems: 'LEGACY — display only, NOT for totals',
} as const;
