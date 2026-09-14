/**
 * RENIX vNext — Financing Work Surface
 * 
 * Canon v1.4 Compliant — Authoritative
 * 
 * Editable sections for each financing source.
 * This is the ONLY place editing occurs.
 * 
 * Styling: RENIX design tokens.
 */

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

interface WorkSurfaceProps {
  sources: FinancingSource[];
  isReadOnly: boolean;
  onEdit: (source: FinancingSource) => void;
  onDelete: (source: FinancingSource) => void;
}

export function WorkSurface({ sources, isReadOnly, onEdit, onDelete }: WorkSurfaceProps) {
  const { formatCurrency } = useFormatters();

  if (sources.length === 0) {
    return null;
  }

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-lg font-medium">
        Source Details
      </h2>
      
      {sources.map(source => (
        <div
          key={source.id}
          id={`source-detail-${source.id}`}
          className="renix-surface"
          data-testid={`source-section-${source.id}`}
          data-source-id={source.id}
        >
          <div className="p-4 border-b border-subtle flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <h3
                className="text-base font-medium"
                data-testid={`text-source-name-${source.id}`}
              >
                {source.name}
              </h3>
              <div className="flex gap-4 mt-1 text-sm">
                <span>{TYPE_LABELS[source.type]}</span>
                <span>{STATUS_LABELS[source.status]}</span>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-xl font-semibold tabular-nums"
                data-testid={`text-source-amount-${source.id}`}
              >
                {formatCurrency(source.amount)}
              </div>
              {source.type === 'loan' && source.monthlyCost !== null && (
                <div
                  className="text-sm mt-1"
                  data-testid={`text-source-monthly-${source.id}`}
                >
                  Monthly impact: {formatCurrency(source.monthlyCost)}
                </div>
              )}
            </div>
          </div>

          {source.notes && (
            <div className="p-4 space-y-2 text-sm">
              <div data-testid={`text-source-notes-${source.id}`}>
                <span className="font-medium">Notes: </span>
                {source.notes}
              </div>
            </div>
          )}

          {!isReadOnly && (
            <div className="p-4 border-t border-subtle flex gap-4">
              <button
                onClick={() => onEdit(source)}
                className="text-sm underline"
                data-testid={`button-edit-source-${source.id}`}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(source)}
                className="text-sm underline"
                data-testid={`button-delete-source-${source.id}`}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
