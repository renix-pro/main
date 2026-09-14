/**
 * RENIX vNext — Cross-Frame Intelligence Pattern Library
 * 
 * Canon v1.4 Compliant — Phase 7
 * 
 * Pattern Library v1.0 — LOCKED
 * 
 * These patterns are read-only, deterministic, and non-authoritative.
 * Patterns detect cross-frame tensions, drift, risk, and blind spots.
 */

import type { 
  CFISnapshot, 
  CFISignal, 
  CFIPattern, 
  ScopeSnapshotItem,
  QuoteSnapshotItem,
  ExecutionSnapshotItem,
  BudgetAllocation,
} from './types';

export const PATTERN_LIBRARY: readonly CFIPattern[] = [
  {
    id: 'P-01',
    name: 'Scope–Budget Tension',
    class: 'tension',
    frames: ['scope', 'budget'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.scope || !snapshot.budget) return false;
      const lastBudgetEdit = snapshot.budget.lastModified;
      const scopeItemsAfterBudget = snapshot.scope.items.filter(
        (item: ScopeSnapshotItem) => item.createdAt > lastBudgetEdit
      );
      return scopeItemsAfterBudget.length > 0;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Project intent has expanded since financial intent was last revisited.',
      whyItMatters: 'New scope items may not be reflected in current budget allocations.',
      paths: [
        { frame: 'scope', context: 'recent additions' },
        { frame: 'budget', context: 'allocations' },
      ],
    }),
    decayCondition: 'Any Budget modification',
  },

  {
    id: 'P-02',
    name: 'Budget–Quote Pressure',
    class: 'tension',
    frames: ['budget', 'quotes'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.budget || !snapshot.quotes) return false;
      const acceptedQuotes = snapshot.quotes.items.filter((q: QuoteSnapshotItem) => q.accepted);
      if (acceptedQuotes.length === 0) return false;
      const acceptedTotal = acceptedQuotes.reduce(
        (sum: number, q: QuoteSnapshotItem) => sum + (q.total?.value ?? 0), 
        0
      );
      const budgetTotal = snapshot.budget.totalIntent;
      return acceptedTotal > budgetTotal;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Validated market pricing exceeds current financial intent for this scope.',
      whyItMatters: 'Accepted quotes indicate costs beyond planned budget.',
      paths: [
        { frame: 'budget', context: 'total intent' },
        { frame: 'quotes', context: 'accepted totals' },
      ],
    }),
    decayCondition: 'Budget reallocation or quote supersession/rejection',
  },

  {
    id: 'P-03',
    name: 'Execution Ahead of Financing',
    class: 'drift',
    frames: ['execution', 'financing'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.execution || !snapshot.financing || !snapshot.budget) return false;
      const hasActiveExecution = snapshot.execution.items.some(
        (e: ExecutionSnapshotItem) => e.status === 'active'
      );
      const financingCoverage = snapshot.financing.totalCoverage;
      const budgetIntent = snapshot.budget.totalIntent;
      return hasActiveExecution && financingCoverage < budgetIntent;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Delivery is progressing while some funding remains unsecured.',
      whyItMatters: 'Active work may outpace available financing.',
      paths: [
        { frame: 'execution', context: 'progress' },
        { frame: 'financing', context: 'coverage' },
      ],
    }),
    decayCondition: 'Financing parity achieved or execution paused',
  },

  {
    id: 'P-04',
    name: 'Commitment Risk Accumulation',
    class: 'risk-accumulation',
    frames: ['quotes', 'budget', 'financing'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.quotes || !snapshot.budget || !snapshot.financing) return false;
      const hasAcceptedQuote = snapshot.quotes.items.some((q: QuoteSnapshotItem) => q.accepted);
      const contingencyBelowBand = snapshot.budget.contingency < snapshot.budget.contingencyComfortBand;
      const hasUnresolvedFinancing = snapshot.financing.hasUnresolvedDependency;
      return hasAcceptedQuote && contingencyBelowBand && hasUnresolvedFinancing;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Recent commitments combine with limited buffers and unresolved funding.',
      whyItMatters: 'Multiple risk factors are present simultaneously.',
      paths: [
        { frame: 'quotes', context: 'accepted' },
        { frame: 'budget', context: 'contingency' },
        { frame: 'financing', context: 'dependencies' },
      ],
    }),
    decayCondition: 'Any one factor resolved',
  },

  {
    id: 'P-05',
    name: 'Invoice Absence Blind Spot',
    class: 'blind-spot',
    frames: ['execution', 'invoices'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.execution || !snapshot.invoices) return false;
      const PROGRESS_THRESHOLD = 0.25;
      const hasSignificantProgress = snapshot.execution.progressRatio > PROGRESS_THRESHOLD;
      const hasNoInvoices = snapshot.invoices.items.length === 0;
      return hasSignificantProgress && hasNoInvoices;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Work has advanced without corresponding financial reality recorded yet.',
      whyItMatters: 'Execution progress is not yet reflected in invoices.',
      paths: [
        { frame: 'execution', context: 'progress' },
        { frame: 'invoices', context: 'presence' },
      ],
    }),
    decayCondition: 'Invoice appears or execution regresses',
  },

  {
    id: 'P-06',
    name: 'Long-Running Ambiguity',
    class: 'drift',
    frames: ['scope', 'budget', 'quotes'],
    trigger: (snapshot: CFISnapshot): boolean => {
      if (!snapshot.scope || !snapshot.project) return false;
      const AMBIGUITY_THRESHOLD_DAYS = 30;
      const thresholdMs = AMBIGUITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
      const now = new Date(snapshot.project.evaluatedAt).getTime();
      const ambiguousItems = snapshot.scope.items.filter((item: ScopeSnapshotItem) => {
        const age = now - new Date(item.createdAt).getTime();
        const hasBudget = snapshot.budget?.allocations.some(
          (a: BudgetAllocation) => a.scopeItemId === item.id
        );
        const hasQuote = snapshot.quotes?.items.some(
          (q: QuoteSnapshotItem) => q.scopeItemId === item.id
        );
        return age > thresholdMs && !hasBudget && !hasQuote;
      });
      return ambiguousItems.length > 0;
    },
    emit: (_snapshot: CFISnapshot): Omit<CFISignal, 'patternId' | 'class'> => ({
      observation: 'Some intended work has remained undefined for an extended period.',
      whyItMatters: 'Long-standing scope items lack budget or quote coverage.',
      paths: [
        { frame: 'scope', context: 'undefined items' },
        { frame: 'budget', context: 'allocations' },
        { frame: 'quotes', context: 'coverage' },
      ],
    }),
    decayCondition: 'Budget or quote attached',
  },
] as const;
