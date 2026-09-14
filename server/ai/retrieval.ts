/**
 * RENIX vNext — Hybrid Retrieval Module (Phase 5B.2)
 * 
 * Provides intelligent retrieval for AI context:
 * - Structured retrieval (default): Deterministic entity lookup
 * - All retrieval is project-scoped
 * - Retrieval decisions are logged for auditability
 */

import { db } from '../db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { ConversationTurn, LoadingMode, ConstraintSet } from './types';

/**
 * Types of entities that can be referenced in conversation
 */
export type EntityType = 
  | 'scope' 
  | 'quote' 
  | 'document' 
  | 'vendor' 
  | 'budget_allocation'
  | 'financing_source'
  | 'invoice';

/**
 * A detected entity reference from conversation
 */
export interface EntityReference {
  type: EntityType;
  id?: string;
  name?: string;
  confidence: 'explicit' | 'inferred';
  source: 'user_message' | 'conversation_history';
}

/**
 * Conversation topic extracted from recent turns
 */
export interface ConversationTopic {
  frame: string;
  entityTypes: EntityType[];
  keywords: string[];
}

/**
 * Retrieval decision explaining why a strategy was chosen
 */
export interface RetrievalDecision {
  strategy: 'structured_only' | 'structured_with_semantic';
  reason: string;
  entityReferences: EntityReference[];
  conversationTopics: ConversationTopic[];
  semanticQueryUsed?: string;
  timestamp: Date;
}

/**
 * Retrieved context from hybrid retrieval
 */
export interface RetrievedContext {
  decision: RetrievalDecision;
  relevantScopeIds: string[];
  relevantQuoteIds: string[];
  relevantDocumentIds: string[];
  relevantVendorIds: string[];
  relevantBudgetAllocationIds: string[];
  relevantQuoteFinancialIds: string[];
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SCOPE_ID_PATTERN = /\[id:([0-9a-f-]+)\]/gi;
const QUOTE_REF_PATTERN = /quote[#\s]*(\d+|[0-9a-f-]+)/gi;
const DOC_REF_PATTERN = /document[#\s]*(\d+|[0-9a-f-]+)/gi;

/**
 * Extract entity references from text
 */
export function extractEntityReferences(
  text: string, 
  source: 'user_message' | 'conversation_history'
): EntityReference[] {
  const refs: EntityReference[] = [];
  
  let match;
  while ((match = SCOPE_ID_PATTERN.exec(text)) !== null) {
    refs.push({
      type: 'scope',
      id: match[1],
      confidence: 'explicit',
      source
    });
  }
  
  while ((match = QUOTE_REF_PATTERN.exec(text)) !== null) {
    refs.push({
      type: 'quote',
      id: match[1],
      confidence: 'explicit',
      source
    });
  }
  
  while ((match = DOC_REF_PATTERN.exec(text)) !== null) {
    refs.push({
      type: 'document',
      id: match[1],
      confidence: 'explicit',
      source
    });
  }
  
  const scopeKeywords = ['scope', 'area', 'room', 'zone', 'section'];
  const quoteKeywords = ['quote', 'estimate', 'bid', 'proposal', 'offer'];
  const documentKeywords = ['document', 'file', 'pdf', 'attachment', 'upload'];
  const vendorKeywords = ['vendor', 'contractor', 'supplier', 'company'];
  const budgetKeywords = ['budget', 'allocation', 'cost', 'expense'];
  const financingKeywords = ['financing', 'loan', 'mortgage', 'funding'];
  const invoiceKeywords = ['invoice', 'bill', 'payment'];
  
  const lowerText = text.toLowerCase();
  
  if (scopeKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'scope', confidence: 'inferred', source });
  }
  if (quoteKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'quote', confidence: 'inferred', source });
  }
  if (documentKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'document', confidence: 'inferred', source });
  }
  if (vendorKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'vendor', confidence: 'inferred', source });
  }
  if (budgetKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'budget_allocation', confidence: 'inferred', source });
  }
  if (financingKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'financing_source', confidence: 'inferred', source });
  }
  if (invoiceKeywords.some(k => lowerText.includes(k))) {
    refs.push({ type: 'invoice', confidence: 'inferred', source });
  }
  
  return refs;
}

/**
 * Extract conversation topics from recent turns
 */
export function extractConversationTopics(
  recentTurns: ConversationTurn[],
  activeFrame: string
): ConversationTopic[] {
  const topics: ConversationTopic[] = [];
  
  topics.push({
    frame: activeFrame,
    entityTypes: mapFrameToEntityTypes(activeFrame),
    keywords: []
  });
  
  const allText = recentTurns.map(t => t.content).join(' ');
  const entityRefs = extractEntityReferences(allText, 'conversation_history');
  
  const referencedTypes = Array.from(new Set(entityRefs.map(r => r.type)));
  if (referencedTypes.length > 0) {
    const frameFromRefs = inferFrameFromEntityTypes(referencedTypes);
    if (frameFromRefs !== activeFrame) {
      topics.push({
        frame: frameFromRefs,
        entityTypes: referencedTypes,
        keywords: extractKeywords(allText)
      });
    }
  }
  
  return topics;
}

/**
 * Map frame to relevant entity types
 */
function mapFrameToEntityTypes(frame: string): EntityType[] {
  switch (frame) {
    case 'scope':
      return ['scope'];
    case 'budget':
      return ['scope', 'budget_allocation'];
    case 'quotes':
      return ['quote', 'vendor', 'scope', 'document'];
    case 'financing':
      return ['financing_source'];
    case 'invoices':
      return ['invoice', 'vendor', 'quote'];
    case 'documents':
      return ['document', 'quote'];
    case 'execution':
      return ['scope'];
    case 'overview':
      return ['scope', 'budget_allocation', 'quote', 'financing_source'];
    default:
      return [];
  }
}

/**
 * Infer frame from entity types mentioned
 */
function inferFrameFromEntityTypes(types: EntityType[]): string {
  if (types.includes('quote') || types.includes('vendor')) return 'quotes';
  if (types.includes('document')) return 'documents';
  if (types.includes('financing_source')) return 'financing';
  if (types.includes('invoice')) return 'invoices';
  if (types.includes('budget_allocation')) return 'budget';
  if (types.includes('scope')) return 'scope';
  return 'overview';
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'i', 'you', 'we', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
    'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const wordCounts = new Map<string, number>();
  words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1));
  
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Decide retrieval strategy based on context
 */
export function decideRetrievalStrategy(
  userMessage: string,
  recentTurns: ConversationTurn[],
  activeFrame: string
): RetrievalDecision {
  const userRefs = extractEntityReferences(userMessage, 'user_message');
  const conversationTopics = extractConversationTopics(recentTurns, activeFrame);
  
  const allRefs = [
    ...userRefs,
    ...recentTurns.flatMap(t => extractEntityReferences(t.content, 'conversation_history'))
  ];
  
  const hasExplicitDocRef = allRefs.some(r => r.type === 'document' && r.confidence === 'explicit');
  const hasDocumentQuestion = /what.*document|document.*say|find.*document|search.*document/i.test(userMessage);
  const needsSemanticSearch = hasDocumentQuestion && !hasExplicitDocRef;
  
  const decision: RetrievalDecision = {
    strategy: needsSemanticSearch ? 'structured_with_semantic' : 'structured_only',
    reason: needsSemanticSearch 
      ? 'User is asking about documents without explicit reference - semantic search may help'
      : 'Structured retrieval sufficient based on explicit references and active frame',
    entityReferences: allRefs,
    conversationTopics,
    semanticQueryUsed: needsSemanticSearch ? userMessage : undefined,
    timestamp: new Date()
  };
  
  return decision;
}

/**
 * Perform structured retrieval for scope nodes
 */
export async function retrieveRelevantScopeNodes(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full'
): Promise<string[]> {
  const explicitIds = entityRefs
    .filter(r => r.type === 'scope' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitIds.length > 0) {
    return explicitIds;
  }
  
  if (loadingMode === 'full') {
    const nodes = await db.select({ id: schema.scopeNodes.id })
      .from(schema.scopeNodes)
      .where(and(
        eq(schema.scopeNodes.projectId, projectId),
        eq(schema.scopeNodes.userId, userId)
      ));
    return nodes.map(n => n.id);
  }
  
  return [];
}

/**
 * Perform structured retrieval for quotes
 */
export async function retrieveRelevantQuotes(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full'
): Promise<string[]> {
  const explicitIds = entityRefs
    .filter(r => r.type === 'quote' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitIds.length > 0) {
    return explicitIds;
  }
  
  if (loadingMode === 'full') {
    const quotes = await db.select({ id: schema.quotes.id })
      .from(schema.quotes)
      .where(and(
        eq(schema.quotes.projectId, projectId),
        eq(schema.quotes.userId, userId)
      ));
    return quotes.map(q => q.id);
  }
  
  return [];
}

/**
 * Perform structured retrieval for documents
 */
export async function retrieveRelevantDocuments(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full',
  limit: number = 10
): Promise<string[]> {
  const explicitIds = entityRefs
    .filter(r => r.type === 'document' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitIds.length > 0) {
    return explicitIds;
  }
  
  if (loadingMode === 'full' || loadingMode === 'summary') {
    const docs = await db.select({ id: schema.documents.id })
      .from(schema.documents)
      .where(and(
        eq(schema.documents.projectId, projectId),
        eq(schema.documents.userId, userId)
      ))
      .orderBy(desc(schema.documents.uploadedAt))
      .limit(limit);
    return docs.map(d => d.id);
  }
  
  return [];
}

/**
 * Perform structured retrieval for budget allocations
 */
export async function retrieveRelevantBudgetAllocations(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full'
): Promise<string[]> {
  const explicitIds = entityRefs
    .filter(r => r.type === 'budget_allocation' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitIds.length > 0) {
    return explicitIds;
  }
  
  if (loadingMode === 'full') {
    const allocations = await db.select({ id: schema.budgetAllocations.id })
      .from(schema.budgetAllocations)
      .where(and(
        eq(schema.budgetAllocations.projectId, projectId),
        eq(schema.budgetAllocations.userId, userId)
      ));
    return allocations.map(a => a.id);
  }
  
  return [];
}

/**
 * Perform structured retrieval for quote financials
 */
export async function retrieveRelevantQuoteFinancials(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full'
): Promise<string[]> {
  const explicitQuoteIds = entityRefs
    .filter(r => r.type === 'quote' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitQuoteIds.length > 0) {
    const financials = await db.select({ id: schema.quoteFinancials.id })
      .from(schema.quoteFinancials)
      .where(and(
        eq(schema.quoteFinancials.projectId, projectId),
        eq(schema.quoteFinancials.userId, userId),
        inArray(schema.quoteFinancials.quoteId, explicitQuoteIds)
      ));
    return financials.map(f => f.id);
  }
  
  if (loadingMode === 'full') {
    const financials = await db.select({ id: schema.quoteFinancials.id })
      .from(schema.quoteFinancials)
      .where(and(
        eq(schema.quoteFinancials.projectId, projectId),
        eq(schema.quoteFinancials.userId, userId)
      ));
    return financials.map(f => f.id);
  }
  
  return [];
}

/**
 * Perform structured retrieval for vendors
 */
export async function retrieveRelevantVendors(
  projectId: string,
  userId: string,
  entityRefs: EntityReference[],
  loadingMode: LoadingMode = 'full'
): Promise<string[]> {
  const explicitIds = entityRefs
    .filter(r => r.type === 'vendor' && r.id && r.confidence === 'explicit')
    .map(r => r.id as string);
  
  if (explicitIds.length > 0) {
    return explicitIds;
  }
  
  if (loadingMode === 'full' || loadingMode === 'summary') {
    const vendors = await db.select({ id: schema.vendors.id })
      .from(schema.vendors)
      .where(and(
        eq(schema.vendors.projectId, projectId),
        eq(schema.vendors.userId, userId)
      ));
    return vendors.map(v => v.id);
  }
  
  return [];
}

/**
 * Perform hybrid retrieval - combines structured + semantic
 */
export async function performHybridRetrieval(
  projectId: string,
  userId: string,
  userMessage: string,
  recentTurns: ConversationTurn[],
  activeFrame: string,
  loadingModes: {
    scope: LoadingMode;
    quotes: LoadingMode;
    documents: LoadingMode;
    budget: LoadingMode;
    vendors: LoadingMode;
  }
): Promise<RetrievedContext> {
  const decision = decideRetrievalStrategy(userMessage, recentTurns, activeFrame);
  
  const [
    relevantScopeIds,
    relevantQuoteIds,
    relevantDocumentIds,
    relevantBudgetAllocationIds,
    relevantQuoteFinancialIds,
    relevantVendorIds
  ] = await Promise.all([
    retrieveRelevantScopeNodes(projectId, userId, decision.entityReferences, loadingModes.scope),
    retrieveRelevantQuotes(projectId, userId, decision.entityReferences, loadingModes.quotes),
    retrieveRelevantDocuments(projectId, userId, decision.entityReferences, loadingModes.documents),
    retrieveRelevantBudgetAllocations(projectId, userId, decision.entityReferences, loadingModes.budget),
    retrieveRelevantQuoteFinancials(projectId, userId, decision.entityReferences, loadingModes.quotes),
    retrieveRelevantVendors(projectId, userId, decision.entityReferences, loadingModes.vendors)
  ]);
  
  const context: RetrievedContext = {
    decision,
    relevantScopeIds,
    relevantQuoteIds,
    relevantDocumentIds,
    relevantVendorIds,
    relevantBudgetAllocationIds,
    relevantQuoteFinancialIds,
  };
  
  logRetrievalDecision(decision, context);
  
  return context;
}

/**
 * Log retrieval decision for auditability
 */
export function logRetrievalDecision(decision: RetrievalDecision, context: RetrievedContext): void {
  const explicitCount = decision.entityReferences.filter(r => r.confidence === 'explicit').length;
  const inferredCount = decision.entityReferences.length - explicitCount;
  
  console.log('=== RETRIEVAL AUDIT ===');
  console.log(`Strategy: ${decision.strategy}`);
  console.log(`Reason: ${decision.reason}`);
  console.log(`Timestamp: ${decision.timestamp.toISOString()}`);
  console.log(`Entity References: ${decision.entityReferences.length} (explicit: ${explicitCount}, inferred: ${inferredCount})`);
  if (decision.entityReferences.length > 0 && decision.entityReferences.length <= 10) {
    decision.entityReferences.forEach(ref => {
      console.log(`  - ${ref.type}: ${ref.id || ref.name || '(inferred)'} [${ref.confidence}]`);
    });
  }
  console.log(`Topics: ${decision.conversationTopics.map(t => t.frame).join(', ')}`);
  console.log(`Retrieved entities:`);
  console.log(`  - Scopes: ${context.relevantScopeIds.length}`);
  console.log(`  - Quotes: ${context.relevantQuoteIds.length}`);
  console.log(`  - Documents: ${context.relevantDocumentIds.length}`);
  console.log(`  - Vendors: ${context.relevantVendorIds.length}`);
  console.log(`  - Budget Allocations: ${context.relevantBudgetAllocationIds.length}`);
  console.log(`  - Quote Financials: ${context.relevantQuoteFinancialIds.length}`);
  console.log('=======================');
}

/**
 * Build a ConstraintSet from retrieval output.
 * Returns undefined if no constraints were derived (fallback to full load).
 */
export function buildConstraintSetFromRetrieval(
  projectId: string,
  retrieved: RetrievedContext | undefined
): ConstraintSet | undefined {
  if (!retrieved) return undefined;
  
  // Check if any constraints exist from retrieval
  // Note: Financing sources and invoices are not currently retrieved,
  // so they remain undefined (fallback to full load for those entities)
  const hasConstraints = 
    retrieved.relevantScopeIds.length > 0 ||
    retrieved.relevantQuoteIds.length > 0 ||
    retrieved.relevantDocumentIds.length > 0 ||
    retrieved.relevantBudgetAllocationIds.length > 0 ||
    retrieved.relevantQuoteFinancialIds.length > 0 ||
    retrieved.relevantVendorIds.length > 0;
  
  if (!hasConstraints) return undefined;
  
  return {
    projectId,
    scopeNodeIds: retrieved.relevantScopeIds.length > 0 ? retrieved.relevantScopeIds : undefined,
    quoteIds: retrieved.relevantQuoteIds.length > 0 ? retrieved.relevantQuoteIds : undefined,
    quoteFinancialIds: retrieved.relevantQuoteFinancialIds.length > 0 ? retrieved.relevantQuoteFinancialIds : undefined,
    documentIds: retrieved.relevantDocumentIds.length > 0 ? retrieved.relevantDocumentIds : undefined,
    budgetAllocationIds: retrieved.relevantBudgetAllocationIds.length > 0 ? retrieved.relevantBudgetAllocationIds : undefined,
    vendorIds: retrieved.relevantVendorIds.length > 0 ? retrieved.relevantVendorIds : undefined,
  };
}
