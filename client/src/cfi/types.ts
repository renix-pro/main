/**
 * RENIX vNext — Cross-Frame Intelligence Types
 * 
 * Canon v1.4 Compliant — Phase 7
 * 
 * Signal output contract and snapshot types for CFI.
 */

export type PatternClass = 'tension' | 'drift' | 'risk-accumulation' | 'blind-spot';

export type FrameName = 
  | 'overview'
  | 'vision'
  | 'scope'
  | 'budget'
  | 'quotes'
  | 'invoices'
  | 'financing'
  | 'execution'
  | 'documents';

export interface CFISignalPath {
  frame: FrameName;
  context: string;
}

export interface CFIInspectable {
  framesRead: FrameName[];
  triggerFacts: string[];
  evaluatedAt: string;
}

export interface CFISignal {
  patternId: string;
  class: PatternClass;
  observation: string;
  whyItMatters: string;
  paths: CFISignalPath[];
  inspectable: CFIInspectable;
}

export interface CFIPattern {
  id: string;
  name: string;
  class: PatternClass;
  frames: FrameName[];
  trigger: (snapshot: CFISnapshot) => boolean;
  emit: (snapshot: CFISnapshot) => Omit<CFISignal, 'patternId' | 'class'>;
  decayCondition: string;
}

export interface ScopeSnapshotItem {
  id: string;
  createdAt: string;
  optional: boolean;
}

export interface ScopeSnapshot {
  items: ScopeSnapshotItem[];
  lastModified: string;
}

export interface BudgetAllocation {
  scopeItemId: string;
  amount: number;
}

export interface BudgetSnapshot {
  totalIntent: number;
  contingency: number;
  contingencyComfortBand: number;
  allocations: BudgetAllocation[];
  lastModified: string;
}

export interface QuoteSnapshotItem {
  id: string;
  scopeItemId?: string;
  accepted: boolean;
  total?: { currency: string; value: number };
}

export interface QuotesSnapshot {
  items: QuoteSnapshotItem[];
}

export interface InvoiceSnapshotItem {
  id: string;
  total?: { currency: string; value: number };
}

export interface InvoicesSnapshot {
  items: InvoiceSnapshotItem[];
}

export interface FinancingSnapshot {
  totalCoverage: number;
  hasUnresolvedDependency: boolean;
}

export interface ExecutionSnapshotItem {
  id: string;
  workItemId: string;
  status: 'pending' | 'active' | 'paused' | 'completed';
}

export interface ExecutionSnapshot {
  items: ExecutionSnapshotItem[];
  progressRatio: number;
}

export interface ProjectSnapshot {
  id: string;
  status: 'open' | 'closed';
  lastActivity: string;
  evaluatedAt: string;
}

export interface CFISnapshot {
  project: ProjectSnapshot;
  scope?: ScopeSnapshot;
  budget?: BudgetSnapshot;
  quotes?: QuotesSnapshot;
  invoices?: InvoicesSnapshot;
  financing?: FinancingSnapshot;
  execution?: ExecutionSnapshot;
}
