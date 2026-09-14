/**
 * RENIX vNext — Budget Frame
 * 
 * Canon v1.4 Compliant — Responsive Layout
 * 
 * The Budget Frame exists to help the user answer:
 * "How much do I intend to spend, how have I chosen to distribute it,
 * and is reality introducing tension I should be aware of?"
 * 
 * This is a thinking surface, not an optimization tool.
 * 
 * Layout Structure:
 * 1. OrientationLayer (fast orientation, read-only)
 *    - BudgetHeader
 *    - OrientationTiles (TotalBudgetTile, BudgetPostureTile, ContingencyTile)
 *    - BudgetSankey (collapsible)
 * 2. ScopeOverview (navigation, not editing)
 * 3. ScopeWorkSurface (authoritative editing surface)
 * 
 * Design Canon:
 * - Pure black (#000000) and white (#FFFFFF) only
 * - No grey backgrounds, shadows, gradients
 * - Borders: 1px solid black
 * - No rounded corners
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { useBudgetData, type BudgetAllocation, type AllocationTarget } from './useBudgetData';
import { useScopeData } from '../scope/useScopeData';
import { useScopeTreeData } from '../scope/useScopeTreeData';
import { TotalBudgetDialog, ContingencyDialog, AllocationDialog, DeleteConfirmDialog } from './BudgetDialogs';
import {
  OrientationTiles,
  BudgetDistributionDonut,
  BudgetScopeTree,
  type ContingencyMode,
} from './components';
import { BudgetSkeleton } from '@/components/FrameSkeleton';

type DialogState =
  | { type: 'none' }
  | { type: 'total-budget' }
  | { type: 'contingency' }
  | { type: 'add-allocation'; preselectedScopeId?: string; preselectedScopeName?: string }
  | { type: 'edit-allocation'; allocation: BudgetAllocation }
  | { type: 'delete-allocation'; allocation: BudgetAllocation };

export function BudgetFrame() {
  const { projectId, currency, isReadOnly } = useProject();
  const { formatCurrency } = useFormatters();
  const budget = useBudgetData(projectId, currency, isReadOnly);
  const scope = useScopeData(projectId, isReadOnly);
  const scopeTree = useScopeTreeData(projectId, isReadOnly);

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  
  const scopeWorkSurfaceRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const [tilesHeight, setTilesHeight] = useState<number>(0);
  
  useEffect(() => {
    if (!tilesRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTilesHeight(entry.contentRect.height);
      }
    });
    observer.observe(tilesRef.current);
    return () => observer.disconnect();
  }, []);
  
  const sessionKey = `renix-budget-scope-${projectId}`;
  
  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey);
    if (stored && scopeTree.getNode(stored)) {
      setSelectedScopeId(stored);
    }
    // Do not auto-select first node - start with no selection
  }, [scopeTree.getNode, sessionKey]);
  
  const handleSelectScope = useCallback((scopeId: string | null) => {
    setSelectedScopeId(prev => {
      const next = prev === scopeId ? null : scopeId;
      if (next) {
        sessionStorage.setItem(sessionKey, next);
      } else {
        sessionStorage.removeItem(sessionKey);
      }
      return next;
    });
  }, [sessionKey]);

  const closeDialog = () => setDialog({ type: 'none' });

  // Build scopes list from root-level scope tree nodes only for donut chart
  const scopesList = useMemo(() => {
    return scopeTree.rootNodes.map(node => ({
      id: node.id,
      name: node.name,
    }));
  }, [scopeTree.rootNodes]);

  const resolveRootScopeId = useCallback((scopeId: string): string | null => {
    const ancestors = scopeTree.getAncestors(scopeId);
    if (ancestors.length > 0) {
      return ancestors[ancestors.length - 1].id;
    }
    const node = scopeTree.getNode(scopeId);
    return node ? node.id : null;
  }, [scopeTree.getAncestors, scopeTree.getNode]);


  const selectedScope = useMemo(() => {
    return scopesList.find(s => s.id === selectedScopeId) || null;
  }, [scopesList, selectedScopeId]);

  const contingencyComputedValue = useMemo(() => {
    if (budget.data.contingencyMode === 'fixed') {
      return budget.data.contingencyValue;
    }
    return (budget.data.contingencyValue / 100) * (budget.data.totalBudget ?? 0);
  }, [budget.data.contingencyMode, budget.data.contingencyValue, budget.data.totalBudget]);

  const handleSaveTotalBudget = (amount: number | null) => {
    budget.setTotalBudget(amount);
  };

  const handleSaveContingency = (mode: 'fixed' | 'percent', value: number) => {
    budget.setContingency(mode, value);
  };

  const handleSaveAllocation = (label: string, amount: number, target: AllocationTarget, notes?: string) => {
    if (dialog.type === 'add-allocation') {
      budget.addAllocation(label, amount, target, notes);
    } else if (dialog.type === 'edit-allocation') {
      budget.updateAllocation(dialog.allocation.id, label, amount, target, notes);
    }
    closeDialog();
  };

  const handleConfirmDelete = () => {
    if (dialog.type === 'delete-allocation') {
      budget.deleteAllocation(dialog.allocation.id);
    }
    closeDialog();
  };

  const handleAllocateToScope = useCallback((scopeId: string, scopeName: string) => {
    setDialog({
      type: 'add-allocation',
      preselectedScopeId: scopeId,
      preselectedScopeName: scopeName,
    });
  }, []);

  const handleScrollToScope = useCallback((scopeId: string) => {
    setSelectedScopeId(scopeId);
    sessionStorage.setItem(sessionKey, scopeId);
    setTimeout(() => {
      const element = document.querySelector(`[data-scope-row-id="${scopeId}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [sessionKey]);

  const handleScrollToAllocation = useCallback((allocationId: string) => {
    const allocation = budget.data.allocations.find(a => a.id === allocationId);
    if (allocation && allocation.target.type === 'scope' && allocation.target.scopeId) {
      setSelectedScopeId(allocation.target.scopeId);
      sessionStorage.setItem(sessionKey, allocation.target.scopeId);
    }
    setTimeout(() => {
      const element = document.querySelector(`[data-allocation-id="${allocationId}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [budget.data.allocations, sessionKey]);

  const handleScrollToUnallocated = useCallback(() => {
    scopeWorkSurfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (budget.isLoading) return <BudgetSkeleton />;

  return (
    <>
      {/* Zone 1: Posture Layer - Tiles and Donut directly rendered */}
      <div className="renix-grid items-start" data-testid="frame-budget">
        <div ref={tilesRef} className="renix-col-primary">
          <OrientationTiles
            totalBudget={budget.data.totalBudget}
            currency={budget.data.currency}
            allocatedTotal={budget.allocatedTotal}
            contingencyMode={budget.data.contingencyMode}
            contingencyValue={budget.data.contingencyValue}
            isReadOnly={isReadOnly}
            onSaveTotalBudget={handleSaveTotalBudget}
            onEditContingency={() => setDialog({ type: 'contingency' })}
          />
        </div>
        <div
          className="renix-col-secondary flex items-center justify-center"
          style={tilesHeight > 0 ? { height: tilesHeight, maxHeight: tilesHeight } : undefined}
        >
          <BudgetDistributionDonut
            totalBudget={budget.data.totalBudget}
            scopes={scopesList}
            allocations={budget.data.allocations}
            contingencyAmount={contingencyComputedValue}
            onScrollToScope={handleScrollToScope}
            resolveRootScopeId={resolveRootScopeId}
          />
        </div>
      </div>

      {/* Zone 2 & 3: Scope Tree with Allocations */}
      {!isReadOnly && !budget.hasTotalBudget && (
        <div className="px-1 py-3 text-sm text-muted-foreground border border-dashed border-border rounded-lg text-center" data-testid="budget-guidance-message">
          Set a total budget intent above to start allocating to scopes
        </div>
      )}
      <div ref={scopeWorkSurfaceRef}>
        <BudgetScopeTree
          rootNodes={scopeTree.rootNodes}
          allocations={budget.data.allocations}
          selectedNodeId={selectedScopeId}
          isReadOnly={isReadOnly}
          hasBudget={budget.hasTotalBudget}
          onSelectNode={handleSelectScope}
          onAllocateToScope={handleAllocateToScope}
          onEditAllocation={(allocation: BudgetAllocation) => setDialog({ type: 'edit-allocation', allocation })}
          onDeleteAllocation={(allocation: BudgetAllocation) => setDialog({ type: 'delete-allocation', allocation })}
          getNode={scopeTree.getNode}
        />
      </div>

      <TotalBudgetDialog
        open={dialog.type === 'total-budget'}
        onOpenChange={(open) => !open && closeDialog()}
        currentAmount={budget.data.totalBudget}
        currency={budget.data.currency}
        onSave={handleSaveTotalBudget}
      />

      <ContingencyDialog
        open={dialog.type === 'contingency'}
        onOpenChange={(open) => !open && closeDialog()}
        currentMode={budget.data.contingencyMode}
        currentValue={budget.data.contingencyValue}
        currency={budget.data.currency}
        onSave={handleSaveContingency}
      />

      <AllocationDialog
        open={dialog.type === 'add-allocation' || dialog.type === 'edit-allocation'}
        onOpenChange={(open) => !open && closeDialog()}
        allocation={dialog.type === 'edit-allocation' ? dialog.allocation : undefined}
        currency={budget.data.currency}
        scopes={scopesList.map(s => ({ id: s.id, name: s.name }))}
        onSave={handleSaveAllocation}
        defaultScopeId={
          dialog.type === 'add-allocation' ? dialog.preselectedScopeId
          : dialog.type === 'edit-allocation' && dialog.allocation.target?.type === 'scope'
            ? (dialog.allocation.target as any).scopeId
            : undefined
        }
        defaultScopeName={
          dialog.type === 'add-allocation' ? dialog.preselectedScopeName
          : dialog.type === 'edit-allocation' && dialog.allocation.target?.type === 'scope'
            ? (dialog.allocation.target as any).scopeName
            : undefined
        }
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-allocation'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Allocation"
        description={
          dialog.type === 'delete-allocation'
            ? `Are you sure you want to delete "${dialog.allocation.label}"?`
            : ''
        }
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default BudgetFrame;
