import { useState } from 'react';
import { Pencil, Save, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ExtractedQuote, ExtractedLineItem } from './QuoteWorkspaceTypes';

function isSubtotalRow(item: ExtractedLineItem): boolean {
  if (item.quantity || item.unitPrice) return false;
  if (!item.amount) return false;
  const desc = (item.description || '').toLowerCase();
  return /zwischensumme|subtotal|summe|sub-total|total\b|netto|brutto|gesamt/.test(desc)
    || desc.trim() === '';
}

interface DerivedQuoteViewProps {
  extractedData: ExtractedQuote;
  currencySymbol: string;
  formatCurrency?: (amount: number) => string;
}

export function DerivedQuoteView({ extractedData, currencySymbol, formatCurrency }: DerivedQuoteViewProps) {
  const fmtCurrency = (val: number) => formatCurrency ? formatCurrency(val) : `${extractedData.currency ?? currencySymbol}${val.toFixed(2)}`;
  return (
    <div className="space-y-6">
      <Card className="border-subtle">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Line Items ({extractedData.lineItems.filter(i => !isSubtotalRow(i)).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {extractedData.lineItems.filter(i => !isSubtotalRow(i)).length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto] gap-4 text-xs text-muted uppercase tracking-wider pb-2 border-b border-subtle">
                <span>Description</span>
                <span className="text-right">Amount</span>
              </div>
              {extractedData.lineItems.filter(i => !isSubtotalRow(i)).map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_auto] gap-4 text-sm py-2 border-b border-subtle/20 last:border-0"
                  data-testid={`extracted-line-item-${index}`}
                >
                  <div>
                    <span>{item.description}</span>
                    {item.quantity && item.unit && (
                      <p className="text-xs text-muted mt-1">
                        {item.quantity} {item.unit} @ {item.unitPrice != null ? fmtCurrency(item.unitPrice) : '—'}
                      </p>
                    )}
                  </div>
                  <span className="text-right tabular-nums">
                    {fmtCurrency(item.amount ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted italic text-center py-4">
              No line items extracted.
            </p>
          )}
        </CardContent>
      </Card>

      {extractedData.notes && (
        <Card className="border-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary" data-testid="text-extracted-notes">
              {extractedData.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface EditableDerivedQuoteViewProps {
  extractedData: ExtractedQuote;
  isReadOnly: boolean;
  currencySymbol: string;
  formatCurrency?: (amount: number) => string;
  onUpdateExtractedData: (data: ExtractedQuote) => void;
}

export function EditableDerivedQuoteView({ 
  extractedData, 
  isReadOnly,
  currencySymbol,
  formatCurrency,
  onUpdateExtractedData 
}: EditableDerivedQuoteViewProps) {
  const fmtCurrency = (val: number) => formatCurrency ? formatCurrency(val) : `${extractedData.currency ?? currencySymbol}${val.toFixed(2)}`;
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingLineItem, setEditingLineItem] = useState<{ index: number; field: string } | null>(null);
  const [lineItemEditValue, setLineItemEditValue] = useState('');

  const startEditing = (field: string, value: string) => {
    if (isReadOnly) return;
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = (field: string) => {
    const updatedData = { ...extractedData };
    switch (field) {
      case 'vendorName':
        updatedData.vendorName = editValue;
        break;
      case 'vendorContact':
        updatedData.vendorContact = editValue;
        break;
      case 'vendorEmail':
        updatedData.vendorEmail = editValue;
        break;
      case 'vendorPhone':
        updatedData.vendorPhone = editValue;
        break;
      case 'reference':
        updatedData.reference = editValue;
        break;
      case 'date':
        updatedData.date = editValue;
        break;
      case 'validUntil':
        updatedData.validUntil = editValue;
        break;
      case 'total':
        updatedData.total = parseFloat(editValue) || 0;
        break;
    }
    onUpdateExtractedData(updatedData);
    setEditingField(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const startEditingLineItem = (index: number, field: string, value: string | number | undefined) => {
    if (isReadOnly) return;
    setEditingLineItem({ index, field });
    setLineItemEditValue(value?.toString() ?? '');
  };

  const saveLineItemEdit = () => {
    if (!editingLineItem) return;
    const { index, field } = editingLineItem;
    const updatedLineItems = [...extractedData.lineItems];
    const item = { ...updatedLineItems[index] };

    switch (field) {
      case 'description':
        item.description = lineItemEditValue;
        break;
      case 'quantity':
        item.quantity = parseFloat(lineItemEditValue) || undefined;
        break;
      case 'unit':
        item.unit = lineItemEditValue || undefined;
        break;
      case 'unitPrice':
        item.unitPrice = parseFloat(lineItemEditValue) || undefined;
        break;
      case 'amount':
        item.amount = parseFloat(lineItemEditValue) || 0;
        break;
    }

    updatedLineItems[index] = item;
    
    const billable = updatedLineItems.filter(i => !isSubtotalRow(i));
    const newSubtotal = billable.reduce((sum, li) => sum + (li.amount ?? 0), 0);
    
    let newTax: number | undefined;
    let newTotal: number;
    
    if (extractedData.taxRate !== undefined) {
      newTax = newSubtotal * extractedData.taxRate;
      newTotal = newSubtotal + newTax;
    } else if (extractedData.tax !== undefined && extractedData.subtotal !== undefined && extractedData.subtotal > 0) {
      const derivedTaxRate = extractedData.tax / extractedData.subtotal;
      newTax = newSubtotal * derivedTaxRate;
      newTotal = newSubtotal + newTax;
    } else {
      newTax = extractedData.tax;
      newTotal = newSubtotal + (newTax ?? 0);
    }

    onUpdateExtractedData({
      ...extractedData,
      lineItems: updatedLineItems,
      subtotal: newSubtotal,
      tax: newTax,
      total: newTotal,
    });
    setEditingLineItem(null);
  };

  const cancelLineItemEdit = () => {
    setEditingLineItem(null);
    setLineItemEditValue('');
  };

  const deleteLineItem = (index: number) => {
    const updatedLineItems = extractedData.lineItems.filter((_, i) => i !== index);
    const billable = updatedLineItems.filter(i => !isSubtotalRow(i));
    const newSubtotal = billable.reduce((sum, li) => sum + (li.amount ?? 0), 0);

    let newTax: number | undefined;
    let newTotal: number;

    if (extractedData.taxRate !== undefined) {
      newTax = newSubtotal * extractedData.taxRate;
      newTotal = newSubtotal + newTax;
    } else if (extractedData.tax !== undefined && extractedData.subtotal !== undefined && extractedData.subtotal > 0) {
      const derivedTaxRate = extractedData.tax / extractedData.subtotal;
      newTax = newSubtotal * derivedTaxRate;
      newTotal = newSubtotal + newTax;
    } else {
      newTax = extractedData.tax;
      newTotal = newSubtotal + (newTax ?? 0);
    }

    onUpdateExtractedData({
      ...extractedData,
      lineItems: updatedLineItems,
      subtotal: newSubtotal,
      tax: newTax,
      total: newTotal,
    });
  };

  const EditableField = ({ 
    field, 
    label, 
    value, 
    testId 
  }: { 
    field: string; 
    label: string; 
    value: string | undefined; 
    testId: string;
  }) => {
    const isEditing = editingField === field;
    const displayValue = value ?? 'Not extracted';

    return (
      <div className="flex justify-between items-center text-sm gap-2">
        <span className="text-muted">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(field);
                if (e.key === 'Escape') cancelEdit();
              }}
              data-testid={`input-edit-${field}`}
            />
            <Button size="icon" variant="ghost" onClick={() => saveEdit(field)}>
              <Save className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" onClick={cancelEdit}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span data-testid={testId}>{displayValue}</span>
            {!isReadOnly && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="opacity-50 hover:opacity-100"
                onClick={() => startEditing(field, value ?? '')}
                data-testid={`button-edit-${field}`}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {(() => {
          const billableItems = extractedData.lineItems
            .map((item, originalIndex) => ({ item, originalIndex }))
            .filter(({ item }) => !isSubtotalRow(item));
          return (
            <>
        <div className="text-sm font-medium text-foreground mb-2">Line Items ({billableItems.length})</div>
        {billableItems.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Qty</th>
                  <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Unit Price</th>
                  <th className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                  {!isReadOnly && <th className="p-2 w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {billableItems.map(({ item, originalIndex: index }) => {
                  const isEditingThis = editingLineItem?.index === index;
                  const editingFieldName = editingLineItem?.field;

                  const EditableCell = ({ field, value, align = 'left', isNumeric = false, formatValue }: { 
                    field: string; 
                    value: string | number | undefined; 
                    align?: 'left' | 'right';
                    isNumeric?: boolean;
                    formatValue?: (v: any) => string;
                  }) => {
                    const isEditing = isEditingThis && editingFieldName === field;
                    const displayValue = value ?? '—';
                    const alignClass = align === 'right' ? 'text-right' : 'text-left';
                    
                    if (isEditing) {
                      return (
                        <div className="flex items-center gap-1">
                          <Input
                            value={lineItemEditValue}
                            onChange={(e) => setLineItemEditValue(e.target.value)}
                            className={`h-6 text-xs ${isNumeric ? 'w-20 text-right' : 'w-full'}`}
                            type={isNumeric ? 'number' : 'text'}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLineItemEdit();
                              if (e.key === 'Escape') cancelLineItemEdit();
                            }}
                            data-testid={`input-edit-line-${index}-${field}`}
                          />
                          <Button size="icon" variant="ghost" onClick={saveLineItemEdit}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelLineItemEdit}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <span 
                        className={`${alignClass} ${!isReadOnly ? 'cursor-pointer hover:underline' : ''} tabular-nums`}
                        onClick={() => !isReadOnly && startEditingLineItem(index, field, value)}
                        data-testid={`text-line-${index}-${field}`}
                      >
                        {formatValue ? formatValue(displayValue) : (isNumeric && typeof displayValue === 'number' 
                          ? fmtCurrency(displayValue)
                          : displayValue)}
                      </span>
                    );
                  };

                  return (
                    <tr key={index} className="border-b border-border last:border-b-0" data-testid={`extracted-line-item-${index}`}>
                      <td className="p-2 text-foreground">
                        <EditableCell field="description" value={item.description} />
                      </td>
                      <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                        <EditableCell 
                          field="quantity" 
                          value={item.quantity} 
                          align="right" 
                          isNumeric 
                          formatValue={(v) => {
                            if (v === '—') return '—';
                            return `${v}${item.unit ? ` ${item.unit}` : ''}`;
                          }}
                        />
                      </td>
                      <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                        <EditableCell field="unitPrice" value={item.unitPrice} align="right" isNumeric />
                      </td>
                      <td className="p-2 text-right text-foreground whitespace-nowrap">
                        <EditableCell field="amount" value={item.amount} align="right" isNumeric />
                      </td>
                      {!isReadOnly && (
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="opacity-50 hover:opacity-100 h-6 w-6"
                              onClick={() => startEditingLineItem(index, 'description', item.description)}
                              data-testid={`button-edit-line-${index}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="opacity-50 hover:opacity-100 text-destructive h-6 w-6"
                              onClick={() => deleteLineItem(index)}
                              data-testid={`button-delete-line-${index}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted italic text-center py-4">No line items extracted.</p>
        )}
            </>
          );
        })()}
      </div>

      {extractedData.notes && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Notes</h3>
          <p className="text-sm text-secondary pl-2 border-l-2 border-subtle">{extractedData.notes}</p>
        </div>
      )}
    </div>
  );
}
