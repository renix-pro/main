/**
 * RENIX vNext — AI Observability & Safety Guardrails (Phase 5C)
 * 
 * Provides structured logging, token safety, and failure mode handling.
 * All logging is JSON-structured with consistent correlation IDs.
 * 
 * ABSOLUTE CONSTRAINTS:
 * - No changes to AI outputs or wording
 * - No changes to proposal semantics
 * - No user-visible diagnostics
 * - Logs only - observability without behavior change
 */

import { randomUUID } from 'crypto';
import type { ConstraintSet, ConversationTurn } from './types';
import type { ContextTokenAudit } from './tokenCounter';
import { estimateTokens } from './tokenCounter';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_MAX_TOKEN_BUDGET = 120000;

export interface ObservabilityConfig {
  maxTokenBudget: number;
  enableStructuredLogs: boolean;
  enableTokenSafety: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

let config: ObservabilityConfig = {
  maxTokenBudget: parseInt(process.env.AI_MAX_TOKEN_BUDGET || String(DEFAULT_MAX_TOKEN_BUDGET), 10),
  enableStructuredLogs: process.env.AI_STRUCTURED_LOGS !== 'false',
  enableTokenSafety: process.env.AI_TOKEN_SAFETY !== 'false',
  logLevel: (process.env.AI_LOG_LEVEL as ObservabilityConfig['logLevel']) || 'info',
};

export function getObservabilityConfig(): ObservabilityConfig {
  return { ...config };
}

export function updateObservabilityConfig(updates: Partial<ObservabilityConfig>): void {
  config = { ...config, ...updates };
}

// ============================================
// REQUEST CONTEXT & CORRELATION
// ============================================

export interface RequestContext {
  requestId: string;
  projectId: string | null;
  userId: string;
  sessionId: string;
  phase: '5C';
  startTime: number;
}

export function createRequestContext(
  projectId: string | null,
  userId: string,
  sessionId: string
): RequestContext {
  return {
    requestId: randomUUID(),
    projectId,
    userId,
    sessionId,
    phase: '5C',
    startTime: Date.now(),
  };
}

// ============================================
// STRUCTURED LOGGING
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface BaseLogEntry {
  timestamp: string;
  phase: '5C';
  requestId: string;
  projectId: string | null;
  level: LogLevel;
  event: string;
}

interface RetrievalLogEntry extends BaseLogEntry {
  event: 'retrieval_decision';
  data: {
    retrieval_strategy: 'structured_only' | 'structured_with_semantic';
    entities_retrieved: {
      scopes: number;
      quotes: number;
      documents: number;
      budget_allocations: number;
      quote_financials: number;
      vendors: number;
    };
    reason_for_semantic: string | null;
    entity_references_count: number;
    explicit_references: number;
    inferred_references: number;
  };
}

interface ConstraintLogEntry extends BaseLogEntry {
  event: 'constraint_applied';
  data: {
    constraint_set_summary: {
      scope_count: number | null;
      quote_count: number | null;
      document_count: number | null;
      budget_allocation_count: number | null;
      vendor_count: number | null;
    };
    constrained_entities_applied: boolean;
  };
}

// Phase 6B: Tension detection logging
interface TensionLogEntry extends BaseLogEntry {
  event: 'tension_detected';
  data: {
    tension_type: string;
    severity: 'low' | 'medium' | 'high';
    entity_counts: { [key: string]: number };
    canonical_sources: string[];
    impact_amount?: number;
    impact_currency?: string;
    impact_percentage?: number;
    confidence: 'high' | 'medium' | 'low';
    constraint_applied: boolean;
  };
}

// Phase 6C: Guided Reasoning logging
interface ReasoningPathLogEntry extends BaseLogEntry {
  event: 'reasoning_path_invoked';
  data: {
    reasoning_type: string;
    steps_count: number;
    canonical_sources_used: string[];
    constraints_applied: string[];
    data_missing: string[];
  };
}

interface ClarifyingQuestionLogEntry extends BaseLogEntry {
  event: 'clarifying_question_generated';
  data: {
    category: string;
    question_summary: string;
    expected_answer_type: string;
    related_entities: string[];
  };
}

interface ScenarioFrameLogEntry extends BaseLogEntry {
  event: 'scenario_frame_generated';
  data: {
    scenario_type: string;
    title: string;
    constraints: string[];
    excludes: string[];
  };
}

interface ProposalReadinessLogEntry extends BaseLogEntry {
  event: 'proposal_readiness_assessed';
  data: {
    is_ready: boolean;
    target_frame: string | null;
    missing_elements: string[];
    awaiting_confirmation: boolean;
  };
}

interface TokenBudgetLogEntry extends BaseLogEntry {
  event: 'token_budget';
  data: {
    tier1_tokens: number;
    tier2_tokens: number;
    tier3_tokens: number;
    attention_tokens: number;
    total_tokens_estimated: number;
    max_budget: number;
    within_budget: boolean;
    overage: number;
  };
}

interface TokenReductionLogEntry extends BaseLogEntry {
  event: 'token_reduction';
  data: {
    original_tier3_tokens: number;
    reduced_tier3_tokens: number;
    tokens_removed: number;
    turns_removed: number;
    tier1_preserved: boolean;
    reason: string;
  };
}

interface FailureModeLogEntry extends BaseLogEntry {
  event: 'failure_mode';
  data: {
    failure_type: 'partial_assembly' | 'retrieval_timeout' | 'semantic_fallback' | 'background_job_interference' | 'unknown';
    what_skipped: string;
    why: string;
    what_preserved: string;
    error_message?: string;
  };
}

interface ContextAssemblyLogEntry extends BaseLogEntry {
  event: 'context_assembly_complete';
  data: {
    active_frame: string;
    loading_modes: {
      scope: string;
      budget: string;
      quotes: string;
      financing: string;
      documents: string;
      expected_cost: string;
    };
    duration_ms: number;
  };
}

export type LogEntry = 
  | RetrievalLogEntry 
  | ConstraintLogEntry 
  | TensionLogEntry
  | ReasoningPathLogEntry
  | ClarifyingQuestionLogEntry
  | ScenarioFrameLogEntry
  | ProposalReadinessLogEntry
  | TokenBudgetLogEntry 
  | TokenReductionLogEntry
  | FailureModeLogEntry
  | ContextAssemblyLogEntry;

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[config.logLevel];
}

function logStructured(entry: LogEntry): void {
  if (!config.enableStructuredLogs) return;
  if (!shouldLog(entry.level)) return;
  
  const output = JSON.stringify(entry);
  
  switch (entry.level) {
    case 'error':
      console.error(`[AI:5C] ${output}`);
      break;
    case 'warn':
      console.warn(`[AI:5C] ${output}`);
      break;
    case 'debug':
      console.debug(`[AI:5C] ${output}`);
      break;
    default:
      console.log(`[AI:5C] ${output}`);
  }
}

// ============================================
// DECISION TRACE LOGGING
// ============================================

export interface RetrievalDecisionInput {
  strategy: 'structured_only' | 'structured_with_semantic';
  reason: string;
  entityReferences: Array<{ confidence: 'explicit' | 'inferred' }>;
  relevantScopeIds: string[];
  relevantQuoteIds: string[];
  relevantDocumentIds: string[];
  relevantBudgetAllocationIds: string[];
  relevantQuoteFinancialIds: string[];
  relevantVendorIds: string[];
}

export function logRetrievalTrace(
  ctx: RequestContext,
  input: RetrievalDecisionInput
): void {
  const explicitCount = input.entityReferences.filter(r => r.confidence === 'explicit').length;
  
  const entry: RetrievalLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'info',
    event: 'retrieval_decision',
    data: {
      retrieval_strategy: input.strategy,
      entities_retrieved: {
        scopes: input.relevantScopeIds.length,
        quotes: input.relevantQuoteIds.length,
        documents: input.relevantDocumentIds.length,
        budget_allocations: input.relevantBudgetAllocationIds.length,
        quote_financials: input.relevantQuoteFinancialIds.length,
        vendors: input.relevantVendorIds.length,
      },
      reason_for_semantic: input.strategy === 'structured_with_semantic' ? input.reason : null,
      entity_references_count: input.entityReferences.length,
      explicit_references: explicitCount,
      inferred_references: input.entityReferences.length - explicitCount,
    },
  };
  
  logStructured(entry);
}

export function logConstraintTrace(
  ctx: RequestContext,
  constraintSet: ConstraintSet | undefined
): void {
  const entry: ConstraintLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'info',
    event: 'constraint_applied',
    data: {
      constraint_set_summary: {
        scope_count: constraintSet?.scopeNodeIds?.length ?? null,
        quote_count: constraintSet?.quoteIds?.length ?? null,
        document_count: constraintSet?.documentIds?.length ?? null,
        budget_allocation_count: constraintSet?.budgetAllocationIds?.length ?? null,
        vendor_count: constraintSet?.vendorIds?.length ?? null,
      },
      constrained_entities_applied: constraintSet !== undefined,
    },
  };
  
  logStructured(entry);
}

/**
 * Phase 6B: Log detected tension insights.
 * Each tension is logged separately with its type, severity, and entities involved.
 */
export function logTensionInsights(
  ctx: RequestContext,
  tensions: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    evidence: Array<{ entityType: string; count: number; canonicalSource: string }>;
    impact: { amount?: number; currency?: string; percentage?: number };
    confidence: 'high' | 'medium' | 'low';
    constraintNote?: string;
  }>
): void {
  tensions.forEach(tension => {
    const entityCounts: { [key: string]: number } = {};
    const canonicalSources: string[] = [];
    
    tension.evidence.forEach(e => {
      entityCounts[e.entityType] = e.count;
      if (!canonicalSources.includes(e.canonicalSource)) {
        canonicalSources.push(e.canonicalSource);
      }
    });
    
    const entry: TensionLogEntry = {
      timestamp: new Date().toISOString(),
      phase: '5C',
      requestId: ctx.requestId,
      projectId: ctx.projectId,
      level: tension.severity === 'high' ? 'warn' : 'info',
      event: 'tension_detected',
      data: {
        tension_type: tension.type,
        severity: tension.severity,
        entity_counts: entityCounts,
        canonical_sources: canonicalSources,
        impact_amount: tension.impact.amount,
        impact_currency: tension.impact.currency,
        impact_percentage: tension.impact.percentage,
        confidence: tension.confidence,
        constraint_applied: !!tension.constraintNote,
      },
    };
    
    logStructured(entry);
  });
}

// ============================================
// PHASE 6C: GUIDED REASONING LOGGING
// ============================================

/**
 * Log a reasoning path invocation.
 */
export function logReasoningPath(
  ctx: RequestContext,
  reasoningPath: {
    type: string;
    steps: Array<{ canonicalSources: string[]; dataRequired: string[] }>;
    constraintsApplied: string[];
  }
): void {
  const canonicalSourcesUsed: string[] = [];
  const dataMissing: string[] = [];
  
  reasoningPath.steps.forEach(step => {
    step.canonicalSources.forEach(src => {
      if (!canonicalSourcesUsed.includes(src)) {
        canonicalSourcesUsed.push(src);
      }
    });
    dataMissing.push(...step.dataRequired);
  });
  
  const entry: ReasoningPathLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'info',
    event: 'reasoning_path_invoked',
    data: {
      reasoning_type: reasoningPath.type,
      steps_count: reasoningPath.steps.length,
      canonical_sources_used: canonicalSourcesUsed,
      constraints_applied: reasoningPath.constraintsApplied,
      data_missing: dataMissing,
    },
  };
  
  logStructured(entry);
}

/**
 * Log clarifying questions generated.
 */
export function logClarifyingQuestions(
  ctx: RequestContext,
  questions: Array<{
    category: string;
    question: string;
    expectedAnswerType: string;
    relatedEntities: string[];
  }>
): void {
  questions.forEach(q => {
    const entry: ClarifyingQuestionLogEntry = {
      timestamp: new Date().toISOString(),
      phase: '5C',
      requestId: ctx.requestId,
      projectId: ctx.projectId,
      level: 'info',
      event: 'clarifying_question_generated',
      data: {
        category: q.category,
        question_summary: q.question.substring(0, 100),
        expected_answer_type: q.expectedAnswerType,
        related_entities: q.relatedEntities,
      },
    };
    
    logStructured(entry);
  });
}

/**
 * Log scenario frames generated.
 */
export function logScenarioFrames(
  ctx: RequestContext,
  frames: Array<{
    type: string;
    title: string;
    constraints: string[];
    excludes: string[];
  }>
): void {
  frames.forEach(frame => {
    const entry: ScenarioFrameLogEntry = {
      timestamp: new Date().toISOString(),
      phase: '5C',
      requestId: ctx.requestId,
      projectId: ctx.projectId,
      level: 'info',
      event: 'scenario_frame_generated',
      data: {
        scenario_type: frame.type,
        title: frame.title,
        constraints: frame.constraints,
        excludes: frame.excludes,
      },
    };
    
    logStructured(entry);
  });
}

/**
 * Log proposal readiness assessment.
 */
export function logProposalReadiness(
  ctx: RequestContext,
  readiness: {
    isReady: boolean;
    targetFrame: string | null;
    missingElements: string[];
    awaitingConfirmation: boolean;
  }
): void {
  const entry: ProposalReadinessLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: readiness.isReady ? 'info' : 'debug',
    event: 'proposal_readiness_assessed',
    data: {
      is_ready: readiness.isReady,
      target_frame: readiness.targetFrame,
      missing_elements: readiness.missingElements,
      awaiting_confirmation: readiness.awaitingConfirmation,
    },
  };
  
  logStructured(entry);
}

/**
 * Log complete guided reasoning context.
 */
export function logGuidedReasoningContext(
  ctx: RequestContext,
  reasoningContext: {
    reasoningPaths: Array<{
      type: string;
      steps: Array<{ canonicalSources: string[]; dataRequired: string[] }>;
      constraintsApplied: string[];
    }>;
    clarifyingQuestions: Array<{
      category: string;
      question: string;
      expectedAnswerType: string;
      relatedEntities: string[];
    }>;
    scenarioFrames: Array<{
      type: string;
      title: string;
      constraints: string[];
      excludes: string[];
    }>;
    proposalReadiness: {
      isReady: boolean;
      targetFrame: string | null;
      missingElements: string[];
      awaitingConfirmation: boolean;
    } | null;
  }
): void {
  // Log each reasoning path
  reasoningContext.reasoningPaths.forEach(path => {
    logReasoningPath(ctx, path);
  });
  
  // Log clarifying questions if any
  if (reasoningContext.clarifyingQuestions.length > 0) {
    logClarifyingQuestions(ctx, reasoningContext.clarifyingQuestions);
  }
  
  // Log scenario frames if any
  if (reasoningContext.scenarioFrames.length > 0) {
    logScenarioFrames(ctx, reasoningContext.scenarioFrames);
  }
  
  // Log proposal readiness if assessed
  if (reasoningContext.proposalReadiness) {
    logProposalReadiness(ctx, reasoningContext.proposalReadiness);
  }
}

export function logTokenBudget(
  ctx: RequestContext,
  audit: ContextTokenAudit
): void {
  const overage = Math.max(0, audit.totalEstimatedTokens - config.maxTokenBudget);
  
  const entry: TokenBudgetLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: overage > 0 ? 'warn' : 'info',
    event: 'token_budget',
    data: {
      tier1_tokens: audit.breakdown.tier1_authoritative,
      tier2_tokens: audit.breakdown.tier2_canonical,
      tier3_tokens: audit.breakdown.tier3_conversation,
      attention_tokens: audit.breakdown.attention,
      total_tokens_estimated: audit.totalEstimatedTokens,
      max_budget: config.maxTokenBudget,
      within_budget: overage === 0,
      overage,
    },
  };
  
  logStructured(entry);
}

// ============================================
// TOKEN SAFETY GUARDRAILS
// ============================================

export interface TokenReductionResult {
  reduced: boolean;
  originalTier3Tokens: number;
  reducedTier3Tokens: number;
  turnsRemoved: number;
  reason: string;
}

export function checkTokenBudget(audit: ContextTokenAudit): {
  withinBudget: boolean;
  overage: number;
  tier3Reducible: boolean;
} {
  const overage = Math.max(0, audit.totalEstimatedTokens - config.maxTokenBudget);
  const tier3Reducible = audit.breakdown.tier3_conversation > 0;
  
  return {
    withinBudget: overage === 0,
    overage,
    tier3Reducible,
  };
}

export function logTokenReduction(
  ctx: RequestContext,
  result: TokenReductionResult
): void {
  const entry: TokenReductionLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'warn',
    event: 'token_reduction',
    data: {
      original_tier3_tokens: result.originalTier3Tokens,
      reduced_tier3_tokens: result.reducedTier3Tokens,
      tokens_removed: result.originalTier3Tokens - result.reducedTier3Tokens,
      turns_removed: result.turnsRemoved,
      tier1_preserved: true,
      reason: result.reason,
    },
  };
  
  logStructured(entry);
}

// ============================================
// FAILURE MODE LOGGING
// ============================================

export type FailureType = 
  | 'partial_assembly'
  | 'retrieval_timeout'
  | 'semantic_fallback'
  | 'background_job_interference'
  | 'unknown';

export function logFailureMode(
  ctx: RequestContext,
  failureType: FailureType,
  details: {
    whatSkipped: string;
    why: string;
    whatPreserved: string;
    errorMessage?: string;
  }
): void {
  const entry: FailureModeLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'error',
    event: 'failure_mode',
    data: {
      failure_type: failureType,
      what_skipped: details.whatSkipped,
      why: details.why,
      what_preserved: details.whatPreserved,
      error_message: details.errorMessage,
    },
  };
  
  logStructured(entry);
}

// ============================================
// TOKEN BUDGET ENFORCEMENT (FAIL-SOFT)
// ============================================

export interface TokenBudgetEnforcementResult {
  withinBudget: boolean;
  originalTokens: number;
  reducedTokens: number;
  reducedConversation: ConversationTurn[];
  turnsRemoved: number;
  tier1Preserved: boolean;
  reduction?: TokenReductionResult;
}

export function enforceTokenBudget(
  ctx: RequestContext | null,
  audit: ContextTokenAudit,
  conversationContext: ConversationTurn[]
): TokenBudgetEnforcementResult {
  if (!config.enableTokenSafety) {
    return {
      withinBudget: true,
      originalTokens: audit.totalEstimatedTokens,
      reducedTokens: audit.totalEstimatedTokens,
      reducedConversation: conversationContext,
      turnsRemoved: 0,
      tier1Preserved: true,
    };
  }

  const budgetCheck = checkTokenBudget(audit);
  
  if (budgetCheck.withinBudget) {
    if (ctx) {
      logTokenBudget(ctx, audit);
    }
    return {
      withinBudget: true,
      originalTokens: audit.totalEstimatedTokens,
      reducedTokens: audit.totalEstimatedTokens,
      reducedConversation: conversationContext,
      turnsRemoved: 0,
      tier1Preserved: true,
    };
  }

  // Over budget - reduce Tier 3 (conversation) first
  // NEVER truncate Tier 1 (authoritative state)
  let overage = budgetCheck.overage;
  const originalTier3Tokens = audit.breakdown.tier3_conversation;
  let reducedConversation = [...conversationContext];
  let tokensRemoved = 0;
  let turnsRemoved = 0;

  while (overage > 0 && reducedConversation.length > 1) {
    // Remove oldest turn first (preserve most recent context)
    const removedTurn = reducedConversation.shift();
    if (removedTurn) {
      const turnTokens = estimateTokens(`[${removedTurn.role.toUpperCase()}]: ${removedTurn.content}\n`);
      tokensRemoved += turnTokens;
      overage -= turnTokens;
      turnsRemoved++;
    }
  }

  const reducedTier3Tokens = originalTier3Tokens - tokensRemoved;
  const reducedTotalTokens = audit.totalEstimatedTokens - tokensRemoved;

  const reductionResult: TokenReductionResult = {
    reduced: true,
    originalTier3Tokens,
    reducedTier3Tokens,
    turnsRemoved,
    reason: `Token budget exceeded by ${budgetCheck.overage}. Reduced Tier 3 (conversation) from ${originalTier3Tokens} to ${reducedTier3Tokens} tokens by removing ${turnsRemoved} oldest turns.`,
  };

  if (ctx) {
    // Log the original budget status (warning)
    logTokenBudget(ctx, audit);
    // Log the reduction action
    logTokenReduction(ctx, reductionResult);
  }

  return {
    withinBudget: overage <= 0,
    originalTokens: audit.totalEstimatedTokens,
    reducedTokens: reducedTotalTokens,
    reducedConversation,
    turnsRemoved,
    tier1Preserved: true,
    reduction: reductionResult,
  };
}

// ============================================
// CONTEXT ASSEMBLY LOGGING
// ============================================

export function logContextAssemblyComplete(
  ctx: RequestContext,
  activeFrame: string,
  loadingModes: {
    scope: string;
    budget: string;
    quotes: string;
    financing: string;
    documents: string;
    expectedCost: string;
  }
): void {
  const entry: ContextAssemblyLogEntry = {
    timestamp: new Date().toISOString(),
    phase: '5C',
    requestId: ctx.requestId,
    projectId: ctx.projectId,
    level: 'info',
    event: 'context_assembly_complete',
    data: {
      active_frame: activeFrame,
      loading_modes: {
        scope: loadingModes.scope,
        budget: loadingModes.budget,
        quotes: loadingModes.quotes,
        financing: loadingModes.financing,
        documents: loadingModes.documents,
        expected_cost: loadingModes.expectedCost,
      },
      duration_ms: Date.now() - ctx.startTime,
    },
  };
  
  logStructured(entry);
}
