/**
 * RENIX vNext — Shared Constants
 * 
 * Centralized taxonomy and status values used across server and client.
 * This ensures consistency and provides a single source of truth.
 */

// ============================================================================
// FINANCING STATUS
// ============================================================================

/**
 * Database stores Pascal case: 'Planned' | 'Confirmed'
 * Client displays lowercase: 'planned' | 'confirmed'
 */
export const FinancingStatusDB = {
  PLANNED: 'Planned',
  CONFIRMED: 'Confirmed',
} as const;

export const FinancingStatusClient = {
  PLANNED: 'planned',
  CONFIRMED: 'confirmed',
} as const;

export type FinancingStatusDBType = typeof FinancingStatusDB[keyof typeof FinancingStatusDB];
export type FinancingStatusClientType = typeof FinancingStatusClient[keyof typeof FinancingStatusClient];

export function toDBFinancingStatus(status: string): FinancingStatusDBType {
  const normalized = status.toLowerCase();
  if (normalized === 'planned') return FinancingStatusDB.PLANNED;
  if (normalized === 'confirmed') return FinancingStatusDB.CONFIRMED;
  return FinancingStatusDB.PLANNED; // default
}

export function toClientFinancingStatus(status: string): FinancingStatusClientType {
  const normalized = status.toLowerCase();
  if (normalized === 'planned') return FinancingStatusClient.PLANNED;
  if (normalized === 'confirmed') return FinancingStatusClient.CONFIRMED;
  return FinancingStatusClient.PLANNED; // default
}

export function isConfirmedStatus(status: string): boolean {
  return status === FinancingStatusDB.CONFIRMED || status === FinancingStatusClient.CONFIRMED;
}

export function isPlannedStatus(status: string): boolean {
  return status === FinancingStatusDB.PLANNED || status === FinancingStatusClient.PLANNED;
}

// ============================================================================
// QUOTE STATUS
// ============================================================================

export const QuoteStatus = {
  NEW: 'new',
  DRAFT: 'draft',
  COMMITTED: 'committed',
  ACCEPTED: 'accepted',
} as const;

export type QuoteStatusType = typeof QuoteStatus[keyof typeof QuoteStatus];

export function isQuoteEditable(status: string): boolean {
  return status === QuoteStatus.NEW || status === QuoteStatus.DRAFT;
}

export function isQuoteCommitted(status: string): boolean {
  return status === QuoteStatus.COMMITTED || status === QuoteStatus.ACCEPTED;
}

// ============================================================================
// INVOICE STATUS
// ============================================================================

export const InvoiceStatus = {
  DRAFT: 'draft',
  FINALIZED: 'finalized',
  PAID: 'paid',
} as const;

export type InvoiceStatusType = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export function isInvoiceEditable(status: string): boolean {
  return status === InvoiceStatus.DRAFT;
}

// ============================================================================
// PROPOSAL STATUS
// ============================================================================

export const ProposalStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export type ProposalStatusType = typeof ProposalStatus[keyof typeof ProposalStatus];

// ============================================================================
// PROJECT STATUS (Legacy - retained for backward compatibility)
// ============================================================================

export const ProjectStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];

export function isProjectReadOnly(status: string): boolean {
  return status === ProjectStatus.CLOSED;
}

// ============================================================================
// PROJECT LIFECYCLE STATE (Phase 3.5 - Global Lifecycle Semantics)
// ============================================================================
// 
// CANONICAL LIFECYCLE MODEL - Exactly THREE states:
// 
// 1. ACTIVE (default)
//    - Normal operation
//    - Reads and writes allowed
//    - AI proposals allowed
// 
// 2. CLOSED
//    - Project intent is finalized
//    - Read-only across all domain entities
//    - AI restricted to: explain, explore, acknowledge
//    - NO proposals or execution diffs allowed
// 
// 3. DELETED (terminal, soft-delete)
//    - Project is hidden from normal queries
//    - No AI access
//    - Data retained for safety
//    - Irreversible via normal application flows
// 
// ============================================================================

export const LifecycleState = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  DELETED: 'deleted',
} as const;

export type LifecycleStateType = typeof LifecycleState[keyof typeof LifecycleState];

/**
 * TRANSITION RULES (Explicit & Minimal)
 * 
 * Only these transitions are allowed:
 * - active → closed
 * - closed → deleted
 * 
 * All other transitions MUST fail loudly.
 */
export const ALLOWED_TRANSITIONS: Record<LifecycleStateType, LifecycleStateType[]> = {
  [LifecycleState.ACTIVE]: [LifecycleState.CLOSED],
  [LifecycleState.CLOSED]: [LifecycleState.DELETED],
  [LifecycleState.DELETED]: [], // Terminal state - no transitions allowed
};

/**
 * Validates if a lifecycle state transition is allowed.
 * Returns true only for: active→closed, closed→deleted
 */
export function isValidLifecycleTransition(from: LifecycleStateType, to: LifecycleStateType): boolean {
  const allowedTargets = ALLOWED_TRANSITIONS[from];
  return allowedTargets?.includes(to) ?? false;
}

/**
 * Checks if a project allows writes based on lifecycle state.
 * Only ACTIVE projects allow writes.
 */
export function isLifecycleWriteAllowed(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState === LifecycleState.ACTIVE;
}

/**
 * Checks if a project allows reads based on lifecycle state.
 * ACTIVE and CLOSED allow reads. DELETED blocks all access.
 */
export function isLifecycleReadAllowed(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState === LifecycleState.ACTIVE || lifecycleState === LifecycleState.CLOSED;
}

/**
 * Checks if AI proposals are allowed based on lifecycle state.
 * Only ACTIVE projects allow AI proposals.
 */
export function isAIProposalAllowed(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState === LifecycleState.ACTIVE;
}

/**
 * Checks if AI access is allowed at all based on lifecycle state.
 * DELETED projects block all AI access.
 */
export function isAIAccessAllowed(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState !== LifecycleState.DELETED;
}

// ============================================================================
// DOCUMENT STATES
// ============================================================================

export const DocumentState = {
  STORED: 'STORED',
  CLASSIFIED: 'CLASSIFIED',
  TAGGED: 'TAGGED',
  INGESTED: 'INGESTED',
} as const;

export type DocumentStateType = typeof DocumentState[keyof typeof DocumentState];

// ============================================================================
// FRAME NAMES (Canonical)
// ============================================================================

export const FrameName = {
  OVERVIEW: 'overview',
  VISION: 'vision',
  SCOPE: 'scope',
  BUDGET: 'budget',
  QUOTES: 'quotes',
  INVOICES: 'invoices',
  FINANCING: 'financing',
  EXECUTION: 'execution',
  DOCUMENTS: 'documents',
  INSIGHTS: 'insights',
} as const;

export type FrameNameType = typeof FrameName[keyof typeof FrameName];

export const FRAME_LIST: FrameNameType[] = [
  FrameName.OVERVIEW,
  FrameName.VISION,
  FrameName.SCOPE,
  FrameName.BUDGET,
  FrameName.QUOTES,
  FrameName.INVOICES,
  FrameName.FINANCING,
  FrameName.EXECUTION,
  FrameName.DOCUMENTS,
  FrameName.INSIGHTS,
];

// ============================================================================
// FINANCING SOURCE TYPES
// ============================================================================

export const FinancingSourceType = {
  SAVINGS: 'savings',
  LOAN: 'loan',
  LINE_OF_CREDIT: 'line_of_credit',
  GIFT: 'gift',
  EQUITY: 'equity',
  OTHER: 'other',
} as const;

export type FinancingSourceTypeValue = typeof FinancingSourceType[keyof typeof FinancingSourceType];
