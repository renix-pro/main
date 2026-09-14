/**
 * RENIX vNext — Financing vs Expected Cost Comparison Chart
 * 
 * Two horizontal bars comparing:
 * - Confirmed financing capacity
 * - Expected cost (pre-execution)
 * 
 * FINANCING FRAME: PRE-EXECUTION ONLY
 * Invoices are OUT OF SCOPE for this frame.
 * 
 * Purpose: "Can I fund what I am planning to do?"
 * 
 * No red/green moral validation. Pure information display.
 */

import { Card } from '@/components/ui/card';
import { useFormatters } from '../../../context/ProjectContext';
import type { ResolvedCostDemandResult } from '../useFinancingData';

interface FinancingComparisonChartProps {
  resolvedCostDemand: ResolvedCostDemandResult | null;
  isLoading: boolean;
}

export function FinancingComparisonChart({ resolvedCostDemand, isLoading }: FinancingComparisonChartProps) {
  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <Card className="p-4" data-testid="comparison-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="space-y-3">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (!resolvedCostDemand) {
    return (
      <Card className="p-4" data-testid="comparison-empty">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Financing vs Expected Cost
        </div>
        <div className="space-y-3">
          <div className="h-8 bg-muted/30 border border-dashed border-border" />
          <div className="h-8 bg-muted/30 border border-dashed border-border" />
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          Can I fund what I am planning to do?
        </div>
      </Card>
    );
  }

  const { totalResolvedCost, confirmedFinancingCapacity, hasFinancingGap } = resolvedCostDemand;
  
  const maxValue = Math.max(totalResolvedCost, confirmedFinancingCapacity, 1);
  const financingPct = (confirmedFinancingCapacity / maxValue) * 100;
  const costPct = (totalResolvedCost / maxValue) * 100;

  return (
    <Card className="p-4" data-testid="financing-comparison-chart">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
        Financing vs Expected Cost
      </div>

      <div className="space-y-4">
        <div data-testid="bar-confirmed-financing">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium">Confirmed Financing</span>
            <span className="text-sm tabular-nums">{formatCurrency(confirmedFinancingCapacity)}</span>
          </div>
          <div className="h-8 w-full bg-muted/30 border border-border overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${financingPct}%` }}
              data-testid="bar-financing-fill"
            />
          </div>
        </div>

        <div data-testid="bar-expected-cost">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium">Expected Cost</span>
            <span className="text-sm tabular-nums">{formatCurrency(totalResolvedCost)}</span>
          </div>
          <div className="h-8 w-full bg-muted/30 border border-border overflow-hidden">
            <div
              className="h-full bg-muted-foreground/60 transition-all duration-300"
              style={{ width: `${costPct}%` }}
              data-testid="bar-cost-fill"
            />
          </div>
        </div>
      </div>

      <div className={`mt-4 pt-3 border-t border-border text-sm ${hasFinancingGap ? 'font-semibold' : 'text-muted-foreground'}`}>
        {hasFinancingGap ? (
          <div className="space-y-1">
            <div data-testid="comparison-gap-message">
              Your current plan cannot be funded with confirmed financing
            </div>
            <div className="text-xs font-normal text-muted-foreground" data-testid="comparison-shortfall">
              Material shortfall: {formatCurrency(Math.abs(confirmedFinancingCapacity - totalResolvedCost))}
            </div>
          </div>
        ) : (
          <span data-testid="comparison-fundable-message">
            Confirmed financing covers expected cost
          </span>
        )}
      </div>
    </Card>
  );
}
