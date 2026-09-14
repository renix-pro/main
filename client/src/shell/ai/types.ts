/**
 * RENIX vNext — AI Conversation Types
 * 
 * Shared types for AI conversation components.
 */

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
  uploadToken?: string;
  objectPath?: string;
}

export type AttentionState = 
  | 'pending_decision'
  | 'missing_information'
  | 'dependency_blocked'
  | 'review_recommended'
  | 'no_attention';

export interface AssistOption {
  label: string;
  action: 'send_message' | 'navigate' | 'dismiss' | 'confirm_quote' | 'confirm_quote_version' | 'confirm_invoice' | 'cancel_ingestion' | 'retry_extraction';
  payload?: string;
  quoteData?: {
    documentId: string;
    scopeId: string;
    scopeName?: string;
    objectPath?: string;
    forceReplace?: boolean;
    existingQuoteCandidates?: Array<{
      id: string;
      reference: string;
      vendorName: string | null;
      total: number | null;
      versionNumber: number;
      commitmentStatus: string | null;
    }>;
  };
  quoteVersionData?: {
    documentId: string;
    existingQuoteId: string;
    scopeId?: string;
    objectPath?: string;
  };
  invoiceData?: {
    documentId: string;
    objectPath?: string;
    scopeId?: string;
    scopeName?: string;
    forceReplace?: boolean;
    extractedData?: any;
  };
  ingestionData?: {
    documentId: string;
  };
  retryData?: {
    documentId: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  responseType?: string;
  thinking?: string;
  suggestedActions?: string[];
  affectedFrames?: string[];
  hasProposal?: boolean;
  assistOptions?: AssistOption[];
  attentionState?: AttentionState;
  attentionDetail?: { what: string; where: string };
  sessionOrientation?: string;
  attachment?: AttachedFile;
  ingestionSuccess?: {
    type: 'quote' | 'invoice' | 'quote_version';
    vendorName: string | null;
    scopeName: string | null;
    total: number | null;
    currency?: string;
    fileName?: string;
    reference?: string | null;
    versionNumber?: number;
    quoteId?: string;
    quoteVersionId?: string;
    scopeId?: string;
  };
  classificationData?: {
    documentType: string;
    confidence: string;
    coverageSummary?: string;
    fileName?: string;
    vendorName?: string | null;
    date?: string | null;
    reference?: string | null;
    lineItemCount?: number;
    currency?: string;
    financials?: {
      netTotal: number | null;
      taxAmount: number | null;
      grossTotal: number | null;
    };
    recommendedTags?: string[];
  };
  preConfirmData?: {
    type: 'quote' | 'invoice';
    fileName?: string;
    scopeName: string;
    vendorName?: string | null;
    total?: number | null;
    currency?: string;
  };
  confidence?: 'high' | 'medium' | 'low';
  structuredData?: StructuredCardData;
}

export type StructuredCardData =
  | FinancialSummaryCardData
  | ScopeAnalysisCardData
  | ComparisonCardData
  | ActionRecommendationCardData;

export interface FinancialSummaryCardData {
  cardType: 'financial_summary';
  title?: string;
  rows: Array<{ label: string; value: number | string; highlight?: boolean }>;
  currency?: string;
  progressPercent?: number;
}

export interface ScopeAnalysisCardData {
  cardType: 'scope_analysis';
  totalItems: number;
  quotedItems: number;
  gaps?: string[];
}

export interface ComparisonCardData {
  cardType: 'comparison';
  title?: string;
  items: Array<{ label: string; optionA: string; optionB: string; winner?: 'a' | 'b' | 'neutral' }>;
}

export interface ActionRecommendationCardData {
  cardType: 'action_recommendation';
  headline: string;
  reason: string;
  actionLabel?: string;
  actionPayload?: string;
  targetFrame?: string;
}

export interface UINavigationIntent {
  type: 'navigate';
  targetFrame: string;
  reason: 'user_request' | 'proposal_created' | 'analysis_complete';
}

export interface AIResponse {
  type: 'explain' | 'explore' | 'propose' | 'needs_evidence' | 'acknowledge';
  content: string;
  thinking?: string;
  proposals?: any[];
  suggested_actions?: string[];
  mode?: 'PROJECT_DISCOVERY' | 'PROJECT_VALIDATION' | 'PROJECT_PLANNING';
  pendingProjectProposal?: any;
  uiIntent?: UINavigationIntent;
  attention_state?: AttentionState;
  attention_detail?: {
    what: string;
    where: string;
  };
  assist_options?: AssistOption[];
  session_orientation?: string;
  confidence_level?: 'high' | 'medium' | 'low';
  structured_data?: StructuredCardData;
  attachment?: {
    documentId: string;
    objectPath?: string;
    classification?: {
      documentType: string;
      confidence: string;
      coverageSummary?: string;
    };
    requiresScopeSelection?: boolean;
    autoConfirmed?: boolean;
  };
}

export interface ProjectProposal {
  id: string;
  targetFrame: string;
  proposedDiff: {
    before: any;
    after: {
      name: string;
      project_type?: string;
      description?: string;
      location?: { city?: string; country?: string };
      currency?: string;
    };
  };
  rationale: string;
  status: string;
}

export interface ProjectState {
  scopeCount: number;
  hasBudget: boolean;
  budgetTotal: number;
  quoteCount: number;
  hasAllocations: boolean;
  isNewProject: boolean;
}

export interface PendingQuoteContext {
  documentId: string;
  /** Optional: unknown when retrying extraction from a message action. */
  objectPath?: string;
  fileName?: string;
  classification?: any;
  extractedData?: {
    vendorName: string | null;
    quoteDate: string | null;
    financials: {
      netTotal: number | null;
      taxAmount: number | null;
      grossTotal: number | null;
    };
  };
}

export const FRAME_NAMES = ['Overview', 'Vision', 'Scope', 'Budget', 'Quotes', 'Financing', 'Execution', 'Invoices', 'Documents'];

export const DISCOVERY_WELCOME: Message = {
  id: 'welcome',
  role: 'system',
  content: 'Hello! I\'m here to help you start a new renovation project. Tell me about your project - what are you planning to renovate? Where is it located? What\'s your vision?',
  timestamp: new Date(),
};

export const PROJECT_WELCOME: Message = {
  id: 'welcome',
  role: 'system',
  content: 'Welcome to RENIX AI. I can help you understand your project, analyze data, and propose changes. All proposals require your explicit approval.',
  timestamp: new Date(),
};
