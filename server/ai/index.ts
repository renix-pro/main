/**
 * RENIX vNext — AI Service Barrel Exports
 * 
 * Re-exports all AI service modules for easy importing.
 * Maintains backward compatibility with existing imports.
 */

export * from './types';

export {
  resolveAttentionState,
  generateAssistOptions,
} from './attention';

export {
  loadCanonicalMemory,
  writeCanonicalMemory,
} from './canonicalMemory';

export {
  getRecentConversation,
  formatConversationForContext,
  summarizeDroppedTurns,
  type ConversationContextResult,
} from './conversationContext';

export {
  assembleAuthoritativeState,
  serializeContextForAI,
} from './contextAssembly';

export {
  AI_SYSTEM_RULE,
  BASE_SYSTEM_PROMPT,
  DISCOVERY_MODE_PROMPT,
  VALIDATION_MODE_PROMPT,
  PLANNING_MODE_PROMPT,
  QUOTES_CONTEXT_PROMPT,
  getSystemPrompt,
} from './prompts';

export {
  processUserMessage,
  streamProcessUserMessage,
  getAICallLogs,
} from './companion';

export {
  buildAIContext,
} from './service';

export {
  validateResponseType,
  parseAIResponse,
  isProposalResponse,
  hasValidProposals,
  VALID_RESPONSE_TYPES,
} from './responseSchema';

export {
  extractEntityReferences,
  extractConversationTopics,
  decideRetrievalStrategy,
  performHybridRetrieval,
  logRetrievalDecision,
  type EntityReference,
  type ConversationTopic,
  type RetrievalDecision,
  type RetrievedContext,
} from './retrieval';
