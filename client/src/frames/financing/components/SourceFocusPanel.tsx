/**
 * RENIX vNext — Source Focus Panel (Inline Editing)
 * 
 * Canon v1.4 Compliant — Inline Editing UX
 * 
 * Shows exactly ONE financing source at a time.
 * ALL fields are directly editable inline.
 * Changes apply on blur/enter - NO save/cancel buttons.
 * Status toggle is always visible and ONE CLICK.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useFormatters } from '../../../context/ProjectContext';
import type { FinancingSource, FinancingType, FinancingStatus } from '../useFinancingData';

const TYPE_OPTIONS: { value: FinancingType; label: string }[] = [
  { value: 'equity', label: 'Equity' },
  { value: 'loan', label: 'Loan' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<FinancingStatus, string> = {
  planned: 'Planned',
  confirmed: 'Confirmed',
};

interface SourceFocusPanelProps {
  source: FinancingSource;
  isReadOnly: boolean;
  onFieldChange: (field: keyof FinancingSource, value: any) => void;
  onDelete: () => void;
}

export function SourceFocusPanel({
  source,
  isReadOnly,
  onFieldChange,
  onDelete,
}: SourceFocusPanelProps) {
  const { formatCurrency, currencySymbol } = useFormatters();

  const [localName, setLocalName] = useState(source.name);
  const [localAmount, setLocalAmount] = useState<number | null>(source.amount);
  const [localMonthlyCost, setLocalMonthlyCost] = useState<number | null>(
    source.monthlyCost ?? null
  );
  const [localNotes, setLocalNotes] = useState(source.notes ?? '');

  useEffect(() => {
    setLocalName(source.name);
    setLocalAmount(source.amount);
    setLocalMonthlyCost(source.monthlyCost ?? null);
    setLocalNotes(source.notes ?? '');
  }, [source.id, source.name, source.amount, source.monthlyCost, source.notes]);

  const handleNameBlur = useCallback(() => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== source.name) {
      onFieldChange('name', trimmed);
    } else {
      setLocalName(source.name);
    }
  }, [localName, source.name, onFieldChange]);

  const handleAmountBlur = useCallback(() => {
    const val = localAmount ?? 0;
    if (val >= 0 && val !== source.amount) {
      onFieldChange('amount', val);
    } else if (val < 0) {
      setLocalAmount(source.amount);
    }
  }, [localAmount, source.amount, onFieldChange]);

  const handleMonthlyCostBlur = useCallback(() => {
    if (localMonthlyCost !== source.monthlyCost) {
      onFieldChange('monthlyCost', localMonthlyCost);
    }
  }, [localMonthlyCost, source.monthlyCost, onFieldChange]);

  const handleNotesBlur = useCallback(() => {
    const trimmed = localNotes.trim();
    if (trimmed !== (source.notes ?? '')) {
      onFieldChange('notes', trimmed || null);
    }
  }, [localNotes, source.notes, onFieldChange]);

  const handleKeyDown = (
    e: React.KeyboardEvent,
    onBlur: () => void
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      onBlur();
    }
    if (e.key === 'Escape') {
      (e.target as HTMLElement).blur();
    }
  };

  const handleTypeChange = (newType: FinancingType) => {
    if (newType !== source.type) {
      onFieldChange('type', newType);
    }
  };

  const handleStatusToggle = () => {
    const newStatus: FinancingStatus = source.status === 'confirmed' ? 'planned' : 'confirmed';
    onFieldChange('status', newStatus);
  };

  return (
    <div
      className="renix-surface border border-border"
      data-testid={`source-focus-${source.id}`}
      data-source-id={source.id}
    >
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            {isReadOnly ? (
              <h3
                className="text-xl font-semibold"
                data-testid={`focus-source-name-${source.id}`}
              >
                {source.name}
              </h3>
            ) : (
              <Input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => handleKeyDown(e, handleNameBlur)}
                className="text-xl font-semibold border-0 border-b border-transparent hover:border-border focus:border-border bg-transparent px-0 h-auto !rounded-none"
                placeholder="Source name"
                data-testid={`input-source-name-${source.id}`}
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              {isReadOnly ? (
                <span className="text-sm text-muted-foreground">
                  {TYPE_OPTIONS.find(t => t.value === source.type)?.label}
                </span>
              ) : (
                <Select
                  value={source.type}
                  onValueChange={handleTypeChange}
                  data-testid={`select-source-type-${source.id}`}
                >
                  <SelectTrigger className="w-auto min-w-[100px] h-8 text-sm border border-border !rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="!rounded-none">
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isReadOnly ? (
                <span
                  className={`text-sm px-2 py-0.5 ${
                    source.status === 'confirmed'
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`focus-status-badge-${source.id}`}
                >
                  {STATUS_LABELS[source.status]}
                </span>
              ) : (
                <button
                  onClick={handleStatusToggle}
                  className={`text-sm px-3 py-1 border transition-colors ${
                    source.status === 'confirmed'
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border hover-elevate'
                  }`}
                  data-testid={`focus-toggle-status-${source.id}`}
                >
                  {STATUS_LABELS[source.status]}
                </button>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            {isReadOnly ? (
              <div
                className="text-2xl font-semibold tabular-nums"
                data-testid={`focus-source-amount-${source.id}`}
              >
                {formatCurrency(source.amount)}
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                  {currencySymbol}
                </span>
                <CurrencyInput
                  value={localAmount}
                  onChange={(v) => setLocalAmount(v)}
                  onBlur={handleAmountBlur}
                  onKeyDown={(e) => handleKeyDown(e, handleAmountBlur)}
                  className="text-2xl font-semibold tabular-nums text-right pl-8 pr-3 w-48 h-auto border-0 border-b border-transparent hover:border-border focus:border-border bg-transparent !rounded-none"
                  placeholder="0"
                  data-testid={`input-source-amount-${source.id}`}
                />
              </div>
            )}
            {source.type === 'loan' && (
              <div className="text-sm text-muted-foreground mt-2">
                {isReadOnly ? (
                  <span>Monthly: {source.monthlyCost ? formatCurrency(source.monthlyCost) : '—'}</span>
                ) : (
                  <div className="flex items-center gap-1 justify-end">
                    <span>Monthly:</span>
                    <span className="text-muted-foreground">{currencySymbol}</span>
                    <CurrencyInput
                      value={localMonthlyCost}
                      onChange={(v) => setLocalMonthlyCost(v)}
                      onBlur={handleMonthlyCostBlur}
                      onKeyDown={(e) => handleKeyDown(e, handleMonthlyCostBlur)}
                      className="w-24 h-6 text-sm tabular-nums text-right border-0 border-b border-transparent hover:border-border focus:border-border bg-transparent px-1 !rounded-none"
                      placeholder="0"
                      data-testid={`input-source-monthly-${source.id}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Notes
          </div>
          {isReadOnly ? (
            <div
              className="text-sm min-h-[60px]"
              data-testid={`focus-source-notes-${source.id}`}
            >
              {source.notes || <span className="text-muted-foreground italic">No notes</span>}
            </div>
          ) : (
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  (e.target as HTMLElement).blur();
                }
              }}
              className="min-h-[60px] text-sm border border-transparent hover:border-border focus:border-border bg-transparent resize-none !rounded-none"
              placeholder="Add notes about this financing source..."
              data-testid={`input-source-notes-${source.id}`}
            />
          )}
        </div>
      </div>

      {!isReadOnly && (
        <div className="p-4 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            data-testid={`focus-delete-source-${source.id}`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Source
          </Button>
        </div>
      )}
    </div>
  );
}
