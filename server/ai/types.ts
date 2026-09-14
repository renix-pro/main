/**
 * RENIX vNext — AI Service Types
 * 
 * Shared type definitions for the AI service modules.
 * These types define the contracts for the three-layer AI memory model.
 */

export type AIResponseType = 'explain' | 'explore' | 'propose' | 'needs_evidence' | 'acknowledge';

export type AIMode = 'PROJECT_DISCOVERY' | 'PROJECT_VALIDATION' | 'PROJECT_PLANNING';

export type AttentionState = 
  | 'pending_decision'
  | 'missing_information'
  | 'dependency_blocked'
  | 'review_recommended'
  | 'no_attention';

export interface AttentionDetail {
  what: string;
  where: string;
}

export interface AssistOption {
  label: string;
  action: 'send_message' | 'navigate' | 'dismiss' | 'confirm_quote' | 'confirm_quote_version' | 'confirm_invoice' | 'cancel_ingestion';
  payload?: string;
  quoteData?: {
    documentId: string;
    scopeId: string;
    scopeName?: string;
    objectPath?: string;
    existingQuoteCandidates?: Array<{
      id: string;
      reference: string;
      vendorName: string | null;
      total: number | null;
      versionNumber: number;
      commitmentStatus: string;
    }>;
  };
  quoteVersionData?: {
    documentId: string;
    existingQuoteId: string;
    objectPath?: string;
  };
  invoiceData?: {
    documentId: string;
    objectPath?: string;
  };
  ingestionData?: {
    documentId: string;
  };
}

export interface SessionContext {
  lastProjectId?: string;
  lastFrame?: string;
  pendingProposalCount: number;
  unresolvedAttention?: AttentionState;
  lastInteractionAt?: Date;
}

export interface AIProposal {
  proposal_id: string;
  author: 'AI';
  model: string;
  created_at: string;
  target_frame: string;
  target_entities: string[];
  proposed_diff: {
    before: any;
    after: any;
  };
  rationale: string;
  assumptions: string[];
  downstream_impacts: string[] | { budget_delta?: number | null; schedule_delta_days?: number | null; financing_exposure?: number | null };
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending';
  provenance: {
    request_id: string;
    user_message: string;
    context_snapshot: string;
  };
}

export interface UINavigationIntent {
  type: 'navigate';
  targetFrame: string;
  reason: 'user_request' | 'proposal_created' | 'analysis_complete';
}

export interface AIResponse {
  type: AIResponseType;
  content: string;
  thinking?: string;
  proposals?: AIProposal[];
  suggested_actions?: string[];
  uiIntent?: UINavigationIntent;
  attention_state?: AttentionState;
  attention_detail?: {
    what: string;
    where: string;
  };
  assist_options?: AssistOption[];
  session_orientation?: string;
  confidence_level?: 'high' | 'medium' | 'low';
  structured_data?: Record<string, any>;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  response_type?: AIResponseType;
  proposals?: AIProposal[];
}

export interface ProjectContext {
  projectId: string | null;
  userId?: string;
  projectName: string;
  projectDescription?: string;
  projectType?: string;
  projectStatus: string;
  activeFrame?: string;
  scopes?: any[];
  budgetIntent?: number;
  contingencyMode?: string;
  contingencyValue?: number;
  budgetAllocations?: { label: string; amount: number; target: string }[];
  financingSources?: { name: string; type: string; amount: number; status: string; monthlyLiability: number | null }[];
  totalConfirmedFinancing?: number;
  totalMonthlyLiabilities?: number;
  fundingGap?: number;
  currency?: string;
  recentActivity?: string[];
  mode: AIMode;
  pendingProjectProposal?: AIProposal | null;
  pendingProposals?: any[];
  isSessionResume?: boolean;
  lastSessionFrame?: string;
  blockedDependencies?: {
    entity: string;
    blockedBy: string;
    frame: string;
  }[];
  isAutoUpload?: boolean;
  requiresAcknowledgement?: boolean;
  attachment?: any;
}

/**
 * Loading mode for frame-aware selective loading.
 * - 'full': All fields, all details
 * - 'summary': Key counts and totals only (no detailed items/nodes)
 * - 'counts': Just count fields
 */
export type LoadingMode = 'full' | 'summary' | 'counts';

/**
 * Constraint set for bounding AI context and frame aggregations.
 * Derived from retrieval output. When arrays are provided and non-empty,
 * only those entities are loaded/aggregated. Undefined/empty = no constraint (full load).
 */
export interface ConstraintSet {
  projectId: string;
  scopeNodeIds?: string[];
  quoteIds?: string[];
  quoteFinancialIds?: string[];
  financingSourceIds?: string[];
  documentIds?: string[];
  budgetAllocationIds?: string[];
  invoiceIds?: string[];
  vendorIds?: string[];
}

export interface AuthoritativeState {
  project: {
    id: string;
    name: string;
    description: string;
    type?: string;
    status: string;
    lifecycleState: 'active' | 'closed' | 'deleted';
    currency: string;
    createdAt: string;
  } | null;
  activeFrame: string;
  scope: {
    nodes: Array<{
      id: string;
      name: string;
      parentId: string | null;
      hasChildren: boolean;
      isArchived: boolean;
      costType?: string;
    }>;
    totalCount: number;
    archivedCount: number;
    loadingMode?: LoadingMode;
  };
  budget: {
    intent: number | null;
    contingencyMode: string;
    contingencyValue: number;
    allocations: Array<{
      id: string;
      label: string;
      amount: number;
      target: unknown;
    }>;
    totalAllocated: number;
    variance: number;
    loadingMode?: LoadingMode;
  };
  quotes: {
    count: number;
    pendingCount: number;
    acceptedCount: number;
    items: Array<{
      id: string;
      reference: string;
      status: string;
      scopeId: string | null;
      scopeName: string | null;
      vendorName: string | null;
      grandTotal: number | null;
      subtotal: number | null;
      totalTax: number | null;
      quoteDate: string | null;
      lineItemCount: number;
      topLineItems: Array<{
        description: string;
        totalPrice: number | null;
      }>;
    }>;
    byScope: Array<{
      scopeId: string;
      scopeName: string;
      quoteCount: number;
      totalGross: number;
      totalNet: number;
    }>;
    loadingMode?: LoadingMode;
  };
  financing: {
    sources: Array<{
      id: string;
      name: string;
      type: string;
      amount: number;
      status: string;
      monthlyLiability: number | null;
    }>;
    totalConfirmed: number;
    totalPlanned: number;
    totalMonthlyLiabilities: number;
    coverageGap: number;
    loadingMode?: LoadingMode;
  };
  expectedCost: {
    totalExpectedCost: number;
    quoteBacked: number;
    budgetBacked: number;
    directCostBacked: number;
    coverageDelta: number;
    hasFinancingGap: boolean;
    gapSeverity: 'none' | 'warning' | 'critical';
    loadingMode?: LoadingMode;
  };
  invoices: {
    count: number;
    paidCount: number;
    pendingAmount: number;
    totalPaid: number;
    loadingMode?: LoadingMode;
  };
  documents: {
    count: number;
    recentUploads: Array<{
      id: string;
      name: string;
      type: string;
      uploadedAt: string;
      summary: string | null;
      extractedTextPreview: string | null;
      linkedQuote: {
        id: string;
        reference: string;
        scopeName: string | null;
      } | null;
    }>;
    intelligence: {
      claimsCount: number;
      highConfidenceFacts: Array<{
        content: string;
        confidence: number;
        documentName: string;
      }>;
      scopeLinks: Array<{
        documentName: string;
        scopeName: string;
        relationship: string;
        confidence: number;
      }>;
      amounts: Array<{
        amount: string;
        context: string;
        documentName: string;
        confidence: number;
      }>;
      dates: Array<{
        date: string;
        context: string;
        documentName: string;
        confidence: number;
      }>;
    };
    loadingMode?: LoadingMode;
  };
  execution: {
    totalCount: number;
    counts: { to_do: number; in_progress: number; done: number };
    overdueCount: number;
    notStartedCount: number;
    tasks: Array<{
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
    }>;
    loadingMode?: LoadingMode;
  };
  pendingProposals: Array<{
    id: string;
    targetFrame: string;
    rationale: string;
    createdAt: string;
  }>;
  resolvedProposals: Array<{
    id: string;
    status: string;
    targetFrame: string;
    rationale: string;
    resolvedAt: string;
  }>;
}

export interface CanonicalMemoryEntry {
  id: string;
  type: string;
  summary: string;
  relatedFrames: string[];
  createdAt: Date;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIContext {
  authoritative_state: AuthoritativeState;
  canonical_memory: CanonicalMemoryEntry[];
  conversation_context: ConversationTurn[];
  dropped_conversation_summary: string | null;
  attention_state: AttentionState;
  attention_detail?: AttentionDetail;
}

export interface AICallLog {
  request_id: string;
  timestamp: Date;
  model: string;
  temperature: number;
  prompt_snapshot: string;
  context_snapshot: string;
  response_type?: AIResponseType;
  duration_ms?: number;
  error?: string;
}

/**
 * Phase 6C: Guided Reasoning Companion Types
 * Enables AI to guide user reasoning without execution.
 */

export type ReasoningPathType = 
  | 'financial_analysis'
  | 'scope_evaluation'
  | 'coverage_assessment'
  | 'risk_exploration'
  | 'quote_comparison'
  | 'budget_alignment'
  | 'timeline_consideration';

export interface ReasoningStep {
  step: number;
  description: string;
  canonicalSources: string[];
  conditionalLanguage: string;
  dataRequired: string[];
}

export interface ReasoningPath {
  type: ReasoningPathType;
  title: string;
  steps: ReasoningStep[];
  constraintsApplied: string[];
  groundedIn: string[];
}

export type ClarifyingQuestionCategory =
  | 'missing_data'
  | 'ambiguous_intent'
  | 'unresolved_tension'
  | 'scope_clarification'
  | 'priority_determination';

export interface ClarifyingQuestion {
  category: ClarifyingQuestionCategory;
  question: string;
  context: string;
  expectedAnswerType: 'yes_no' | 'choice' | 'value' | 'explanation';
  relatedEntities: string[];
}

export type ScenarioType =
  | 'constrained_view'
  | 'unconstrained_view'
  | 'scope_focused'
  | 'vendor_focused'
  | 'timeline_focused';

export interface ScenarioFrame {
  type: ScenarioType;
  title: string;
  description: string;
  dataView: string;
  constraints: string[];
  excludes: string[];
}

export interface ProposalReadiness {
  isReady: boolean;
  targetFrame: string | null;
  rationale: string;
  missingElements: string[];
  awaitingConfirmation: boolean;
}

export interface GuidedReasoningContext {
  reasoningPaths: ReasoningPath[];
  clarifyingQuestions: ClarifyingQuestion[];
  scenarioFrames: ScenarioFrame[];
  proposalReadiness: ProposalReadiness | null;
  constraintsAcknowledged: string[];
}
