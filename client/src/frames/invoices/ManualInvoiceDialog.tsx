import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
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
import { CurrencyInput } from '@/components/CurrencyInput';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ScopeNode } from '@/frames/scope/useScopeTreeData';

interface LineItem {
  label: string;
  amount: number | null;
  description: string;
}

function createEmptyLine(): LineItem {
  return { label: '', amount: null, description: '' };
}

interface ManualInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  directCostScopes: ScopeNode[];
  currency: string;
}

export function ManualInvoiceDialog({
  open,
  onOpenChange,
  projectId,
  directCostScopes,
  currency,
}: ManualInvoiceDialogProps) {
  const { toast } = useToast();

  const [vendorName, setVendorName] = useState('');
  const [reference, setReference] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [scopeId, setScopeId] = useState('');
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()]);

  useEffect(() => {
    if (open) {
      setVendorName('');
      setReference('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setNotes('');
      setScopeId(directCostScopes.length === 1 ? directCostScopes[0].id : '');
      setLines([createEmptyLine()]);
    }
  }, [open, directCostScopes]);

  const mutation = useMutation({
    mutationFn: async (data: {
      vendorName: string;
      reference?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
      scopeId: string;
      lines: { label: string; amount: number; description?: string }[];
    }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/invoices/manual`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices(projectId) });
      toast({ title: 'Invoice created', description: 'Manual invoice has been created successfully.' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addLine = () => {
    setLines(prev => [...prev, createEmptyLine()]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const updateLine = (index: number, field: keyof LineItem, value: string | number | null) => {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const handleSubmit = () => {
    const validLines = lines
      .filter(l => l.label.trim() && l.amount !== null && l.amount > 0)
      .map(l => ({
        label: l.label.trim(),
        amount: Math.round(l.amount! * 100),
        description: l.description.trim() || undefined,
      }));

    if (!vendorName.trim() || !scopeId || validLines.length === 0) return;

    mutation.mutate({
      vendorName: vendorName.trim(),
      reference: reference.trim() || undefined,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      scopeId,
      lines: validLines,
    });
  };

  const hasValidLines = lines.some(l => l.label.trim() && l.amount !== null && l.amount > 0);
  const canSubmit = vendorName.trim() && scopeId && hasValidLines && !mutation.isPending;

  const currencySymbol = currency === 'EUR' ? '\u20AC' : currency === 'USD' ? '$' : currency === 'GBP' ? '\u00A3' : currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-manual-invoice-title">Create Invoice</DialogTitle>
          <DialogDescription>
            Create a manual invoice for a direct-cost scope.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="manual-invoice-vendor">Vendor / Payee</Label>
            <Input
              id="manual-invoice-vendor"
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="e.g., Contractor name"
              data-testid="input-manual-invoice-vendor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-invoice-reference">Reference (optional)</Label>
            <Input
              id="manual-invoice-reference"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g., INV-2025-001"
              data-testid="input-manual-invoice-reference"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-invoice-issue-date">Issue Date</Label>
              <Input
                id="manual-invoice-issue-date"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                data-testid="input-manual-invoice-issue-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-invoice-due-date">Due Date (optional)</Label>
              <Input
                id="manual-invoice-due-date"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                data-testid="input-manual-invoice-due-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-invoice-scope">Scope</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger data-testid="select-manual-invoice-scope">
                <SelectValue placeholder="Select a direct-cost scope" />
              </SelectTrigger>
              <SelectContent>
                {directCostScopes.map(scope => (
                  <SelectItem key={scope.id} value={scope.id} data-testid={`select-scope-option-${scope.id}`}>
                    {scope.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addLine}
                data-testid="button-add-line-item"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Line {index + 1}</span>
                  {lines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      data-testid={`button-remove-line-${index}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={line.label}
                      onChange={e => updateLine(index, 'label', e.target.value)}
                      placeholder="e.g., Installation work"
                      data-testid={`input-line-label-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount ({currencySymbol})</Label>
                    <CurrencyInput
                      value={line.amount}
                      onChange={v => updateLine(index, 'amount', v)}
                      placeholder="0.00"
                      data-testid={`input-line-amount-${index}`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description (optional)</Label>
                  <Input
                    value={line.description}
                    onChange={e => updateLine(index, 'description', e.target.value)}
                    placeholder="Additional details"
                    data-testid={`input-line-description-${index}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-invoice-notes">Notes (optional)</Label>
            <Textarea
              id="manual-invoice-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes about this invoice"
              data-testid="input-manual-invoice-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-manual-invoice"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="button-submit-manual-invoice"
          >
            {mutation.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
