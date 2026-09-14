/**
 * RENIX vNext — AI Response Schema Module
 * 
 * Response validation and parsing schemas.
 * Used to validate AI responses match expected structure.
 */

import type { AIResponse, AIResponseType } from './types';

export const VALID_RESPONSE_TYPES: AIResponseType[] = [
  'explain',
  'explore', 
  'propose',
  'needs_evidence',
  'acknowledge'
];

export function validateResponseType(type: string): AIResponseType {
  if (VALID_RESPONSE_TYPES.includes(type as AIResponseType)) {
    return type as AIResponseType;
  }
  return 'explain';
}

export function parseAIResponse(content: string): AIResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      type: validateResponseType(parsed.type || 'explain'),
    };
  } catch {
    return {
      type: 'explain',
      content: content,
    };
  }
}

export function isProposalResponse(response: AIResponse): boolean {
  return response.type === 'propose' && 
         Array.isArray(response.proposals) && 
         response.proposals.length > 0;
}

export function hasValidProposals(response: AIResponse): boolean {
  if (!response.proposals || !Array.isArray(response.proposals)) {
    return false;
  }
  return response.proposals.every(p => 
    p.target_frame && 
    p.proposed_diff && 
    p.rationale
  );
}
