/**
 * RENIX vNext — AI Token Counting Utility (Phase 5B.1)
 * 
 * Provides token estimation for AI context assembly auditing.
 * Uses a simple heuristic (chars/4) as approximation for GPT tokenization.
 * 
 * This is for observability only - not production billing.
 */

export interface TokenContribution {
  tier: 'tier1_authoritative' | 'tier2_canonical' | 'tier3_conversation' | 'attention';
  section: string;
  charCount: number;
  estimatedTokens: number;
}

export interface ContextTokenAudit {
  totalChars: number;
  totalEstimatedTokens: number;
  contributions: TokenContribution[];
  breakdown: {
    tier1_authoritative: number;
    tier2_canonical: number;
    tier3_conversation: number;
    attention: number;
  };
}

/**
 * Estimate token count using chars/4 heuristic.
 * GPT models average ~4 chars per token for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Create a token contribution entry for auditing.
 */
export function createContribution(
  tier: TokenContribution['tier'],
  section: string,
  text: string
): TokenContribution {
  const charCount = text.length;
  return {
    tier,
    section,
    charCount,
    estimatedTokens: estimateTokens(text),
  };
}

/**
 * Aggregate token contributions into an audit report.
 */
export function aggregateContributions(contributions: TokenContribution[]): ContextTokenAudit {
  const breakdown = {
    tier1_authoritative: 0,
    tier2_canonical: 0,
    tier3_conversation: 0,
    attention: 0,
  };

  let totalChars = 0;
  let totalEstimatedTokens = 0;

  for (const c of contributions) {
    totalChars += c.charCount;
    totalEstimatedTokens += c.estimatedTokens;
    breakdown[c.tier] += c.estimatedTokens;
  }

  return {
    totalChars,
    totalEstimatedTokens,
    contributions,
    breakdown,
  };
}

/**
 * Log a token audit to console in a structured format.
 */
export function logTokenAudit(audit: ContextTokenAudit, contextLabel?: string): void {
  const label = contextLabel || 'AI Context';
  console.log(`[TokenAudit] ${label}: ${audit.totalEstimatedTokens} est. tokens (${audit.totalChars} chars)`);
  console.log(`[TokenAudit] Breakdown: Tier1=${audit.breakdown.tier1_authoritative}, Tier2=${audit.breakdown.tier2_canonical}, Tier3=${audit.breakdown.tier3_conversation}, Attention=${audit.breakdown.attention}`);
  
  if (audit.contributions.length > 0) {
    const topSections = audit.contributions
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
      .slice(0, 5);
    console.log(`[TokenAudit] Top sections: ${topSections.map(c => `${c.section}(${c.estimatedTokens})`).join(', ')}`);
  }
}
