/**
 * RENIX vNext — Financing Orientation Layer
 * 
 * Canon v1.4 Compliant — Authoritative
 * 
 * Above-the-fold orientation that answers "Where do I stand?"
 * 
 * Contains:
 * - FinancingHeader
 * - OrientationTiles (3 tiles)
 * 
 * Styling: RENIX design tokens.
 */

import { Button } from '@/components/ui/button';
import { useFormatters } from '../../../context/ProjectContext';
import { GlossaryTerm } from '@/components/GlossaryTerm';

interface OrientationLayerProps {
  totalFinancingPotential: number;
  totalConfirmed: number;
  totalPlanned: number;
  budgetTotal: number | null;
  isReadOnly: boolean;
  onAddSource: () => void;
}

export function OrientationLayer({
  totalFinancingPotential,
  totalConfirmed,
  totalPlanned,
  budgetTotal,
  isReadOnly,
  onAddSource,
}: OrientationLayerProps) {
  const { formatCurrency } = useFormatters();

  const getCoverageText = () => {
    if (budgetTotal === null || budgetTotal === 0) {
      return 'No budget intent set';
    }
    const gap = budgetTotal - totalFinancingPotential;
    if (gap > 0) {
      return `Funding gap of ${formatCurrency(gap)} vs current budget intent`;
    } else if (gap < 0) {
      return `Financing exceeds budget by ${formatCurrency(Math.abs(gap))}`;
    }
    return 'Financing covers current budget intent';
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-semibold"
            data-testid="text-financing-title"
          >
            Financing
          </h1>
          <p className="text-sm mt-1">
            Project funding sources and status
          </p>
        </div>
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSource}
            data-testid="button-add-source"
          >
            Add Source
          </Button>
        )}
      </header>

      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
        <div
          className="renix-surface p-4"
          data-testid="tile-total-financing"
        >
          <div className="text-sm mb-2">
            Total Financing Potential
          </div>
          <div
            className="text-2xl font-semibold tabular-nums"
            data-testid="text-total-financing"
          >
            {formatCurrency(totalFinancingPotential)}
          </div>
          <div className="text-xs mt-2">
            Confirmed + Planned
          </div>
        </div>

        <div
          className="renix-surface p-4"
          data-testid="tile-funding-coverage"
        >
          <div className="text-sm mb-2">
            Funding Coverage
          </div>
          <div
            className="text-sm"
            data-testid="text-funding-coverage"
          >
            {getCoverageText()}
          </div>
        </div>

        <div
          className="renix-surface p-4"
          data-testid="tile-funding-assumptions"
        >
          <div className="text-sm mb-2">
            Funding Assumptions
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <GlossaryTerm term="confirmed-financing"><span>Confirmed:</span></GlossaryTerm>
              <span
                className="tabular-nums font-medium"
                data-testid="text-confirmed-total"
              >
                {formatCurrency(totalConfirmed)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <GlossaryTerm term="planned-financing"><span>Planned:</span></GlossaryTerm>
              <span
                className="tabular-nums font-medium"
                data-testid="text-planned-total"
              >
                {formatCurrency(totalPlanned)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
