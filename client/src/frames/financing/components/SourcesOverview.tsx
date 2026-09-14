/**
 * RENIX vNext — Financing Sources Overview
 * 
 * Canon v1.4 Compliant — Authoritative
 * 
 * Fast scanning navigation to sources.
 * Grid on desktop, list on mobile.
 * 
 * Each tile includes a status toggle (Planned/Confirmed).
 * Clicking the tile scrolls to WorkSurface section.
 * 
 * Styling: RENIX design tokens.
 */

import { useFormatters } from '../../../context/ProjectContext';
import type { FinancingSource, FinancingStatus } from '../useFinancingData';

const STATUS_LABELS: Record<FinancingStatus, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
};

interface SourcesOverviewProps {
  sources: FinancingSource[];
  isReadOnly: boolean;
  onSelectSource: (sourceId: string) => void;
  onToggleStatus: (sourceId: string, newStatus: FinancingStatus) => void;
}

export function SourcesOverview({ sources, isReadOnly, onSelectSource, onToggleStatus }: SourcesOverviewProps) {
  const { formatCurrency } = useFormatters();

  if (sources.length === 0) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent, source: FinancingSource) => {
    e.stopPropagation();
    const newStatus: FinancingStatus = source.status === 'confirmed' ? 'planned' : 'confirmed';
    onToggleStatus(source.id, newStatus);
  };

  return (
    <section className="max-w-6xl mx-auto">
      <h2 className="text-lg font-medium mb-4">
        Financing Sources ({sources.length})
      </h2>
      
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4">
        {sources.map(source => (
          <div
            key={source.id}
            className="renix-surface p-4"
            data-testid={`source-tile-${source.id}`}
          >
            <button
              onClick={() => onSelectSource(source.id)}
              className="w-full text-left hover:underline"
              data-testid={`source-tile-link-${source.id}`}
            >
              <div className="text-sm font-medium truncate">
                {source.name}
              </div>
              <div className="text-lg font-semibold tabular-nums mt-1">
                {formatCurrency(source.amount)}
              </div>
              {source.type === 'loan' && source.monthlyCost !== null && (
                <div className="text-xs mt-1">
                  Monthly impact: {formatCurrency(source.monthlyCost)}
                </div>
              )}
            </button>
            
            <div className="mt-3 flex items-center justify-between gap-2">
              {!isReadOnly ? (
                <button
                  onClick={(e) => handleToggle(e, source)}
                  className={`text-xs px-2 py-1 border border-subtle ${
                    source.status === 'confirmed' 
                      ? 'btn-primary' 
                      : ''
                  }`}
                  data-testid={`source-toggle-${source.id}`}
                >
                  {STATUS_LABELS[source.status]}
                </button>
              ) : (
                <span className="text-xs">
                  {STATUS_LABELS[source.status]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        {sources.map(source => (
          <div
            key={source.id}
            className="w-full renix-surface p-4"
            data-testid={`source-list-${source.id}`}
          >
            <button
              onClick={() => onSelectSource(source.id)}
              className="w-full text-left flex justify-between items-start hover:underline"
              data-testid={`source-list-link-${source.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {source.name}
                </div>
                {source.type === 'loan' && source.monthlyCost !== null && (
                  <div className="text-xs mt-1">
                    Monthly impact: {formatCurrency(source.monthlyCost)}
                  </div>
                )}
              </div>
              <div className="text-lg font-semibold tabular-nums ml-4">
                {formatCurrency(source.amount)}
              </div>
            </button>
            
            <div className="mt-3 flex items-center gap-2">
              {!isReadOnly ? (
                <button
                  onClick={(e) => handleToggle(e, source)}
                  className={`text-xs px-2 py-1 border border-subtle ${
                    source.status === 'confirmed' 
                      ? 'btn-primary' 
                      : ''
                  }`}
                  data-testid={`source-toggle-mobile-${source.id}`}
                >
                  {STATUS_LABELS[source.status]}
                </button>
              ) : (
                <span className="text-xs">
                  {STATUS_LABELS[source.status]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
