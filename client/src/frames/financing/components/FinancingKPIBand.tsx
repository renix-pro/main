import { MetricCard } from '@/components/tiles';
import { useFormatters } from '../../../context/ProjectContext';
import { GlossaryTerm } from '@/components/GlossaryTerm';
import { Card } from '@/components/ui/card';
import type { ResolvedCostDemandResult } from '../useFinancingData';

interface FinancingKPIBandProps {
  resolvedCostDemand: ResolvedCostDemandResult | null;
  isLoading: boolean;
}

export function FinancingKPIBand({ resolvedCostDemand, isLoading }: FinancingKPIBandProps) {
  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-band-loading">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!resolvedCostDemand) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-band-empty">
        <MetricCard label="Expected Cost" emptyText="—" statusTint="draft" />
        <MetricCard
          label="Confirmed Financing Capacity"
          emptyText="—"
          statusTint="approved"
        />
        <MetricCard label="Coverage Delta" emptyText="—" />
        <MetricCard label="Monthly Liability" emptyText="—" statusTint="pending" />
      </div>
    );
  }

  const { 
    totalResolvedCost, 
    breakdown, 
    confirmedFinancingCapacity, 
    coverageDelta,
    monthlyLiabilityTotal,
    hasFinancingGap 
  } = resolvedCostDemand;

  const isNegativeDelta = coverageDelta < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-band">
      <MetricCard
        label="Expected Cost"
        value={formatCurrency(totalResolvedCost)}
        statusTint="draft"
      >
        <div className="space-y-1 text-xs text-muted-foreground" data-testid="kpi-cost-breakdown">
          <div className="flex justify-between gap-2">
            <span>Quote-backed</span>
            <span className="tabular-nums font-medium">{formatCurrency(breakdown.quoteBacked)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Budget-backed</span>
            <span className="tabular-nums font-medium">{formatCurrency(breakdown.budgetBacked)}</span>
          </div>
          {(breakdown.directCostBacked || 0) > 0 && (
            <div className="flex justify-between gap-2">
              <span>Direct cost</span>
              <span className="tabular-nums font-medium">{formatCurrency(breakdown.directCostBacked)}</span>
            </div>
          )}
          {(breakdown.contingencyAmount || 0) > 0 && (
            <div className="flex justify-between gap-2">
              <span>Contingency</span>
              <span className="tabular-nums font-medium">{formatCurrency(breakdown.contingencyAmount)}</span>
            </div>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground/70 italic">
          Pre-execution planning only
        </div>
      </MetricCard>

      <MetricCard
        label="Confirmed Financing Capacity"
        value={formatCurrency(confirmedFinancingCapacity)}
        statusTint="approved"
      >
        <div className="text-xs text-muted-foreground">
          Sum of confirmed sources only
        </div>
      </MetricCard>

      <MetricCard
        label="Coverage Delta"
        value={`${coverageDelta >= 0 ? '+' : ''}${formatCurrency(coverageDelta)}`}
        statusTint={isNegativeDelta ? 'declined' : 'approved'}
        className={isNegativeDelta ? 'border-2 border-foreground' : undefined}
      >
        {hasFinancingGap && (
          <div className="space-y-1">
            <div 
              className="text-sm font-semibold"
              data-testid="kpi-gap-warning"
            >
              This plan is currently not fundable
            </div>
            <div className="text-xs text-muted-foreground" data-testid="kpi-coverage-percent">
              {totalResolvedCost > 0 
                ? `Confirmed financing covers ${Math.round((confirmedFinancingCapacity / totalResolvedCost) * 100)}% of expected cost`
                : 'No expected cost defined'}
            </div>
          </div>
        )}
        {!hasFinancingGap && coverageDelta > 0 && (
          <div className="text-xs text-muted-foreground">
            Confirmed financing covers expected cost
          </div>
        )}
        {!hasFinancingGap && coverageDelta === 0 && (
          <div className="text-xs text-muted-foreground">
            Confirmed financing exactly matches expected cost
          </div>
        )}
      </MetricCard>

      <MetricCard
        label="Monthly Liability"
        value={monthlyLiabilityTotal > 0 ? formatCurrency(monthlyLiabilityTotal) : undefined}
        emptyText="—"
        statusTint="pending"
      >
        <div className="text-xs text-muted-foreground">
          {monthlyLiabilityTotal > 0
            ? 'Sum of all loan repayments'
            : 'No loan liabilities recorded'}
        </div>
        {monthlyLiabilityTotal > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(monthlyLiabilityTotal * 12)}/year
          </div>
        )}
      </MetricCard>
    </div>
  );
}
