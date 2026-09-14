/**
 * RENIX vNext — Quotes Frame Dialogs
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Dialogs for managing vendors, quotes, and versions.
 * Acceptance is explicit and irreversible.
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Vendor, Quote } from './useQuotesData';
import { useRegionalContext } from '../../context/ProjectContext';

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor;
  onSave: (name: string, contactInfo?: string, notes?: string) => void;
}

export function VendorDialog({ open, onOpenChange, vendor, onSave }: VendorDialogProps) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName(vendor?.name ?? '');
      setNotes(vendor?.notes ?? '');
    }
  }, [open, vendor]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), undefined, notes.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-vendor-title">
            {vendor ? 'Edit Vendor' : 'Add Vendor'}
          </DialogTitle>
          <DialogDescription>
            Vendors are external parties who provide quotes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., ABC Builders"
              data-testid="input-vendor-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              data-testid="input-vendor-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-vendor">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()} data-testid="button-save-vendor">
            {vendor ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: Quote;
  vendors: Vendor[];
  defaultVendorId?: string;
  onSave: (vendorId: string, reference: string, description?: string) => void;
}

export function QuoteDialog({ open, onOpenChange, quote, vendors, defaultVendorId, onSave }: QuoteDialogProps) {
  const [vendorId, setVendorId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setVendorId(quote?.vendorId ?? defaultVendorId ?? '');
      setDescription(quote?.description ?? '');
    }
  }, [open, quote, defaultVendorId]);

  const handleSave = () => {
    if (!vendorId || !description.trim()) return;
    onSave(vendorId, '', description.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-quote-title">
            {quote ? 'Edit Quote' : 'Add Quote'}
          </DialogTitle>
          <DialogDescription>
            A quote is a vendor-authored market assertion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quote-vendor">Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId} disabled={!!quote}>
              <SelectTrigger data-testid="select-quote-vendor">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-description">Description</Label>
            <Textarea
              id="quote-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this quote covers"
              data-testid="input-quote-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-quote">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!vendorId || !description.trim()} data-testid="button-save-quote">
            {quote ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AcceptConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteName: string;
  versionNumber: number;
  total: number;
  currency: string;
  onConfirm: () => void;
}

export function AcceptConfirmDialog({ open, onOpenChange, quoteName, versionNumber, total, currency, onConfirm }: AcceptConfirmDialogProps) {
  const { locale } = useRegionalContext();
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(total);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-accept-title">
            Accept Quote Version
          </DialogTitle>
          <DialogDescription data-testid="dialog-accept-description">
            This action is irreversible. Accepting this version commits to the quoted terms.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <p className="text-sm">
            <span className="text-secondary">Quote:</span>{' '}
            <span className="font-medium">{quoteName}</span>
          </p>
          <p className="text-sm">
            <span className="text-secondary">Version:</span>{' '}
            <span className="font-medium">v{versionNumber}</span>
          </p>
          <p className="text-sm">
            <span className="text-secondary">Total:</span>{' '}
            <span className="font-medium">{formatted}</span>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-accept">
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-confirm-accept">
            Accept Quote
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
