/**
 * RENIX vNext — Contingency Reserve
 * 
 * Canon v1.4 Compliant
 * First-class contingency with fixed/percent toggle.
 * Contingency is never auto-consumed.
 */

import { useState } from 'react';
import { useFormatters } from '@/context/ProjectContext';

export type ContingencyMode = 'fixed' | 'percent';

interface ContingencyReserveProps {
  mode: ContingencyMode;
  value: number;
  allocatedTotal: number;
  isReadOnly: boolean;
  onModeChange: (mode: ContingencyMode) => void;
  onValueChange: (value: number) => void;
}

export function ContingencyReserve({
  mode,
  value,
  allocatedTotal,
  isReadOnly,
  onModeChange,
  onValueChange,
}: ContingencyReserveProps) {
  const { formatCurrency } = useFormatters();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [pendingModeChange, setPendingModeChange] = useState<ContingencyMode | null>(null);

  const computedValue = mode === 'percent' 
    ? (allocatedTotal * value) / 100 
    : value;

  const handleModeSelect = (newMode: ContingencyMode) => {
    if (newMode === mode) return;
    setPendingModeChange(newMode);
  };

  const confirmModeChange = () => {
    if (pendingModeChange) {
      onModeChange(pendingModeChange);
      setPendingModeChange(null);
    }
  };

  const cancelModeChange = () => {
    setPendingModeChange(null);
  };

  const handleSaveValue = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onValueChange(numValue);
    }
    setIsEditing(false);
  };

  return (
    <section className="renix-surface p-4" data-testid="contingency-reserve">
      <h2 className="text-lg font-semibold uppercase tracking-wide mb-4">
        Contingency Reserve
      </h2>

      <div className="flex items-start gap-6">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contingency-mode"
              checked={mode === 'fixed'}
              onChange={() => handleModeSelect('fixed')}
              disabled={isReadOnly}
              className="accent-current"
              data-testid="radio-contingency-fixed"
            />
            <span className="text-sm">Fixed value</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contingency-mode"
              checked={mode === 'percent'}
              onChange={() => handleModeSelect('percent')}
              disabled={isReadOnly}
              className="accent-current"
              data-testid="radio-contingency-percent"
            />
            <span className="text-sm">% of allocated budget</span>
          </label>
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="border border-subtle px-2 py-1 text-sm w-32 bg-transparent"
                autoFocus
                data-testid="input-contingency-value"
              />
              {mode === 'percent' && <span className="text-sm">%</span>}
              <button
                onClick={handleSaveValue}
                className="text-xs underline-offset-2 hover:underline"
                data-testid="button-save-contingency"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums" data-testid="text-contingency-value">
                {mode === 'percent' 
                  ? `${value}%` 
                  : formatCurrency(value)}
              </span>
              {mode === 'percent' && (
                <span className="text-sm text-secondary">
                  ({formatCurrency(computedValue)})
                </span>
              )}
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setEditValue(value.toString());
                    setIsEditing(true);
                  }}
                  className="text-xs underline-offset-2 hover:underline ml-2"
                  data-testid="button-edit-contingency"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {pendingModeChange && (
        <div className="mt-4 border-t border-subtle pt-4">
          <p className="text-sm mb-2">
            Switch contingency from {mode === 'fixed' ? 'fixed value' : 'percentage'} to {pendingModeChange === 'fixed' ? 'fixed value' : 'percentage'}?
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmModeChange}
              className="text-sm underline-offset-2 hover:underline"
              data-testid="button-confirm-mode-change"
            >
              Confirm
            </button>
            <button
              onClick={cancelModeChange}
              className="text-sm underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
