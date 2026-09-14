/**
 * RENIX vNext — Budget Frame Dialogs
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Dialogs for setting total budget and managing allocations.
 * No auto-calculation or remainder logic.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BudgetAllocation, AllocationTarget } from './useBudgetData';

function sanitizeTarget(target: AllocationTarget): AllocationTarget {
  if (target.type === 'scope' && !(target as any).scopeId) return { type: 'unassigned' };
  return target;
}

interface TotalBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAmount: number | null;
  currency: string;
  onSave: (amount: number | null) => void;
}

export function TotalBudgetDialog({
  open,
  onOpenChange,
  currentAmount,
  currency,
  onSave,
}: TotalBudgetDialogProps) {
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(currentAmount);
    }
  }, [open, currentAmount]);

  const handleSave = () => {
    onSave(amount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-total-budget-title">
            Set Total Budget
          </DialogTitle>
          <DialogDescription>
            Enter your intended total budget. This represents your spending intent, not a commitment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="total-amount">Amount ({currency})</Label>
            <CurrencyInput
              id="total-amount"
              value={amount}
              onChange={setAmount}
              placeholder="Enter amount"
              data-testid="input-total-budget"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-total">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-total">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ContingencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: 'fixed' | 'percent';
  currentValue: number;
  currency: string;
  onSave: (mode: 'fixed' | 'percent', value: number) => void;
}

export function ContingencyDialog({
  open,
  onOpenChange,
  currentMode,
  currentValue,
  currency,
  onSave,
}: ContingencyDialogProps) {
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [fixedValue, setFixedValue] = useState<number | null>(null);
  const [percentValue, setPercentValue] = useState('');

  useEffect(() => {
    if (open) {
      setMode(currentMode);
      if (currentMode === 'fixed') {
        setFixedValue(currentValue);
        setPercentValue('');
      } else {
        setFixedValue(null);
        setPercentValue(currentValue.toString());
      }
    }
  }, [open, currentMode, currentValue]);

  const handleSave = () => {
    if (mode === 'fixed') {
      onSave(mode, fixedValue ?? 0);
    } else {
      const parsed = parseFloat(percentValue);
      onSave(mode, isNaN(parsed) ? 0 : parsed);
    }
    onOpenChange(false);
  };

  const handleModeChange = (v: string) => {
    setMode(v as 'fixed' | 'percent');
    setFixedValue(null);
    setPercentValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-contingency-title">
            Set Contingency Reserve
          </DialogTitle>
          <DialogDescription>
            Reserve a contingency amount as a fixed value or percentage of allocated budget.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contingency-mode">Mode</Label>
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger data-testid="select-contingency-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
                <SelectItem value="percent">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contingency-value">
              {mode === 'fixed' ? `Amount (${currency})` : 'Percentage (%)'}
            </Label>
            {mode === 'fixed' ? (
              <CurrencyInput
                id="contingency-value"
                value={fixedValue}
                onChange={setFixedValue}
                placeholder="Enter amount"
                data-testid="input-contingency-value"
              />
            ) : (
              <Input
                id="contingency-value"
                type="number"
                min="0"
                step="1"
                value={percentValue}
                onChange={e => setPercentValue(e.target.value)}
                placeholder="Enter percentage"
                data-testid="input-contingency-value"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-contingency">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-contingency">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ScopeEntry {
  id: string;
  name: string;
}

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation?: BudgetAllocation;
  currency: string;
  scopes: ScopeEntry[];
  onSave: (label: string, amount: number, target: AllocationTarget, notes?: string) => void;
  defaultScopeId?: string;
  defaultScopeName?: string;
}

export function AllocationDialog({
  open,
  onOpenChange,
  allocation,
  currency,
  scopes,
  onSave,
  defaultScopeId,
  defaultScopeName,
}: AllocationDialogProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<string>('unassigned');
  const [targetId, setTargetId] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  const isScopeContext = !!defaultScopeId;

  useEffect(() => {
    if (open) {
      setLabel(allocation?.label ?? '');
      setAmount(allocation?.amount ?? null);
      setNotes(allocation?.notes ?? '');
      setTargetId('');
      
      if (allocation?.target) {
        const target = allocation.target as any;
        if (allocation.target.type === 'scope') {
          setTargetType('scope');
          setTargetId(target.scopeId || '');
        } else {
          setTargetType('unassigned');
          setTargetId('');
        }
      } else if (defaultScopeId) {
        setTargetType('scope');
        setTargetId(defaultScopeId);
      } else {
        setTargetType('unassigned');
        setTargetId('');
      }
    }
  }, [open, allocation, defaultScopeId, isScopeContext]);

  const handleSave = () => {
    const parsedAmount = amount ?? 0;
    let target: AllocationTarget;
    
    if (isScopeContext) {
      const scopeEntry = scopes.find(s => s.id === defaultScopeId);
      target = { type: 'scope', scopeId: defaultScopeId!, scopeName: defaultScopeName || scopeEntry?.name || '' };
      
      const generatedLabel = defaultScopeName || scopeEntry?.name || 'Allocation';
      target = sanitizeTarget(target);
      onSave(generatedLabel, parsedAmount, target, notes || undefined);
    } else {
      switch (targetType) {
        case 'scope': {
          const scopeEntry = scopes.find(s => s.id === targetId);
          target = scopeEntry 
            ? { type: 'scope', scopeId: scopeEntry.id, scopeName: scopeEntry.name }
            : { type: 'unassigned' };
          break;
        }
        default:
          target = { type: 'unassigned' };
      }
      
      target = sanitizeTarget(target);
      onSave(label || 'Untitled allocation', parsedAmount, target, notes || undefined);
    }
    
    onOpenChange(false);
  };

  if (isScopeContext) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="dialog-allocation-title">
              {allocation ? 'Edit Allocation' : 'Add Allocation'}
            </DialogTitle>
            <DialogDescription>
              Allocations express intent. They do not enforce spending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="alloc-amount">Amount ({currency})</Label>
              <CurrencyInput
                id="alloc-amount"
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                data-testid="input-allocation-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alloc-notes">Notes</Label>
              <Textarea
                id="alloc-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                data-testid="input-allocation-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-allocation">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-allocation">
              {allocation ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-allocation-title">
            {allocation ? 'Edit Allocation' : 'Add Allocation'}
          </DialogTitle>
          <DialogDescription>
            Allocations express intent. They do not enforce spending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="alloc-label">Label</Label>
            <Input
              id="alloc-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g., Kitchen cabinets, Electrical work"
              data-testid="input-allocation-label"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc-amount">Amount ({currency})</Label>
            <CurrencyInput
              id="alloc-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              data-testid="input-allocation-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc-target">Attach to</Label>
            <Select value={targetType} onValueChange={(v) => { setTargetType(v); setTargetId(''); }}>
              <SelectTrigger data-testid="select-allocation-target-type">
                <SelectValue placeholder="Select target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {scopes.length > 0 && <SelectItem value="scope">Specific Scope</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {targetType === 'scope' && scopes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="alloc-scope">Scope</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger data-testid="select-allocation-scope">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  {scopes.map(scope => (
                    <SelectItem key={scope.id} value={scope.id}>
                      {scope.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="alloc-notes">Notes</Label>
            <Textarea
              id="alloc-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              data-testid="input-allocation-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-allocation">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-allocation">
            {allocation ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, title, description, onConfirm }: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-delete-title">{title}</DialogTitle>
          <DialogDescription data-testid="dialog-delete-description">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-delete">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} data-testid="button-confirm-delete">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
