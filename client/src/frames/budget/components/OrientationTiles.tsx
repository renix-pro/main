/**
 * RENIX vNext — Orientation Tiles
 * 
 * Canon v1.4 Compliant
 * Three tiles: TotalBudgetTile, AvailableBudget/OverAllocated (mutually exclusive), ContingencyTile
 * Responsive: 3-column grid on desktop, single-column stack on mobile.
 * Pure black/white styling, no icons, no rounded corners.
 * 
 * Targeted Update:
 * - Total Budget Intent is inline editable (click → input → blur/enter to commit)
 * - BudgetPostureTile replaced with AvailableBudgetTile or OverAllocatedTile
 * - Contingency is a global reserve, not allocatable
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { GlossaryTerm } from '@/components/GlossaryTerm';
import { CurrencyInput } from '@/components/CurrencyInput';
import { useFormatters } from '@/context/ProjectContext';

interface TotalBudgetTileProps {
  totalBudget: number | null;
  currency: string;
  isReadOnly: boolean;
  onSave: (amount: number | null) => void;
}

function TotalBudgetTile({ totalBudget, currency, isReadOnly, onSave }: TotalBudgetTileProps) {
  const { formatCurrency } = useFormatters();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
    };
  }, []);

  const startEditing = useCallback(() => {
    if (isReadOnly) return;
    setEditValue(totalBudget);
    setIsEditing(true);
  }, [isReadOnly, totalBudget]);

  const commit = useCallback(() => {
    setIsEditing(false);

    if (editValue !== totalBudget) {
      onSave(editValue);
      setShowConfirmation(true);

      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
      confirmationTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowConfirmation(false);
        }
        confirmationTimerRef.current = null;
      }, 2000);
    }
  }, [editValue, totalBudget, onSave]);

  const cancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }, [commit, cancel]);

  const displayValue = totalBudget !== null ? formatCurrency(totalBudget) : '—';

  return (
    <div
      className="renix-surface p-4 bg-status-pending-subtle"
      data-testid="tile-total-budget"
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1"><GlossaryTerm term="total-budget">Total Budget Intent</GlossaryTerm></div>
      <div className="relative">
        <CurrencyInput
          value={editValue}
          onChange={setEditValue}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`text-2xl font-semibold tabular-nums bg-transparent border-b border-foreground/30 outline-none w-full border-0 rounded-none shadow-none focus-visible:ring-0 h-auto p-0 ${
            isEditing ? 'block' : 'hidden'
          }`}
          data-testid="input-total-budget"
        />
        <div
          className={`text-2xl font-semibold tabular-nums ${!isReadOnly ? 'cursor-pointer hover:opacity-80' : ''} ${
            isEditing ? 'hidden' : 'block'
          }`}
          onClick={startEditing}
          data-testid="value-total-budget"
        >
          {displayValue}
        </div>
      </div>
      <div 
        className={`text-sm text-secondary mt-2 transition-opacity ${showConfirmation ? 'opacity-100' : 'opacity-0'}`}
        data-testid="text-budget-updated"
      >
        Budget updated
      </div>
    </div>
  );
}

/**
 * AvailableBudget / OverAllocated Tiles
 * 
 * Canon v1.4: Mutually exclusive tiles showing budget state.
 * AvailableBudget = TotalBudget - AllocatedScopeTotal - Contingency
 * 
 * If AvailableBudget >= 0: Show Available Budget tile
 * If AvailableBudget < 0: Show Over-allocated tile (absolute value)
 * 
 * Styling: Subtle RENIX palette tint, no icons, no urgency.
 */

interface BudgetStateTileProps {
  totalBudget: number | null;
  allocatedTotal: number;
  contingencyAmount: number;
}

function BudgetStateTile({ totalBudget, allocatedTotal, contingencyAmount }: BudgetStateTileProps) {
  const { formatCurrency } = useFormatters();

  if (totalBudget === null) {
    return (
      <div
        className="renix-surface p-4"
        data-testid="tile-available-budget"
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Available Budget</div>
        <div className="text-2xl font-semibold tabular-nums">—</div>
        <div className="text-xs mt-2 text-muted-foreground">Set total budget to see availability</div>
      </div>
    );
  }

  const availableBudget = totalBudget - allocatedTotal - contingencyAmount;

  if (availableBudget >= 0) {
    return (
      <div
        className="renix-surface p-4 bg-status-approved-subtle"
        data-testid="tile-available-budget"
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Available Budget</div>
        <div className="text-2xl font-semibold tabular-nums">
          {formatCurrency(availableBudget)}
        </div>
      </div>
    );
  } else {
    return (
      <div
        className="renix-surface p-4 bg-status-declined-subtle border-2 border-foreground"
        data-testid="tile-over-allocated"
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Over-allocated</div>
        <div className="text-2xl font-semibold tabular-nums">
          {formatCurrency(Math.abs(availableBudget))}
        </div>
        <div className="text-xs mt-2 text-muted-foreground">
          Allocations exceed total budget by this amount
        </div>
      </div>
    );
  }
}

interface ContingencyTileProps {
  mode: 'fixed' | 'percent';
  value: number;
  totalBudget: number | null;
  isReadOnly: boolean;
  onEdit: () => void;
}

function ContingencyTile({ mode, value, totalBudget, isReadOnly, onEdit }: ContingencyTileProps) {
  const { formatCurrency } = useFormatters();

  const displayValue = mode === 'percent' 
    ? `${value}%` 
    : formatCurrency(value);

  const modeIndicator = mode === 'fixed' ? 'Fixed' : '%';

  const computedValue = mode === 'percent' 
    ? ((totalBudget ?? 0) * value) / 100 
    : value;

  return (
    <div
      className="renix-surface p-4 bg-status-draft-subtle"
      data-testid="tile-contingency"
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1"><GlossaryTerm term="contingency">Contingency Reserved</GlossaryTerm></div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{displayValue}</span>
        <span className="text-sm text-muted">({modeIndicator})</span>
      </div>
      {mode === 'percent' && (
        <div className="text-sm mt-1">
          {formatCurrency(computedValue)}
        </div>
      )}
      {!isReadOnly && (
        <button
          onClick={onEdit}
          className="text-sm text-secondary underline-offset-2 hover:underline mt-2"
          data-testid="button-edit-contingency"
        >
          Edit
        </button>
      )}
    </div>
  );
}

export interface OrientationTilesProps {
  totalBudget: number | null;
  currency: string;
  allocatedTotal: number;
  contingencyMode: 'fixed' | 'percent';
  contingencyValue: number;
  isReadOnly: boolean;
  onSaveTotalBudget: (amount: number | null) => void;
  onEditContingency: () => void;
}

export function OrientationTiles({
  totalBudget,
  currency,
  allocatedTotal,
  contingencyMode,
  contingencyValue,
  isReadOnly,
  onSaveTotalBudget,
  onEditContingency,
}: OrientationTilesProps) {
  const contingencyAmount = contingencyMode === 'percent'
    ? ((totalBudget ?? 0) * contingencyValue) / 100
    : contingencyValue;

  return (
    <div className="flex flex-col gap-4" data-testid="orientation-tiles">
      <TotalBudgetTile
        totalBudget={totalBudget}
        currency={currency}
        isReadOnly={isReadOnly}
        onSave={onSaveTotalBudget}
      />
      <ContingencyTile
        mode={contingencyMode}
        value={contingencyValue}
        totalBudget={totalBudget}
        isReadOnly={isReadOnly}
        onEdit={onEditContingency}
      />
      <BudgetStateTile
        totalBudget={totalBudget}
        allocatedTotal={allocatedTotal}
        contingencyAmount={contingencyAmount}
      />
    </div>
  );
}
