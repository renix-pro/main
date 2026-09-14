/**
 * RENIX vNext — AI Scope Matcher
 * 
 * Matches invoices to project scopes using AI-based analysis.
 * Analyzes vendor name, line item descriptions, and scope definitions
 * to intelligently assign invoices to the most relevant scope.
 */

import { completeJson } from './openai';
import type { ScopeNode } from '@shared/schema';

interface LineItem {
  description?: string;
  amount?: number;
}

interface MatchInvoiceInput {
  vendorName: string;
  lineItems: LineItem[];
  total?: number;
  scopeNodes: ScopeNode[];
}

interface MatchResult {
  scopeId: string | null;
  scopeName: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Match an invoice to a scope node using AI analysis.
 * 
 * Analyzes:
 * - Vendor name (e.g., "Bausachverständige" → building inspection → Site/structure)
 * - Line item descriptions (e.g., "Gutachten" → expert report)
 * - Scope node names and notes
 */
export async function matchInvoiceToScope(input: MatchInvoiceInput): Promise<MatchResult | null> {
  const { vendorName, lineItems, scopeNodes } = input;
  
  if (scopeNodes.length === 0) {
    console.log('[scopeMatcher] No scope nodes available for matching');
    return null;
  }
  
  // Build scope context for AI
  const scopeContext = scopeNodes.map(node => ({
    id: node.id,
    name: node.name,
    description: node.description || '',
    parentId: node.parentId,
  }));
  
  // Build invoice context
  const lineItemDescriptions = lineItems
    .map(item => item.description)
    .filter(Boolean)
    .join(', ');
  
  const prompt = `You are matching a construction/renovation invoice to a project scope.

PROJECT SCOPES:
${scopeContext.map(s => `- ID: ${s.id}, Name: "${s.name}"${s.description ? `, Description: "${s.description}"` : ''}`).join('\n')}

INVOICE DETAILS:
- Vendor: "${vendorName}"
- Line Items: ${lineItemDescriptions || 'No detailed line items'}
- Total Amount: ${input.total != null ? `€${input.total.toFixed(2)}` : 'Not specified'}

TASK:
Determine which scope this invoice most likely belongs to based on:
1. The vendor name and what type of work they typically do
2. The line item descriptions
3. The available project scopes

Common German construction terms:
- "Bausachverständige/r" = Building surveyor/inspector → typically Site/structure or Building envelope
- "Gutachten" = Expert report/assessment
- "Fenster" = Windows → Building envelope
- "Elektro" = Electrical → MEP
- "Heizung" = Heating → MEP
- "Bad/Sanitär" = Bathroom/Plumbing → Interior or MEP
- "Dach" = Roof → Roofing or Building envelope
- "Garten/Landschaft" = Garden/Landscape → Landscaping or Exterior

Respond with JSON:
{
  "scopeId": "the matching scope ID or null if no match",
  "scopeName": "the matching scope name or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this scope matches"
}

If confidence is below 0.5 or no clear match exists, return scopeId and scopeName as null.`;

  try {
    const result = await completeJson<any>({
      system: 'You are an expert at categorizing construction invoices to project scopes. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
      effort: 'low',
    });
    console.log('[scopeMatcher] AI response:', JSON.stringify(result));
    
    // Validate the matched scope ID exists
    if (result.scopeId) {
      const matchedNode = scopeNodes.find(n => n.id === result.scopeId);
      if (!matchedNode) {
        console.log(`[scopeMatcher] AI returned invalid scope ID: ${result.scopeId}`);
        return null;
      }
    }
    
    return {
      scopeId: result.scopeId || null,
      scopeName: result.scopeName || null,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    console.error('[scopeMatcher] AI matching failed:', error);
    return null;
  }
}
