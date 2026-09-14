/**
 * RENIX vNext — Financing Frame
 * 
 * Canon v1.4 Compliant — Inline Editing UX
 * 
 * The Financing Frame answers:
 * "How might this project be funded, from where, and with what status?"
 * 
 * CORE PRINCIPLE: Click tile → Change value → Observe updated truth
 * 
 * Structure:
 * 1. Three Mandatory KPIs (always visible at top)
 * 2. Cost Resolution Stack Chart
 * 3. Financing vs Resolved Cost Comparison Chart
 * 4. Self-describing Source Tiles (clickable to select)
 * 5. Inline Focus Panel for selected source (all fields editable on blur/enter)
 * 
 * Core invariants:
 * - NO modal edit dialogs
 * - NO "Edit" buttons - all fields directly editable
 * - NO save/cancel flows for single-field edits
 * - Status toggle is always visible and ONE CLICK
 * - Confirmation ONLY for funding gap changes
 */

import { useState, useCallback, useRef } from 'react';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { useFinancingData, type FinancingSource, type FinancingType, type FinancingStatus } from './useFinancingData';
import { AddSourceDialog, DeleteConfirmDialog, FundingGapConfirmDialog } from './FinancingDialogs';
import {
  FinancingKPIBand,
  FinancingSynthesis,
  CostResolutionStackChart,
  FinancingComparisonChart,
  SourceTiles,
  SourceFocusPanel,
} from './components';
import { FinancingSkeleton } from '@/components/FrameSkeleton';

type DialogState =
  | { type: 'none' }
  | { type: 'add-source' }
  | { type: 'delete-source'; source: FinancingSource }
  | { type: 'funding-gap-confirm'; pendingAction: () => void; cancelAction: () => void };

export function FinancingFrame() {
  const { projectId, isReadOnly } = useProject();
  const { currencySymbol } = useFormatters();
  const financingData = useFinancingData(projectId, isReadOnly);

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const closeDialog = useCallback(() => setDialog({ type: 'none' }), []);

  const handleAddSourceConfirm = useCallback((
    name: string, 
    type: FinancingType, 
    amount: number, 
    status: FinancingStatus,
    monthlyCost: number | null,
    notes: string | undefined
  ) => {
    financingData.addSource(name, type, amount, status, monthlyCost, notes);
    closeDialog();
  }, [financingData, closeDialog]);

  const handleConfirmDelete = useCallback(() => {
    if (dialog.type === 'delete-source') {
      financingData.deleteSource(dialog.source.id);
      if (selectedSourceId === dialog.source.id) {
        setSelectedSourceId(null);
      }
    }
    closeDialog();
  }, [dialog, financingData, selectedSourceId, closeDialog]);

  const handleSelectSource = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
  }, []);

  const handleAddSource = useCallback(() => {
    setDialog({ type: 'add-source' });
  }, []);

  const handleDeleteSource = useCallback((source: FinancingSource) => {
    setDialog({ type: 'delete-source', source });
  }, []);

  const handleToggleStatus = useCallback((sourceId: string, newStatus: FinancingStatus) => {
    const source = financingData.data.sources.find(s => s.id === sourceId);
    if (!source) return;

    // Check if this change would affect funding gap
    const currentConfirmed = financingData.totalConfirmed;
    let newConfirmedTotal = currentConfirmed;
    
    if (source.status === 'confirmed' && newStatus === 'planned') {
      // Removing from confirmed
      newConfirmedTotal -= source.amount;
    } else if (source.status === 'planned' && newStatus === 'confirmed') {
      // Adding to confirmed
      newConfirmedTotal += source.amount;
    }

    const { wouldCreateGap, wouldWidenGap } = financingData.checkFundingGapChange(newConfirmedTotal);

    if (wouldCreateGap || wouldWidenGap) {
      setDialog({
        type: 'funding-gap-confirm',
        pendingAction: () => {
          financingData.updateSourceStatus(sourceId, newStatus);
        },
        cancelAction: () => {},
      });
    } else {
      financingData.updateSourceStatus(sourceId, newStatus);
    }
  }, [financingData]);

  const handleFieldChange = useCallback((sourceId: string, field: keyof FinancingSource, value: any) => {
    const source = financingData.data.sources.find(s => s.id === sourceId);
    if (!source) return;

    // For amount changes on confirmed sources, check funding gap
    if (field === 'amount' && source.status === 'confirmed') {
      const currentConfirmed = financingData.totalConfirmed;
      const newConfirmedTotal = currentConfirmed - source.amount + (value as number);
      
      const { wouldCreateGap, wouldWidenGap } = financingData.checkFundingGapChange(newConfirmedTotal);
      
      if (wouldCreateGap || wouldWidenGap) {
        setDialog({
          type: 'funding-gap-confirm',
          pendingAction: () => {
            financingData.updateSourceField(sourceId, field, value);
          },
          cancelAction: () => {
            // User cancelled - no action needed, UI will revert on next render
          },
        });
        return;
      }
    }

    // For status changes, use the status handler
    if (field === 'status') {
      handleToggleStatus(sourceId, value as FinancingStatus);
      return;
    }

    financingData.updateSourceField(sourceId, field, value);
  }, [financingData, handleToggleStatus]);

  const handleFundingGapProceed = useCallback(() => {
    if (dialog.type === 'funding-gap-confirm') {
      dialog.pendingAction();
    }
    closeDialog();
  }, [dialog, closeDialog]);

  const handleFundingGapCancel = useCallback(() => {
    if (dialog.type === 'funding-gap-confirm') {
      dialog.cancelAction();
    }
    closeDialog();
  }, [dialog, closeDialog]);

  const selectedSource = selectedSourceId
    ? financingData.data.sources.find((s) => s.id === selectedSourceId)
    : null;

  if (financingData.isLoading) return <FinancingSkeleton />;

  return (
    <div 
      className="space-y-6"
      data-testid="financing-frame"
    >
      <FinancingKPIBand 
        resolvedCostDemand={financingData.resolvedCostDemand}
        isLoading={financingData.isLoadingCostDemand}
      />

      <FinancingSynthesis
        resolvedCostDemand={financingData.resolvedCostDemand}
        sources={financingData.data.sources}
        isLoading={financingData.isLoadingCostDemand}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostResolutionStackChart
          resolvedCostDemand={financingData.resolvedCostDemand}
          isLoading={financingData.isLoadingCostDemand}
        />
        <FinancingComparisonChart
          resolvedCostDemand={financingData.resolvedCostDemand}
          isLoading={financingData.isLoadingCostDemand}
        />
      </div>

      <SourceTiles
        sources={financingData.data.sources}
        isReadOnly={isReadOnly}
        onSelectSource={handleSelectSource}
        onToggleStatus={handleToggleStatus}
        onAddSource={handleAddSource}
      />

      {selectedSource && (
        <section data-testid="source-focus-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Source Details</h2>
            <button
              onClick={() => setSelectedSourceId(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid="button-close-focus-panel"
            >
              Close
            </button>
          </div>
          <SourceFocusPanel
            source={selectedSource}
            isReadOnly={isReadOnly}
            onFieldChange={(field, value) => handleFieldChange(selectedSource.id, field, value)}
            onDelete={() => handleDeleteSource(selectedSource)}
          />
        </section>
      )}

      <AddSourceDialog
        open={dialog.type === 'add-source'}
        onOpenChange={(open) => !open && closeDialog()}
        onAdd={handleAddSourceConfirm}
        currencySymbol={currencySymbol}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-source'}
        onOpenChange={(open) => !open && closeDialog()}
        sourceName={dialog.type === 'delete-source' ? dialog.source.name : ''}
        onConfirm={handleConfirmDelete}
      />

      <FundingGapConfirmDialog
        open={dialog.type === 'funding-gap-confirm'}
        onOpenChange={(open) => !open && handleFundingGapCancel()}
        onProceed={handleFundingGapProceed}
        onCancel={handleFundingGapCancel}
      />
    </div>
  );
}

export default FinancingFrame;
