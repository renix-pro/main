/**
 * RENIX vNext — Expected Cost Stack Chart
 * 
 * Stacked bar showing cost certainty breakdown:
 * - Quote-backed costs (higher certainty)
 * - Budget-backed costs (planning intent)
 * 
 * FINANCING FRAME: PRE-EXECUTION ONLY
 * Invoices are OUT OF SCOPE for this frame.
 * 
 * Label: "Cost certainty, not funding allocation"
 * 
 * No red/green moral validation. Pure information display.
 */

import { Card } from '@/components/ui/card';
import { useFormatters } from '../../../context/ProjectContext';
import type { ResolvedCostDemandResult } from '../useFinancingData';

interface CostResolutionStackChartProps {
  resolvedCostDemand: ResolvedCostDemandResult | null;
  isLoading: boolean;
}

export function CostResolutionStackChart({ resolvedCostDemand, isLoading }: CostResolutionStackChartProps) {
  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <Card className="p-4" data-testid="cost-stack-loading">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </Card>
    );
  }

  if (!resolvedCostDemand) {
    return (
      <Card className="p-4" data-testid="cost-stack-empty">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Expected Cost Stack
        </div>
        <div className="h-10 bg-muted/30 border border-dashed border-border flex items-center justify-center">
          <span className="text-sm text-muted-foreground">No cost data available</span>
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          Pre-execution planning: quotes + remaining budget intent
        </div>
      </Card>
    );
  }

  const { totalResolvedCost, breakdown } = resolvedCostDemand;
  
  // Only show quote-backed and budget-backed (NO invoices)
  const quotePct = totalResolvedCost > 0 ? (breakdown.quoteBacked / totalResolvedCost) * 100 : 0;
  const budgetPct = totalResolvedCost > 0 ? (breakdown.budgetBacked / totalResolvedCost) * 100 : 0;
  const directCostPct = totalResolvedCost > 0 ? ((breakdown.directCostBacked || 0) / totalResolvedCost) * 100 : 0;

  return (
    <Card className="p-4" data-testid="cost-resolution-stack">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Expected Cost Stack
        </div>
        <div className="text-sm font-medium tabular-nums">
          {formatCurrency(totalResolvedCost)}
        </div>
      </div>

      <div 
        className="h-10 w-full flex overflow-hidden border border-border"
        data-testid="cost-stack-bar"
      >
        {quotePct > 0 && (
          <div
            className="h-full bg-foreground flex items-center justify-center transition-all duration-300"
            style={{ width: `${quotePct}%` }}
            data-testid="stack-quote-bar"
          >
            {quotePct > 12 && (
              <span className="text-xs font-medium text-background px-1 truncate">
                {Math.round(quotePct)}%
              </span>
            )}
          </div>
        )}
        {budgetPct > 0 && (
          <div
            className="h-full bg-muted flex items-center justify-center transition-all duration-300"
            style={{ width: `${budgetPct}%` }}
            data-testid="stack-budget-bar"
          >
            {budgetPct > 12 && (
              <span className="text-xs font-medium text-muted-foreground px-1 truncate">
                {Math.round(budgetPct)}%
              </span>
            )}
          </div>
        )}
        {directCostPct > 0 && (
          <div
            className="h-full bg-foreground/60 flex items-center justify-center transition-all duration-300"
            style={{ width: `${directCostPct}%` }}
            data-testid="stack-direct-cost-bar"
          >
            {directCostPct > 12 && (
              <span className="text-xs font-medium text-background px-1 truncate">
                {Math.round(directCostPct)}%
              </span>
            )}
          </div>
        )}
        {totalResolvedCost === 0 && (
          <div className="h-full w-full bg-muted/30 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No expected costs</span>
          </div>
        )}
      </div>

      <div className={`mt-4 grid gap-3 text-xs ${directCostPct > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="flex items-center gap-2" data-testid="legend-quote">
          <div className="w-3 h-3 bg-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">Quote-backed</div>
            <div className="text-muted-foreground tabular-nums">{formatCurrency(breakdown.quoteBacked)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2" data-testid="legend-budget">
          <div className="w-3 h-3 bg-muted border border-border flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">Budget-backed</div>
            <div className="text-muted-foreground tabular-nums">{formatCurrency(breakdown.budgetBacked)}</div>
          </div>
        </div>
        {directCostPct > 0 && (
          <div className="flex items-center gap-2" data-testid="legend-direct-cost">
            <div className="w-3 h-3 bg-foreground/60 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-medium truncate">Direct cost</div>
              <div className="text-muted-foreground tabular-nums">{formatCurrency(breakdown.directCostBacked)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border space-y-1" data-testid="cost-stack-interpretation">
        <div className="font-medium text-foreground">What this shows:</div>
        <div>
          {quotePct === 0 && budgetPct > 0 && (
            <span>
              All expected cost ({formatCurrency(breakdown.budgetBacked)}) is still budget-based. 
              This represents higher uncertainty until quotes are obtained.
            </span>
          )}
          {quotePct > 0 && budgetPct > 0 && (
            <span>
              {Math.round(quotePct)}% of expected cost is backed by supplier quotes. 
              The remaining {Math.round(budgetPct)}% is budget intent, still uncertain.
            </span>
          )}
          {quotePct === 100 && budgetPct === 0 && (
            <span>
              All expected cost is backed by quotes from suppliers, 
              providing higher certainty on actual amounts.
            </span>
          )}
          {totalResolvedCost === 0 && (
            <span>
              No expected costs have been defined. Add budget allocations or quotes to see cost breakdown.
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
