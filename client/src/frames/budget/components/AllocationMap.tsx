/**
 * RENIX vNext — Allocation Map
 * 
 * Canon v1.4 Compliant
 * Scope-first allocation view.
 * All scopes must be reflected; unallocated scopes shown as planning gaps.
 */

import { useMemo } from 'react';
import { useFormatters } from '@/context/ProjectContext';
import { ScopeRow } from './ScopeRow';
import type { BudgetAllocation } from '../useBudgetData';

interface Scope {
  id: string;
  name: string;
  optionality?: 'required' | 'optional' | 'aspirational';
}

interface AllocationMapProps {
  scopes: Scope[];
  allocations: BudgetAllocation[];
  totalBudget: number | null;
  isReadOnly: boolean;
  onEditAllocation: (allocation: BudgetAllocation) => void;
  onDeleteAllocation: (allocation: BudgetAllocation) => void;
  onAllocateToScope: (scopeId: string, scopeName: string) => void;
  onAddUnassigned: () => void;
}

export function AllocationMap({
  scopes,
  allocations,
  totalBudget,
  isReadOnly,
  onEditAllocation,
  onDeleteAllocation,
  onAllocateToScope,
  onAddUnassigned,
}: AllocationMapProps) {
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

  const unassignedAllocations = useMemo(() => {
    return allocations.filter(a => 
      a.target.type === 'unassigned' || 
      (a.target.type === 'scope' && !a.target.scopeId) ||
      a.target.type === 'area' ||
      a.target.type === 'item'
    );
  }, [allocations]);

  const contingencyAllocations = useMemo(() => {
    return allocations.filter(a => a.target.type === 'contingency');
  }, [allocations]);

  const allocatedTotal = useMemo(() => {
    return allocations.reduce((sum, a) => sum + a.amount, 0);
  }, [allocations]);

  const unallocatedIntent = useMemo(() => {
    if (totalBudget === null) return null;
    return totalBudget - allocatedTotal;
  }, [totalBudget, allocatedTotal]);

  const scopesWithoutAllocation = useMemo(() => {
    return scopes.filter(s => {
      const scopeAllocs = scopeAllocations.get(s.id) || [];
      return scopeAllocs.length === 0;
    });
  }, [scopes, scopeAllocations]);

  return (
    <section className="space-y-4" data-testid="allocation-map">
      <h2 className="text-lg font-semibold uppercase tracking-wide">
        Allocations by Scope
      </h2>

      {scopes.length === 0 ? (
        <div className="renix-surface p-4 text-sm">
          No scopes defined. Define scopes in the Scope frame first.
        </div>
      ) : (
        <div className="space-y-4">
          {scopes.map(scope => (
            <ScopeRow
              key={scope.id}
              scopeId={scope.id}
              scopeName={scope.name}
              optionality={scope.optionality}
              allocations={scopeAllocations.get(scope.id) || []}
              isReadOnly={isReadOnly}
              onEditAllocation={onEditAllocation}
              onDeleteAllocation={onDeleteAllocation}
              onAllocate={onAllocateToScope}
            />
          ))}
        </div>
      )}

      {unassignedAllocations.length > 0 && (
        <div className="renix-surface p-4" data-testid="unassigned-allocations">
          <div className="font-semibold mb-3">Unassigned Allocations</div>
          <div className="space-y-2">
            {unassignedAllocations.map(allocation => (
              <div 
                key={allocation.id}
                className="flex items-center justify-between gap-4 py-2 border-t border-subtle group"
                data-testid={`unassigned-row-${allocation.id}`}
              >
                <span className="text-sm">{allocation.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(allocation.amount)}
                  </span>
                  {!isReadOnly && (
                    <div className="visible md:invisible md:group-hover:visible flex gap-2">
                      <button
                        onClick={() => onEditAllocation(allocation)}
                        className="text-xs underline-offset-2 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteAllocation(allocation)}
                        className="text-xs underline-offset-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div>
          <button
            onClick={onAddUnassigned}
            className="text-sm underline-offset-2 hover:underline"
            data-testid="button-add-unassigned"
          >
            + Add unassigned allocation
          </button>
        </div>
      )}

      {unallocatedIntent !== null && unallocatedIntent !== 0 && (
        <div className="pt-4 text-sm text-secondary" data-testid="unallocated-intent">
          Unallocated intent: {formatCurrency(Math.abs(unallocatedIntent))}
          {unallocatedIntent < 0 && ' (over-allocated)'}
        </div>
      )}
    </section>
  );
}
