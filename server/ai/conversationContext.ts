/**
 * RENIX vNext — AI Conversation Context Module (Layer 3)
 * 
 * Layer 3 — CONVERSATIONAL CONTEXT
 *   Ephemeral, last 6-10 turns only.
 *   Disposable, NEVER treated as truth.
 *   
 *   Used for natural dialogue flow.
 *   Discarded after session ends.
 * 
 * CONVERSATION SUMMARIZATION (Tier 3 Optimization)
 *   When conversation window rolls over, older turns are summarized
 *   to preserve context about topics discussed while limiting tokens.
 */

import type { ConversationTurn } from './types';

const CONVERSATION_LIMIT = 10;
const TOPIC_EXCERPT_LENGTH = 30;

export interface ConversationContextResult {
  recentTurns: ConversationTurn[];
  droppedSummary: string | null;
}

/**
 * Create a deterministic summary of dropped conversation turns.
 * 
 * Format: "Earlier: [N user messages, M assistant messages covering: <topics>]"
 * 
 * @param droppedTurns - The turns that are about to be dropped from context
 * @returns A single-paragraph summary (max ~100 tokens)
 */
export function summarizeDroppedTurns(droppedTurns: ConversationTurn[]): string {
  if (droppedTurns.length === 0) {
    return '';
  }

  const userMessages = droppedTurns.filter(t => t.role === 'user');
  const assistantMessages = droppedTurns.filter(t => t.role === 'assistant');

  const topics: string[] = [];
  for (const turn of droppedTurns) {
    const excerpt = turn.content.substring(0, TOPIC_EXCERPT_LENGTH).trim();
    const truncated = turn.content.length > TOPIC_EXCERPT_LENGTH 
      ? excerpt + '...' 
      : excerpt;
    if (truncated) {
      topics.push(truncated);
    }
  }

  const topicsPreview = topics.slice(0, 5).join('; ');
  const hasMore = topics.length > 5 ? ` (+${topics.length - 5} more)` : '';

  return `Earlier: [${userMessages.length} user messages, ${assistantMessages.length} assistant messages covering: ${topicsPreview}${hasMore}]`;
}

/**
 * Get recent conversation turns with optional summary of dropped turns.
 * 
 * @param conversationHistory - Full conversation history
 * @returns Object with recent turns and dropped summary (if any)
 */
export function getRecentConversation(
  conversationHistory: ConversationTurn[]
): ConversationContextResult {
  if (conversationHistory.length <= CONVERSATION_LIMIT) {
    return {
      recentTurns: conversationHistory,
      droppedSummary: null,
    };
  }

  const dropCount = conversationHistory.length - CONVERSATION_LIMIT;
  const droppedTurns = conversationHistory.slice(0, dropCount);
  const recentTurns = conversationHistory.slice(-CONVERSATION_LIMIT);

  const droppedSummary = summarizeDroppedTurns(droppedTurns);

  return {
    recentTurns,
    droppedSummary: droppedSummary || null,
  };
}

/**
 * Format conversation context for AI prompt inclusion.
 * 
 * If there's a dropped summary, prepends:
 *   "[Earlier in this conversation: <summary>]"
 * Then includes the recent turns.
 * 
 * @param conversationHistory - Full conversation history
 * @returns Formatted string for AI context
 */
export function formatConversationForContext(
  conversationHistory: ConversationTurn[]
): string {
  if (conversationHistory.length === 0) {
    return '';
  }
  
  const { recentTurns, droppedSummary } = getRecentConversation(conversationHistory);
  
  const parts: string[] = [];
  
  if (droppedSummary) {
    parts.push(`[Earlier in this conversation: ${droppedSummary}]`);
    parts.push('');
  }
  
  const formattedTurns = recentTurns
    .map(turn => `[${turn.role.toUpperCase()}]: ${turn.content}`)
    .join('\n');
  
  parts.push(formattedTurns);
  
  return parts.join('\n');
}

export { ConversationTurn };
