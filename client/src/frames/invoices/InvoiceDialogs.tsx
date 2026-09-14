/**
 * RENIX vNext — Invoices Frame Dialogs
 * 
 * Canon v1.4 Compliant — Phase 10.1
 * 
 * Dialogs for managing Invoice payments and confirmations.
 * 
 * NOTE: Invoice creation is restricted to AI document ingestion only.
 * No manual invoice creation dialogs are exposed.
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useFormatters } from '@/context/ProjectContext';
import type { InvoiceLine } from './useInvoicesData';

// InvoiceDialog REMOVED per Canon v1.4 - Invoice creation is AI-mediated only

interface LineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line?: InvoiceLine;
  currency: string;
  onSave: (label: string, amount: number, description?: string) => void;
}

export function LineDialog({ open, onOpenChange, line, currency, onSave }: LineDialogProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setLabel(line?.label ?? '');
      setAmount(line?.amount?.toString() ?? '');
      setDescription(line?.description ?? '');
    }
  }, [open, line]);

  const handleSave = () => {
    const parsedAmount = parseFloat(amount) || 0;
    onSave(label, parsedAmount, description || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-line-title">
            {line ? 'Edit Line Item' : 'Add Line Item'}
          </DialogTitle>
          <DialogDescription>
            Add a line item to this invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="line-label">Description</Label>
            <Input
              id="line-label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g., Kitchen cabinets installation"
              data-testid="input-line-label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="line-amount">Amount ({currency})</Label>
            <Input
              id="line-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid="input-line-amount"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="line-description">Additional Notes</Label>
            <Textarea
              id="line-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional additional details"
              data-testid="input-line-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-line">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-line">
            {line ? 'Save' : 'Add Line'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceRef: string;
  onConfirm: () => void;
}

export function FinalizeDialog({ open, onOpenChange, invoiceRef, onConfirm }: FinalizeDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-finalize-title">Finalize Invoice</DialogTitle>
          <DialogDescription data-testid="dialog-finalize-description">
            Are you sure you want to finalize "{invoiceRef}"? Once finalized, the invoice cannot be edited.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-finalize">
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-confirm-finalize">
            Finalize
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

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceRef: string;
  invoiceTotal: number;
  amountPaid: number;
  outstanding: number;
  currency: string;
  onSave: (amount: number, paymentDate: string, reference?: string, notes?: string) => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceRef,
  invoiceTotal,
  amountPaid,
  outstanding,
  currency,
  onSave,
}: RecordPaymentDialogProps) {
  const { formatCurrency: projectFormatCurrency } = useFormatters();
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setReference('');
      setNotes('');
    }
  }, [open]);

  const handleSave = () => {
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) return;
    
    onSave(
      parsedAmount,
      paymentDate,
      reference || undefined,
      notes || undefined
    );
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => projectFormatCurrency(value);

  const parsedAmount = parseFloat(amount) || 0;
  const isFullPayment = parsedAmount >= outstanding;
  const newOutstanding = Math.max(0, outstanding - parsedAmount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="drawer-record-payment">
        <SheetHeader>
          <SheetTitle data-testid="dialog-record-payment-title">Record Payment</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Record a payment for invoice "{invoiceRef}".
          </p>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="renix-surface p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Invoice Total</span>
              <span>{formatCurrency(invoiceTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Already Paid</span>
              <span>{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted">Outstanding</span>
              <span className={outstanding > 0 ? 'text-warning' : 'text-success'}>{formatCurrency(outstanding)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount ({currency})</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid="input-payment-amount"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-muted">
                {isFullPayment 
                  ? 'This will fully pay the invoice.' 
                  : `Remaining after payment: ${formatCurrency(newOutstanding)}`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment Date</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              data-testid="input-payment-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference (Optional)</Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g., Check #1234, Wire Transfer"
              data-testid="input-payment-reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (Optional)</Label>
            <Textarea
              id="payment-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional payment details"
              data-testid="input-payment-notes"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-payment">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={parsedAmount <= 0}
            data-testid="button-save-payment"
          >
            Record Payment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
