/**
 * RENIX vNext — AI Explainability & Grounded Synthesis Module (Phase 6A + 6B + 6C)
 * 
 * Provides structured explanations and tension insights using ONLY canonical, constrained data.
 * 
 * ABSOLUTE CONSTRAINTS:
 * - NO changes to AI autonomy or proposal flow
 * - NO recommendations or advice
 * - NO UI behavior changes
 * - NO data or calculation changes
 * - NEVER prescriptive language
 * 
 * Phase 6A: Explainability & Grounded Synthesis
 * - Synthesize cross-frame data (quotes, budget, financing, invoices)
 * - Explain numerical discrepancies with canonical source attribution
 * - Provide evidence traceability with entity counts and source references
 * 
 * Phase 6B: AI Insight Generation & Tension Detection
 * - Detect structural tensions and risks across frames
 * - Surface implications WITHOUT advising action
 * - Quantify impact using canonical sources
 * 
 * Phase 6C: Guided Reasoning Companion
 * - Structure reasoning paths for complex situations
 * - Generate clarifying questions when evidence is missing
 * - Frame alternative scenarios using existing data
 * - Signal proposal readiness without execution
 */

import type { 
  AuthoritativeState, 
  ConstraintSet,
  ReasoningPath,
  ReasoningPathType,
  ReasoningStep,
  ClarifyingQuestion,
  ClarifyingQuestionCategory,
  ScenarioFrame,
  ScenarioType,
  ProposalReadiness,
  GuidedReasoningContext
} from './types';

/**
 * Canonical source definitions for explainability.
 * Maps table names to their meaning and unit conventions.
 */
export const CANONICAL_SOURCES = {
  quote_financials: {
    description: 'Authoritative source for quote totals',
    unitConvention: 'cents (INTEGER) - divide by 100 for currency units',
    fields: ['grossAmount', 'netAmount', 'taxAmount'],
  },
  budget_allocations: {
    description: 'Budget intent allocations by scope',
    unitConvention: 'whole currency units (INTEGER)',
    fields: ['amount'],
  },
  financing_sources: {
    description: 'Confirmed and planned financing sources',
    unitConvention: 'whole currency units (INTEGER)',
    fields: ['amount', 'monthlyLiability'],
  },
  invoice_lines: {
    description: 'Invoice line items for paid/pending transactions',
    unitConvention: 'cents (INTEGER) - divide by 100 for currency units',
    fields: ['amount'],
  },
  scope_nodes: {
    description: 'Hierarchical scope structure',
    unitConvention: 'N/A',
    fields: ['name', 'parentId'],
  },
} as const;

/**
 * Cross-frame reconciliation rules.
 * Explains how values relate across different frames.
 */
export const RECONCILIATION_RULES = {
  expectedCost: {
    rule: 'Expected Cost = Quote-Backed (accepted quote totals) + Budget-Backed (residual allocations without accepted quotes)',
    note: 'Invoices are execution-phase data and are excluded from pre-execution Expected Cost calculations.',
  },
  quotesVsBudget: {
    rule: 'Quote totals are derived from quote_financials.grossAmount (canonical). Budget allocations are planning targets. Differences indicate variance from plan.',
  },
  financingCoverage: {
    rule: 'Coverage Delta = Total Confirmed Financing - Expected Cost. Negative delta indicates a financing gap.',
  },
  invoicesExclusion: {
    rule: 'Invoices represent historical spending (execution phase) and are NOT included in Financing Frame coverage calculations. Financing Frame focuses on pre-execution planning.',
  },
} as const;

/**
 * Entity count summary for evidence traceability.
 */
export interface EntityCounts {
  scopeNodes: number;
  budgetAllocations: number;
  quotes: number;
  acceptedQuotes: number;
  financingSources: number;
  confirmedFinancingSources: number;
  invoices: number;
  paidInvoices: number;
  documents: number;
}

/**
 * Grounded explanation context for AI.
 */
export interface ExplainabilityContext {
  entityCounts: EntityCounts;
  constraintSummary: string;
  canonicalSourcesUsed: string[];
  reconciliationNotes: string[];
  crossFrameSynthesis: string;
  tensionInsights: TensionInsight[];
}

// ============================================================================
// PHASE 6B: TENSION DETECTION TYPES
// ============================================================================

/**
 * Tension severity levels.
 */
export type TensionSeverity = 'low' | 'medium' | 'high';

/**
 * Tension types that can be detected across frames.
 */
export type TensionType = 
  | 'budget_quote_gap'
  | 'financing_shortfall'
  | 'financing_over_coverage'
  | 'high_provisional_reliance'
  | 'invoice_execution_mismatch'
  | 'vendor_concentration'
  | 'scope_concentration'
  | 'unallocated_budget'
  | 'quote_coverage_gap';

/**
 * A detected tension insight.
 * Describes WHAT is happening and WHY it matters.
 * NEVER provides advice or recommendations.
 */
export interface TensionInsight {
  type: TensionType;
  severity: TensionSeverity;
  summary: string;
  whyItMatters: string;
  impact: {
    amount?: number;
    currency?: string;
    percentage?: number;
  };
  evidence: {
    entityType: string;
    count: number;
    canonicalSource: string;
    entityIds?: string[];
  }[];
  confidence: 'high' | 'medium' | 'low';
  constraintNote?: string;
}

/**
 * Extract entity counts from authoritative state.
 */
export function extractEntityCounts(state: AuthoritativeState): EntityCounts {
  return {
    scopeNodes: state.scope.totalCount,
    budgetAllocations: state.budget.allocations.length,
    quotes: state.quotes.count,
    acceptedQuotes: state.quotes.acceptedCount,
    financingSources: state.financing.sources.length,
    confirmedFinancingSources: state.financing.sources.filter(s => s.status === 'confirmed').length,
    invoices: state.invoices.count,
    paidInvoices: state.invoices.paidCount,
    documents: state.documents.count,
  };
}

/**
 * Generate constraint summary for explainability.
 * Does NOT expose raw IDs to users - only counts.
 */
export function generateConstraintSummary(constraintSet?: ConstraintSet): string {
  if (!constraintSet) {
    return 'No retrieval constraints applied - full data load';
  }

  const parts: string[] = [];
  
  if (constraintSet.scopeNodeIds?.length) {
    parts.push(`${constraintSet.scopeNodeIds.length} scope nodes`);
  }
  if (constraintSet.quoteIds?.length) {
    parts.push(`${constraintSet.quoteIds.length} quotes`);
  }
  if (constraintSet.budgetAllocationIds?.length) {
    parts.push(`${constraintSet.budgetAllocationIds.length} budget allocations`);
  }
  if (constraintSet.financingSourceIds?.length) {
    parts.push(`${constraintSet.financingSourceIds.length} financing sources`);
  }
  if (constraintSet.invoiceIds?.length) {
    parts.push(`${constraintSet.invoiceIds.length} invoices`);
  }
  if (constraintSet.documentIds?.length) {
    parts.push(`${constraintSet.documentIds.length} documents`);
  }

  if (parts.length === 0) {
    return 'No retrieval constraints applied - full data load';
  }

  return `Constrained to: ${parts.join(', ')}`;
}

/**
 * Generate canonical sources list based on which data is present.
 */
export function identifyCanonicalSourcesUsed(state: AuthoritativeState): string[] {
  const sources: string[] = [];

  if (state.quotes.count > 0) {
    sources.push('quote_financials (quote totals in cents)');
  }
  if (state.budget.allocations.length > 0 || state.budget.intent !== null) {
    sources.push('budget_allocations (amounts in currency units)');
  }
  if (state.financing.sources.length > 0) {
    sources.push('financing_sources (amounts in currency units)');
  }
  if (state.invoices.count > 0) {
    sources.push('invoice_lines (amounts in cents)');
  }
  if (state.scope.totalCount > 0) {
    sources.push('scope_nodes (hierarchical scope structure)');
  }
  if (state.documents.count > 0) {
    sources.push('documents (uploaded project documents)');
  }

  return sources;
}

/**
 * Helper to extract scopeId from allocation target (handles multiple formats).
 */
function extractScopeIdFromTarget(target: unknown): string | null {
  if (!target) return null;
  if (typeof target === 'string') return target;
  if (typeof target === 'object' && target !== null) {
    const obj = target as Record<string, unknown>;
    if (typeof obj.scopeId === 'string') return obj.scopeId;
    if (typeof obj.id === 'string') return obj.id;
  }
  return null;
}

/**
 * Generate reconciliation notes based on current state.
 * Explains any discrepancies between frames using canonical rules.
 */
export function generateReconciliationNotes(state: AuthoritativeState): string[] {
  const notes: string[] = [];
  const currency = state.project?.currency || 'USD';

  if (state.expectedCost.totalExpectedCost > 0) {
    notes.push(
      `Expected Cost (${formatCurrency(state.expectedCost.totalExpectedCost, currency)}) = ` +
      `Quote-Backed (${formatCurrency(state.expectedCost.quoteBacked, currency)}) + ` +
      `Budget-Backed (${formatCurrency(state.expectedCost.budgetBacked, currency)})`
    );
  }

  if (state.expectedCost.hasFinancingGap) {
    notes.push(
      `Coverage Delta: ${formatCurrency(state.expectedCost.coverageDelta, currency)} ` +
      `(${state.expectedCost.gapSeverity} severity) — ` +
      `Confirmed Financing (${formatCurrency(state.financing.totalConfirmed, currency)}) ` +
      `vs Expected Cost (${formatCurrency(state.expectedCost.totalExpectedCost, currency)})`
    );
  }

  if (state.invoices.count > 0) {
    notes.push(
      `${state.invoices.count} invoice(s) recorded (${state.invoices.paidCount} paid, ` +
      `total paid: ${formatCurrency(state.invoices.totalPaid, currency)}). ` +
      `Invoices are execution-phase data and excluded from pre-execution Financing coverage.`
    );
  }

  if (state.quotes.byScope.length > 0 && state.budget.allocations.length > 0) {
    const quoteScopeIds = new Set(state.quotes.byScope.map(q => q.scopeId));
    const budgetScopeCount = state.budget.allocations.filter(a => {
      const scopeId = extractScopeIdFromTarget(a.target);
      return scopeId && quoteScopeIds.has(scopeId);
    }).length;
    
    if (budgetScopeCount > 0) {
      notes.push(
        `${budgetScopeCount} scope(s) have both budget allocations and quotes — ` +
        `compare quote totals (from quote_financials) against budget allocations for variance analysis.`
      );
    }
  }

  return notes;
}

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  EUR: 'de-DE', USD: 'en-US', GBP: 'en-GB', AUD: 'en-AU', CAD: 'en-CA',
  CHF: 'de-CH', JPY: 'ja-JP', NZD: 'en-NZ', SEK: 'sv-SE', NOK: 'nb-NO',
  DKK: 'da-DK', PLN: 'pl-PL', CZK: 'cs-CZ', HUF: 'hu-HU', SGD: 'en-SG',
  HKD: 'zh-HK', INR: 'en-IN', BRL: 'pt-BR', MXN: 'es-MX', ZAR: 'en-ZA',
};

function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALE_MAP[currency] || 'en-US';
}

/**
 * Format currency value for display.
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate cross-frame synthesis summary.
 * Provides a unified view across quotes, budget, financing, and invoices.
 * Uses ONLY authoritative totals from the state (pre-computed from canonical sources).
 */
export function generateCrossFrameSynthesis(state: AuthoritativeState): string {
  const currency = state.project?.currency || 'USD';
  const lines: string[] = [];

  lines.push('=== CROSS-FRAME FINANCIAL SYNTHESIS ===');
  
  lines.push(`\nBUDGET FRAME (Planning Intent):`);
  lines.push(`  Budget Intent: ${state.budget.intent !== null ? formatCurrency(state.budget.intent, currency) : 'Not set'}`);
  lines.push(`  Total Allocated: ${formatCurrency(state.budget.totalAllocated, currency)}`);
  lines.push(`  Allocations: ${state.budget.allocations.length} (from budget_allocations table)`);
  
  lines.push(`\nQUOTES FRAME (External Assertions):`);
  lines.push(`  Total Quotes: ${state.quotes.count} (${state.quotes.acceptedCount} accepted, ${state.quotes.pendingCount} pending)`);
  // Use byScope totals (authoritative) rather than re-summing items
  if (state.quotes.byScope.length > 0) {
    const totalQuoteGross = state.quotes.byScope.reduce((sum, s) => sum + s.totalGross, 0);
    lines.push(`  Total Quote Value (by scope): ${formatCurrency(totalQuoteGross, currency)} (from quote_financials.grossAmount)`);
  } else if (state.quotes.count > 0) {
    // Fallback: use expectedCost.quoteBacked as authoritative source
    lines.push(`  Quote-Backed Value: ${formatCurrency(state.expectedCost.quoteBacked, currency)} (from quote_financials)`);
  }
  
  lines.push(`\nFINANCING FRAME (Pre-Execution Coverage):`);
  lines.push(`  Confirmed Financing: ${formatCurrency(state.financing.totalConfirmed, currency)}`);
  lines.push(`  Planned Financing: ${formatCurrency(state.financing.totalPlanned, currency)}`);
  lines.push(`  Sources: ${state.financing.sources.length} (from financing_sources table)`);
  lines.push(`  Monthly Liabilities: ${formatCurrency(state.financing.totalMonthlyLiabilities, currency)}`);
  
  lines.push(`\nEXPECTED COST (Financing Frame KPI):`);
  lines.push(`  Total Expected Cost: ${formatCurrency(state.expectedCost.totalExpectedCost, currency)}`);
  lines.push(`  Quote-Backed: ${formatCurrency(state.expectedCost.quoteBacked, currency)}`);
  lines.push(`  Budget-Backed: ${formatCurrency(state.expectedCost.budgetBacked, currency)}`);
  lines.push(`  Coverage Delta: ${formatCurrency(state.expectedCost.coverageDelta, currency)}`);
  lines.push(`  Gap Severity: ${state.expectedCost.gapSeverity}`);
  
  lines.push(`\nINVOICES FRAME (Execution-Phase Reality):`);
  lines.push(`  Total Invoices: ${state.invoices.count} (${state.invoices.paidCount} paid)`);
  lines.push(`  Total Paid: ${formatCurrency(state.invoices.totalPaid, currency)}`);
  lines.push(`  Pending Amount: ${formatCurrency(state.invoices.pendingAmount, currency)}`);
  lines.push(`  [NOTE: Invoices are excluded from Financing coverage calculations]`);

  return lines.join('\n');
}

// ============================================================================
// PHASE 6B: TENSION DETECTION FUNCTIONS
// ============================================================================

/**
 * Detect structural tensions across frames using canonical data.
 * NEVER provides recommendations - only describes what is happening.
 */
export function detectTensions(
  state: AuthoritativeState,
  constraintSet?: ConstraintSet
): TensionInsight[] {
  const tensions: TensionInsight[] = [];
  const currency = state.project?.currency || 'USD';
  const constraintNote = constraintSet ? generateConstraintSummary(constraintSet) : undefined;

  // 1. Financing Shortfall Detection
  if (state.expectedCost.hasFinancingGap && state.expectedCost.coverageDelta < 0) {
    const gap = Math.abs(state.expectedCost.coverageDelta);
    const severity: TensionSeverity = 
      state.expectedCost.gapSeverity === 'critical' ? 'high' :
      state.expectedCost.gapSeverity === 'warning' ? 'medium' : 'low';
    
    tensions.push({
      type: 'financing_shortfall',
      severity,
      summary: `Confirmed financing (${formatCurrency(state.financing.totalConfirmed, currency)}) is ${formatCurrency(gap, currency)} below expected cost (${formatCurrency(state.expectedCost.totalExpectedCost, currency)}).`,
      whyItMatters: 'A financing gap indicates that current confirmed funding sources do not fully cover the projected project cost. This difference represents the unfunded portion of the expected cost.',
      impact: { amount: gap, currency },
      evidence: [
        { entityType: 'financing_sources', count: state.financing.sources.filter(s => s.status === 'confirmed').length, canonicalSource: 'financing_sources.amount' },
        { entityType: 'expected_cost', count: 1, canonicalSource: 'computed from quote_financials + budget_allocations' },
      ],
      confidence: 'high',
      constraintNote,
    });
  }

  // 2. Financing Over-Coverage Detection
  if (state.expectedCost.coverageDelta > 0 && state.expectedCost.totalExpectedCost > 0) {
    const surplus = state.expectedCost.coverageDelta;
    const surplusPercent = Math.round((surplus / state.expectedCost.totalExpectedCost) * 100);
    
    if (surplusPercent > 20) {
      tensions.push({
        type: 'financing_over_coverage',
        severity: 'low',
        summary: `Confirmed financing exceeds expected cost by ${formatCurrency(surplus, currency)} (${surplusPercent}% over expected cost).`,
        whyItMatters: 'Significant over-coverage may indicate either conservative cost estimates or financing arranged beyond immediate project needs.',
        impact: { amount: surplus, currency, percentage: surplusPercent },
        evidence: [
          { entityType: 'financing_sources', count: state.financing.sources.filter(s => s.status === 'confirmed').length, canonicalSource: 'financing_sources.amount' },
        ],
        confidence: 'high',
        constraintNote,
      });
    }
  }

  // 3. High Provisional Quote Reliance
  const pendingQuotes = state.quotes.pendingCount;
  const acceptedQuotes = state.quotes.acceptedCount;
  const totalQuotes = state.quotes.count;
  
  if (totalQuotes > 0 && pendingQuotes > 0) {
    const pendingRatio = pendingQuotes / totalQuotes;
    if (pendingRatio >= 0.5) {
      tensions.push({
        type: 'high_provisional_reliance',
        severity: pendingRatio >= 0.75 ? 'high' : 'medium',
        summary: `${pendingQuotes} of ${totalQuotes} quotes (${Math.round(pendingRatio * 100)}%) remain pending/draft.`,
        whyItMatters: 'A high proportion of non-accepted quotes means the expected cost is partially based on unconfirmed pricing. Final costs may differ as quotes are finalized.',
        impact: { percentage: Math.round(pendingRatio * 100) },
        evidence: [
          { entityType: 'quotes', count: pendingQuotes, canonicalSource: 'quotes with status != accepted' },
        ],
        confidence: 'high',
        constraintNote,
      });
    }
  }

  // 4. Budget vs Quote Coverage Gap
  if (state.budget.allocations.length > 0 && state.quotes.byScope.length > 0) {
    const quotedScopeIds = new Set(state.quotes.byScope.map(q => q.scopeId));
    const unquotedAllocations = state.budget.allocations.filter(a => {
      const scopeId = extractScopeIdFromTarget(a.target);
      return scopeId && !quotedScopeIds.has(scopeId);
    });
    
    if (unquotedAllocations.length > 0) {
      const unquotedTotal = unquotedAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalAllocated = state.budget.totalAllocated;
      const unquotedPercent = totalAllocated > 0 ? Math.round((unquotedTotal / totalAllocated) * 100) : 0;
      
      if (unquotedPercent >= 30) {
        tensions.push({
          type: 'quote_coverage_gap',
          severity: unquotedPercent >= 50 ? 'high' : 'medium',
          summary: `${unquotedAllocations.length} budget allocation(s) totaling ${formatCurrency(unquotedTotal, currency)} (${unquotedPercent}% of allocated budget) have no corresponding quotes.`,
          whyItMatters: 'Budget allocations without quotes represent planning estimates not yet validated by external pricing. Actual costs for these scopes remain uncertain.',
          impact: { amount: unquotedTotal, currency, percentage: unquotedPercent },
          evidence: [
            { entityType: 'budget_allocations', count: unquotedAllocations.length, canonicalSource: 'budget_allocations.amount' },
          ],
          confidence: 'high',
          constraintNote,
        });
      }
    }
  }

  // 5. Unallocated Budget Detection
  if (state.budget.intent !== null && state.budget.intent > 0) {
    const unallocated = state.budget.intent - state.budget.totalAllocated;
    const unallocatedPercent = Math.round((unallocated / state.budget.intent) * 100);
    
    if (unallocatedPercent >= 20 && unallocated > 0) {
      tensions.push({
        type: 'unallocated_budget',
        severity: unallocatedPercent >= 40 ? 'medium' : 'low',
        summary: `${formatCurrency(unallocated, currency)} (${unallocatedPercent}%) of budget intent remains unallocated to scopes.`,
        whyItMatters: 'Unallocated budget represents funds not yet assigned to specific scopes. This may be intentional contingency or indicate incomplete planning.',
        impact: { amount: unallocated, currency, percentage: unallocatedPercent },
        evidence: [
          { entityType: 'budget_intent', count: 1, canonicalSource: 'budget_data.totalBudget' },
          { entityType: 'budget_allocations', count: state.budget.allocations.length, canonicalSource: 'budget_allocations.amount' },
        ],
        confidence: 'high',
        constraintNote,
      });
    }
  }

  // 6. Scope Concentration (single scope dominates quote value)
  if (state.quotes.byScope && state.quotes.byScope.length > 1) {
    const totalQuoteGross = state.quotes.byScope.reduce((sum, s) => sum + s.totalGross, 0);
    if (totalQuoteGross > 0) {
      const sortedScopes = [...state.quotes.byScope].sort((a, b) => b.totalGross - a.totalGross);
      const topScope = sortedScopes[0];
      const topScopePercent = Math.round((topScope.totalGross / totalQuoteGross) * 100);
      
      if (topScopePercent >= 50) {
        tensions.push({
          type: 'scope_concentration',
          severity: topScopePercent >= 70 ? 'medium' : 'low',
          summary: `Scope "${topScope.scopeName}" accounts for ${topScopePercent}% (${formatCurrency(topScope.totalGross, currency)}) of total quote value.`,
          whyItMatters: 'High concentration in a single scope means project cost is heavily dependent on that scope\'s accuracy. Variances in this scope will have outsized impact on total cost.',
          impact: { amount: topScope.totalGross, currency, percentage: topScopePercent },
          evidence: [
            { entityType: 'scope', count: 1, canonicalSource: 'quotes.byScope.totalGross (from quote_financials)' },
          ],
          confidence: 'high',
          constraintNote,
        });
      }
    }
  }

  // 7. Vendor Concentration (if vendor data available)
  if (state.quotes.items && state.quotes.items.length > 1) {
    const vendorTotals = new Map<string, { total: number; count: number; name: string }>();
    state.quotes.items.forEach(q => {
      const vendorName = q.vendorName || 'Unknown';
      const existing = vendorTotals.get(vendorName) || { total: 0, count: 0, name: vendorName };
      existing.total += q.grandTotal || 0;
      existing.count += 1;
      vendorTotals.set(vendorName, existing);
    });

    const totalQuoteValue = state.quotes.items.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
    if (totalQuoteValue > 0 && vendorTotals.size > 1) {
      const sortedVendors = Array.from(vendorTotals.values()).sort((a, b) => b.total - a.total);
      const topVendor = sortedVendors[0];
      const topVendorPercent = Math.round((topVendor.total / totalQuoteValue) * 100);
      
      if (topVendorPercent >= 60) {
        tensions.push({
          type: 'vendor_concentration',
          severity: topVendorPercent >= 80 ? 'medium' : 'low',
          summary: `Vendor "${topVendor.name}" represents ${topVendorPercent}% (${formatCurrency(topVendor.total, currency)}) of total quote value across ${topVendor.count} quote(s).`,
          whyItMatters: 'High vendor concentration means significant reliance on a single contractor. Any issues with this vendor (pricing changes, availability, performance) would affect a large portion of project cost.',
          impact: { amount: topVendor.total, currency, percentage: topVendorPercent },
          evidence: [
            { entityType: 'vendor', count: 1, canonicalSource: 'quotes.vendorName + quote_financials.grossAmount' },
          ],
          confidence: 'medium',
          constraintNote,
        });
      }
    }
  }

  return tensions;
}

/**
 * Build complete explainability context for AI.
 */
export function buildExplainabilityContext(
  state: AuthoritativeState,
  constraintSet?: ConstraintSet
): ExplainabilityContext {
  return {
    entityCounts: extractEntityCounts(state),
    constraintSummary: generateConstraintSummary(constraintSet),
    canonicalSourcesUsed: identifyCanonicalSourcesUsed(state),
    reconciliationNotes: generateReconciliationNotes(state),
    crossFrameSynthesis: generateCrossFrameSynthesis(state),
    tensionInsights: detectTensions(state, constraintSet),
  };
}

/**
 * Serialize explainability context for AI consumption.
 * This is appended to the authoritative state context.
 */
export function serializeExplainabilityContext(ctx: ExplainabilityContext): string {
  const lines: string[] = [];
  
  lines.push('\n=== EXPLAINABILITY CONTEXT (Phase 6A) ===\n');
  
  lines.push('EVIDENCE TRACEABILITY:');
  lines.push(`  Based on: ${ctx.entityCounts.scopeNodes} scope nodes, ${ctx.entityCounts.budgetAllocations} budget allocations, ${ctx.entityCounts.quotes} quotes (${ctx.entityCounts.acceptedQuotes} accepted), ${ctx.entityCounts.financingSources} financing sources (${ctx.entityCounts.confirmedFinancingSources} confirmed), ${ctx.entityCounts.invoices} invoices (${ctx.entityCounts.paidInvoices} paid), ${ctx.entityCounts.documents} documents`);
  lines.push(`  ${ctx.constraintSummary}`);
  lines.push('');
  
  lines.push('CANONICAL SOURCES USED:');
  ctx.canonicalSourcesUsed.forEach(source => {
    lines.push(`  - ${source}`);
  });
  lines.push('');
  
  if (ctx.reconciliationNotes.length > 0) {
    lines.push('RECONCILIATION NOTES:');
    ctx.reconciliationNotes.forEach((note, i) => {
      lines.push(`  ${i + 1}. ${note}`);
    });
    lines.push('');
  }
  
  lines.push(ctx.crossFrameSynthesis);
  
  // Phase 6B: Tension Insights
  if (ctx.tensionInsights && ctx.tensionInsights.length > 0) {
    lines.push('\n=== TENSION INSIGHTS (Phase 6B) ===');
    lines.push('[RULE: Report these descriptively. NEVER recommend actions or give advice.]\n');
    
    ctx.tensionInsights.forEach((tension, i) => {
      lines.push(`TENSION ${i + 1}: ${tension.type.toUpperCase().replace(/_/g, ' ')}`);
      lines.push(`  Severity: ${tension.severity}`);
      lines.push(`  Summary: ${tension.summary}`);
      lines.push(`  Why it matters: ${tension.whyItMatters}`);
      
      if (tension.impact.amount !== undefined) {
        lines.push(`  Impact: ${formatCurrencyForTension(tension.impact.amount, tension.impact.currency)}${tension.impact.percentage !== undefined ? ` (${tension.impact.percentage}%)` : ''}`);
      } else if (tension.impact.percentage !== undefined) {
        lines.push(`  Impact: ${tension.impact.percentage}%`);
      }
      
      lines.push(`  Evidence:`);
      tension.evidence.forEach(e => {
        lines.push(`    - ${e.count} ${e.entityType}(s) [source: ${e.canonicalSource}]`);
      });
      
      lines.push(`  Confidence: ${tension.confidence}`);
      if (tension.constraintNote) {
        lines.push(`  [${tension.constraintNote}]`);
      }
      lines.push('');
    });
    
    lines.push('=== END TENSION INSIGHTS ===');
  }
  
  lines.push('\n=== END EXPLAINABILITY CONTEXT ===\n');
  
  return lines.join('\n');
}

/**
 * Format currency for tension display.
 */
function formatCurrencyForTension(amount: number, currency?: string): string {
  const cur = currency || 'USD';
  return new Intl.NumberFormat(localeForCurrency(cur), {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// PHASE 6C: GUIDED REASONING COMPANION
// ============================================================================

/**
 * Reasoning path templates for common analytical scenarios.
 * Each path provides structured steps grounded in canonical data.
 */
const REASONING_PATH_TEMPLATES: Record<ReasoningPathType, { title: string; stepDescriptions: string[] }> = {
  financial_analysis: {
    title: 'Financial Position Analysis',
    stepDescriptions: [
      'Review current expected cost from quote-backed and budget-backed sources',
      'Examine confirmed financing capacity from financing_sources',
      'Calculate coverage delta between financing and expected cost',
      'Consider the implications of the current coverage position',
    ],
  },
  scope_evaluation: {
    title: 'Scope Structure Evaluation',
    stepDescriptions: [
      'Review the hierarchical scope structure and node relationships',
      'Identify which scopes have associated budget allocations',
      'Examine quote coverage across scope nodes',
      'Consider the completeness of scope definition',
    ],
  },
  coverage_assessment: {
    title: 'Quote Coverage Assessment',
    stepDescriptions: [
      'Identify budget allocations that lack accepted quotes',
      'Review quote statuses across all scope areas',
      'Calculate the proportion of expected cost that is quote-backed',
      'Consider the reliability of current cost estimates',
    ],
  },
  risk_exploration: {
    title: 'Risk Factor Exploration',
    stepDescriptions: [
      'Review detected tensions from Phase 6B analysis',
      'Examine vendor and scope concentration patterns',
      'Consider financing gap implications if present',
      'Assess the provisional quote reliance level',
    ],
  },
  quote_comparison: {
    title: 'Quote Comparison Analysis',
    stepDescriptions: [
      'Review quotes associated with a specific scope',
      'Compare gross amounts across vendors',
      'Examine line item details where available',
      'Consider the quote status progression',
    ],
  },
  budget_alignment: {
    title: 'Budget Alignment Analysis',
    stepDescriptions: [
      'Review total budget intent and allocation distribution',
      'Compare allocations against accepted quote totals',
      'Identify variance between planned and quoted amounts',
      'Consider contingency position and available buffer',
    ],
  },
  timeline_consideration: {
    title: 'Timeline Consideration',
    stepDescriptions: [
      'Review quote dates and validity periods where available',
      'Examine invoice payment patterns if present',
      'Consider the project lifecycle phase',
      'Note any time-sensitive elements in the data',
    ],
  },
};

/**
 * Detect which reasoning paths are relevant based on authoritative state and tensions.
 */
export function detectReasoningNeeds(
  state: AuthoritativeState,
  tensions: TensionInsight[],
  activeFrame: string
): ReasoningPathType[] {
  const needs: ReasoningPathType[] = [];
  
  // Financial analysis is always relevant if there's financial data
  if (state.financing.sources.length > 0 || state.expectedCost.totalExpectedCost > 0) {
    needs.push('financial_analysis');
  }
  
  // Coverage assessment if there are budget allocations or quotes
  if (state.budget.allocations.length > 0 || state.quotes.count > 0) {
    needs.push('coverage_assessment');
  }
  
  // Risk exploration if tensions are detected
  if (tensions.length > 0) {
    needs.push('risk_exploration');
  }
  
  // Frame-specific reasoning
  switch (activeFrame) {
    case 'scope':
      needs.push('scope_evaluation');
      break;
    case 'quotes':
      needs.push('quote_comparison');
      break;
    case 'budget':
      needs.push('budget_alignment');
      break;
    case 'financing':
      if (!needs.includes('financial_analysis')) {
        needs.push('financial_analysis');
      }
      break;
  }
  
  return Array.from(new Set(needs)); // Deduplicate
}

/**
 * Generate a structured reasoning path for a given type.
 */
export function generateReasoningPath(
  type: ReasoningPathType,
  state: AuthoritativeState,
  constraintSet?: ConstraintSet
): ReasoningPath {
  const template = REASONING_PATH_TEMPLATES[type];
  const currency = state.project?.currency || 'EUR';
  
  const steps: ReasoningStep[] = template.stepDescriptions.map((description, index) => ({
    step: index + 1,
    description,
    canonicalSources: getCanonicalSourcesForStep(type, index),
    conditionalLanguage: getConditionalLanguage(type, index),
    dataRequired: getDataRequiredForStep(type, index, state),
  }));
  
  const constraintsApplied: string[] = [];
  if (constraintSet) {
    if (constraintSet.scopeNodeIds?.length) {
      constraintsApplied.push(`Scope limited to ${constraintSet.scopeNodeIds.length} node(s)`);
    }
    if (constraintSet.quoteIds?.length) {
      constraintsApplied.push(`Quotes limited to ${constraintSet.quoteIds.length} quote(s)`);
    }
  }
  
  return {
    type,
    title: template.title,
    steps,
    constraintsApplied,
    groundedIn: ['authoritative_state', 'canonical_sources'],
  };
}

/**
 * Get canonical sources for a reasoning step.
 */
function getCanonicalSourcesForStep(type: ReasoningPathType, stepIndex: number): string[] {
  const sourceMap: Record<ReasoningPathType, string[][]> = {
    financial_analysis: [
      ['quote_financials', 'budget_allocations'],
      ['financing_sources'],
      ['quote_financials', 'financing_sources'],
      [],
    ],
    scope_evaluation: [
      ['scope_nodes'],
      ['budget_allocations', 'scope_nodes'],
      ['quote_financials', 'scope_nodes'],
      [],
    ],
    coverage_assessment: [
      ['budget_allocations', 'quote_financials'],
      ['quote_financials'],
      ['quote_financials', 'budget_allocations'],
      [],
    ],
    risk_exploration: [
      [],
      ['quote_financials'],
      ['financing_sources'],
      ['quote_financials'],
    ],
    quote_comparison: [
      ['quote_financials', 'scope_nodes'],
      ['quote_financials'],
      ['quote_line_items'],
      ['quote_financials'],
    ],
    budget_alignment: [
      ['budget_allocations'],
      ['budget_allocations', 'quote_financials'],
      ['budget_allocations', 'quote_financials'],
      ['budget_allocations'],
    ],
    timeline_consideration: [
      ['quote_financials'],
      ['invoice_lines'],
      [],
      [],
    ],
  };
  
  return sourceMap[type]?.[stepIndex] || [];
}

/**
 * Get conditional language for exploratory reasoning.
 */
function getConditionalLanguage(type: ReasoningPathType, stepIndex: number): string {
  const phrases = [
    'If we consider...',
    'Based on available data...',
    'Given the current state...',
    'Looking at this from the perspective of...',
  ];
  return phrases[stepIndex % phrases.length];
}

/**
 * Get data required for a reasoning step.
 */
function getDataRequiredForStep(
  type: ReasoningPathType,
  stepIndex: number,
  state: AuthoritativeState
): string[] {
  const required: string[] = [];
  
  if (type === 'financial_analysis' && stepIndex === 0) {
    if (state.expectedCost.totalExpectedCost === 0) {
      required.push('Expected cost data (quotes or budget allocations)');
    }
  }
  
  if (type === 'quote_comparison' && stepIndex === 1) {
    if (state.quotes.count < 2) {
      required.push('Multiple quotes for comparison');
    }
  }
  
  return required;
}

/**
 * Generate clarifying questions based on missing evidence or unresolved tensions.
 */
export function generateClarifyingQuestions(
  state: AuthoritativeState,
  tensions: TensionInsight[],
  activeFrame: string
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];
  
  // Missing data questions
  if (state.budget.intent === null && activeFrame === 'financing') {
    questions.push({
      category: 'missing_data',
      question: 'What is your total budget intent for this project?',
      context: 'Budget intent helps establish the baseline for coverage calculations.',
      expectedAnswerType: 'value',
      relatedEntities: ['budget_data'],
    });
  }
  
  if (state.quotes.count === 0 && state.budget.allocations.length > 0) {
    questions.push({
      category: 'missing_data',
      question: 'Are there quotes expected for the existing budget allocations?',
      context: 'Budget allocations without quotes rely on estimates rather than vendor pricing.',
      expectedAnswerType: 'yes_no',
      relatedEntities: ['budget_allocations'],
    });
  }
  
  // Unresolved tension questions
  tensions.forEach(tension => {
    if (tension.type === 'financing_shortfall' && tension.severity === 'high') {
      questions.push({
        category: 'unresolved_tension',
        question: 'Is additional financing being considered for this project?',
        context: `Current financing gap: ${formatCurrencyForTension(tension.impact.amount || 0, tension.impact.currency)}`,
        expectedAnswerType: 'yes_no',
        relatedEntities: ['financing_sources'],
      });
    }
    
    if (tension.type === 'high_provisional_reliance') {
      questions.push({
        category: 'unresolved_tension',
        question: 'Are any of the pending quotes expected to be accepted soon?',
        context: 'High provisional reliance means cost estimates may change significantly.',
        expectedAnswerType: 'explanation',
        relatedEntities: ['quotes'],
      });
    }
  });
  
  // Scope clarification
  if (state.scope.nodes.length === 0 && activeFrame !== 'scope') {
    questions.push({
      category: 'scope_clarification',
      question: 'Would you like to define the project scope structure first?',
      context: 'Scope nodes help organize budget allocations and quotes.',
      expectedAnswerType: 'yes_no',
      relatedEntities: ['scope_nodes'],
    });
  }
  
  // Priority determination
  if (tensions.length > 2) {
    questions.push({
      category: 'priority_determination',
      question: 'Which aspect would you like to explore first?',
      context: 'Multiple structural patterns have been detected.',
      expectedAnswerType: 'choice',
      relatedEntities: tensions.slice(0, 3).map(t => t.type),
    });
  }
  
  return questions;
}

/**
 * Generate scenario frames for alternative data views.
 */
export function generateScenarioFrames(
  state: AuthoritativeState,
  constraintSet?: ConstraintSet
): ScenarioFrame[] {
  const frames: ScenarioFrame[] = [];
  
  // Always offer constrained vs unconstrained views if constraints exist
  if (constraintSet && (
    constraintSet.scopeNodeIds?.length ||
    constraintSet.quoteIds?.length ||
    constraintSet.budgetAllocationIds?.length
  )) {
    frames.push({
      type: 'constrained_view',
      title: 'Current Context View',
      description: 'Analysis limited to entities matching the current conversation context.',
      dataView: 'constrained',
      constraints: buildConstraintDescriptions(constraintSet),
      excludes: ['Entities outside current context'],
    });
    
    frames.push({
      type: 'unconstrained_view',
      title: 'Full Project View',
      description: 'Analysis across all project entities without retrieval constraints.',
      dataView: 'full',
      constraints: [],
      excludes: [],
    });
  }
  
  // Scope-focused view if multiple scopes exist
  if (state.scope.nodes.length > 1) {
    const topScope = state.scope.nodes.find(n => n.parentId === null);
    if (topScope) {
      frames.push({
        type: 'scope_focused',
        title: `Focus: ${topScope.name}`,
        description: 'Analysis centered on a specific scope branch.',
        dataView: 'scope_filtered',
        constraints: [`Scope: ${topScope.name}`],
        excludes: ['Other scope branches'],
      });
    }
  }
  
  // Vendor-focused view if multiple vendors exist
  const uniqueVendors = new Set(
    state.quotes.items
      .map(q => q.vendorName)
      .filter((v): v is string => v !== null)
  );
  if (uniqueVendors.size > 1) {
    frames.push({
      type: 'vendor_focused',
      title: 'Vendor Comparison View',
      description: 'Analysis grouped by vendor for comparison.',
      dataView: 'vendor_grouped',
      constraints: [`${uniqueVendors.size} vendors`],
      excludes: [],
    });
  }
  
  return frames;
}

/**
 * Build constraint descriptions from a ConstraintSet.
 */
function buildConstraintDescriptions(constraintSet: ConstraintSet): string[] {
  const descriptions: string[] = [];
  
  if (constraintSet.scopeNodeIds?.length) {
    descriptions.push(`${constraintSet.scopeNodeIds.length} scope node(s)`);
  }
  if (constraintSet.quoteIds?.length) {
    descriptions.push(`${constraintSet.quoteIds.length} quote(s)`);
  }
  if (constraintSet.budgetAllocationIds?.length) {
    descriptions.push(`${constraintSet.budgetAllocationIds.length} budget allocation(s)`);
  }
  if (constraintSet.documentIds?.length) {
    descriptions.push(`${constraintSet.documentIds.length} document(s)`);
  }
  
  return descriptions;
}

/**
 * Assess whether the AI is ready to propose based on available data.
 */
export function assessProposalReadiness(
  state: AuthoritativeState,
  userMessage: string,
  tensions: TensionInsight[]
): ProposalReadiness {
  const missingElements: string[] = [];
  let targetFrame: string | null = null;
  let isReady = false;
  let rationale = '';
  
  // Check for proposal-triggering keywords
  const proposalKeywords = ['create', 'add', 'update', 'change', 'set', 'allocate', 'assign'];
  const hasProposalIntent = proposalKeywords.some(kw => 
    userMessage.toLowerCase().includes(kw)
  );
  
  if (!hasProposalIntent) {
    return {
      isReady: false,
      targetFrame: null,
      rationale: 'No proposal intent detected in user message.',
      missingElements: [],
      awaitingConfirmation: false,
    };
  }
  
  // Determine target frame from message context
  if (userMessage.toLowerCase().includes('budget') || userMessage.toLowerCase().includes('allocation')) {
    targetFrame = 'budget';
    if (state.budget.intent === null) {
      missingElements.push('Budget intent must be set before allocations');
    }
  } else if (userMessage.toLowerCase().includes('scope')) {
    targetFrame = 'scope';
  } else if (userMessage.toLowerCase().includes('quote')) {
    targetFrame = 'quotes';
  } else if (userMessage.toLowerCase().includes('financing') || userMessage.toLowerCase().includes('funding')) {
    targetFrame = 'financing';
  }
  
  // Check if ready
  isReady = missingElements.length === 0 && targetFrame !== null;
  
  if (isReady) {
    rationale = `Ready to propose changes to ${targetFrame} frame. Awaiting user confirmation before proceeding.`;
  } else if (missingElements.length > 0) {
    rationale = `Cannot propose until: ${missingElements.join('; ')}`;
  } else {
    rationale = 'Target frame could not be determined from the request.';
  }
  
  return {
    isReady,
    targetFrame,
    rationale,
    missingElements,
    awaitingConfirmation: isReady,
  };
}

/**
 * Build the complete guided reasoning context.
 */
export function buildGuidedReasoningContext(
  state: AuthoritativeState,
  tensions: TensionInsight[],
  userMessage: string,
  constraintSet?: ConstraintSet
): GuidedReasoningContext {
  const activeFrame = state.activeFrame;
  
  // Detect which reasoning paths are relevant
  const reasoningNeeds = detectReasoningNeeds(state, tensions, activeFrame);
  const reasoningPaths = reasoningNeeds.map(type => 
    generateReasoningPath(type, state, constraintSet)
  );
  
  // Generate clarifying questions
  const clarifyingQuestions = generateClarifyingQuestions(state, tensions, activeFrame);
  
  // Generate scenario frames
  const scenarioFrames = generateScenarioFrames(state, constraintSet);
  
  // Assess proposal readiness
  const proposalReadiness = assessProposalReadiness(state, userMessage, tensions);
  
  // Collect constraints acknowledged
  const constraintsAcknowledged: string[] = [];
  if (constraintSet) {
    constraintsAcknowledged.push(...buildConstraintDescriptions(constraintSet));
  }
  
  return {
    reasoningPaths,
    clarifyingQuestions,
    scenarioFrames,
    proposalReadiness,
    constraintsAcknowledged,
  };
}

/**
 * Serialize guided reasoning context for AI prompt.
 */
export function serializeGuidedReasoningContext(ctx: GuidedReasoningContext): string {
  const lines: string[] = [];
  
  lines.push('\n=== GUIDED REASONING (Phase 6C) ===');
  lines.push('[RULE: Guide reasoning. NEVER execute actions. NEVER give advice. Wait for user confirmation before proposing.]');
  
  // Reasoning paths
  if (ctx.reasoningPaths.length > 0) {
    lines.push('\n--- REASONING PATHS AVAILABLE ---');
    ctx.reasoningPaths.forEach(path => {
      lines.push(`\n[${path.type.toUpperCase().replace(/_/g, ' ')}]: ${path.title}`);
      path.steps.forEach(step => {
        lines.push(`  Step ${step.step}: ${step.description}`);
        if (step.canonicalSources.length > 0) {
          lines.push(`    Sources: ${step.canonicalSources.join(', ')}`);
        }
        if (step.dataRequired.length > 0) {
          lines.push(`    [Missing: ${step.dataRequired.join(', ')}]`);
        }
      });
      if (path.constraintsApplied.length > 0) {
        lines.push(`  Constraints: ${path.constraintsApplied.join(', ')}`);
      }
    });
  }
  
  // Clarifying questions
  if (ctx.clarifyingQuestions.length > 0) {
    lines.push('\n--- POTENTIAL CLARIFYING QUESTIONS ---');
    lines.push('[These are questions the AI MAY ask to gather missing information]');
    ctx.clarifyingQuestions.forEach((q, i) => {
      lines.push(`\n  Q${i + 1} [${q.category}]: ${q.question}`);
      lines.push(`      Context: ${q.context}`);
      lines.push(`      Expected answer: ${q.expectedAnswerType}`);
    });
  }
  
  // Scenario frames
  if (ctx.scenarioFrames.length > 0) {
    lines.push('\n--- SCENARIO FRAMES ---');
    lines.push('[Alternative data views the AI can frame for the user]');
    ctx.scenarioFrames.forEach(frame => {
      lines.push(`\n  [${frame.type.toUpperCase().replace(/_/g, ' ')}]: ${frame.title}`);
      lines.push(`    ${frame.description}`);
      if (frame.constraints.length > 0) {
        lines.push(`    Includes: ${frame.constraints.join(', ')}`);
      }
      if (frame.excludes.length > 0) {
        lines.push(`    Excludes: ${frame.excludes.join(', ')}`);
      }
    });
  }
  
  // Proposal readiness
  if (ctx.proposalReadiness) {
    lines.push('\n--- PROPOSAL READINESS ---');
    if (ctx.proposalReadiness.isReady) {
      lines.push(`  Status: READY to propose (target: ${ctx.proposalReadiness.targetFrame})`);
      lines.push('  [AWAITING USER CONFIRMATION - Do not execute until user explicitly confirms]');
    } else {
      lines.push(`  Status: NOT READY`);
      lines.push(`  Reason: ${ctx.proposalReadiness.rationale}`);
      if (ctx.proposalReadiness.missingElements.length > 0) {
        lines.push(`  Missing: ${ctx.proposalReadiness.missingElements.join(', ')}`);
      }
    }
  }
  
  // Constraints acknowledged
  if (ctx.constraintsAcknowledged.length > 0) {
    lines.push(`\n[Constraints acknowledged: ${ctx.constraintsAcknowledged.join(', ')}]`);
  }
  
  lines.push('\n=== END GUIDED REASONING ===');
  
  return lines.join('\n');
}
