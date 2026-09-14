/**
 * RENIX vNext — AI Context Assembly Module (Layer 1)
 * 
 * Layer 1 — AUTHORITATIVE STATE
 *   Rebuilt on EVERY AI turn. Deterministic, bounded, no historical data.
 *   Represents "what is true right now"
 * 
 * ==========================================================================
 * CANONICAL DATA SOURCES (Phase 1 Canon Lock)
 * ==========================================================================
 * 
 * SCOPE: scope_nodes (@canonical)
 *   - All scope data for AI context comes from scope_nodes table
 *   - Legacy scope tables (scopes, scope_areas, scope_items) are NOT used here
 * 
 * QUOTES: quote_financials (@canonical)
 *   - THIS IS THE AUTHORITATIVE SOURCE FOR QUOTE TOTALS
 *   - Used for: grandTotal, subtotal, totalTax in AI context
 *   - quote_line_items are read for display (top N items) but NOT for totals
 *   - Legacy quote line tables are ingestion artifacts only
 * 
 * BUDGET: budget_data + budget_allocations (@canonical)
 * FINANCING: financing_sources (@canonical)
 * ==========================================================================
 * 
 * FRAME-AWARE SELECTIVE LOADING (Tier 1 Token Optimization)
 * ==========================================================================
 * 
 * Loading modes:
 *   - 'full': All fields, all details (current behavior)
 *   - 'summary': Key counts and totals only (no detailed items/nodes)
 *   - 'counts': Just count fields
 * 
 * Frame priority mapping determines which data gets which loading mode:
 *   - Core data (always full): project basics, activeFrame
 *   - Primary data (full when frame matches): the data for the active frame
 *   - Secondary data (summary only): related frames for context
 *   - Tertiary data (counts only): unrelated frames
 * ==========================================================================
 */

import { db } from '../db';
import { eq, desc, and, or, inArray, type SQL } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { centsToUnits } from '../localeUtils';
import type { AuthoritativeState, AIContext, ConstraintSet } from './types';
import { 
  TokenContribution, 
  ContextTokenAudit, 
  createContribution, 
  aggregateContributions, 
  logTokenAudit 
} from './tokenCounter';
import {
  buildExplainabilityContext,
  serializeExplainabilityContext,
} from './explainability';

/**
 * Loading mode for frame-aware selective loading.
 * - 'full': All fields, all details
 * - 'summary': Key counts and totals only (no detailed items/nodes)
 * - 'counts': Just count fields
 */
export type LoadingMode = 'full' | 'summary' | 'counts';

/**
 * Loading mode hints for each data domain.
 */
export interface FrameLoadingModes {
  scope: LoadingMode;
  budget: LoadingMode;
  quotes: LoadingMode;
  financing: LoadingMode;
  invoices: LoadingMode;
  documents: LoadingMode;
  execution: LoadingMode;
  expectedCost: LoadingMode;
}

/**
 * Resolve loading modes for each data domain based on the active frame.
 * 
 * Frame priority mapping:
 * - overview: full for all (shows signals from all frames)
 * - scope: full scope, summary budget/quotes/invoices
 * - budget: full budget + scope, summary quotes/financing
 * - quotes: full quotes + scope, summary budget
 * - financing: full financing + budget + quotes, summary scope
 * - invoices: full invoices + quotes, summary budget
 * - execution: full execution + scope, summary budget/quotes
 * - documents: full documents, summary scope/quotes
 * - insights: full for all (analytics view)
 * - vision: full vision only, minimal other data
 */
export function resolveFrameLoadingModes(activeFrame: string): FrameLoadingModes {
  const defaults: FrameLoadingModes = {
    scope: 'counts',
    budget: 'counts',
    quotes: 'counts',
    financing: 'counts',
    invoices: 'counts',
    documents: 'counts',
    execution: 'counts',
    expectedCost: 'summary',
  };

  switch (activeFrame) {
    case 'overview':
      return {
        scope: 'full',
        budget: 'full',
        quotes: 'full',
        financing: 'full',
        invoices: 'full',
        documents: 'full',
        execution: 'full',
        expectedCost: 'full',
      };

    case 'scope':
      return {
        scope: 'full',
        budget: 'summary',
        quotes: 'summary',
        financing: 'counts',
        invoices: 'summary',
        documents: 'counts',
        execution: 'summary',
        expectedCost: 'summary',
      };

    case 'budget':
      return {
        scope: 'full',
        budget: 'full',
        quotes: 'summary',
        financing: 'summary',
        invoices: 'counts',
        documents: 'counts',
        execution: 'counts',
        expectedCost: 'full',
      };

    case 'quotes':
      return {
        scope: 'full',
        budget: 'summary',
        quotes: 'full',
        financing: 'counts',
        invoices: 'counts',
        documents: 'summary',
        execution: 'counts',
        expectedCost: 'summary',
      };

    case 'financing':
      return {
        scope: 'summary',
        budget: 'full',
        quotes: 'full',
        financing: 'full',
        invoices: 'summary',
        documents: 'counts',
        execution: 'counts',
        expectedCost: 'full',
      };

    case 'invoices':
      return {
        scope: 'counts',
        budget: 'summary',
        quotes: 'full',
        financing: 'summary',
        invoices: 'full',
        documents: 'counts',
        execution: 'counts',
        expectedCost: 'summary',
      };

    case 'execution':
      return {
        scope: 'full',
        budget: 'summary',
        quotes: 'summary',
        financing: 'counts',
        invoices: 'counts',
        documents: 'counts',
        execution: 'full',
        expectedCost: 'counts',
      };

    case 'documents':
      return {
        scope: 'summary',
        budget: 'counts',
        quotes: 'summary',
        financing: 'counts',
        invoices: 'counts',
        documents: 'full',
        execution: 'counts',
        expectedCost: 'counts',
      };

    case 'vision':
      return {
        scope: 'counts',
        budget: 'counts',
        quotes: 'counts',
        financing: 'counts',
        invoices: 'counts',
        documents: 'counts',
        execution: 'counts',
        expectedCost: 'counts',
      };

    default:
      return defaults;
  }
}

/**
 * Helper function to apply constraint filtering to a base condition.
 * When allowedIds is provided and non-empty, adds an inArray filter.
 * Otherwise, returns the base condition unchanged.
 */
function applyConstraint(
  baseCondition: SQL<unknown>,
  idColumn: any,
  allowedIds: string[] | undefined
): SQL<unknown> {
  if (!allowedIds || allowedIds.length === 0) {
    return baseCondition;
  }
  return and(baseCondition, inArray(idColumn, allowedIds))!;
}

/**
 * Summarize a resolved proposal for token-efficient AI context.
 * Format: "[date] [status] [targetFrame]: [rationale excerpt - first 100 chars]"
 */
export function summarizeResolvedProposal(proposal: {
  status: string;
  targetFrame: string;
  rationale: string;
  resolvedAt: string;
}): string {
  const date = proposal.resolvedAt.split('T')[0];
  const truncatedRationale = proposal.rationale.length > 100 
    ? proposal.rationale.substring(0, 100) + '...'
    : proposal.rationale;
  return `[${date}] [${proposal.status}] [${proposal.targetFrame}]: ${truncatedRationale}`;
}

/**
 * Assemble the authoritative state for a project with frame-aware selective loading.
 * 
 * @param projectId - The project ID
 * @param userId - The user ID
 * @param activeFrame - The currently active frame
 * @param loadingModes - Optional loading mode hints (defaults to resolving from activeFrame)
 * @param constraintSet - Optional constraint set to filter entities (for bounded context)
 */
export async function assembleAuthoritativeState(
  projectId: string,
  userId: string,
  activeFrame: string,
  loadingModes?: FrameLoadingModes,
  constraintSet?: ConstraintSet
): Promise<AuthoritativeState> {
  const modes = loadingModes ?? resolveFrameLoadingModes(activeFrame);
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(
      eq(schema.projects.id, projectId),
      eq(schema.projects.userId, userId)
    ))
    .limit(1);

  if (!project) {
    return {
      project: null,
      activeFrame,
      scope: { nodes: [], totalCount: 0, archivedCount: 0, loadingMode: 'counts' },
      budget: { intent: null, contingencyMode: 'fixed', contingencyValue: 0, allocations: [], totalAllocated: 0, variance: 0, loadingMode: 'counts' },
      quotes: { count: 0, pendingCount: 0, acceptedCount: 0, items: [], byScope: [], loadingMode: 'counts' },
      financing: { sources: [], totalConfirmed: 0, totalPlanned: 0, totalMonthlyLiabilities: 0, coverageGap: 0, loadingMode: 'counts' },
      expectedCost: { totalExpectedCost: 0, quoteBacked: 0, budgetBacked: 0, directCostBacked: 0, coverageDelta: 0, hasFinancingGap: false, gapSeverity: 'none', loadingMode: 'counts' },
      invoices: { count: 0, paidCount: 0, pendingAmount: 0, totalPaid: 0, loadingMode: 'counts' },
      documents: { count: 0, recentUploads: [], intelligence: { claimsCount: 0, highConfidenceFacts: [], scopeLinks: [], amounts: [], dates: [] }, loadingMode: 'counts' },
      execution: { totalCount: 0, counts: { to_do: 0, in_progress: 0, done: 0 }, overdueCount: 0, notStartedCount: 0, tasks: [], loadingMode: 'counts' },
      pendingProposals: [],
      resolvedProposals: [],
    };
  }

  const regionalContext = project.regionalContext as { currency?: string } | null;

  const baseProjectUserCondition = (table: { projectId: any; userId: any }) =>
    and(eq(table.projectId, projectId), eq(table.userId, userId))!;

  const [
    scopeNodes,
    budgetData,
    budgetAllocations,
    quotes,
    quoteVersions,
    quoteLineItems,
    quoteFinancials,
    vendorSnapshots,
    quoteMetadataRows,
    financingSources,
    invoices,
    documents,
    sourceDocuments,
    pendingProposals,
    resolvedProposals,
    executionTasks,
  ] = await Promise.all([
    db.select().from(schema.scopeNodes)
      .where(applyConstraint(
        baseProjectUserCondition(schema.scopeNodes),
        schema.scopeNodes.id,
        constraintSet?.scopeNodeIds
      )),
    db.select().from(schema.budgetData)
      .where(and(eq(schema.budgetData.projectId, projectId), eq(schema.budgetData.userId, userId)))
      .limit(1),
    db.select().from(schema.budgetAllocations)
      .where(applyConstraint(
        baseProjectUserCondition(schema.budgetAllocations),
        schema.budgetAllocations.id,
        constraintSet?.budgetAllocationIds
      )),
    db.select().from(schema.quotes)
      .where(applyConstraint(
        baseProjectUserCondition(schema.quotes),
        schema.quotes.id,
        constraintSet?.quoteIds
      )),
    db.select().from(schema.quoteVersions)
      .where(and(eq(schema.quoteVersions.projectId, projectId), eq(schema.quoteVersions.userId, userId))),
    db.select().from(schema.quoteLineItems)
      .where(and(eq(schema.quoteLineItems.projectId, projectId), eq(schema.quoteLineItems.userId, userId))),
    db.select().from(schema.quoteFinancials)
      .where(applyConstraint(
        baseProjectUserCondition(schema.quoteFinancials),
        schema.quoteFinancials.id,
        constraintSet?.quoteFinancialIds
      )),
    db.select().from(schema.vendorSnapshots)
      .where(applyConstraint(
        baseProjectUserCondition(schema.vendorSnapshots),
        schema.vendorSnapshots.id,
        constraintSet?.vendorIds
      )),
    db.select().from(schema.quoteMetadata)
      .where(and(eq(schema.quoteMetadata.projectId, projectId), eq(schema.quoteMetadata.userId, userId))),
    db.select().from(schema.financingSources)
      .where(applyConstraint(
        baseProjectUserCondition(schema.financingSources),
        schema.financingSources.id,
        constraintSet?.financingSourceIds
      )),
    db.select().from(schema.invoices)
      .where(applyConstraint(
        baseProjectUserCondition(schema.invoices),
        schema.invoices.id,
        constraintSet?.invoiceIds
      )),
    db.select().from(schema.documents)
      .where(applyConstraint(
        baseProjectUserCondition(schema.documents),
        schema.documents.id,
        constraintSet?.documentIds
      ))
      .orderBy(desc(schema.documents.uploadedAt))
      .limit(10),
    db.select().from(schema.sourceDocuments)
      .where(and(eq(schema.sourceDocuments.projectId, projectId), eq(schema.sourceDocuments.userId, userId))),
    db.select().from(schema.aiProposals)
      .where(and(
        eq(schema.aiProposals.projectId, projectId),
        eq(schema.aiProposals.userId, userId),
        eq(schema.aiProposals.status, 'pending')
      ))
      .orderBy(desc(schema.aiProposals.createdAt)),
    db.select().from(schema.aiProposals)
      .where(and(
        eq(schema.aiProposals.projectId, projectId),
        eq(schema.aiProposals.userId, userId),
        or(
          eq(schema.aiProposals.status, 'accepted'),
          eq(schema.aiProposals.status, 'rejected')
        )
      ))
      .orderBy(desc(schema.aiProposals.resolvedAt))
      .limit(30),
    db.select().from(schema.executionTasks)
      .where(and(eq(schema.executionTasks.projectId, projectId), eq(schema.executionTasks.userId, userId))),
  ]);

  const nodeParentIds = new Set(scopeNodes.map(n => n.parentId).filter(Boolean));
  const totalScopeCount = scopeNodes.filter(n => !n.isArchived).length;
  const archivedScopeCount = scopeNodes.filter(n => n.isArchived).length;
  
  let scopeNodesForState: typeof scopeNodes extends (infer T)[] ? Array<{
    id: string;
    name: string;
    parentId: string | null;
    hasChildren: boolean;
    isArchived: boolean;
    costType?: string;
  }> : never = [];
  
  if (modes.scope === 'full') {
    scopeNodesForState = scopeNodes.map(n => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      hasChildren: nodeParentIds.has(n.id),
      isArchived: n.isArchived,
      costType: n.costType,
    }));
  } else if (modes.scope === 'summary') {
    const topLevel = scopeNodes.filter(n => !n.parentId && !n.isArchived);
    scopeNodesForState = topLevel.map(n => ({
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      hasChildren: nodeParentIds.has(n.id),
      isArchived: n.isArchived,
      costType: n.costType,
    }));
  }
  
  const scopeState = {
    nodes: scopeNodesForState,
    totalCount: totalScopeCount,
    archivedCount: archivedScopeCount,
    loadingMode: modes.scope,
  };

  const budget = budgetData[0];
  const totalAllocated = budgetAllocations.reduce((sum, a) => sum + a.amount, 0);
  const budgetIntent = budget?.totalBudget ?? null;
  
  let allocationsForState: Array<{
    id: string;
    label: string;
    amount: number;
    target: unknown;
  }> = [];
  
  if (modes.budget === 'full') {
    allocationsForState = budgetAllocations.map(a => ({
      id: a.id,
      label: a.label,
      amount: a.amount,
      target: a.target,
    }));
  } else if (modes.budget === 'summary') {
    allocationsForState = budgetAllocations.slice(0, 3).map(a => ({
      id: a.id,
      label: a.label,
      amount: a.amount,
      target: a.target,
    }));
  }
  
  const budgetState = {
    intent: budgetIntent,
    contingencyMode: budget?.contingencyMode ?? 'fixed',
    contingencyValue: budget?.contingencyValue ?? 0,
    allocations: allocationsForState,
    totalAllocated,
    variance: budgetIntent ? budgetIntent - totalAllocated : 0,
    loadingMode: modes.budget,
  };

  const committedQuotes = quotes.filter(q => {
    return q.extractionStatus === 'verified';
  });

  const acceptedQuotes = committedQuotes.filter(q => q.commitmentStatus === 'accepted');
  const pendingQuotes = committedQuotes.filter(q => q.status === 'draft' || q.status === 'committed');
  
  const scopeNameMap = new Map(scopeNodes.map(n => [n.id, n.name]));

  const quoteItems = committedQuotes.map(q => {
    const financials = quoteFinancials.find(f => f.quoteId === q.id);
    const lookupVersionId = q.legacyVersionId || q.id;
    const vendor = vendorSnapshots.find(v => v.quoteVersionId === lookupVersionId) || null;
    const metadata = quoteMetadataRows.find(m => m.quoteVersionId === lookupVersionId) || null;
    const lineItems = quoteLineItems
          .filter(li => li.quoteVersionId === lookupVersionId)
          .sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0))
          .slice(0, 5);

    const lineageInfo = q.lineageId && q.lineageId !== q.id
      ? ` (version ${q.versionNumber}, lineage: ${q.lineageId})`
      : q.versionNumber > 1
        ? ` (version ${q.versionNumber})`
        : '';

    const reference = metadata?.reference || '';

    return {
      id: q.id,
      reference: reference + lineageInfo,
      status: q.status,
      scopeId: q.scopeId,
      scopeName: q.scopeId ? (scopeNameMap.get(q.scopeId) || null) : null,
      vendorName: vendor?.name || null,
      grandTotal: centsToUnits(financials?.grossAmount),
      subtotal: centsToUnits(financials?.netAmount),
      totalTax: centsToUnits(financials?.taxAmount),
      quoteDate: metadata?.quoteDate || q.createdAt?.toISOString() || null,
      lineItemCount: quoteLineItems.filter(li => li.quoteVersionId === lookupVersionId).length,
      versionNumber: q.versionNumber,
      commitmentStatus: q.commitmentStatus,
      extractionStatus: q.extractionStatus,
      previousQuoteId: q.previousQuoteId,
      topLineItems: lineItems.map(li => ({
        description: li.description,
        totalPrice: centsToUnits(li.totalPrice),
      })),
    };
  });

  const quotesByScope = new Map<string, { scopeId: string; scopeName: string; quoteCount: number; totalGross: number; totalNet: number }>();
  for (const item of quoteItems) {
    if (item.scopeId && item.scopeName) {
      const existing = quotesByScope.get(item.scopeId);
      if (existing) {
        existing.quoteCount += 1;
        existing.totalGross += item.grandTotal || 0;
        existing.totalNet += item.subtotal || 0;
      } else {
        quotesByScope.set(item.scopeId, {
          scopeId: item.scopeId,
          scopeName: item.scopeName,
          quoteCount: 1,
          totalGross: item.grandTotal || 0,
          totalNet: item.subtotal || 0,
        });
      }
    }
  }

  let quotesItemsForState: typeof quoteItems = [];
  let quotesByScopeForState: Array<{
    scopeId: string;
    scopeName: string;
    quoteCount: number;
    totalGross: number;
    totalNet: number;
  }> = [];
  
  if (modes.quotes === 'full') {
    quotesItemsForState = quoteItems;
    quotesByScopeForState = Array.from(quotesByScope.values());
  } else if (modes.quotes === 'summary') {
    quotesItemsForState = quoteItems.slice(0, 3).map(q => ({
      ...q,
      topLineItems: [],
    }));
    quotesByScopeForState = Array.from(quotesByScope.values());
  }
  
  const quotesState = {
    count: committedQuotes.length,
    pendingCount: pendingQuotes.length,
    acceptedCount: acceptedQuotes.length,
    items: quotesItemsForState,
    byScope: quotesByScopeForState,
    loadingMode: modes.quotes,
  };

  const confirmedSources = financingSources.filter(s => s.status === 'Confirmed');
  const plannedSources = financingSources.filter(s => s.status === 'Planned');
  const totalConfirmed = confirmedSources.reduce((sum, s) => sum + s.amount, 0);
  const totalPlanned = plannedSources.reduce((sum, s) => sum + s.amount, 0);
  const totalMonthlyLiabilities = financingSources
    .filter(s => s.monthlyLiability)
    .reduce((sum, s) => sum + (s.monthlyLiability ?? 0), 0);
  const coverageGap = budgetIntent ? budgetIntent - (totalConfirmed + totalPlanned) : 0;
  
  let financingSourcesForState: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    status: string;
    monthlyLiability: number | null;
  }> = [];
  
  if (modes.financing === 'full') {
    financingSourcesForState = financingSources.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      amount: s.amount,
      status: s.status,
      monthlyLiability: s.monthlyLiability,
    }));
  } else if (modes.financing === 'summary') {
    financingSourcesForState = financingSources.slice(0, 3).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      amount: s.amount,
      status: s.status,
      monthlyLiability: s.monthlyLiability,
    }));
  }
  
  const financingState = {
    sources: financingSourcesForState,
    totalConfirmed,
    totalPlanned,
    totalMonthlyLiabilities,
    coverageGap,
    loadingMode: modes.financing,
  };

  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const invoicesState = {
    count: invoices.length,
    paidCount: paidInvoices.length,
    pendingAmount: 0,
    totalPaid: 0,
    loadingMode: modes.invoices,
  };

  const documentQuoteMap = new Map<string, { quoteId: string; reference: string; scopeName: string | null }>();
  
  for (const srcDoc of sourceDocuments) {
    if (srcDoc.documentId) {
      const quote = committedQuotes.find(q => q.sourceDocumentId === srcDoc.id && q.extractionStatus === 'verified');
      if (quote) {
        const scopeName = quote.scopeId ? scopeNodes.find(s => s.id === quote.scopeId)?.name || null : null;
        const lookupId = quote.legacyVersionId || quote.id;
        const meta = quoteMetadataRows.find(m => m.quoteVersionId === lookupId);
        documentQuoteMap.set(srcDoc.documentId, {
          quoteId: quote.id,
          reference: meta?.reference || 'Untitled Quote',
          scopeName,
        });
      }
    }
  }

  const MAX_TEXT_PREVIEW = 2000;
  
  const { getProjectDocumentInsights } = await import('../documentProcessor');
  let documentIntelligence: {
    claimsCount: number;
    highConfidenceFacts: Array<{ content: string; confidence: number; documentName: string }>;
    scopeLinks: Array<{ documentName: string; scopeName: string; relationship: string; confidence: number }>;
    amounts: Array<{ amount: string; context: string; documentName: string; confidence: number }>;
    dates: Array<{ date: string; context: string; documentName: string; confidence: number }>;
  } = { claimsCount: 0, highConfidenceFacts: [], scopeLinks: [], amounts: [], dates: [] };
  
  try {
    const insights = await getProjectDocumentInsights(projectId, userId);
    const docIdToName = new Map(documents.map(d => [d.id, d.fileName]));
    
    const highConfidenceFacts = (insights.claimsByType?.fact || [])
      .filter(c => c.confidence >= 0.8)
      .slice(0, 10)
      .map(c => ({
        content: c.content,
        confidence: c.confidence,
        documentName: docIdToName.get(c.documentId) || 'Unknown',
      }));
    
    const scopeLinks = (insights.linksByType?.scope || [])
      .slice(0, 10)
      .map(link => ({
        documentName: docIdToName.get(link.documentId) || 'Unknown',
        scopeName: link.targetName || 'Unknown',
        relationship: link.relationship,
        confidence: link.confidence,
      }));
    
    const amounts = (insights.claimsByType?.amount || [])
      .filter(c => c.confidence >= 0.6)
      .slice(0, 10)
      .map(c => ({
        amount: c.content,
        context: c.extractedValue?.reasoning || '',
        documentName: docIdToName.get(c.documentId) || 'Unknown',
        confidence: c.confidence,
      }));
    
    const dates = (insights.claimsByType?.date || [])
      .filter(c => c.confidence >= 0.6)
      .slice(0, 10)
      .map(c => ({
        date: c.content,
        context: c.extractedValue?.reasoning || '',
        documentName: docIdToName.get(c.documentId) || 'Unknown',
        confidence: c.confidence,
      }));
    
    const totalClaims = Object.values(insights.claimsByType || {}).reduce((sum, arr) => sum + arr.length, 0);
    
    documentIntelligence = {
      claimsCount: totalClaims,
      highConfidenceFacts,
      scopeLinks,
      amounts,
      dates,
    };
  } catch (error) {
    console.error('[AIContextAssembly] Error fetching document intelligence:', error);
  }
  
  let recentUploadsForState: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
    summary: string | null;
    extractedTextPreview: string | null;
    linkedQuote: { id: string; reference: string; scopeName: string | null } | null;
  }> = [];
  
  let documentIntelligenceForState = documentIntelligence;
  
  if (modes.documents === 'full') {
    recentUploadsForState = documents.map(d => {
      const linkedQuote = documentQuoteMap.get(d.id);
      return {
        id: d.id,
        name: d.fileName,
        type: d.documentType || 'unknown',
        uploadedAt: d.uploadedAt.toISOString(),
        summary: d.summary || null,
        extractedTextPreview: (!d.summary && d.extractedText) 
          ? (d.extractedText.length > MAX_TEXT_PREVIEW 
              ? d.extractedText.substring(0, MAX_TEXT_PREVIEW) + '\n[Text truncated...]' 
              : d.extractedText)
          : null,
        linkedQuote: linkedQuote ? {
          id: linkedQuote.quoteId,
          reference: linkedQuote.reference,
          scopeName: linkedQuote.scopeName,
        } : null,
      };
    });
  } else if (modes.documents === 'summary') {
    recentUploadsForState = documents.slice(0, 5).map(d => {
      const linkedQuote = documentQuoteMap.get(d.id);
      return {
        id: d.id,
        name: d.fileName,
        type: d.documentType || 'unknown',
        uploadedAt: d.uploadedAt.toISOString(),
        summary: null,
        extractedTextPreview: null,
        linkedQuote: linkedQuote ? {
          id: linkedQuote.quoteId,
          reference: linkedQuote.reference,
          scopeName: linkedQuote.scopeName,
        } : null,
      };
    });
    documentIntelligenceForState = { claimsCount: documentIntelligence.claimsCount, highConfidenceFacts: [], scopeLinks: [], amounts: [], dates: [] };
  } else {
    documentIntelligenceForState = { claimsCount: documentIntelligence.claimsCount, highConfidenceFacts: [], scopeLinks: [], amounts: [], dates: [] };
  }
  
  const documentsState = {
    count: documents.length,
    recentUploads: recentUploadsForState,
    intelligence: documentIntelligenceForState,
    loadingMode: modes.documents,
  };

  const now = new Date();
  const executionCounts = { to_do: 0, in_progress: 0, done: 0 };
  let overdueCount = 0;
  let notStartedCount = 0;

  executionTasks.forEach(t => {
    const status = t.status as 'to_do' | 'in_progress' | 'done';
    if (executionCounts[status] !== undefined) executionCounts[status]++;
    
    const isOverdue = t.plannedEnd && new Date(t.plannedEnd) < now && t.status !== 'done';
    const isNotStarted = t.plannedStart && new Date(t.plannedStart) < now && t.status === 'to_do';
    if (isOverdue) overdueCount++;
    if (isNotStarted) notStartedCount++;
  });

  let executionTasksForState: Array<{
    id: string;
    label: string;
    status: string;
    scopeNodeId: string | null;
    scopeNodeName: string | null;
    responsibility: { type: string; label?: string } | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    completedAt: string | null;
    overdue: boolean;
    notStarted: boolean;
  }> = [];

  if (modes.execution === 'full') {
    executionTasksForState = executionTasks.map(t => ({
      id: t.id,
      label: t.label,
      status: t.status,
      scopeNodeId: t.scopeItemId,
      scopeNodeName: t.scopeItemName,
      responsibility: t.responsibility as { type: string; label?: string } | null,
      plannedStart: t.plannedStart ? t.plannedStart.toISOString() : null,
      plannedEnd: t.plannedEnd ? t.plannedEnd.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      overdue: !!(t.plannedEnd && new Date(t.plannedEnd) < now && t.status !== 'done'),
      notStarted: !!(t.plannedStart && new Date(t.plannedStart) < now && t.status === 'to_do'),
    }));
  } else if (modes.execution === 'summary') {
    executionTasksForState = executionTasks
      .filter(t => t.status !== 'done')
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        label: t.label,
        status: t.status,
        scopeNodeId: t.scopeItemId,
        scopeNodeName: t.scopeItemName,
        responsibility: t.responsibility as { type: string; label?: string } | null,
        plannedStart: t.plannedStart ? t.plannedStart.toISOString() : null,
        plannedEnd: t.plannedEnd ? t.plannedEnd.toISOString() : null,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        overdue: !!(t.plannedEnd && new Date(t.plannedEnd) < now && t.status !== 'done'),
        notStarted: !!(t.plannedStart && new Date(t.plannedStart) < now && t.status === 'to_do'),
      }));
  }

  const executionState = {
    totalCount: executionTasks.length,
    counts: executionCounts,
    overdueCount,
    notStartedCount,
    tasks: executionTasksForState,
    loadingMode: modes.execution,
  };

  const proposalsState = pendingProposals.map(p => ({
    id: p.id,
    targetFrame: p.targetFrame,
    rationale: p.rationale,
    createdAt: p.createdAt.toISOString(),
  }));

  const resolvedProposalsState = resolvedProposals.map(p => ({
    id: p.id,
    status: p.status,
    targetFrame: p.targetFrame,
    rationale: p.rationale,
    resolvedAt: p.resolvedAt?.toISOString() || p.createdAt.toISOString(),
  }));

  const { computeExpectedCost } = await import('../resolvedCostDemand');
  const costResult = await computeExpectedCost(projectId, userId, constraintSet);
  
  let expectedCostState: {
    totalExpectedCost: number;
    quoteBacked: number;
    budgetBacked: number;
    directCostBacked: number;
    coverageDelta: number;
    hasFinancingGap: boolean;
    gapSeverity: 'none' | 'warning' | 'critical';
    loadingMode: LoadingMode;
  };
  
  if (modes.expectedCost === 'full') {
    expectedCostState = {
      totalExpectedCost: costResult.totalExpectedCost,
      quoteBacked: costResult.breakdown.quoteBacked,
      budgetBacked: costResult.breakdown.budgetBacked,
      directCostBacked: costResult.breakdown.directCostBacked,
      coverageDelta: costResult.coverageDelta,
      hasFinancingGap: costResult.hasFinancingGap,
      gapSeverity: costResult.gapSeverity,
      loadingMode: modes.expectedCost,
    };
  } else {
    expectedCostState = {
      totalExpectedCost: costResult.totalExpectedCost,
      quoteBacked: 0,
      budgetBacked: 0,
      directCostBacked: 0,
      coverageDelta: costResult.coverageDelta,
      hasFinancingGap: costResult.hasFinancingGap,
      gapSeverity: costResult.gapSeverity,
      loadingMode: modes.expectedCost,
    };
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type || undefined,
      status: project.status,
      lifecycleState: (project.lifecycleState || 'active') as 'active' | 'closed' | 'deleted',
      currency: regionalContext?.currency || 'USD',
      createdAt: project.createdAt.toISOString(),
    },
    activeFrame,
    scope: scopeState,
    budget: budgetState,
    quotes: quotesState,
    financing: financingState,
    expectedCost: expectedCostState,
    invoices: invoicesState,
    documents: documentsState,
    execution: executionState,
    pendingProposals: proposalsState,
    resolvedProposals: resolvedProposalsState,
  };
}

export function serializeContextForAI(context: AIContext, constraintSet?: ConstraintSet): string {
  const { authoritative_state, canonical_memory, attention_state, attention_detail } = context;

  let output = '=== AUTHORITATIVE STATE (Current Truth) ===\n\n';

  if (authoritative_state.project) {
    output += `PROJECT: ${authoritative_state.project.name}\n`;
    output += `Status: ${authoritative_state.project.status}\n`;
    output += `Lifecycle State: ${authoritative_state.project.lifecycleState}\n`;
    output += `Currency: ${authoritative_state.project.currency}\n`;
    if (authoritative_state.project.type) {
      output += `Type: ${authoritative_state.project.type}\n`;
    }
    output += `Active Frame: ${authoritative_state.activeFrame}\n`;
    
    if (authoritative_state.project.lifecycleState === 'closed') {
      output += `\n[LIFECYCLE RESTRICTION: This project is CLOSED]\n`;
      output += `- You MUST NOT propose any changes or mutations\n`;
      output += `- You may only: explain, explore, and acknowledge\n`;
      output += `- Do not suggest modifications to scope, budget, quotes, or any domain entities\n`;
      output += `- Historical analysis and explanations are allowed\n`;
    } else if (authoritative_state.project.lifecycleState === 'deleted') {
      output += `\n[LIFECYCLE RESTRICTION: This project is DELETED]\n`;
      output += `- You have NO access to this project\n`;
      output += `- Respond that this project is no longer accessible\n`;
    }
    output += '\n';
  } else {
    output += 'PROJECT: None (Discovery Mode)\n\n';
  }

  output += `SCOPE:\n`;
  output += `- Total nodes: ${authoritative_state.scope.totalCount}\n`;
  output += `- Archived: ${authoritative_state.scope.archivedCount}\n`;
  if (authoritative_state.scope.nodes.length > 0) {
    const topLevel = authoritative_state.scope.nodes.filter(n => !n.parentId && !n.isArchived);
    output += `- Top-level scopes:\n`;
    topLevel.forEach(n => {
      const costTypeLabel = n.costType === 'direct' ? ' [DIRECT COST]' : '';
      output += `  - ${n.name} [id:${n.id}]${costTypeLabel}\n`;
    });
  }
  output += `[ENTITY VALIDATION: ONLY the ${authoritative_state.scope.totalCount} scope(s) listed above exist. Any scope referenced in conversation history or canonical memory that is NOT listed here has been deleted by the user and must not be referenced.]\n`;
  output += '\n';

  output += `BUDGET:\n`;
  output += `- Intent: ${authoritative_state.budget.intent ?? 'Not set'}\n`;
  output += `- Total allocated: ${authoritative_state.budget.totalAllocated}\n`;
  output += `- Variance: ${authoritative_state.budget.variance}\n`;
  output += `- Contingency: ${authoritative_state.budget.contingencyMode} (${authoritative_state.budget.contingencyValue})\n`;
  output += '\n';

  output += `FINANCING:\n`;
  output += `- Confirmed: ${authoritative_state.financing.totalConfirmed}\n`;
  output += `- Planned: ${authoritative_state.financing.totalPlanned}\n`;
  output += `- Monthly liabilities: ${authoritative_state.financing.totalMonthlyLiabilities}\n`;
  output += '\n';
  
  output += `EXPECTED_COST (PRE-EXECUTION):\n`;
  output += `- Total expected cost: ${authoritative_state.expectedCost.totalExpectedCost}\n`;
  output += `- Quote-backed: ${authoritative_state.expectedCost.quoteBacked}\n`;
  output += `- Budget-backed (residual): ${authoritative_state.expectedCost.budgetBacked}\n`;
  output += `- Direct-cost-backed: ${authoritative_state.expectedCost.directCostBacked}\n`;
  output += `- Coverage delta: ${authoritative_state.expectedCost.coverageDelta}\n`;
  output += `- Gap severity: ${authoritative_state.expectedCost.gapSeverity}\n`;
  output += `[NOTE: This is planning-level cost. Invoices/spending belong to Invoices Frame.]\n`;
  output += '\n';

  output += `QUOTES:\n`;
  output += `- Total: ${authoritative_state.quotes.count}\n`;
  output += `- Pending: ${authoritative_state.quotes.pendingCount}\n`;
  output += `- Accepted: ${authoritative_state.quotes.acceptedCount}\n`;
  if (authoritative_state.quotes.items.length > 0) {
    output += `\nQUOTE DETAILS (grouped by scope):\n`;
    const quotesByScopeFlat = new Map<string, typeof authoritative_state.quotes.items>();
    authoritative_state.quotes.items.forEach(q => {
      const key = q.scopeId || 'unassigned';
      if (!quotesByScopeFlat.has(key)) quotesByScopeFlat.set(key, []);
      quotesByScopeFlat.get(key)!.push(q);
    });
    let flatQuoteIndex = 1;
    quotesByScopeFlat.forEach((scopeQuotes, scopeId) => {
      const scopeName = scopeQuotes[0]?.scopeName || 'Unassigned';
      output += `\n  --- Scope: ${scopeName} [scopeId:${scopeId}] ---\n`;
      scopeQuotes.forEach((q) => {
        output += `\n  Quote ${flatQuoteIndex} [id:${q.id}]: ${q.reference || 'No reference'}\n`;
        output += `    Status: ${q.status}\n`;
        if ((q as any).commitmentStatus) {
          output += `    Commitment: ${(q as any).commitmentStatus}\n`;
        }
        if ((q as any).versionNumber && (q as any).versionNumber > 1) {
          output += `    Version: ${(q as any).versionNumber}\n`;
        }
        if ((q as any).previousQuoteId) {
          output += `    Previous Version: [id:${(q as any).previousQuoteId}]\n`;
        }
        if (q.vendorName) {
          output += `    Vendor: ${q.vendorName}\n`;
        }
        output += `    Scope: ${q.scopeName} [scopeId:${q.scopeId}]\n`;
        if (q.grandTotal !== null) {
          output += `    Grand Total: ${q.grandTotal.toLocaleString()}\n`;
        }
        if (q.subtotal !== null) {
          output += `    Subtotal: ${q.subtotal.toLocaleString()}\n`;
        }
        if (q.totalTax !== null) {
          output += `    Tax: ${q.totalTax.toLocaleString()}\n`;
        }
        if (q.quoteDate) {
          output += `    Date: ${q.quoteDate}\n`;
        }
        output += `    Line Items: ${q.lineItemCount}\n`;
        if (q.topLineItems.length > 0) {
          output += `    Top Line Items:\n`;
          q.topLineItems.forEach(li => {
            const price = li.totalPrice !== null ? ` (${li.totalPrice.toLocaleString()})` : '';
            output += `      - ${li.description}${price}\n`;
          });
        }
        flatQuoteIndex++;
      });
    });
  }
  
  if (authoritative_state.quotes.byScope.length > 0) {
    output += `\nQUOTES BY SCOPE (for comparison with budget allocations):\n`;
    authoritative_state.quotes.byScope.forEach(scope => {
      output += `  - ${scope.scopeName}: ${scope.quoteCount} quote(s), Total Gross: ${scope.totalGross.toLocaleString()}, Total Net: ${scope.totalNet.toLocaleString()}\n`;
    });
  }
  output += '\n';

  output += `DOCUMENTS (${authoritative_state.documents.count} total):\n`;
  if (authoritative_state.documents.recentUploads.length > 0) {
    authoritative_state.documents.recentUploads.forEach((doc, i) => {
      output += `\n  Document ${i + 1}: ${doc.name}\n`;
      output += `    Type: ${doc.type}\n`;
      output += `    Uploaded: ${doc.uploadedAt}\n`;
      if (doc.linkedQuote) {
        output += `    Linked to Quote: "${doc.linkedQuote.reference}"`;
        if (doc.linkedQuote.scopeName) {
          output += ` (Scope: ${doc.linkedQuote.scopeName})`;
        }
        output += '\n';
      }
      if (doc.summary) {
        output += `    Summary:\n${doc.summary.split('\n').map(line => `      ${line}`).join('\n')}\n`;
      } else if (doc.extractedTextPreview) {
        output += `    Content Preview (summary pending):\n${doc.extractedTextPreview.split('\n').slice(0, 20).map(line => `      ${line}`).join('\n')}\n`;
      } else {
        output += `    Content: [Not available - image or binary file]\n`;
      }
    });
  } else {
    output += `  No documents uploaded yet.\n`;
  }
  
  const intel = authoritative_state.documents.intelligence;
  if (intel.claimsCount > 0) {
    output += `\n=== DOCUMENT INTELLIGENCE (${intel.claimsCount} claims extracted) ===\n`;
    
    if (intel.highConfidenceFacts.length > 0) {
      output += `\nHIGH-CONFIDENCE FACTS (reliability >= 80%):\n`;
      intel.highConfidenceFacts.forEach((fact, i) => {
        output += `  ${i + 1}. "${fact.content}" (Source: ${fact.documentName}, Confidence: ${Math.round(fact.confidence * 100)}%)\n`;
      });
    }
    
    if (intel.scopeLinks.length > 0) {
      output += `\nDOCUMENT-SCOPE RELATIONSHIPS:\n`;
      intel.scopeLinks.forEach(link => {
        output += `  - ${link.documentName} ${link.relationship} "${link.scopeName}" (${Math.round(link.confidence * 100)}% confidence)\n`;
      });
    }
    
    if (intel.amounts.length > 0) {
      output += `\nEXTRACTED AMOUNTS (from documents):\n`;
      intel.amounts.forEach(amt => {
        const context = amt.context ? ` - ${amt.context}` : '';
        output += `  - ${amt.amount}${context} (Source: ${amt.documentName})\n`;
      });
    }
    
    if (intel.dates.length > 0) {
      output += `\nKEY DATES (from documents):\n`;
      intel.dates.forEach(d => {
        const context = d.context ? ` - ${d.context}` : '';
        output += `  - ${d.date}${context} (Source: ${d.documentName})\n`;
      });
    }
    
    output += '\n';
  }
  output += '\n';

  if (authoritative_state.execution) {
    output += `EXECUTION:\n`;
    output += `- Total tasks: ${authoritative_state.execution.totalCount}\n`;
    output += `- Planned: ${authoritative_state.execution.counts.to_do}\n`;
    output += `- In Progress: ${authoritative_state.execution.counts.in_progress}\n`;
    output += `- Done: ${authoritative_state.execution.counts.done}\n`;
    if (authoritative_state.execution.overdueCount > 0) {
      output += `- OVERDUE: ${authoritative_state.execution.overdueCount}\n`;
    }
    if (authoritative_state.execution.notStartedCount > 0) {
      output += `- Not started (past start date): ${authoritative_state.execution.notStartedCount}\n`;
    }
    if (authoritative_state.execution.tasks.length > 0) {
      output += `\nTASK DETAILS:\n`;
      authoritative_state.execution.tasks.forEach((t, i) => {
        output += `\n  Task ${i + 1}: ${t.label}\n`;
        output += `    Status: ${t.status}\n`;
        if (t.scopeNodeName) output += `    Scope: ${t.scopeNodeName}\n`;
        if (t.responsibility) {
          const respLabel = t.responsibility.type === 'external' && t.responsibility.label
            ? `External (${t.responsibility.label})`
            : t.responsibility.type;
          output += `    Responsibility: ${respLabel}\n`;
        }
        if (t.plannedStart) output += `    Start: ${t.plannedStart}\n`;
        if (t.plannedEnd) output += `    End: ${t.plannedEnd}\n`;
        if (t.overdue) output += `    [OVERDUE]\n`;
        if (t.notStarted) output += `    [NOT STARTED - past start date]\n`;
        if (t.completedAt) output += `    Completed: ${t.completedAt}\n`;
      });
    }
    output += '\n';
  }

  if (authoritative_state.pendingProposals.length > 0) {
    output += `PENDING_PROPOSALS:\n`;
    authoritative_state.pendingProposals.forEach((p, i) => {
      output += `${i + 1}. [${p.targetFrame}] ${p.rationale}\n`;
    });
    output += '\n';
  }

  if (authoritative_state.resolvedProposals && authoritative_state.resolvedProposals.length > 0) {
    output += `RESOLVED_PROPOSALS (${authoritative_state.resolvedProposals.length} total, summarized):\n`;
    authoritative_state.resolvedProposals.forEach(p => {
      output += `- ${summarizeResolvedProposal(p)}\n`;
    });
    output += '\n';
  }

  output += `=== ATTENTION STATE ===\n`;
  output += `State: ${attention_state}\n`;
  if (attention_detail) {
    output += `What: ${attention_detail.what}\n`;
    output += `Where: ${attention_detail.where}\n`;
  }
  output += '\n';

  if (canonical_memory.length > 0) {
    output += `=== CANONICAL MEMORY (Immutable History) ===\n`;
    const recentMemories = canonical_memory.slice(0, 10);
    recentMemories.forEach(m => {
      output += `- [${m.type}] ${m.summary}\n`;
    });
    output += '\n';
  }

  // Phase 6A: Add explainability context for grounded synthesis
  const explainabilityCtx = buildExplainabilityContext(authoritative_state, constraintSet);
  output += serializeExplainabilityContext(explainabilityCtx);

  return output;
}

/**
 * Phase 5B.1: Instrumented context serialization with token auditing.
 * Returns both the serialized context and a token breakdown by tier.
 */
export interface SerializeWithAuditResult {
  context: string;
  audit: ContextTokenAudit;
}

export function serializeContextForAIWithAudit(
  context: AIContext,
  enableLogging: boolean = false,
  constraintSet?: ConstraintSet
): SerializeWithAuditResult {
  const { authoritative_state, canonical_memory, conversation_context, attention_state, attention_detail } = context;
  const contributions: TokenContribution[] = [];

  const loadingModesInfo = {
    scope: authoritative_state.scope.loadingMode || 'full',
    budget: authoritative_state.budget.loadingMode || 'full',
    quotes: authoritative_state.quotes.loadingMode || 'full',
    financing: authoritative_state.financing.loadingMode || 'full',
    invoices: authoritative_state.invoices.loadingMode || 'full',
    documents: authoritative_state.documents.loadingMode || 'full',
    expectedCost: authoritative_state.expectedCost.loadingMode || 'full',
  };

  let tier1Output = '=== AUTHORITATIVE STATE (Current Truth) ===\n\n';

  if (authoritative_state.project) {
    let projectSection = `PROJECT: ${authoritative_state.project.name}\n`;
    projectSection += `Status: ${authoritative_state.project.status}\n`;
    projectSection += `Lifecycle State: ${authoritative_state.project.lifecycleState}\n`;
    projectSection += `Currency: ${authoritative_state.project.currency}\n`;
    if (authoritative_state.project.type) {
      projectSection += `Type: ${authoritative_state.project.type}\n`;
    }
    projectSection += `Active Frame: ${authoritative_state.activeFrame}\n`;
    
    if (authoritative_state.project.lifecycleState === 'closed') {
      projectSection += `\n[LIFECYCLE RESTRICTION: This project is CLOSED]\n`;
      projectSection += `- You MUST NOT propose any changes or mutations\n`;
      projectSection += `- You may only: explain, explore, and acknowledge\n`;
      projectSection += `- Do not suggest modifications to scope, budget, quotes, or any domain entities\n`;
      projectSection += `- Historical analysis and explanations are allowed\n`;
    } else if (authoritative_state.project.lifecycleState === 'deleted') {
      projectSection += `\n[LIFECYCLE RESTRICTION: This project is DELETED]\n`;
      projectSection += `- You have NO access to this project\n`;
      projectSection += `- Respond that this project is no longer accessible\n`;
    }
    projectSection += '\n';
    contributions.push(createContribution('tier1_authoritative', 'project', projectSection));
    tier1Output += projectSection;
  } else {
    const projectSection = 'PROJECT: None (Discovery Mode)\n\n';
    contributions.push(createContribution('tier1_authoritative', 'project', projectSection));
    tier1Output += projectSection;
  }

  let scopeSection = `SCOPE:\n`;
  scopeSection += `- Total nodes: ${authoritative_state.scope.totalCount}\n`;
  scopeSection += `- Archived: ${authoritative_state.scope.archivedCount}\n`;
  if (authoritative_state.scope.nodes.length > 0) {
    const topLevel = authoritative_state.scope.nodes.filter(n => !n.parentId && !n.isArchived);
    scopeSection += `- Top-level scopes:\n`;
    topLevel.forEach(n => {
      const costTypeLabel = n.costType === 'direct' ? ' [DIRECT COST]' : '';
      scopeSection += `  - ${n.name} [id:${n.id}]${costTypeLabel}\n`;
    });
  }
  scopeSection += '\n';
  contributions.push(createContribution('tier1_authoritative', 'scope', scopeSection));
  tier1Output += scopeSection;

  let budgetSection = `BUDGET:\n`;
  budgetSection += `- Intent: ${authoritative_state.budget.intent ?? 'Not set'}\n`;
  budgetSection += `- Total allocated: ${authoritative_state.budget.totalAllocated}\n`;
  budgetSection += `- Variance: ${authoritative_state.budget.variance}\n`;
  budgetSection += `- Contingency: ${authoritative_state.budget.contingencyMode} (${authoritative_state.budget.contingencyValue})\n\n`;
  contributions.push(createContribution('tier1_authoritative', 'budget', budgetSection));
  tier1Output += budgetSection;

  let financingSection = `FINANCING:\n`;
  financingSection += `- Confirmed: ${authoritative_state.financing.totalConfirmed}\n`;
  financingSection += `- Planned: ${authoritative_state.financing.totalPlanned}\n`;
  financingSection += `- Monthly liabilities: ${authoritative_state.financing.totalMonthlyLiabilities}\n\n`;
  contributions.push(createContribution('tier1_authoritative', 'financing', financingSection));
  tier1Output += financingSection;

  let expectedCostSection = `EXPECTED_COST (PRE-EXECUTION):\n`;
  expectedCostSection += `- Total expected cost: ${authoritative_state.expectedCost.totalExpectedCost}\n`;
  expectedCostSection += `- Quote-backed: ${authoritative_state.expectedCost.quoteBacked}\n`;
  expectedCostSection += `- Budget-backed (residual): ${authoritative_state.expectedCost.budgetBacked}\n`;
  expectedCostSection += `- Direct-cost-backed: ${authoritative_state.expectedCost.directCostBacked}\n`;
  expectedCostSection += `- Coverage delta: ${authoritative_state.expectedCost.coverageDelta}\n`;
  expectedCostSection += `- Gap severity: ${authoritative_state.expectedCost.gapSeverity}\n`;
  expectedCostSection += `[NOTE: This is planning-level cost. Invoices/spending belong to Invoices Frame.]\n\n`;
  contributions.push(createContribution('tier1_authoritative', 'expectedCost', expectedCostSection));
  tier1Output += expectedCostSection;

  let quotesSection = `QUOTES:\n`;
  quotesSection += `- Total: ${authoritative_state.quotes.count}\n`;
  quotesSection += `- Pending: ${authoritative_state.quotes.pendingCount}\n`;
  quotesSection += `- Accepted: ${authoritative_state.quotes.acceptedCount}\n`;
  if (authoritative_state.quotes.items.length > 0) {
    quotesSection += `\nQUOTE DETAILS (grouped by scope):\n`;
    const quotesByScope = new Map<string, typeof authoritative_state.quotes.items>();
    authoritative_state.quotes.items.forEach(q => {
      const key = q.scopeId || 'unassigned';
      if (!quotesByScope.has(key)) quotesByScope.set(key, []);
      quotesByScope.get(key)!.push(q);
    });
    let quoteIndex = 1;
    quotesByScope.forEach((scopeQuotes, scopeId) => {
      const scopeName = scopeQuotes[0]?.scopeName || 'Unassigned';
      quotesSection += `\n  --- Scope: ${scopeName} [scopeId:${scopeId}] ---\n`;
      scopeQuotes.forEach((q) => {
        quotesSection += `\n  Quote ${quoteIndex} [id:${q.id}]: ${q.reference || 'No reference'}\n`;
        quotesSection += `    Status: ${q.status}\n`;
        if (q.vendorName) quotesSection += `    Vendor: ${q.vendorName}\n`;
        quotesSection += `    Scope: ${q.scopeName} [scopeId:${q.scopeId}]\n`;
        if (q.grandTotal !== null) quotesSection += `    Grand Total: ${q.grandTotal.toLocaleString()}\n`;
        if (q.subtotal !== null) quotesSection += `    Subtotal: ${q.subtotal.toLocaleString()}\n`;
        if (q.totalTax !== null) quotesSection += `    Tax: ${q.totalTax.toLocaleString()}\n`;
        if (q.quoteDate) quotesSection += `    Date: ${q.quoteDate}\n`;
        quotesSection += `    Line Items: ${q.lineItemCount}\n`;
        if (q.topLineItems.length > 0) {
          quotesSection += `    Top Line Items:\n`;
          q.topLineItems.forEach(li => {
            const price = li.totalPrice !== null ? ` (${li.totalPrice.toLocaleString()})` : '';
            quotesSection += `      - ${li.description}${price}\n`;
          });
        }
        quoteIndex++;
      });
    });
  }
  if (authoritative_state.quotes.byScope.length > 0) {
    quotesSection += `\nQUOTES BY SCOPE (for comparison with budget allocations):\n`;
    authoritative_state.quotes.byScope.forEach(scope => {
      quotesSection += `  - ${scope.scopeName}: ${scope.quoteCount} quote(s), Total Gross: ${scope.totalGross.toLocaleString()}, Total Net: ${scope.totalNet.toLocaleString()}\n`;
    });
  }
  quotesSection += '\n';
  contributions.push(createContribution('tier1_authoritative', 'quotes', quotesSection));
  tier1Output += quotesSection;

  let documentsSection = `DOCUMENTS (${authoritative_state.documents.count} total):\n`;
  if (authoritative_state.documents.recentUploads.length > 0) {
    authoritative_state.documents.recentUploads.forEach((doc, i) => {
      documentsSection += `\n  Document ${i + 1}: ${doc.name}\n`;
      documentsSection += `    Type: ${doc.type}\n`;
      documentsSection += `    Uploaded: ${doc.uploadedAt}\n`;
      if (doc.linkedQuote) {
        documentsSection += `    Linked to Quote: "${doc.linkedQuote.reference}"`;
        if (doc.linkedQuote.scopeName) documentsSection += ` (Scope: ${doc.linkedQuote.scopeName})`;
        documentsSection += '\n';
      }
      if (doc.summary) {
        documentsSection += `    Summary:\n${doc.summary.split('\n').map(line => `      ${line}`).join('\n')}\n`;
      } else if (doc.extractedTextPreview) {
        documentsSection += `    Content Preview (summary pending):\n${doc.extractedTextPreview.split('\n').slice(0, 20).map(line => `      ${line}`).join('\n')}\n`;
      } else {
        documentsSection += `    Content: [Not available - image or binary file]\n`;
      }
    });
  } else {
    documentsSection += `  No documents uploaded yet.\n`;
  }

  const intel = authoritative_state.documents.intelligence;
  if (intel.claimsCount > 0) {
    documentsSection += `\n=== DOCUMENT INTELLIGENCE (${intel.claimsCount} claims extracted) ===\n`;
    if (intel.highConfidenceFacts.length > 0) {
      documentsSection += `\nHIGH-CONFIDENCE FACTS (reliability >= 80%):\n`;
      intel.highConfidenceFacts.forEach((fact, i) => {
        documentsSection += `  ${i + 1}. "${fact.content}" (Source: ${fact.documentName}, Confidence: ${Math.round(fact.confidence * 100)}%)\n`;
      });
    }
    if (intel.scopeLinks.length > 0) {
      documentsSection += `\nDOCUMENT-SCOPE RELATIONSHIPS:\n`;
      intel.scopeLinks.forEach(link => {
        documentsSection += `  - ${link.documentName} ${link.relationship} "${link.scopeName}" (${Math.round(link.confidence * 100)}% confidence)\n`;
      });
    }
    if (intel.amounts.length > 0) {
      documentsSection += `\nEXTRACTED AMOUNTS (from documents):\n`;
      intel.amounts.forEach(amt => {
        const contextStr = amt.context ? ` - ${amt.context}` : '';
        documentsSection += `  - ${amt.amount}${contextStr} (Source: ${amt.documentName})\n`;
      });
    }
    if (intel.dates.length > 0) {
      documentsSection += `\nKEY DATES (from documents):\n`;
      intel.dates.forEach(d => {
        const contextStr = d.context ? ` - ${d.context}` : '';
        documentsSection += `  - ${d.date}${contextStr} (Source: ${d.documentName})\n`;
      });
    }
    documentsSection += '\n';
  }
  documentsSection += '\n';
  contributions.push(createContribution('tier1_authoritative', 'documents', documentsSection));
  tier1Output += documentsSection;

  if (authoritative_state.execution) {
    let executionSection = `EXECUTION:\n`;
    executionSection += `- Total tasks: ${authoritative_state.execution.totalCount}\n`;
    executionSection += `- Planned: ${authoritative_state.execution.counts.to_do}\n`;
    executionSection += `- In Progress: ${authoritative_state.execution.counts.in_progress}\n`;
    executionSection += `- Done: ${authoritative_state.execution.counts.done}\n`;
    if (authoritative_state.execution.overdueCount > 0) {
      executionSection += `- OVERDUE: ${authoritative_state.execution.overdueCount}\n`;
    }
    if (authoritative_state.execution.notStartedCount > 0) {
      executionSection += `- Not started (past start date): ${authoritative_state.execution.notStartedCount}\n`;
    }
    if (authoritative_state.execution.tasks.length > 0) {
      executionSection += `\nTASK DETAILS:\n`;
      authoritative_state.execution.tasks.forEach((t, i) => {
        executionSection += `\n  Task ${i + 1}: ${t.label}\n`;
        executionSection += `    Status: ${t.status}\n`;
        if (t.scopeNodeName) executionSection += `    Scope: ${t.scopeNodeName}\n`;
        if (t.responsibility) {
          const respLabel = t.responsibility.type === 'external' && t.responsibility.label
            ? `External (${t.responsibility.label})`
            : t.responsibility.type;
          executionSection += `    Responsibility: ${respLabel}\n`;
        }
        if (t.plannedStart) executionSection += `    Start: ${t.plannedStart}\n`;
        if (t.plannedEnd) executionSection += `    End: ${t.plannedEnd}\n`;
        if (t.overdue) executionSection += `    [OVERDUE]\n`;
        if (t.notStarted) executionSection += `    [NOT STARTED - past start date]\n`;
        if (t.completedAt) executionSection += `    Completed: ${t.completedAt}\n`;
      });
    }
    executionSection += '\n';
    contributions.push(createContribution('tier1_authoritative', 'execution', executionSection));
    tier1Output += executionSection;
  }

  if (authoritative_state.pendingProposals.length > 0) {
    let proposalsSection = `PENDING_PROPOSALS:\n`;
    authoritative_state.pendingProposals.forEach((p, i) => {
      proposalsSection += `${i + 1}. [${p.targetFrame}] ${p.rationale}\n`;
    });
    proposalsSection += '\n';
    contributions.push(createContribution('tier1_authoritative', 'pendingProposals', proposalsSection));
    tier1Output += proposalsSection;
  }

  if (authoritative_state.resolvedProposals && authoritative_state.resolvedProposals.length > 0) {
    let resolvedSection = `RESOLVED_PROPOSALS (${authoritative_state.resolvedProposals.length} total, summarized):\n`;
    authoritative_state.resolvedProposals.forEach(p => {
      resolvedSection += `- ${summarizeResolvedProposal(p)}\n`;
    });
    resolvedSection += '\n';
    contributions.push(createContribution('tier2_canonical', 'resolvedProposals', resolvedSection));
    tier1Output += resolvedSection;
  }

  let attentionSection = `=== ATTENTION STATE ===\n`;
  attentionSection += `State: ${attention_state}\n`;
  if (attention_detail) {
    attentionSection += `What: ${attention_detail.what}\n`;
    attentionSection += `Where: ${attention_detail.where}\n`;
  }
  attentionSection += '\n';
  contributions.push(createContribution('attention', 'attentionState', attentionSection));
  tier1Output += attentionSection;

  let tier2Output = '';
  if (canonical_memory.length > 0) {
    tier2Output = `=== CANONICAL MEMORY (Immutable History) ===\n`;
    const recentMemories = canonical_memory.slice(0, 10);
    recentMemories.forEach(m => {
      tier2Output += `- [${m.type}] ${m.summary}\n`;
    });
    tier2Output += '\n';
    contributions.push(createContribution('tier2_canonical', 'canonicalMemory', tier2Output));
  }

  let tier3Output = '';
  if (conversation_context && conversation_context.length > 0) {
    tier3Output = `=== RECENT CONVERSATION ===\n`;
    conversation_context.forEach(turn => {
      tier3Output += `[${turn.role.toUpperCase()}]: ${turn.content}\n`;
    });
    tier3Output += '\n';
    contributions.push(createContribution('tier3_conversation', 'conversation', tier3Output));
  }

  // Phase 6A: Add explainability context for grounded synthesis (pass constraint set for accurate reporting)
  const explainabilityCtx = buildExplainabilityContext(authoritative_state, constraintSet);
  const explainabilityOutput = serializeExplainabilityContext(explainabilityCtx);
  contributions.push(createContribution('tier1_authoritative', 'explainability', explainabilityOutput));

  const fullContext = tier1Output + tier2Output + tier3Output + explainabilityOutput;
  const audit = aggregateContributions(contributions);

  if (enableLogging) {
    logTokenAudit(audit, `AI Context Assembly [Frame: ${authoritative_state.activeFrame}]`);
    console.log(`[TokenAudit] Loading modes: scope=${loadingModesInfo.scope}, budget=${loadingModesInfo.budget}, quotes=${loadingModesInfo.quotes}, financing=${loadingModesInfo.financing}, docs=${loadingModesInfo.documents}, expectedCost=${loadingModesInfo.expectedCost}`);
  }

  return { context: fullContext, audit };
}

export type { ContextTokenAudit } from './tokenCounter';
