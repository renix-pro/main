/**
 * RENIX vNext — AI Service (Backward Compatibility Re-exports)
 * 
 * This file maintains backward compatibility by re-exporting from
 * the new modular AI service located in server/ai/.
 * 
 * All new code should import directly from 'server/ai/index.ts'.
 */

export type {
  AIResponseType,
  AIMode,
  AttentionState,
  AttentionDetail,
  AssistOption,
  SessionContext,
  AIProposal,
  UINavigationIntent,
  AIResponse,
  AIMessage,
  ProjectContext,
  AICallLog,
} from './ai';

export {
  processUserMessage,
  streamProcessUserMessage,
  getAICallLogs,
  getSystemPrompt,
  AI_SYSTEM_RULE,
  BASE_SYSTEM_PROMPT,
  DISCOVERY_MODE_PROMPT,
  VALIDATION_MODE_PROMPT,
  PLANNING_MODE_PROMPT,
  QUOTES_CONTEXT_PROMPT,
  validateResponseType,
  parseAIResponse,
  isProposalResponse,
  hasValidProposals,
  VALID_RESPONSE_TYPES,
} from './ai';

export { buildAIContext, serializeContextForAI } from './ai';
