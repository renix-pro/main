/**
 * Expected Cost Engine (Financing Frame)
 * 
 * FINANCING COST TRUTH: PRE-EXECUTION ONLY
 * 
 * The Financing Frame reasons ONLY over:
 * - Budgets (intent)
 * - Quotes (increasing certainty)
 * 
 * Invoices are explicitly OUT OF SCOPE for this frame.
 * Execution truth (invoices, spend, payments) belongs to Invoices/Execution Frames.
 * 
 * This engine answers: "Can I fund what I am planning to do?"
 * 
 * ==========================================================================
 * PHASE 5.9: CANONICAL SOURCE ENFORCEMENT
 * ==========================================================================
 * 
 * CANONICAL SOURCES (no legacy totals):
 * - quote_financials.grossAmount (@canonical) — INTEGER (cents) → convert to units
 * - budget_allocations.amount — INTEGER (whole currency units)
 * - financing_sources.amount — INTEGER (whole currency units)
 * 
 * LEGACY quoteVersions.total (DOUBLE PRECISION) is NOT used.
 * 
 * UNIT CONVENTION: All arithmetic is performed in CURRENCY UNITS.
 * quote_financials.grossAmount (cents) is converted using centsToUnits().
 * ==========================================================================
 */

import { storage } from "./storage";
import type { Quote, BudgetData, BudgetAllocation, FinancingSource, QuoteFinancials, ScopeNode } from "@shared/schema";
import type { ConstraintSet } from './ai/types';
import { centsToUnits } from './localeUtils';

export interface ExpectedCostBreakdown {
  quoteBacked: number;
  budgetBacked: number;
  directCostBacked: number;
}

export interface ResolvedCostDemandResult {
  totalResolvedCost: number;
  breakdown: {
    invoiceBacked: number;  // Always 0 - kept for interface compatibility
    quoteBacked: number;
    budgetBacked: number;
    directCostBacked: number;
    contingencyAmount: number;
    unresolvedCount: number;
  };
  confirmedFinancingCapacity: number;
  plannedFinancingCapacity: number;
  coverageDelta: number;
  monthlyLiabilityTotal: number;
  hasFinancingGap: boolean;
  gapSeverity: 'none' | 'warning' | 'critical';
}

export interface ExpectedCostResult {
  totalExpectedCost: number;
  breakdown: ExpectedCostBreakdown;
  confirmedFinancingCapacity: number;
  plannedFinancingCapacity: number;
  coverageDelta: number;
  monthlyLiabilityTotal: number;
  hasFinancingGap: boolean;
  gapSeverity: 'none' | 'warning' | 'critical';
}

/**
 * Compute expected cost for a project (pre-execution)
 * 
 * Expected Cost Logic:
 * - Quote-backed: SUM of all quotes (any status from new → accepted)
 * - Budget-backed: Budget intent MINUS quote coverage (remaining intent)
 * 
 * Project-Level Expected Cost = Σ(quote amounts) + Σ(remaining budget residuals)
 * 
 * Key principle: Expected cost MUST NOT drop unless scope or budget intent is explicitly changed
 */
export async function computeResolvedCostDemand(
  projectId: string,
  userId: string,
  constraintSet?: ConstraintSet
): Promise<ResolvedCostDemandResult> {
  // Fetch only pre-execution data (no invoices)
  const [rawQuotes, budgetData, rawFinancingSources] = await Promise.all([
    storage.getQuotesByProject(projectId, userId),
    storage.getBudgetByProject(projectId, userId),
    storage.getSourcesByProject(projectId, userId),
  ]);

  // Get budget allocations if budget exists
  let rawBudgetAllocations: BudgetAllocation[] = [];
  if (budgetData) {
    rawBudgetAllocations = await storage.getAllocationsByBudget(budgetData.id, userId);
  }

  // Apply constraint filtering if constraintSet provided with non-empty arrays
  let quotes = rawQuotes;
  if (constraintSet?.quoteIds && constraintSet.quoteIds.length > 0) {
    quotes = rawQuotes.filter(q => constraintSet.quoteIds!.includes(q.id));
  }

  let budgetAllocations = rawBudgetAllocations;
  if (constraintSet?.budgetAllocationIds && constraintSet.budgetAllocationIds.length > 0) {
    budgetAllocations = rawBudgetAllocations.filter(a => constraintSet.budgetAllocationIds!.includes(a.id));
  }

  let financingSources = rawFinancingSources;
  if (constraintSet?.financingSourceIds && constraintSet.financingSourceIds.length > 0) {
    financingSources = rawFinancingSources.filter(s => constraintSet.financingSourceIds!.includes(s.id));
  }

  // 1. Quote-backed costs: Only VERIFIED + ACTIVE/ACCEPTED versions participate
  // Priority: Accepted version > Active version > ignore Draft/Superseded
  // CANONICAL SOURCE: quote_financials.grossAmount (INTEGER cents)
  // Legacy quoteVersions.total (DOUBLE PRECISION) is NOT used here.
  // Convert from cents to currency units to match budget/financing conventions.
  let quoteBackedTotal = 0;
  for (const quote of quotes) {
    const financials: QuoteFinancials | undefined = await storage.getFinancialsByQuote(quote.id, userId);
    if (financials?.grossAmount) {
      quoteBackedTotal += centsToUnits(financials.grossAmount) ?? 0;
    }
  }

  // 2. Fetch scope nodes to determine costType for each allocation
  const scopeNodes: ScopeNode[] = await storage.getScopeNodesByProject(projectId, userId);
  const directCostScopeIds = new Set(
    scopeNodes.filter(n => n.costType === 'direct').map(n => n.id)
  );

  // 3. Split budget allocations into standard vs direct cost
  const standardAllocations: BudgetAllocation[] = [];
  const directCostAllocations: BudgetAllocation[] = [];

  for (const alloc of budgetAllocations) {
    const target = alloc.target as { type?: string; scopeId?: string; scopeNodeId?: string } | null;
    const scopeId = target?.scopeId || target?.scopeNodeId;
    if (scopeId && directCostScopeIds.has(scopeId)) {
      directCostAllocations.push(alloc);
    } else {
      standardAllocations.push(alloc);
    }
  }

  // 4. Direct cost total: full allocation amount, no quote deduction
  const directCostTotal = directCostAllocations.reduce(
    (sum: number, alloc: BudgetAllocation) => sum + alloc.amount, 0
  );

  // 5. Standard budget-backed costs: Budget intent MINUS quote coverage
  // budget_allocations.amount is INTEGER (whole currency units)
  let standardBudgetIntent = 0;
  if (standardAllocations.length > 0) {
    standardBudgetIntent = standardAllocations.reduce(
      (sum: number, alloc: BudgetAllocation) => sum + alloc.amount, 0
    );
  } else if (budgetAllocations.length === 0 && budgetData?.totalBudget) {
    standardBudgetIntent = budgetData.totalBudget;
  }

  // Budget residual = MAX(0, Standard Budget Intent - Quote Coverage)
  // All values now in currency units
  const budgetBackedTotal = Math.max(0, standardBudgetIntent - quoteBackedTotal);

  // 6. Contingency: a financial truth that must be covered by financing
  let contingencyAmount = 0;
  if (budgetData) {
    const mode = budgetData.contingencyMode || 'fixed';
    const value = budgetData.contingencyValue || 0;
    if (mode === 'percent' && budgetData.totalBudget) {
      contingencyAmount = Math.round((budgetData.totalBudget * value) / 100);
    } else {
      contingencyAmount = value;
    }
  }

  // Total expected cost in currency units (includes contingency as a real financing need)
  const totalExpectedCost = quoteBackedTotal + budgetBackedTotal + directCostTotal + contingencyAmount;

  // Calculate confirmed and planned financing capacity
  // financing_sources.amount is INTEGER (whole currency units)
  // Note: Status is stored as Pascal case 'Planned' or 'Confirmed' in the database
  const confirmedFinancingCapacity = financingSources
    .filter((s: FinancingSource) => s.status === 'Confirmed' || s.status === 'confirmed')
    .reduce((sum: number, s: FinancingSource) => sum + s.amount, 0);

  const plannedFinancingCapacity = financingSources
    .filter((s: FinancingSource) => s.status === 'Planned' || s.status === 'planned')
    .reduce((sum: number, s: FinancingSource) => sum + s.amount, 0);

  // Coverage delta = Confirmed Financing - Expected Cost (all in currency units)
  const coverageDelta = confirmedFinancingCapacity - totalExpectedCost;

  // Monthly liability total (also in currency units)
  const monthlyLiabilityTotal = financingSources
    .filter((s: FinancingSource) => s.monthlyLiability !== null)
    .reduce((sum: number, s: FinancingSource) => sum + (s.monthlyLiability || 0), 0);

  // Determine gap severity (ratio is unit-independent)
  let gapSeverity: 'none' | 'warning' | 'critical' = 'none';
  if (coverageDelta < 0) {
    const gapPercentage = totalExpectedCost > 0 
      ? Math.abs(coverageDelta) / totalExpectedCost 
      : 0;
    gapSeverity = gapPercentage > 0.2 ? 'critical' : 'warning';
  }

  // All values already in currency units - return directly
  return {
    totalResolvedCost: totalExpectedCost,
    breakdown: {
      invoiceBacked: 0,  // Invoices are OUT OF SCOPE for Financing Frame
      quoteBacked: quoteBackedTotal,
      budgetBacked: budgetBackedTotal,
      directCostBacked: directCostTotal,
      contingencyAmount,
      unresolvedCount: 0,
    },
    confirmedFinancingCapacity,
    plannedFinancingCapacity,
    coverageDelta,
    monthlyLiabilityTotal,
    hasFinancingGap: coverageDelta < 0,
    gapSeverity,
  };
}

/**
 * Compute expected cost (new interface)
 */
export async function computeExpectedCost(
  projectId: string,
  userId: string,
  constraintSet?: ConstraintSet
): Promise<ExpectedCostResult> {
  const result = await computeResolvedCostDemand(projectId, userId, constraintSet);
  return {
    totalExpectedCost: result.totalResolvedCost,
    breakdown: {
      quoteBacked: result.breakdown.quoteBacked,
      budgetBacked: result.breakdown.budgetBacked,
      directCostBacked: result.breakdown.directCostBacked,
    },
    confirmedFinancingCapacity: result.confirmedFinancingCapacity,
    plannedFinancingCapacity: result.plannedFinancingCapacity,
    coverageDelta: result.coverageDelta,
    monthlyLiabilityTotal: result.monthlyLiabilityTotal,
    hasFinancingGap: result.hasFinancingGap,
    gapSeverity: result.gapSeverity,
  };
}

/**
 * Get a human-readable summary of the expected cost
 */
export function formatCostResolutionSummary(result: ResolvedCostDemandResult): string {
  const { breakdown, coverageDelta, hasFinancingGap } = result;
  
  let summary = `Expected Cost: `;
  const parts: string[] = [];
  
  // Only show quote-backed and budget-backed (NO invoices in Financing Frame)
  if (breakdown.quoteBacked > 0) {
    parts.push(`€${breakdown.quoteBacked.toLocaleString()} quote-backed`);
  }
  if (breakdown.budgetBacked > 0) {
    parts.push(`€${breakdown.budgetBacked.toLocaleString()} budget-backed`);
  }
  if (breakdown.directCostBacked > 0) {
    parts.push(`€${breakdown.directCostBacked.toLocaleString()} direct-cost`);
  }
  if (breakdown.contingencyAmount > 0) {
    parts.push(`€${breakdown.contingencyAmount.toLocaleString()} contingency`);
  }
  
  if (parts.length === 0) {
    summary += 'No expected costs defined yet.';
  } else {
    summary += parts.join(' + ');
  }
  
  if (hasFinancingGap) {
    summary += ` | FUNDING GAP: €${Math.abs(coverageDelta).toLocaleString()}`;
  }
  
  return summary;
}
