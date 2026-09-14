/**
 * RENIX vNext — AI Context Assembly (Backward Compatibility Re-exports)
 * 
 * This file maintains backward compatibility by re-exporting from
 * the new modular AI service located in server/ai/.
 * 
 * All new code should import directly from 'server/ai/index.ts'.
 */

export type {
  AttentionState,
  AttentionDetail,
  AssistOption,
  AuthoritativeState,
  CanonicalMemoryEntry,
  ConversationTurn,
  AIContext,
} from './ai';

export {
  assembleAuthoritativeState,
  serializeContextForAI,
  buildAIContext,
  loadCanonicalMemory,
  writeCanonicalMemory,
  resolveAttentionState,
  generateAssistOptions,
  getRecentConversation,
  formatConversationForContext,
  summarizeDroppedTurns,
  AI_SYSTEM_RULE,
} from './ai';

export type { ConversationContextResult } from './ai';
