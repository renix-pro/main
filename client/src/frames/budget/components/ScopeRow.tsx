/**
 * RENIX vNext — Scope Row
 * 
 * Canon v1.4 Compliant
 * Displays a scope with its allocations in the Budget Frame.
 * RENIX design tokens.
 */

import { useFormatters } from '@/context/ProjectContext';
import type { BudgetAllocation } from '../useBudgetData';

interface ScopeRowProps {
  scopeId: string;
  scopeName: string;
  optionality?: 'required' | 'optional' | 'aspirational';
  allocations: BudgetAllocation[];
  isReadOnly: boolean;
  onEditAllocation: (allocation: BudgetAllocation) => void;
  onDeleteAllocation: (allocation: BudgetAllocation) => void;
  onAllocate: (scopeId: string, scopeName: string) => void;
}

export function ScopeRow({
  scopeId,
  scopeName,
  optionality,
  allocations,
  isReadOnly,
  onEditAllocation,
  onDeleteAllocation,
  onAllocate,
}: ScopeRowProps) {
  const { formatCurrency } = useFormatters();
  const hasAllocations = allocations.length > 0;
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div 
      className="renix-surface p-4"
      data-testid={`scope-row-${scopeId}`}
      data-scope-row-id={scopeId}
    >
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <span className="font-semibold" data-testid={`scope-name-${scopeId}`}>
            {scopeName}
          </span>
          {optionality && optionality !== 'required' && (
            <span className="ml-2 text-xs uppercase tracking-wide border border-subtle px-2 py-0.5">
              {optionality}
            </span>
          )}
        </div>
        {hasAllocations && (
          <span className="text-sm font-semibold tabular-nums" data-testid={`scope-total-${scopeId}`}>
            {formatCurrency(totalAllocated)}
          </span>
        )}
      </div>

      {hasAllocations ? (
        <div className="space-y-2">
          {allocations.map(allocation => (
            <div 
              key={allocation.id}
              className="flex items-center justify-between gap-4 py-2 border-t border-subtle group"
              data-testid={`allocation-row-${allocation.id}`}
              data-allocation-id={allocation.id}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm" data-testid={`allocation-label-${allocation.id}`}>
                  {allocation.label}
                </span>
                {allocation.notes && (
                  <p className="text-xs text-secondary mt-0.5 truncate">
                    {allocation.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold tabular-nums" data-testid={`allocation-amount-${allocation.id}`}>
                  {formatCurrency(allocation.amount)}
                </span>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEditAllocation(allocation)}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                      data-testid={`button-edit-allocation-${allocation.id}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteAllocation(allocation)}
                      className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors"
                      data-testid={`button-delete-allocation-${allocation.id}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 py-2 border-t border-subtle">
          <span className="text-xs uppercase tracking-wide border border-subtle px-2 py-1">
            Not allocated
          </span>
          {!isReadOnly && (
            <button
              onClick={() => onAllocate(scopeId, scopeName)}
              className="text-sm underline-offset-2 hover:underline"
              data-testid={`button-allocate-${scopeId}`}
            >
              Allocate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
