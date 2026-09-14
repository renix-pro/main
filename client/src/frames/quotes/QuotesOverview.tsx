/**
 * RENIX vNext — Quotes Overview
 * 
 * Overview mode showing metrics and scope tree for quote navigation.
 * Part of the vertical reveal focus architecture.
 */

import { useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { useScopeTreeData } from '@/frames/scope/useScopeTreeData';
import { useQuotesData, type Quote, type QuoteVersion, getEffectiveQuoteStatus, isQuoteCommitted, isQuotePending } from './useQuotesData';
import { Circle, CircleDot, CheckCircle2, Banknote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PostureTile, MetricCard } from '@/components/tiles';
import { KPIRing } from '@/components/KPIBand';
import { GenericTree } from '@/components/GenericTree';
import { BudgetTensionStrip } from './BudgetTensionStrip';
import { queryKeys, budgetApi } from '@/lib/api';
import type { GenericTreeNode, TreeNodeRenderProps } from '@/components/GenericTree/types';
import type { ScopeTreeNode } from '@/frames/scope/useScopeTreeData';
import { ScopeDetailsPanel } from './ScopeDetailsPanel';

interface QuotesTreeNodeData extends GenericTreeNode {
  quoteCount: number;
  activeCount: number;
  hasCommitted: boolean;
  hasNew: boolean;
  displayAmount: number | null;
  costType: string;
  budgetAllocation: number | null;
}

function getQuoteDisplayAmount(quote: Quote): number | null {
  const acceptedVersion = quote.versions.find(v => v.commitmentStatus === 'accepted' && v.extractionStatus === 'verified');
  if (acceptedVersion) {
    return quote.financials?.grossAmount ?? acceptedVersion.total ?? null;
  }
  const activeVersion = quote.versions.find(v => v.commitmentStatus === 'active' && v.extractionStatus === 'verified');
  if (activeVersion) {
    return quote.financials?.grossAmount ?? activeVersion.total ?? null;
  }
  return null;
}

function getDirectDisplayAmount(nodeQuotes: Quote[]): number | null {
  const acceptedQuote = nodeQuotes.find(q => q.versions?.some(v => v.commitmentStatus === 'accepted'));
  if (acceptedQuote) {
    return getQuoteDisplayAmount(acceptedQuote);
  }
  const activeQuotes = nodeQuotes.filter(q => q.versions?.[0]?.commitmentStatus !== 'superseded');
  if (activeQuotes.length > 0) {
    const sorted = [...activeQuotes].sort((a, b) => b.updatedAt - a.updatedAt);
    return getQuoteDisplayAmount(sorted[0]);
  }
  return null;
}

function buildQuotesTreeNodes(
  nodes: ScopeTreeNode[],
  scopeQuoteMap: Map<string, Quote[]>,
  scopeBudgetMap: Map<string, number>
): QuotesTreeNodeData[] {
  return nodes.map((node) => {
    const isDirectCost = node.costType === 'direct';
    const nodeQuotes = scopeQuoteMap.get(node.id) || [];
    const hasCommitted = nodeQuotes.some(q => isQuoteCommitted(q));
    const hasNew = nodeQuotes.some(q => isQuotePending(q));
    const activeCount = nodeQuotes.filter(q => getEffectiveQuoteStatus(q) !== 'superseded').length;

    const directAmount = getDirectDisplayAmount(nodeQuotes);
    const budgetAlloc = scopeBudgetMap.get(node.id) ?? null;

    const children = node.children.length > 0
      ? buildQuotesTreeNodes(node.children, scopeQuoteMap, scopeBudgetMap)
      : [];

    const childrenTotal = children.reduce((sum, child) => {
      if (child.displayAmount !== null) return sum + child.displayAmount;
      return sum;
    }, 0);
    const childrenQuoteCount = children.reduce((sum, child) => sum + child.quoteCount, 0);

    const totalQuoteCount = nodeQuotes.length + childrenQuoteCount;
    let displayAmount: number | null = null;

    if (isDirectCost && budgetAlloc !== null) {
      displayAmount = budgetAlloc;
    } else if (directAmount !== null && childrenTotal > 0) {
      displayAmount = directAmount + childrenTotal;
    } else if (directAmount !== null) {
      displayAmount = directAmount;
    } else if (childrenTotal > 0) {
      displayAmount = childrenTotal;
    }

    return {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      depth: node.depth,
      sortOrder: node.sortOrder,
      children,
      isExpanded: node.isExpanded,
      quoteCount: totalQuoteCount,
      activeCount,
      hasCommitted,
      hasNew,
      displayAmount,
      costType: node.costType,
      budgetAllocation: budgetAlloc,
      metadata: { scopeId: node.id },
    };
  });
}

interface QuotesOverviewProps {
  selectedScopeId: string | null;
  onSelectScope: (scopeId: string) => void;
  onViewQuoteDetails?: (quoteId: string) => void;
  onCompareQuote?: (quoteId: string) => void;
  onAskAI?: () => void;
  onCommitQuote?: () => void;
  onAddVersion?: (quoteId: string) => void;
  onAcceptVersion?: (quote: Quote, version: QuoteVersion) => void;
  onDeleteQuote?: (quoteId: string) => void;
  openQuoteId?: string;
  openScopeId?: string;
  openInEditMode?: boolean;
}

export function QuotesOverview({ selectedScopeId, onSelectScope, onViewQuoteDetails, onCompareQuote, onAskAI, onCommitQuote, onAddVersion, onAcceptVersion, onDeleteQuote, openQuoteId, openScopeId, openInEditMode }: QuotesOverviewProps) {
  const { projectId, isReadOnly, currency } = useProject();
  const { formatCurrency } = useFormatters();
  const quotes = useQuotesData(projectId, currency, isReadOnly);
  const scopeTree = useScopeTreeData(projectId, isReadOnly);

  const { data: budgetResponse } = useQuery({
    queryKey: queryKeys.budget(projectId),
    queryFn: () => budgetApi.get(projectId),
    enabled: !!projectId,
  });

  const scopeBudgetMap = useMemo(() => {
    const map = new Map<string, number>();
    const allocations = budgetResponse?.allocations || [];
    for (const alloc of allocations) {
      const target = alloc.target as { type: string; scopeId?: string } | null;
      if (target?.type === 'scope' && target.scopeId) {
        const existing = map.get(target.scopeId) || 0;
        map.set(target.scopeId, existing + alloc.amount);
      }
    }
    return map;
  }, [budgetResponse]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const node of scopeTree.rootNodes) {
      ids.add(node.id);
    }
    return ids;
  });

  // When a deep-link targets a specific scope, ensure all of its ancestors are expanded
  // so the node is visible in the tree and renderExpandedDetail can fire for it.
  useEffect(() => {
    if (!openScopeId || scopeTree.nodes.length === 0) return;
    setExpandedIds(prev => {
      const next = new Set(prev);
      let current = scopeTree.nodes.find(n => n.id === openScopeId);
      while (current?.parentId) {
        next.add(current.parentId);
        current = scopeTree.nodes.find(n => n.id === current!.parentId);
      }
      return next;
    });
  }, [openScopeId, scopeTree.nodes]);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const isNodeExpanded = useCallback((nodeId: string) => {
    return expandedIds.has(nodeId);
  }, [expandedIds]);

  const metrics = useMemo(() => {
    const allQuotes = quotes.data?.quotes || [];
    const scopesWithQuotes = new Set(allQuotes.filter(q => q.scopeId).map(q => q.scopeId));
    const pendingQuotes = allQuotes.filter(q => isQuotePending(q));
    const committedQuotes = allQuotes.filter(q => isQuoteCommitted(q));
    
    return {
      totalScopes: scopeTree.nodes.length,
      withQuotes: scopesWithQuotes.size,
      pending: pendingQuotes.length,
      committed: committedQuotes.length,
    };
  }, [quotes.data?.quotes, scopeTree.nodes]);

  const scopeQuoteMap = useMemo(() => {
    const map = new Map<string, Quote[]>();
    const allQuotes = quotes.data?.quotes || [];
    for (const quote of allQuotes) {
      if (quote.scopeId) {
        const existing = map.get(quote.scopeId) || [];
        existing.push(quote);
        map.set(quote.scopeId, existing);
      }
    }
    return map;
  }, [quotes.data?.quotes]);

  const treeNodes = useMemo(() =>
    buildQuotesTreeNodes(scopeTree.rootNodes, scopeQuoteMap, scopeBudgetMap),
    [scopeTree.rootNodes, scopeQuoteMap, scopeBudgetMap]
  );

  const scopeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of scopeTree.nodes) {
      map.set(node.id, node.name);
    }
    return map;
  }, [scopeTree.nodes]);


  const renderTrailingContent = useCallback((props: TreeNodeRenderProps<QuotesTreeNodeData>): ReactNode => {
    const { node } = props;
    const { quoteCount, hasCommitted, hasNew, displayAmount, costType, budgetAllocation } = node;
    const isDirectCost = costType === 'direct';

    if (isDirectCost) {
      return (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary" className="text-[10px] bg-muted" data-testid={`badge-direct-cost-${node.id}`}>
            <Banknote className="h-3 w-3 mr-1" />
            Direct Cost
          </Badge>
          {budgetAllocation !== null && budgetAllocation > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
              <span className="text-sm font-semibold tabular-nums" data-testid={`text-direct-cost-amount-${node.id}`}>
                {formatCurrency(budgetAllocation)}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (quoteCount <= 0) return null;

    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        {displayAmount !== null ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-md">
            {hasCommitted ? (
              <CheckCircle2 className="h-3 w-3 text-status-approved flex-shrink-0" data-testid={`icon-committed-${node.id}`} />
            ) : hasNew ? (
              <Circle className="h-3 w-3 flex-shrink-0" data-testid={`icon-new-${node.id}`} />
            ) : (
              <CircleDot className="h-3 w-3 flex-shrink-0" data-testid={`icon-draft-${node.id}`} />
            )}
            <span className="text-sm font-semibold tabular-nums" data-testid={`text-quote-amount-${node.id}`}>
              {formatCurrency(displayAmount)}
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground" data-testid={`text-quote-count-${node.id}`}>
              {quoteCount === 1 ? '1 quote' : `${quoteCount} quotes`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 border border-dashed border-border rounded-md">
            {hasCommitted ? (
              <CheckCircle2 className="h-3 w-3 text-status-approved flex-shrink-0" data-testid={`icon-committed-${node.id}`} />
            ) : hasNew ? (
              <Circle className="h-3 w-3 flex-shrink-0" data-testid={`icon-new-${node.id}`} />
            ) : (
              <CircleDot className="h-3 w-3 flex-shrink-0" data-testid={`icon-draft-${node.id}`} />
            )}
            <span data-testid={`text-quote-count-${node.id}`}>
              {quoteCount === 1 ? '1 quote' : `${quoteCount} quotes`}
            </span>
          </div>
        )}
      </div>
    );
  }, [formatCurrency]);

  const renderExpandedDetail = useCallback((props: TreeNodeRenderProps<QuotesTreeNodeData>): ReactNode => {
    const isTargetScope = openScopeId && props.node.id === openScopeId;
    return (
      <ScopeDetailsPanel
        scopeId={props.node.id}
        onViewQuoteDetails={onViewQuoteDetails}
        onCompareQuote={onCompareQuote}
        onAskAI={onAskAI}
        onCommitQuote={onCommitQuote}
        onAddVersion={onAddVersion}
        onAcceptVersion={onAcceptVersion}
        onDeleteQuote={onDeleteQuote}
        openQuoteId={isTargetScope ? openQuoteId : undefined}
        openInEditMode={isTargetScope ? openInEditMode : undefined}
      />
    );
  }, [onViewQuoteDetails, onCompareQuote, onAskAI, onCommitQuote, onAddVersion, onAcceptVersion, onDeleteQuote, openScopeId, openQuoteId, openInEditMode]);

  return (
    <div className="space-y-6" data-testid="quotes-overview">
      <PostureTile
        label="Quotes Total"
        value={formatCurrency(quotes.totalNonSupersededAmount)}
        subtext="Sum of all non-superseded quotes"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="quotes-metrics-grid">
        <MetricCard label="Total scopes" value={metrics.totalScopes} />
        <MetricCard label="With quotes" value={metrics.withQuotes} />
        <MetricCard label="Pending" value={metrics.pending} />
        <MetricCard label="Committed" value={metrics.committed} />
      </div>

      <BudgetTensionStrip
        quotes={quotes.data?.quotes || []}
        scopeNames={scopeNames}
      />

      {metrics.totalScopes > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2"
          data-testid="quotes-scope-coverage-strip"
        >
          <KPIRing
            value={metrics.withQuotes}
            max={metrics.totalScopes}
            size={48}
            strokeWidth={4}
            color="secondary"
          />
          <div className="flex flex-col">
            <span
              className="text-sm font-semibold text-foreground tabular-nums"
              data-testid="text-scope-coverage-ratio"
            >
              {metrics.withQuotes} of {metrics.totalScopes} scopes covered
            </span>
            <span
              className="text-xs text-muted-foreground"
              data-testid="text-scope-coverage-percentage"
            >
              {metrics.totalScopes > 0
                ? `${Math.round((metrics.withQuotes / metrics.totalScopes) * 100)}% coverage`
                : '0% coverage'}
            </span>
          </div>
        </div>
      )}

      <GenericTree
        nodes={treeNodes}
        selectedNodeId={selectedScopeId}
        onSelectNode={(id) => id && onSelectScope(id)}
        onToggleExpanded={toggleExpanded}
        isNodeExpanded={isNodeExpanded}
        isReadOnly={true}
        enableDragDrop={false}
        enableInlineEdit={false}
        enableAddChild={false}
        emptyMessage="No scopes defined. Create scopes in the Scope frame first."
        testIdPrefix="quotes-tree"
        renderTrailingContent={renderTrailingContent as any}
        renderExpandedDetail={renderExpandedDetail as any}
      />
    </div>
  );
}
