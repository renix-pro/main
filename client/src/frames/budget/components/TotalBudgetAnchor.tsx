/**
 * RENIX vNext — Total Budget Anchor
 * 
 * Canon v1.4 Compliant
 * Large number display with edit action.
 * RENIX design tokens.
 */

import { useFormatters } from '@/context/ProjectContext';

interface TotalBudgetAnchorProps {
  totalBudget: number | null;
  isReadOnly: boolean;
  onEdit: () => void;
}

export function TotalBudgetAnchor({ totalBudget, isReadOnly, onEdit }: TotalBudgetAnchorProps) {
  const { formatCurrency } = useFormatters();

  return (
    <section 
      className="border-b border-subtle pb-4"
      data-testid="budget-total-anchor"
    >
      <div className="text-4xl font-semibold tabular-nums" data-testid="text-total-budget">
        {totalBudget !== null ? formatCurrency(totalBudget) : '—'}
      </div>
      <div className="mt-2 text-sm">
        <span>Total budget intent</span>
        {!isReadOnly && (
          <>
            <span className="mx-2">·</span>
            <button
              onClick={onEdit}
              className="underline-offset-2 hover:underline focus:outline focus:outline-1 focus:outline-current"
              data-testid="button-edit-total-budget"
            >
              Edit total budget
            </button>
          </>
        )}
      </div>
    </section>
  );
}
