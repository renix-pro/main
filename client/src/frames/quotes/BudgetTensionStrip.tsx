import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus, Banknote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, budgetApi } from '@/lib/api';
import { useScopeTreeData } from '@/frames/scope/useScopeTreeData';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { type Quote } from './useQuotesData';
import { cn } from '@/lib/utils';

interface ScopeTension {
  scopeId: string;
  scopeName: string;
  budgetAmount: number;
  activeQuoteTotal: number;
  delta: number;
  ratio: number;
  isDirectCost: boolean;
}

interface BudgetTensionStripProps {
  quotes: Quote[];
  scopeNames: Map<string, string>;
}

function TensionBar({ ratio, isOver }: { ratio: number; isOver: boolean }) {
  const clampedRatio = Math.min(ratio, 1);

  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden" data-testid="tension-bar">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
          isOver
            ? "bg-status-declined"
            : "bg-status-approved"
        )}
        style={{ width: `${clampedRatio * 100}%` }}
      />
      {isOver && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-full bg-status-declined" />
      )}
    </div>
  );
}

function ScopeTensionRow({
  tension,
  formatCurrency,
}: {
  tension: ScopeTension;
  formatCurrency: (amount: number) => string;
}) {
  const isOver = tension.delta < 0;
  const absDelta = Math.abs(tension.delta);
  const noBudget = tension.budgetAmount === 0;

  if (tension.isDirectCost) {
    return (
      <div className="flex flex-col gap-1" data-testid={`tension-row-${tension.scopeId}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate flex-1">
            <Banknote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              {tension.scopeName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs tabular-nums font-medium text-foreground" data-testid={`tension-direct-amount-${tension.scopeId}`}>
              {formatCurrency(tension.budgetAmount)}
            </span>
            <span className="text-[10px] text-muted-foreground italic">locked</span>
          </div>
        </div>
        <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted">
          <div className="absolute inset-0 bg-status-approved/25 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid={`tension-row-${tension.scopeId}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {tension.scopeName}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs tabular-nums text-muted-foreground" data-testid={`tension-quote-amount-${tension.scopeId}`}>
            {formatCurrency(tension.activeQuoteTotal)}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          {noBudget ? (
            <span className="text-xs text-muted-foreground italic" data-testid={`tension-budget-amount-${tension.scopeId}`}>
              No budget
            </span>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground" data-testid={`tension-budget-amount-${tension.scopeId}`}>
              {formatCurrency(tension.budgetAmount)}
            </span>
          )}
        </div>
      </div>
      {noBudget ? (
        <div className="relative h-2 w-full rounded-full border border-dashed border-border" data-testid="tension-bar-empty" />
      ) : (
        <TensionBar ratio={tension.ratio} isOver={isOver} />
      )}
      {!noBudget && tension.delta !== 0 && (
        <div className={cn(
          "flex items-center gap-0.5 text-[10px]",
          isOver ? "text-destructive" : "text-status-approved"
        )}>
          {isOver ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          <span className="tabular-nums">
            {formatCurrency(absDelta)} {isOver ? 'over' : 'remaining'}
          </span>
        </div>
      )}
    </div>
  );
}

export function BudgetTensionStrip({ quotes, scopeNames }: BudgetTensionStripProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { projectId, isReadOnly } = useProject();
  const { formatCurrency } = useFormatters();
  const scopeTree = useScopeTreeData(projectId, isReadOnly);

  const { data: budgetResponse } = useQuery({
    queryKey: queryKeys.budget(projectId),
    queryFn: () => budgetApi.get(projectId),
    enabled: !!projectId,
  });

  const directCostScopeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of scopeTree.nodes) {
      if (node.costType === 'direct') {
        ids.add(node.id);
      }
    }
    return ids;
  }, [scopeTree.nodes]);

  const allocations = budgetResponse?.allocations || [];

  const scopeBudgetMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const alloc of allocations) {
      const target = alloc.target as { type: string; scopeId?: string } | null;
      if (target?.type === 'scope' && target.scopeId) {
        const existing = map.get(target.scopeId) || 0;
        map.set(target.scopeId, existing + alloc.amount);
      }
    }
    return map;
  }, [allocations]);

  const activeQuoteTotalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const quote of quotes) {
      if (!quote.scopeId) continue;
      const version = quote.versions.find(v =>
        v.extractionStatus === 'verified' &&
        (v.commitmentStatus === 'active' || v.commitmentStatus === 'accepted')
      );
      if (version) {
        const amount = quote.financials?.grossAmount ?? version.total ?? 0;
        const existing = map.get(quote.scopeId) || 0;
        map.set(quote.scopeId, existing + amount);
      }
    }
    return map;
  }, [quotes]);

  const tensions = useMemo(() => {
    const result: ScopeTension[] = [];
    const allScopeIds = Array.from(new Set([...Array.from(scopeBudgetMap.keys()), ...Array.from(activeQuoteTotalMap.keys())]));

    for (const scopeId of allScopeIds) {
      const budgetAmount = scopeBudgetMap.get(scopeId) || 0;
      const isDirectCost = directCostScopeIds.has(scopeId);
      const activeQuoteTotal = isDirectCost ? 0 : (activeQuoteTotalMap.get(scopeId) || 0);

      if (budgetAmount === 0 && activeQuoteTotal === 0) continue;

      const delta = isDirectCost ? 0 : budgetAmount - activeQuoteTotal;
      const ratio = isDirectCost ? 1 : (budgetAmount > 0 ? activeQuoteTotal / budgetAmount : (activeQuoteTotal > 0 ? 1.5 : 0));

      result.push({
        scopeId,
        scopeName: scopeNames.get(scopeId) || 'Unknown Scope',
        budgetAmount,
        activeQuoteTotal,
        delta,
        ratio,
        isDirectCost,
      });
    }

    result.sort((a, b) => {
      if (a.isDirectCost !== b.isDirectCost) return a.isDirectCost ? 1 : -1;
      return a.scopeName.localeCompare(b.scopeName);
    });
    return result;
  }, [scopeBudgetMap, activeQuoteTotalMap, scopeNames, directCostScopeIds]);

  const cumulative = useMemo(() => {
    const standardTensions = tensions.filter(t => !t.isDirectCost);
    const directCostTotal = tensions.filter(t => t.isDirectCost).reduce((sum, t) => sum + t.budgetAmount, 0);
    const totalBudget = standardTensions.reduce((sum, t) => sum + t.budgetAmount, 0);
    const totalQuotes = standardTensions.reduce((sum, t) => sum + t.activeQuoteTotal, 0);
    const delta = totalBudget - totalQuotes;
    const ratio = totalBudget > 0 ? totalQuotes / totalBudget : (totalQuotes > 0 ? 1.5 : 0);
    return { totalBudget, totalQuotes, delta, ratio, directCostTotal };
  }, [tensions]);

  if (tensions.length === 0) return null;

  const isOver = cumulative.delta < 0;
  const absDelta = Math.abs(cumulative.delta);
  const hasBudget = cumulative.totalBudget > 0;
  const pct = hasBudget
    ? Math.round((cumulative.totalQuotes / cumulative.totalBudget) * 100)
    : null;

  return (
    <div
      className="rounded-lg border border-border bg-background/80 backdrop-blur-sm overflow-hidden"
      data-testid="budget-tension-strip"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors"
        data-testid="tension-strip-toggle"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground">Budget Tension</span>
          <span className="text-xs text-muted-foreground" data-testid="tension-scope-count">
            {tensions.length} {tensions.length === 1 ? 'scope' : 'scopes'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs tabular-nums font-medium text-foreground" data-testid="tension-total-quotes">
              {formatCurrency(cumulative.totalQuotes)}
            </span>
            <span className="text-xs text-muted-foreground">of</span>
            <span className="text-xs tabular-nums text-muted-foreground" data-testid="tension-total-budget">
              {formatCurrency(cumulative.totalBudget)}
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums",
            !hasBudget
              ? "bg-muted text-muted-foreground"
              : isOver
                ? "bg-destructive/10 text-destructive"
                : "bg-status-approved/10 text-status-approved"
          )} data-testid="tension-summary-badge">
            {!hasBudget ? (
              <Minus className="h-3 w-3" />
            ) : isOver ? (
              <TrendingUp className="h-3 w-3" />
            ) : cumulative.delta === 0 ? (
              <Minus className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {pct !== null ? `${pct}%` : 'No budget'}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          <div className="pt-3 flex flex-col gap-1" data-testid="tension-cumulative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Quotes vs Budget
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm tabular-nums font-semibold text-foreground">
                  {formatCurrency(cumulative.totalQuotes)}
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(cumulative.totalBudget)}
                </span>
              </div>
            </div>
            <TensionBar ratio={cumulative.ratio} isOver={isOver} />
            {cumulative.delta !== 0 && (
              <div className={cn(
                "flex items-center gap-0.5 text-[10px]",
                isOver ? "text-destructive" : "text-status-approved"
              )}>
                {isOver ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                <span className="tabular-nums">
                  {formatCurrency(absDelta)} {isOver ? 'over budget' : 'remaining'}
                </span>
              </div>
            )}
            {cumulative.directCostTotal > 0 && (
              <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-border/30">
                <div className="flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Direct costs (locked)</span>
                </div>
                <span className="text-xs tabular-nums font-medium text-foreground" data-testid="tension-direct-cost-total">
                  {formatCurrency(cumulative.directCostTotal)}
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-border/50" />

          <div className="space-y-3" data-testid="tension-scope-list">
            {tensions.map(tension => (
              <ScopeTensionRow
                key={tension.scopeId}
                tension={tension}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
