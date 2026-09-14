/**
 * RENIX vNext — AI Companion (Claude)
 *
 * Message processing and streaming logic for the AI companion, on top of the
 * shared Claude client in ./claude. Handles both streaming and non-streaming
 * responses. Preserves proposal gating logic.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { completeText, streamText, webResearch, parseJsonLoose, CLAUDE_MODEL, JSON_ONLY_RULE } from "./claude";
import { retrieveRelevantChunks, retrieveDocumentByNameFallback, formatChunksForContext } from './ragPipeline';

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', JPY: '¥', NZD: 'NZ$', SEK: 'kr', NOK: 'kr',
  DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', SGD: 'S$',
  HKD: 'HK$', INR: '₹', BRL: 'R$', MXN: 'MX$', ZAR: 'R',
};

function currencySymbol(code: string | undefined): string {
  if (!code) return '$';
  return CURRENCY_SYMBOL_MAP[code] || code;
}

import type { 
  AIResponse, 
  AIResponseType, 
  AIMessage, 
  ProjectContext, 
  AICallLog,
  ConversationTurn
} from './types';
import { getSystemPrompt, AI_SYSTEM_RULE } from './prompts';
import { buildAIContext, serializeContextForAI } from './service';
import { serializeContextForAIWithAudit } from './contextAssembly';

/** Last 10 user/assistant turns as Claude message params. */
function toClaudeHistory(history: AIMessage[]): Anthropic.MessageParam[] {
  return history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

const aiCallLogs: AICallLog[] = [];
const MAX_LOGS = 1000;

function logAICall(log: AICallLog) {
  aiCallLogs.push(log);
  if (aiCallLogs.length > MAX_LOGS) {
    aiCallLogs.shift();
  }
  console.log(`[AI] ${log.request_id} - ${log.response_type || 'pending'} - ${log.duration_ms || 0}ms`);
}

export function getAICallLogs(limit: number = 50): AICallLog[] {
  return aiCallLogs.slice(-limit);
}

function redactPII(text: string): string {
  return text
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]');
}

const COST_VALIDATION_PATTERNS = [
  /\b(validate|verify|check|review|assess|evaluate|sanity.?check)\b.*\b(quote|cost|price|pricing|estimate|amount|total|rate|bid)\b/i,
  /\b(quote|cost|price|pricing|estimate|amount|total|rate|bid)\b.*\b(validate|verify|check|review|assess|evaluate|reasonable|fair|competitive|too.?high|too.?low|overpriced|expensive|cheap|market)\b/i,
  /\b(market|industry|average|typical|normal|standard|going.?rate|benchmark)\b.*\b(price|cost|rate|quote)\b/i,
  /\b(is|are|does)\b.*\b(this|these|the)\b.*\b(quote|cost|price|amount)\b.*\b(reasonable|fair|competitive|good|ok|right|correct|accurate)\b/i,
  /\bsanity.?check\b/i,
  /\bcost.?comparison\b/i,
  /\bprice.?comparison\b/i,
  /\bmarket.?rate/i,
  /\b(compare|comparing)\b.*\b(quote|price|cost)\b.*\b(market|industry|average)\b/i,
];

function detectCostValidationIntent(userMessage: string): boolean {
  return COST_VALIDATION_PATTERNS.some(pattern => pattern.test(userMessage));
}

function buildWebSearchQuery(userMessage: string, context: ProjectContext): string {
  const currency = context.currency || 'EUR';
  const projectType = context.projectType || 'construction renovation';
  
  const scopeNames = context.scopes?.map(s => s.name).filter(Boolean).slice(0, 5) || [];
  const scopeContext = scopeNames.length > 0 ? scopeNames.join(', ') : '';
  
  let budgetContext = '';
  if (context.budgetAllocations?.length) {
    budgetContext = context.budgetAllocations
      .slice(0, 5)
      .map((a: any) => `${a.label}: ${a.amount} ${currency}`)
      .join('; ');
  }

  return `Current market rates and typical costs for ${projectType} work: ${scopeContext}. ${budgetContext ? `Budget context: ${budgetContext}.` : ''} Currency: ${currency}. Focus on realistic cost ranges per square meter or per unit for these types of work.`;
}

async function performWebResearch(userMessage: string, context: ProjectContext): Promise<string | null> {
  try {
    const searchQuery = buildWebSearchQuery(userMessage, context);
    console.log(`[AI WebSearch] Triggering web research for cost validation`);
    
    const outputText = await webResearch(
      `Research current market rates and typical pricing for the following construction/renovation work. Provide specific price ranges per unit where possible. Be factual and cite sources.\n\nUser question: ${redactPII(userMessage)}\n\nSearch focus: ${searchQuery}`,
      { maxUses: 5, effort: 'medium' },
    );
    if (outputText) {
      console.log(`[AI WebSearch] Web research completed (${outputText.length} chars)`);
      return outputText;
    }
    return null;
  } catch (error) {
    console.error('[AI WebSearch] Web research failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function processUserMessage(
  userMessage: string,
  conversationHistory: AIMessage[],
  context: ProjectContext
): Promise<AIResponse> {
  const requestId = randomUUID();
  const startTime = Date.now();
  const model = CLAUDE_MODEL;
  const temperature = 0.3;
  
  const contextSnapshot = JSON.stringify({
    projectId: context.projectId,
    projectName: context.projectName,
    projectStatus: context.projectStatus,
    activeFrame: context.activeFrame,
    scopeCount: context.scopes?.length || 0,
    budgetIntent: context.budgetIntent,
    currency: context.currency,
  });

  const log: AICallLog = {
    request_id: requestId,
    timestamp: new Date(),
    model,
    temperature,
    prompt_snapshot: redactPII(userMessage.substring(0, 500)),
    context_snapshot: contextSnapshot,
  };

  try {
    const buildScopeTree = (nodes: any[], parentId: string | null = null, depth: number = 0): string => {
      return nodes
        .filter(n => n.parentId === parentId)
        .map(n => {
          const indent = "  ".repeat(depth + 1);
          const children = buildScopeTree(nodes, n.id, depth + 1);
          return `${indent}- ${n.name} [id:${n.id}]${n.isOptional ? ' (optional)' : ''}${n.isArchived ? ' [ARCHIVED]' : ''}${children ? '\n' + children : ''}`;
        })
        .join('\n');
    };

    const scopeList = context.scopes?.length 
      ? buildScopeTree(context.scopes)
      : '  (none defined)';
    
    let contextMessage: string;
    if (context.mode === 'PROJECT_DISCOVERY') {
      contextMessage = `CONTEXT:
- Mode: PROJECT_DISCOVERY
- No project exists yet
- Help the user define their project through natural conversation`;
    } else if (context.mode === 'PROJECT_VALIDATION') {
      contextMessage = `CONTEXT:
- Mode: PROJECT_VALIDATION
- Pending project proposal exists
- Proposal: ${JSON.stringify(context.pendingProjectProposal?.proposed_diff?.after || {})}`;
    } else {
      const pendingProposalsSummary = context.pendingProposals?.length 
        ? `\nPENDING PROPOSALS (${context.pendingProposals.length}):\n${context.pendingProposals.slice(0, 5).map((p: any) => 
            `  - ${p.targetFrame}: ${p.rationale?.substring(0, 60) || 'No rationale'}...`
          ).join('\n')}`
        : '';
      
      const blockedSummary = context.blockedDependencies?.length
        ? `\nBLOCKED DEPENDENCIES:\n${context.blockedDependencies.map((b: any) =>
            `  - ${b.entity} blocked by ${b.blockedBy} (${b.frame})`
          ).join('\n')}`
        : '';
      
      contextMessage = `PROJECT CONTEXT:
- Project: ${context.projectName} (${context.projectStatus})
- Type: ${context.projectType || 'Not specified'}
${context.projectDescription ? `- Description: ${context.projectDescription}` : ''}
- Active Frame: ${context.activeFrame || 'Overview'}
- Currency: ${context.currency || 'USD'}
- Scopes (${context.scopes?.length || 0}):
${scopeList}
- Budget Intent: ${context.budgetIntent ? `${currencySymbol(context.currency)}${context.budgetIntent.toLocaleString()}` : 'Not set'}
${context.contingencyMode && context.contingencyValue ? `- Contingency: ${context.contingencyMode === 'percent' ? `${context.contingencyValue}%` : `${currencySymbol(context.currency)}${context.contingencyValue.toLocaleString()} (fixed)`}` : ''}
${context.budgetAllocations?.length ? `- Allocations (${context.budgetAllocations.length}):\n${context.budgetAllocations.map((a: any) => `  - ${a.label}: ${currencySymbol(context.currency)}${a.amount.toLocaleString()}`).join('\n')}` : ''}
${context.totalConfirmedFinancing !== undefined ? `- Total Confirmed Financing: ${currencySymbol(context.currency)}${context.totalConfirmedFinancing.toLocaleString()}` : ''}
${context.fundingGap !== undefined ? `- Funding ${context.fundingGap >= 0 ? 'Surplus' : 'GAP'}: ${currencySymbol(context.currency)}${Math.abs(context.fundingGap).toLocaleString()}${context.fundingGap < 0 ? ' (ATTENTION: Project is underfunded!)' : ''}` : ''}
${context.totalMonthlyLiabilities ? `- Total Monthly Liabilities: ${currencySymbol(context.currency)}${context.totalMonthlyLiabilities.toLocaleString()}/month` : ''}
${context.financingSources?.length ? `- Financing Sources (${context.financingSources.length}):\n${context.financingSources.map((s: any) => `  - ${s.name} (${s.type}): ${currencySymbol(context.currency)}${s.amount.toLocaleString()} [${s.status}]${s.monthlyLiability ? ` - ${currencySymbol(context.currency)}${s.monthlyLiability.toLocaleString()}/mo liability` : ''}`).join('\n')}` : ''}
${pendingProposalsSummary}${blockedSummary}
${context.isSessionResume ? `\n- isSessionResume: true (provide brief orientation in session_orientation field)` : ''}
${context.recentActivity?.length ? `\nRecent Activity:\n${context.recentActivity.slice(0, 5).map(a => `- ${a}`).join('\n')}` : ''}
${context.requiresAcknowledgement ? `\nDOCUMENT UPLOAD DETECTED:
- User has just uploaded a document. You MUST acknowledge receipt of the file.
- Begin your response by confirming you received the file.
- State that you are analyzing/checking what type of document this is.
- If attachment classification is available, proceed with the classification flow.
- Example: "I've received the file. I'm checking what type of document this is."` : ''}
${context.attachment ? `\nATTACHMENT DATA (for document confirmation):
- documentId: "${context.attachment.documentId}"
- objectPath: "${context.attachment.objectPath || ''}"
- classification: ${JSON.stringify(context.attachment.classification || {})}
- requiresScopeSelection: ${context.attachment.requiresScopeSelection || false}
${context.attachment.extractedData ? `- extractedData: ${JSON.stringify(context.attachment.extractedData)}` : ''}

[QUOTE INGESTION RULES]
By default, treat every upload as a NEW quote. Do NOT proactively suggest version-linking.
However, if the user EXPLICITLY asks to add this document as a new version of an existing quote,
you MUST honor that request by using confirm_quote_version action with the correct existingQuoteId
from QUOTE DETAILS in context. Only offer confirm_quote_version when the user explicitly requests it.
When generating confirm_quote assist_options, use these exact values for quoteData.documentId and quoteData.objectPath.
When generating confirm_quote_version assist_options, use these exact values for quoteVersionData.documentId and quoteVersionData.objectPath.
When generating confirm_invoice assist_options, use these exact values for invoiceData.documentId and invoiceData.objectPath.
When generating confirm_invoice assist_options, if extractedData is available above, include it as invoiceData.extractedData (the full object as-is). If extractedData is not available, still generate the confirm_invoice action without it — the backend will handle extraction.` : ''}
${(context as any).pendingQuoteExtraction ? `\nPENDING QUOTE EXTRACTION DATA (AI can reference these specific details):
- Vendor: ${(context as any).pendingQuoteExtraction.vendorName || 'Not detected'}
- Date: ${(context as any).pendingQuoteExtraction.quoteDate || 'Not detected'}
- Net Amount: ${(context as any).pendingQuoteExtraction.netAmount ? `${currencySymbol((context as any).pendingQuoteExtraction.currency)}${(context as any).pendingQuoteExtraction.netAmount.toLocaleString()}` : 'Not detected'}
- Tax Amount: ${(context as any).pendingQuoteExtraction.taxAmount ? `${currencySymbol((context as any).pendingQuoteExtraction.currency)}${(context as any).pendingQuoteExtraction.taxAmount.toLocaleString()}` : 'Not detected'}
- Gross Amount: ${(context as any).pendingQuoteExtraction.grossAmount ? `${currencySymbol((context as any).pendingQuoteExtraction.currency)}${(context as any).pendingQuoteExtraction.grossAmount.toLocaleString()}` : 'Not detected'}
${(context as any).pendingQuoteExtraction.lineItems?.length ? `- Top Line Items:\n${(context as any).pendingQuoteExtraction.lineItems.map((li: any) => `  * ${li.description}: ${currencySymbol((context as any).pendingQuoteExtraction.currency)}${(li.amount || 0).toLocaleString()}`).join('\n')}` : ''}
You can mention these specific values when discussing the quote with the user.` : ''}`;
    }

    let fullContextMessage = '';
    if (context.mode === 'PROJECT_PLANNING' && context.projectId && context.userId) {
      try {
        const conversationTurns: ConversationTurn[] = conversationHistory
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(),
          }));
        const fullAIContext = await buildAIContext(
          context.projectId,
          context.userId,
          context.projectId,
          context.activeFrame || 'overview',
          conversationTurns
        );
        // Phase 5B.1: Use audited serialization with token logging
        // Phase 6A: Pass constraint set for accurate explainability reporting
        const { context: serializedContext, audit } = serializeContextForAIWithAudit(
          fullAIContext, 
          true, 
          fullAIContext.observability?.constraintSet
        );
        fullContextMessage = serializedContext;
      } catch (err) {
        console.error('[AI] Failed to build full context:', err);
      }
    }

    let webResearchContext = '';
    const isCostValidation = context.mode === 'PROJECT_PLANNING' && detectCostValidationIntent(userMessage);
    if (isCostValidation) {
      console.log(`[AI] Cost validation intent detected — triggering web research`);
      const webData = await performWebResearch(userMessage, context);
      if (webData) {
        webResearchContext = `\n\nWEB RESEARCH DATA (for cost validation only — cite sources when referencing):
The following market data was gathered from web sources to help validate costs. Use this data to compare against the project's quotes and allocations. Always mention that this data is from web sources and may vary by region, season, and specific project requirements.

${webData}`;
      }
    }

    let ragContext = '';
    if (context.mode === 'PROJECT_PLANNING' && context.projectId) {
      try {
        let ragChunks = await retrieveRelevantChunks(context.projectId, userMessage);
        if (ragChunks.length === 0) {
          ragChunks = await retrieveDocumentByNameFallback(context.projectId, userMessage);
          if (ragChunks.length > 0) {
            console.log(`[AI] RAG fallback: loaded document by name match`);
          }
        }
        if (ragChunks.length > 0) {
          ragContext = formatChunksForContext(ragChunks);
          console.log(`[AI] RAG: injected ${ragChunks.length} document passages for query`);
        }
      } catch (err) {
        console.error('[AI] RAG retrieval failed (non-blocking):', err);
      }
    }

    const systemSections = [
      getSystemPrompt(context.mode, context.activeFrame),
      contextMessage,
      fullContextMessage,
      ragContext ? `DOCUMENT KNOWLEDGE (retrieved from uploaded project documents — use these passages to answer user questions about document content):\n${ragContext}` : '',
      webResearchContext,
      JSON_ONLY_RULE,
    ];
    const messages: Anthropic.MessageParam[] = [
      ...toClaudeHistory(conversationHistory),
      { role: 'user', content: userMessage },
    ];

    const content = (await completeText({ system: systemSections, messages, model })) || '{}';
    let parsed: AIResponse;
    
    try {
      parsed = parseJsonLoose<AIResponse>(content);
    } catch {
      parsed = {
        type: 'explain',
        content: content,
      };
    }

    const validTypes: AIResponseType[] = ['explain', 'explore', 'propose', 'needs_evidence', 'acknowledge'];
    if (!validTypes.includes(parsed.type)) {
      parsed.type = 'explain';
    }

    const pendingProposals = context.pendingProposals || [];
    const hasPendingProposals = pendingProposals.length > 0;
    
    if (hasPendingProposals && parsed.proposals && parsed.proposals.length > 0) {
      console.log(`[AI] Stripping ${parsed.proposals.length} proposal(s) - pending proposals exist`);
      parsed.proposals = [];
      parsed.attention_state = 'pending_decision';
      parsed.attention_detail = {
        what: `You have ${pendingProposals.length} pending proposal(s) awaiting review`,
        where: pendingProposals[0]?.targetFrame || 'project',
      };
      if (!parsed.content.toLowerCase().includes('pending')) {
        parsed.content += '\n\n*You have pending proposals to review first. Please accept or reject them before I can suggest new changes.*';
      }
    }
    
    if (parsed.proposals && Array.isArray(parsed.proposals) && parsed.proposals.length > 0) {
      parsed.proposals = [parsed.proposals[0]].map(p => ({
        ...p,
        proposal_id: randomUUID(),
        author: 'AI' as const,
        model,
        created_at: new Date().toISOString(),
        status: 'pending' as const,
        provenance: {
          request_id: requestId,
          user_message: redactPII(userMessage),
          context_snapshot: contextSnapshot,
        },
      }));
    }

    log.response_type = parsed.type;
    log.duration_ms = Date.now() - startTime;
    logAICall(log);

    return parsed;
  } catch (error) {
    log.error = error instanceof Error ? error.message : 'Unknown error';
    log.duration_ms = Date.now() - startTime;
    logAICall(log);

    return {
      type: 'explain',
      content: 'I apologize, but I encountered an issue processing your request. Please try again.',
    };
  }
}

export async function streamProcessUserMessage(
  userMessage: string,
  conversationHistory: AIMessage[],
  context: ProjectContext,
  onChunk: (chunk: string) => void
): Promise<AIResponse> {
  const requestId = randomUUID();
  const startTime = Date.now();
  const model = CLAUDE_MODEL;
  const temperature = 0.3;
  
  const contextSnapshot = JSON.stringify({
    projectId: context.projectId,
    projectName: context.projectName,
    projectStatus: context.projectStatus,
    activeFrame: context.activeFrame,
  });

  const log: AICallLog = {
    request_id: requestId,
    timestamp: new Date(),
    model,
    temperature,
    prompt_snapshot: redactPII(userMessage.substring(0, 500)),
    context_snapshot: contextSnapshot,
  };

  try {
    let contextMessage: string;
    if (context.mode === 'PROJECT_DISCOVERY') {
      contextMessage = `CONTEXT:\n- Mode: PROJECT_DISCOVERY\n- No project exists yet`;
    } else if (context.mode === 'PROJECT_VALIDATION') {
      contextMessage = `CONTEXT:\n- Mode: PROJECT_VALIDATION\n- Pending proposal exists`;
    } else {
      contextMessage = `PROJECT CONTEXT:\n- Project: ${context.projectName} (${context.projectStatus})\n- Active Frame: ${context.activeFrame || 'Overview'}\n- Currency: ${context.currency || 'USD'}`;
    }

    let ragContext = '';
    if (context.mode === 'PROJECT_PLANNING' && context.projectId) {
      try {
        let ragChunks = await retrieveRelevantChunks(context.projectId, userMessage);
        if (ragChunks.length === 0) {
          ragChunks = await retrieveDocumentByNameFallback(context.projectId, userMessage);
          if (ragChunks.length > 0) {
            console.log(`[AI/stream] RAG fallback: loaded document by name match`);
          }
        }
        if (ragChunks.length > 0) {
          ragContext = formatChunksForContext(ragChunks);
          console.log(`[AI/stream] RAG: injected ${ragChunks.length} document passages`);
        }
      } catch (err) {
        console.error('[AI/stream] RAG retrieval failed (non-blocking):', err);
      }
    }

    const systemSections = [
      getSystemPrompt(context.mode, context.activeFrame),
      contextMessage,
      ragContext ? `DOCUMENT KNOWLEDGE (retrieved from uploaded project documents — use these passages to answer user questions about document content):\n${ragContext}` : '',
      JSON_ONLY_RULE,
    ];
    const messages: Anthropic.MessageParam[] = [
      ...toClaudeHistory(conversationHistory),
      { role: 'user', content: userMessage },
    ];

    const fullResponse = await streamText({ system: systemSections, messages, model }, onChunk);

    let parsed: AIResponse;
    try {
      parsed = parseJsonLoose<AIResponse>(fullResponse);
    } catch {
      parsed = { type: 'explain', content: fullResponse };
    }

    if (parsed.proposals && Array.isArray(parsed.proposals)) {
      parsed.proposals = parsed.proposals.map(p => ({
        ...p,
        proposal_id: randomUUID(),
        author: 'AI' as const,
        model,
        created_at: new Date().toISOString(),
        status: 'pending' as const,
        provenance: {
          request_id: requestId,
          user_message: redactPII(userMessage),
          context_snapshot: contextSnapshot,
        },
      }));
    }

    log.response_type = parsed.type;
    log.duration_ms = Date.now() - startTime;
    logAICall(log);

    return parsed;
  } catch (error) {
    log.error = error instanceof Error ? error.message : 'Unknown error';
    log.duration_ms = Date.now() - startTime;
    logAICall(log);

    return {
      type: 'explain',
      content: 'I encountered an issue. Please try again.',
    };
  }
}
