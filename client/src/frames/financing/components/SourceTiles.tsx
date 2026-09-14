/**
 * RENIX vNext — Self-Describing Source Tiles
 * 
 * Each tile displays ALL critical information without hover:
 * - Source Name
 * - Financing Type (Loan/Grant/Equity)
 * - Amount Confirmed
 * - Status (Planned/Confirmed)
 * - Monthly Liability (only if present)
 * 
 * No critical info hidden behind hover.
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFormatters } from '../../../context/ProjectContext';
import type { FinancingSource, FinancingType, FinancingStatus } from '../useFinancingData';

const TYPE_LABELS: Record<FinancingType, string> = {
  equity: 'Equity',
  loan: 'Loan',
  grant: 'Grant',
  other: 'Other',
};

const STATUS_LABELS: Record<FinancingStatus, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
};

interface SourceTilesProps {
  sources: FinancingSource[];
  isReadOnly: boolean;
  onSelectSource: (sourceId: string) => void;
  onToggleStatus: (sourceId: string, newStatus: FinancingStatus) => void;
  onAddSource?: () => void;
}

export function SourceTiles({ 
  sources, 
  isReadOnly, 
  onSelectSource, 
  onToggleStatus,
  onAddSource 
}: SourceTilesProps) {
  const { formatCurrency } = useFormatters();

  const handleToggle = (e: React.MouseEvent, source: FinancingSource) => {
    e.stopPropagation();
    const newStatus: FinancingStatus = source.status === 'confirmed' ? 'planned' : 'confirmed';
    onToggleStatus(source.id, newStatus);
  };

  return (
    <section data-testid="source-tiles-section">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-medium">
          Financing Sources {sources.length > 0 && `(${sources.length})`}
        </h2>
        {!isReadOnly && onAddSource && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSource}
            data-testid="button-add-source"
          >
            Add Source
          </Button>
        )}
      </div>

      {sources.length === 0 ? (
        <Card className="p-6 text-center" data-testid="sources-empty">
          <div className="text-muted-foreground mb-2">No financing sources defined</div>
          {!isReadOnly && onAddSource && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddSource}
              data-testid="button-add-first-source"
            >
              Add First Source
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map(source => (
            <Card 
              key={source.id}
              className="p-4"
              data-testid={`source-tile-${source.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => onSelectSource(source.id)}
                    className="text-left hover:underline w-full"
                    data-testid={`source-tile-link-${source.id}`}
                  >
                    <div className="font-medium truncate" data-testid={`source-name-${source.id}`}>
                      {source.name}
                    </div>
                  </button>
                </div>
                <Badge 
                  variant="secondary" 
                  className="flex-shrink-0"
                  data-testid={`source-type-badge-${source.id}`}
                >
                  {TYPE_LABELS[source.type]}
                </Badge>
              </div>

              <div 
                className="text-2xl font-semibold tabular-nums mb-3"
                data-testid={`source-amount-${source.id}`}
              >
                {formatCurrency(source.amount)}
              </div>

              {source.type === 'loan' && source.monthlyCost !== null && (
                <div 
                  className="text-sm text-muted-foreground mb-3"
                  data-testid={`source-monthly-${source.id}`}
                >
                  Monthly liability: {formatCurrency(source.monthlyCost)}
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                {!isReadOnly ? (
                  <button
                    onClick={(e) => handleToggle(e, source)}
                    className={`text-xs px-2.5 py-1 border ${
                      source.status === 'confirmed' 
                        ? 'bg-foreground text-background border-foreground' 
                        : 'border-border hover-elevate'
                    }`}
                    data-testid={`source-status-toggle-${source.id}`}
                  >
                    {STATUS_LABELS[source.status]}
                  </button>
                ) : (
                  <Badge 
                    variant={source.status === 'confirmed' ? 'default' : 'secondary'}
                    data-testid={`source-status-badge-${source.id}`}
                  >
                    {STATUS_LABELS[source.status]}
                  </Badge>
                )}
              </div>

              {source.notes && (
                <div 
                  className="text-xs text-muted-foreground mt-3 line-clamp-2"
                  data-testid={`source-notes-${source.id}`}
                >
                  {source.notes}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
