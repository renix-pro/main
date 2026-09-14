/**
 * RENIX vNext — Proposal System Types
 * 
 * AI-First Pivot Step 3: Proposal Layer
 * All mutations can be intercepted and converted to proposals
 * that require explicit user approval before execution.
 */

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type ProposalCategory = 
  | 'project'
  | 'scope'
  | 'budget'
  | 'quotes'
  | 'invoices'
  | 'financing'
  | 'execution'
  | 'documents'
  | 'vision';

export type ProposalAction = 'create' | 'update' | 'delete';

export interface Proposal<T = unknown> {
  id: string;
  category: ProposalCategory;
  action: ProposalAction;
  entityType: string;
  entityId?: string;
  title: string;
  description: string;
  payload: T;
  status: ProposalStatus;
  createdAt: Date;
  expiresAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ProposalQueueState {
  proposals: Proposal[];
  pendingCount: number;
  isProcessing: boolean;
}

export interface ProposalContextValue {
  state: ProposalQueueState;
  addProposal: <T>(proposal: Omit<Proposal<T>, 'id' | 'status' | 'createdAt'>) => string;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string, reason?: string) => void;
  clearExpired: () => void;
  pruneOldProposals: (maxAgeMs?: number) => void;
  isProposalModeActive: boolean;
  setProposalModeActive: (active: boolean) => void;
}

export interface MutationProposalConfig<TVariables, TData = unknown> {
  category: ProposalCategory;
  entityType: string;
  getEntityId?: (variables: TVariables) => string | undefined;
  getTitle: (variables: TVariables) => string;
  getDescription: (variables: TVariables) => string;
  action: ProposalAction;
  onApproved?: (data: TData) => void;
}
