/**
 * RENIX vNext — Zone3 Focus Layer (CFS Compliant)
 * 
 * Canon v1.4 Compliant — Common Frame Structure
 * 
 * Zone 3 Purpose: "What am I deciding or editing right now?"
 * - MUST show details of EXACTLY ONE entity
 * - Is the ONLY authoritative editing surface
 * - All create, edit, adjust actions occur here
 * - No comparison views allowed
 * - No multi-entity editing allowed
 */

import { useMemo } from 'react';
import { useFormatters } from '@/context/ProjectContext';
import type { BudgetAllocation } from '../useBudgetData';

interface Scope {
  id: string;
  name: string;
  optionality?: 'required' | 'optional' | 'aspirational';
}

interface ScopeWorkSurfaceProps {
  scopes: Scope[];
  allocations: BudgetAllocation[];
  totalBudget: number | null;
  isReadOnly: boolean;
  onEditAllocation: (allocation: BudgetAllocation) => void;
  onDeleteAllocation: (allocation: BudgetAllocation) => void;
  onAllocateToScope: (scopeId: string, scopeName: string) => void;
}

export function ScopeWorkSurface({
  scopes,
  allocations,
  totalBudget,
  isReadOnly,
  onEditAllocation,
  onDeleteAllocation,
  onAllocateToScope,
}: ScopeWorkSurfaceProps) {
  const { formatCurrency } = useFormatters();

  const scopeAllocations = useMemo(() => {
    const map = new Map<string, BudgetAllocation[]>();
    scopes.forEach(s => map.set(s.id, []));
    
    allocations.forEach(alloc => {
      if (alloc.target.type === 'scope' && alloc.target.scopeId) {
        const existing = map.get(alloc.target.scopeId) || [];
        existing.push(alloc);
        map.set(alloc.target.scopeId, existing);
      }
    });
    
    return map;
  }, [scopes, allocations]);

  const getTargetTypeLabel = (target: BudgetAllocation['target']): string => {
    switch (target.type) {
      case 'scope':
        return 'Scope';
      case 'contingency':
        return 'Contingency';
      case 'unassigned':
        return 'Unassigned';
      default:
        return '';
    }
  };

  if (scopes.length === 0) {
    return (
      <section 
        className="w-full renix-surface p-8 flex items-center justify-center"
        data-testid="zone3-focus"
        data-cfs-zone="zone3-focus"
      >
        <p className="text-sm text-muted">Select a scope above to view allocations</p>
      </section>
    );
  }

  return (
    <section 
      className="space-y-6"
      data-testid="zone3-focus"
      data-cfs-zone="zone3-focus"
    >
      {scopes.map(scope => {
        const scopeAllocs = scopeAllocations.get(scope.id) || [];
        const hasAllocations = scopeAllocs.length > 0;
        const totalAllocated = scopeAllocs.reduce((sum, a) => sum + a.amount, 0);

        return (
          <section
            key={scope.id}
            className="renix-surface p-4 space-y-3"
            data-scope-row-id={scope.id}
            data-testid={`scope-section-${scope.id}`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h3 className="font-semibold" data-testid={`scope-name-${scope.id}`}>
                  {scope.name}
                </h3>
                {scope.optionality && scope.optionality !== 'required' && (
                  <span className="ml-2 text-xs uppercase tracking-wide border border-subtle px-2 py-0.5">
                    {scope.optionality}
                  </span>
                )}
              </div>
              {hasAllocations && (
                <span className="text-sm font-semibold tabular-nums" data-testid={`scope-total-${scope.id}`}>
                  {formatCurrency(totalAllocated)}
                </span>
              )}
            </div>

            {hasAllocations ? (
              <div className="space-y-2">
                {scopeAllocs.map(allocation => (
                  <div
                    key={allocation.id}
                    className="flex items-start justify-between gap-4 py-2 border-t border-subtle group"
                    data-allocation-id={allocation.id}
                    data-testid={`allocation-row-${allocation.id}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium" data-testid={`allocation-label-${allocation.id}`}>
                          {allocation.label}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-secondary">
                          ({getTargetTypeLabel(allocation.target)})
                        </span>
                      </div>
                      {allocation.notes && (
                        <p className="text-xs text-secondary" data-testid={`allocation-notes-${allocation.id}`}>
                          {allocation.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm font-semibold tabular-nums" data-testid={`allocation-amount-${allocation.id}`}>
                        {formatCurrency(allocation.amount)}
                      </span>
                      {!isReadOnly && (
                        <div className="visible md:invisible md:group-hover:visible flex gap-2">
                          <button
                            onClick={() => onEditAllocation(allocation)}
                            className="text-xs underline-offset-2 hover:underline"
                            data-testid={`button-edit-allocation-${allocation.id}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteAllocation(allocation)}
                            className="text-xs underline-offset-2 hover:underline"
                            data-testid={`button-delete-allocation-${allocation.id}`}
                          >
                            Delete
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
                    onClick={() => onAllocateToScope(scope.id, scope.name)}
                    className="text-sm underline-offset-2 hover:underline"
                    data-testid={`button-allocate-${scope.id}`}
                  >
                    Allocate
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
