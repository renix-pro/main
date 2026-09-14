/**
 * RENIX vNext — AI Service Orchestration Module
 * 
 * Main entry point for the AI service.
 * Orchestrates the three-layer AI memory model:
 *   Layer 1: Authoritative State (rebuilt from DB each turn)
 *   Layer 2: Canonical Memory (append-only decision log)
 *   Layer 3: Conversational Context (last 6-10 turns)
 * 
 * Phase 5B.2: Hybrid Retrieval Integration
 *   - Structured retrieval is default (deterministic entity lookup)
 *   - Semantic retrieval only for documents when needed
 *   - All retrieval decisions are logged for auditability
 * 
 * Phase 5C: AI Observability & Safety Guardrails
 *   - Structured JSON logging with requestId correlation
 *   - Token budget enforcement with Tier 3 reduction
 *   - Failure mode logging for diagnosability
 */

import type { AIContext, ConversationTurn, ConstraintSet } from './types';
import { assembleAuthoritativeState, serializeContextForAI as serializeContext } from './contextAssembly';
import { loadCanonicalMemory, writeCanonicalMemory } from './canonicalMemory';
import { getRecentConversation } from './conversationContext';
import { resolveAttentionState, generateAssistOptions } from './attention';
import { 
  performHybridRetrieval,
  buildConstraintSetFromRetrieval,
  type RetrievalDecision,
  type RetrievedContext
} from './retrieval';
import {
  createRequestContext,
  logRetrievalTrace,
  logConstraintTrace,
  logContextAssemblyComplete,
  logFailureMode,
  logTokenBudget,
  enforceTokenBudget,
  type RequestContext,
} from './observability';
import { serializeContextForAIWithAudit } from './contextAssembly';

export { serializeContext as serializeContextForAI };

export interface BuildAIContextOptions {
  userMessage?: string;
  enableRetrievalLogging?: boolean;
  enableObservability?: boolean;
}

export interface AIContextWithRetrieval extends AIContext {
  retrieval_decision?: RetrievalDecision;
  retrieved_context?: RetrievedContext;
  observability?: {
    requestId: string;
    constraintSet?: ConstraintSet;
    tokenBudget?: {
      originalTokens: number;
      reducedTokens: number;
      turnsRemoved: number;
      tier1Preserved: boolean;
    };
  };
}

export async function buildAIContext(
  projectId: string | null,
  userId: string,
  sessionId: string,
  activeFrame: string = 'Overview',
  conversationHistory: ConversationTurn[] = [],
  options: BuildAIContextOptions = {}
): Promise<AIContextWithRetrieval> {
  const { recentTurns, droppedSummary } = getRecentConversation(conversationHistory);
  const enableObservability = options.enableObservability !== false;
  
  // Phase 5C: Create request context for correlation
  const requestCtx = enableObservability 
    ? createRequestContext(projectId, userId, sessionId)
    : null;

  if (!projectId) {
    return {
      authoritative_state: {
        project: null,
        activeFrame,
        scope: { nodes: [], totalCount: 0, archivedCount: 0, loadingMode: 'counts' },
        budget: { intent: null, contingencyMode: 'fixed', contingencyValue: 0, allocations: [], totalAllocated: 0, variance: 0, loadingMode: 'counts' },
        quotes: { count: 0, pendingCount: 0, acceptedCount: 0, items: [], byScope: [], loadingMode: 'counts' },
        financing: { sources: [], totalConfirmed: 0, totalPlanned: 0, totalMonthlyLiabilities: 0, coverageGap: 0, loadingMode: 'counts' },
        expectedCost: { totalExpectedCost: 0, quoteBacked: 0, budgetBacked: 0, directCostBacked: 0, coverageDelta: 0, hasFinancingGap: false, gapSeverity: 'none', loadingMode: 'counts' },
        execution: { tasks: [], totalCount: 0, counts: { to_do: 0, in_progress: 0, done: 0 }, overdueCount: 0, notStartedCount: 0, loadingMode: 'counts' },
        invoices: { count: 0, paidCount: 0, pendingAmount: 0, totalPaid: 0, loadingMode: 'counts' },
        documents: { count: 0, recentUploads: [], intelligence: { claimsCount: 0, highConfidenceFacts: [], scopeLinks: [], amounts: [], dates: [] }, loadingMode: 'counts' },
        pendingProposals: [],
        resolvedProposals: [],
      },
      canonical_memory: [],
      conversation_context: recentTurns,
      dropped_conversation_summary: droppedSummary,
      attention_state: 'no_attention',
      observability: requestCtx ? { requestId: requestCtx.requestId } : undefined,
    };
  }

  let retrieval_decision: RetrievalDecision | undefined;
  let retrieved_context: RetrievedContext | undefined;
  
  if (options.userMessage) {
    try {
      retrieved_context = await performHybridRetrieval(
        projectId,
        userId,
        options.userMessage,
        recentTurns,
        activeFrame,
        {
          scope: 'full',
          quotes: 'full',
          documents: 'summary',
          budget: 'full',
          vendors: 'summary'
        }
      );
      retrieval_decision = retrieved_context.decision;
      
      // Phase 5C: Log retrieval decision trace
      if (requestCtx && retrieval_decision) {
        logRetrievalTrace(requestCtx, {
          strategy: retrieval_decision.strategy,
          reason: retrieval_decision.reason,
          entityReferences: retrieval_decision.entityReferences,
          relevantScopeIds: retrieved_context.relevantScopeIds,
          relevantQuoteIds: retrieved_context.relevantQuoteIds,
          relevantDocumentIds: retrieved_context.relevantDocumentIds,
          relevantBudgetAllocationIds: retrieved_context.relevantBudgetAllocationIds,
          relevantQuoteFinancialIds: retrieved_context.relevantQuoteFinancialIds,
          relevantVendorIds: retrieved_context.relevantVendorIds,
        });
      }
    } catch (error) {
      // Phase 5C: Log retrieval failure
      if (requestCtx) {
        logFailureMode(requestCtx, 'retrieval_timeout', {
          whatSkipped: 'Hybrid retrieval',
          why: error instanceof Error ? error.message : 'Unknown retrieval error',
          whatPreserved: 'Authoritative state will be assembled with full load (no constraints)',
          errorMessage: error instanceof Error ? error.message : undefined,
        });
      }
      // Continue without retrieval - fall back to unconstrained loading
    }
  }

  // Build constraint set from retrieval results (Phase 5B.3)
  // When constraints exist, only load/aggregate constrained entities
  const constraintSet = buildConstraintSetFromRetrieval(projectId, retrieved_context);
  
  // Phase 5C: Log constraint application
  if (requestCtx) {
    logConstraintTrace(requestCtx, constraintSet);
  }
  
  let authoritative_state;
  try {
    authoritative_state = await assembleAuthoritativeState(
      projectId, 
      userId, 
      activeFrame, 
      undefined, // loadingModes - use defaults
      constraintSet
    );
  } catch (error) {
    // Phase 5C: Log partial assembly failure
    if (requestCtx) {
      logFailureMode(requestCtx, 'partial_assembly', {
        whatSkipped: 'Authoritative state assembly failed',
        why: error instanceof Error ? error.message : 'Unknown error during context assembly',
        whatPreserved: 'Fallback to minimal context with empty authoritative state',
        errorMessage: error instanceof Error ? error.message : undefined,
      });
    }
    // Re-throw to prevent proceeding with invalid state
    throw error;
  }
  
  // Phase 5C: Check for partial assembly issues (missing expected data)
  if (requestCtx && authoritative_state.project && authoritative_state.scope.totalCount === 0 && 
      authoritative_state.quotes.count === 0 && authoritative_state.budget.totalAllocated === 0) {
    // Log a warning if project exists but all domain data is empty - may indicate partial assembly
    logFailureMode(requestCtx, 'partial_assembly', {
      whatSkipped: 'Domain data appears incomplete',
      why: 'Project exists but scope, quotes, and budget are all empty - potential data loading issue',
      whatPreserved: 'Project metadata and conversation context',
    });
  }
  
  const canonical_memory = await loadCanonicalMemory(projectId, userId);
  const { attention_state, attention_detail } = resolveAttentionState(authoritative_state);

  // Phase 5C: Token safety guardrails
  // Compute token audit and enforce budget before returning
  const preliminaryContext = {
    authoritative_state,
    canonical_memory,
    conversation_context: recentTurns,
    dropped_conversation_summary: droppedSummary,
    attention_state,
    attention_detail,
  };
  
  const { audit } = serializeContextForAIWithAudit(preliminaryContext, false);
  
  // Enforce token budget - reduces Tier 3 (conversation) if over budget
  // Tier 1 (authoritative state) is NEVER truncated
  const budgetResult = enforceTokenBudget(requestCtx, audit, recentTurns);
  const finalConversation = budgetResult.turnsRemoved > 0 ? budgetResult.reducedConversation : recentTurns;

  // Phase 5C: Log context assembly completion
  if (requestCtx) {
    logContextAssemblyComplete(requestCtx, activeFrame, {
      scope: authoritative_state.scope.loadingMode || 'full',
      budget: authoritative_state.budget.loadingMode || 'full',
      quotes: authoritative_state.quotes.loadingMode || 'full',
      financing: authoritative_state.financing.loadingMode || 'full',
      documents: authoritative_state.documents.loadingMode || 'full',
      expectedCost: authoritative_state.expectedCost.loadingMode || 'full',
    });
  }

  return {
    authoritative_state,
    canonical_memory,
    conversation_context: finalConversation,
    dropped_conversation_summary: droppedSummary,
    attention_state,
    attention_detail,
    retrieval_decision,
    retrieved_context,
    observability: requestCtx ? { 
      requestId: requestCtx.requestId,
      constraintSet,
      tokenBudget: {
        originalTokens: audit.totalEstimatedTokens,
        reducedTokens: budgetResult.reducedTokens,
        turnsRemoved: budgetResult.turnsRemoved,
        tier1Preserved: budgetResult.tier1Preserved,
      },
    } : undefined,
  };
}

export { writeCanonicalMemory, loadCanonicalMemory } from './canonicalMemory';
export { resolveAttentionState, generateAssistOptions } from './attention';
export { assembleAuthoritativeState } from './contextAssembly';
