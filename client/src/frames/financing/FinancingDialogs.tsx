/**
 * RENIX vNext — Financing Frame Dialogs
 * 
 * Canon v1.4 Compliant — Inline Editing UX
 * 
 * Only minimal confirmation dialogs - NO edit modals.
 * 
 * - DeleteConfirmDialog: Confirms source deletion
 * - FundingGapConfirmDialog: Lightweight confirmation when changes create/widen funding gaps
 * - AddSourceDialog: Simple dialog to add a new source (name + type only, then inline edit)
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FinancingType, FinancingStatus } from './useFinancingData';

const FINANCING_TYPES: { value: FinancingType; label: string }[] = [
  { value: 'equity', label: 'Equity' },
  { value: 'loan', label: 'Loan' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
];

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    name: string, 
    type: FinancingType, 
    amount: number, 
    status: FinancingStatus,
    monthlyCost: number | null,
    notes: string | undefined
  ) => void;
  currencySymbol?: string;
}

export function AddSourceDialog({ open, onOpenChange, onAdd, currencySymbol = '€' }: AddSourceDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancingType>('equity');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<FinancingStatus>('planned');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setType('equity');
      setAmount('');
      setStatus('planned');
      setMonthlyCost('');
      setNotes('');
    }
  }, [open]);

  const amountValue = parseFloat(amount);
  const isValid = name.trim().length > 0 && !isNaN(amountValue) && amountValue > 0;

  const handleAdd = () => {
    if (!isValid) return;
    
    const trimmedName = name.trim();
    const parsedMonthlyCost = type === 'loan' && monthlyCost ? parseFloat(monthlyCost) : null;
    const trimmedNotes = notes.trim() || undefined;
    
    onAdd(trimmedName, type, amountValue, status, parsedMonthlyCost, trimmedNotes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg renix-surface !rounded-none">
        <DialogHeader>
          <DialogTitle data-testid="dialog-add-source-title">
            Add Financing Source
          </DialogTitle>
          <DialogDescription>
            Enter the details for your new financing source.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="source-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Personal Savings, Home Equity Loan"
              autoFocus
              data-testid="input-add-source-name"
              className="border border-border !rounded-none"
            />
          </div>
          
          {/* Type and Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FinancingType)}>
                <SelectTrigger 
                  id="source-type" 
                  data-testid="select-add-source-type" 
                  className="border border-border !rounded-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="renix-surface !rounded-none">
                  {FINANCING_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={status === 'planned' ? 'default' : 'outline'}
                  onClick={() => setStatus('planned')}
                  className="flex-1 toggle-elevate"
                  data-testid="button-status-planned"
                >
                  Planned
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={status === 'confirmed' ? 'default' : 'outline'}
                  onClick={() => setStatus('confirmed')}
                  className="flex-1 toggle-elevate"
                  data-testid="button-status-confirmed"
                >
                  Confirmed
                </Button>
              </div>
            </div>
          </div>
          
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="source-amount">Amount <span className="text-destructive">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="source-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-add-source-amount"
                className="pl-8"
              />
            </div>
          </div>
          
          {/* Monthly Cost - only shown for loans */}
          {type === 'loan' && (
            <div className="space-y-2">
              <Label htmlFor="source-monthly">Monthly Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="source-monthly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyCost}
                  onChange={(e) => setMonthlyCost(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-add-source-monthly"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">Monthly liability for this loan</p>
            </div>
          )}
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="source-notes">Notes</Label>
            <Textarea
              id="source-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional details about this source..."
              data-testid="input-add-source-notes"
              className="min-h-[60px] resize-none"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            data-testid="button-cancel-add-source"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!isValid}
            data-testid="button-confirm-add-source"
          >
            Add Source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceName: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, sourceName, onConfirm }: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="renix-surface !rounded-none">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="dialog-delete-title">
            Delete Financing Source
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="dialog-delete-description">
            Are you sure you want to delete "{sourceName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            data-testid="button-cancel-delete" 
            className="border border-border !rounded-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            data-testid="button-confirm-delete" 
            className="bg-destructive text-destructive-foreground !rounded-none"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface FundingGapConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
  onCancel: () => void;
}

export function FundingGapConfirmDialog({ 
  open, 
  onOpenChange, 
  onProceed, 
  onCancel 
}: FundingGapConfirmDialogProps) {
  const handleProceed = () => {
    onProceed();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="renix-surface !rounded-none">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="dialog-funding-gap-title">
            Funding Gap Warning
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="dialog-funding-gap-description">
            This change creates or widens a funding gap. Do you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleCancel}
            data-testid="button-cancel-funding-gap" 
            className="border border-border !rounded-none"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleProceed} 
            data-testid="button-proceed-funding-gap" 
            className="btn-primary !rounded-none"
          >
            Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { type FinancingType, type FinancingStatus };
