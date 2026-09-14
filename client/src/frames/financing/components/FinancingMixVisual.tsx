/**
 * RENIX vNext — Financing Mix Visual (Zone1B)
 * 
 * Canon v1.4 Compliant — CFS Zone1B Primary Visual
 * 
 * Displays the mix/distribution of financing sources.
 * Shows confirmed vs planned distribution as a horizontal stacked bar.
 * 
 * Styling: RENIX design tokens - clean monochrome aesthetic.
 */

import { useFormatters } from '../../../context/ProjectContext';
import type { FinancingSource } from '../useFinancingData';

interface FinancingMixVisualProps {
  sources: FinancingSource[];
  totalConfirmed: number;
  totalPlanned: number;
}

export function FinancingMixVisual({
  sources,
  totalConfirmed,
  totalPlanned,
}: FinancingMixVisualProps) {
  const { formatCurrency } = useFormatters();
  const total = totalConfirmed + totalPlanned;

  if (sources.length === 0) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-6"
        data-testid="financing-mix-empty"
      >
        <div className="text-center space-y-2">
          <div className="text-2xl text-muted-foreground/50">—</div>
          <span className="text-sm text-muted-foreground">No financing sources defined</span>
        </div>
      </div>
    );
  }

  const confirmedPct = total > 0 ? (totalConfirmed / total) * 100 : 0;
  const plannedPct = total > 0 ? (totalPlanned / total) * 100 : 0;

  const confirmedSources = sources.filter(s => s.status === 'confirmed');
  const plannedSources = sources.filter(s => s.status === 'planned');

  return (
    <div
      className="w-full h-full flex flex-col justify-center p-4 space-y-6"
      data-testid="financing-mix-visual"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Financing Mix</span>
          <span className="font-medium">{formatCurrency(total)}</span>
        </div>
        
        <div
          className="h-8 w-full flex overflow-hidden border border-border"
          data-testid="mix-bar-container"
        >
          {confirmedPct > 0 && (
            <div
              className="h-full bg-foreground flex items-center justify-center transition-all duration-300"
              style={{ width: `${confirmedPct}%` }}
              data-testid="mix-confirmed-bar"
            >
              {confirmedPct > 15 && (
                <span className="text-xs font-medium text-background px-1 truncate">
                  {Math.round(confirmedPct)}%
                </span>
              )}
            </div>
          )}
          {plannedPct > 0 && (
            <div
              className="h-full bg-muted flex items-center justify-center transition-all duration-300 border-l border-border"
              style={{ width: `${plannedPct}%` }}
              data-testid="mix-planned-bar"
            >
              {plannedPct > 15 && (
                <span className="text-xs font-medium text-muted-foreground px-1 truncate">
                  {Math.round(plannedPct)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-foreground" />
            <span className="text-sm">Confirmed</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium tabular-nums">
              {formatCurrency(totalConfirmed)}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ({confirmedSources.length} source{confirmedSources.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted border border-border" />
            <span className="text-sm">Planned</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium tabular-nums">
              {formatCurrency(totalPlanned)}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              ({plannedSources.length} source{plannedSources.length !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">Sources by Type</div>
          <div className="flex flex-wrap gap-2">
            {['equity', 'loan', 'grant', 'other'].map(type => {
              const typeSources = sources.filter(s => s.type === type);
              if (typeSources.length === 0) return null;
              const typeTotal = typeSources.reduce((sum, s) => sum + s.amount, 0);
              return (
                <div
                  key={type}
                  className="px-2 py-1 text-xs border border-border bg-muted/30"
                  data-testid={`type-badge-${type}`}
                >
                  <span className="capitalize">{type}</span>
                  <span className="ml-1 text-muted-foreground">
                    {formatCurrency(typeTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
