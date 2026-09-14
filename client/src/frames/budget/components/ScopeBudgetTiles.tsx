/**
 * RENIX vNext — Zone2 Explore Layer (CFS Compliant)
 * 
 * Canon v1.4 Compliant — Common Frame Structure
 * 
 * Zone 2 Purpose: "What objects exist, and which one should I look at?"
 * - Tiles MUST be square (1:1 aspect ratio)
 * - Tiles MUST be uniform size
 * - Tiles MUST be read-only (selection triggers Zone 3)
 * - The LAST tile MUST always be "Add new"
 * 
 * Responsive:
 * - Desktop: Grid layout by default
 * - Mobile: Carousel view by default
 */

import { useFormatters } from '../../../context/ProjectContext';

export interface ScopeBudgetItem {
  id: string;
  name: string;
  allocated: number;
  allocationCount: number;
  isOptional: boolean;
  color?: string;
}

interface ScopeBudgetTilesProps {
  scopes: ScopeBudgetItem[];
  selectedScopeId: string | null;
  onSelectScope: (scopeId: string) => void;
  onAddScope?: () => void;
}

export function ScopeBudgetTiles({
  scopes,
  selectedScopeId,
  onSelectScope,
  onAddScope,
}: ScopeBudgetTilesProps) {
  const { formatCurrency } = useFormatters();

  return (
    <section
      data-testid="zone2-explore"
      data-cfs-zone="zone2-explore"
      className="w-full"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">
        Scope Allocations
      </h3>
      
      {scopes.length === 0 && !onAddScope ? (
        <div
          className="renix-surface p-6 text-center"
          data-testid="scope-budget-empty"
        >
          <p className="text-sm">No scopes defined yet.</p>
          <p className="text-sm text-secondary mt-1">Add scopes in the Scope Frame to allocate budget.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          data-testid="entity-tile-grid"
        >
          {scopes.map((scope) => {
            const isSelected = selectedScopeId === scope.id;
            const isUnallocated = scope.allocated === 0;
            
            return (
              <button
                key={scope.id}
                onClick={() => onSelectScope(scope.id)}
                className={`
                  aspect-square text-left p-4 transition-colors flex flex-col justify-between rounded-lg
                  ${isSelected 
                    ? 'ring-2 ring-[var(--accent-copper)] renix-surface' 
                    : isUnallocated
                      ? 'border-2 border-dashed border-subtle renix-surface hover-elevate'
                      : 'renix-surface hover-elevate'
                  }
                `}
                data-testid={`tile-scope-budget-${scope.id}`}
                data-entity-id={scope.id}
                style={scope.color ? { borderLeftColor: scope.color, borderLeftWidth: '4px' } : undefined}
              >
                <div>
                  <div className="font-medium text-sm line-clamp-2">{scope.name}</div>
                  {scope.isOptional && (
                    <span className="text-xs px-1 border border-subtle rounded mt-1 inline-block text-muted">
                      Optional
                    </span>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="text-base font-semibold tabular-nums">
                    {formatCurrency(scope.allocated)}
                  </div>
                  <div className="text-xs text-muted">
                    {scope.allocationCount === 0 
                      ? 'Not allocated' 
                      : `${scope.allocationCount} allocation${scope.allocationCount !== 1 ? 's' : ''}`
                    }
                  </div>
                </div>
              </button>
            );
          })}
          
          {onAddScope && (
            <button
              onClick={onAddScope}
              className="aspect-square border border-dashed border-subtle rounded-lg renix-surface flex items-center justify-center p-4 hover-elevate transition-colors"
              data-testid="entity-tile-add-new"
              data-entity-id="add-new"
            >
              <span className="text-3xl text-muted">+</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
