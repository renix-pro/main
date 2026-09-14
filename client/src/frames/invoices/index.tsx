/**
 * RENIX vNext — Invoices Frame
 * 
 * Canon v1.4 Compliant — Phase 10
 * CFS 3-Zone Layout
 * 
 * The Invoices Frame records financial reality.
 * It captures what was actually invoiced, by whom, and for what.
 * It is factual, evidentiary, and retrospective.
 * 
 * Zone Structure:
 * - Zone 1: KPI Strip (Total Invoiced, Total Paid, Total Outstanding)
 * - Zone 2: Canonical Scope Tree with invoices as leaf nodes
 * - Zone 3: Detail View (Invoice identity, payments, actions)
 * 
 * CRITICAL: Zone 2 ALWAYS renders the canonical scope tree.
 * Invoices appear as leaf nodes under their associated scopes.
 * The scope tree is NEVER hidden, even when no invoices exist.
 * 
 * Core invariants:
 * - Invoices represent financial reality, not intent
 * - Finalized invoices are immutable
 * - Invoices never mutate Budget, Quotes, Financing, or Execution
 * - Missing invoices are a valid state
 * - Invoices are AI-generated from documents (no manual creation)
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Building2, CreditCard, Receipt, Trash2, Plus } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScopeTreeData } from '@/frames/scope/useScopeTreeData';
import {
  Zone1Posture,
  Zone1ATiles,
  Zone1BVisual,
  Zone2Explore,
} from '@/layout/CFSLayout';
import { PostureTile } from '@/components/tiles';
import { KPIRing } from '@/components/KPIBand';
import { 
  useInvoicesData, 
  type Invoice, 
  getInvoiceDisplayStatus,
} from './useInvoicesData';
import { InvoicesTree, UNASSIGNED_SCOPE_ID, type InvoicesTreeNodeData } from './InvoicesTree';
import type { TreeNodeRenderProps } from '@/components/GenericTree/types';
import { RecordPaymentDialog, DeleteConfirmDialog } from './InvoiceDialogs';
import { ManualInvoiceDialog } from './ManualInvoiceDialog';
import { InvoicesSkeleton } from '@/components/FrameSkeleton';

// Simplified dialog state - invoices are immutable after ingestion
// Only payment recording is supported post-ingestion
type DialogState =
  | { type: 'none' }
  | { type: 'record-payment'; invoice: Invoice }
  | { type: 'delete-payment'; invoiceId: string; paymentId: string }
  | { type: 'delete-invoice'; invoice: Invoice };

type SelectionType = 
  | { type: 'none' }
  | { type: 'scope'; scopeId: string }
  | { type: 'invoice'; invoice: Invoice };

export function InvoicesFrame() {
  const { projectId, isReadOnly, formatCurrency, currency } = useProject();
  const invoicesData = useInvoicesData(projectId, isReadOnly);
  const scopeTreeData = useScopeTreeData(projectId, isReadOnly);

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [selection, setSelection] = useState<SelectionType>({ type: 'none' });
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false);

  const directCostScopes = useMemo(() => {
    if (!scopeTreeData.nodes) return [];
    return scopeTreeData.nodes.filter(n => n.costType === 'direct');
  }, [scopeTreeData.nodes]);

  const closeDialog = () => setDialog({ type: 'none' });

  const scopeInvoiceMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const invoice of invoicesData.confirmedInvoices) {
      // Group by scopeId, or use unassigned key for invoices without scope
      const key = invoice.scopeId || UNASSIGNED_SCOPE_ID;
      const existing = map.get(key) || [];
      existing.push(invoice.id);
      map.set(key, existing);
    }
    return map;
  }, [invoicesData.confirmedInvoices]);

  const selectedId = useMemo(() => {
    if (selection.type === 'scope') return `scope:${selection.scopeId}`;
    if (selection.type === 'invoice') return `invoice:${selection.invoice.id}`;
    return null;
  }, [selection]);

  const handleSelectScope = useCallback((scopeId: string) => {
    setSelection(prev => 
      prev.type === 'scope' && prev.scopeId === scopeId 
        ? { type: 'none' } 
        : { type: 'scope', scopeId }
    );
  }, []);

  const handleSelectInvoice = useCallback((invoiceId: string) => {
    setSelection(prev => {
      if (prev.type === 'invoice' && prev.invoice.id === invoiceId) {
        return { type: 'none' };
      }
      const invoice = invoicesData.confirmedInvoices.find((inv: Invoice) => inv.id === invoiceId);
      return invoice ? { type: 'invoice', invoice } : prev;
    });
  }, [invoicesData.confirmedInvoices]);

  const handleQuickPay = useCallback((invoiceId: string) => {
    const invoice = invoicesData.confirmedInvoices.find((inv: Invoice) => inv.id === invoiceId);
    if (invoice && invoice.outstanding > 0) {
      setDialog({ type: 'record-payment', invoice });
    }
  }, [invoicesData.confirmedInvoices]);

  const handleRecordPayment = (amount: number, paymentDate: string, reference?: string, notes?: string) => {
    if (dialog.type === 'record-payment') {
      invoicesData.recordPayment(dialog.invoice.id, amount, paymentDate, reference, notes);
    }
    closeDialog();
  };

  const renderExpandedDetail = useCallback((props: TreeNodeRenderProps<InvoicesTreeNodeData>) => {
    const { node } = props;

    if (node.nodeType === 'scope') {
      const scopeId = node.scopeId || node.id.replace('scope:', '');
      const scopeNode = scopeId === UNASSIGNED_SCOPE_ID
        ? { id: UNASSIGNED_SCOPE_ID, name: 'Unassigned Invoices', description: null }
        : scopeTreeData.getNode(scopeId);
      if (!scopeNode) return null;
      const invoiceIds = scopeInvoiceMap.get(scopeId) || [];
      const nodeInvoices = invoicesData.confirmedInvoices.filter((inv: Invoice) => invoiceIds.includes(inv.id));
      return (
        <ScopeDetailView
          scopeNode={scopeNode}
          invoices={nodeInvoices}
          formatCurrency={formatCurrency}
          onSelectInvoice={(invoice) => setSelection({ type: 'invoice', invoice })}
          onRecordPayment={(invoice) => setDialog({ type: 'record-payment', invoice })}
          isReadOnly={isReadOnly}
        />
      );
    }

    if (node.nodeType === 'invoice' && node.invoiceId) {
      const invoice = invoicesData.confirmedInvoices.find((inv: Invoice) => inv.id === node.invoiceId);
      if (!invoice) return null;
      return (
        <InvoiceDetailView
          invoice={invoice}
          currency={currency}
          formatCurrency={formatCurrency}
          isReadOnly={isReadOnly}
          onRecordPayment={() => setDialog({ type: 'record-payment', invoice })}
          onDeletePayment={(paymentId) => setDialog({ type: 'delete-payment', invoiceId: invoice.id, paymentId })}
          onDeleteInvoice={() => setDialog({ type: 'delete-invoice', invoice })}
        />
      );
    }

    return null;
  }, [scopeTreeData, scopeInvoiceMap, invoicesData.confirmedInvoices, formatCurrency, currency, isReadOnly]);

  if (invoicesData.isLoading) return <InvoicesSkeleton />;

  return (
    <motion.div
      className="h-full"
      data-testid="frame-invoices"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
        <Zone1Posture data-testid="invoices-zone1">
          <Zone1ATiles data-testid="invoices-kpi-tiles">
            <div className="flex items-center justify-between gap-4 flex-wrap" data-testid="invoices-zone1a-header">
              <PostureTile
                label="Total Invoiced"
                value={formatCurrency(invoicesData.totalInvoiced)}
                subtext={`${invoicesData.confirmedInvoices.length} confirmed invoices`}
                statusTint="pending"
                className="flex-1 min-w-[180px]"
              />
              {!isReadOnly && directCostScopes.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualInvoiceOpen(true)}
                  data-testid="button-create-manual-invoice"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Invoice
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4" data-testid="invoices-kpi-grid">
              <PostureTile
                label="Total Paid"
                value={formatCurrency(invoicesData.totalPaid)}
                subtext={`${invoicesData.paidCount} fully paid`}
                statusTint="approved"
              />
              <PostureTile
                label="Total Outstanding"
                value={formatCurrency(invoicesData.totalOutstanding)}
                subtext={invoicesData.totalOutstanding > 0 ? 'Pending payments' : 'All paid'}
                statusTint={invoicesData.totalOutstanding > 0 ? 'draft' : 'approved'}
              />
            </div>
          </Zone1ATiles>
          <Zone1BVisual data-testid="invoices-payment-ring-strip">
            {invoicesData.confirmedInvoices.length > 0 && invoicesData.totalInvoiced > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <KPIRing
                  value={invoicesData.totalPaid}
                  max={invoicesData.totalInvoiced}
                  size={120}
                  strokeWidth={8}
                  color={invoicesData.totalPaid >= invoicesData.totalInvoiced ? 'ok' : 'warning'}
                />
                <div className="flex flex-col items-center">
                  <span
                    className="text-lg font-semibold text-foreground tabular-nums"
                    data-testid="text-payment-percentage"
                  >
                    {Math.round((invoicesData.totalPaid / invoicesData.totalInvoiced) * 100)}% paid
                  </span>
                  <span
                    className="text-sm text-muted-foreground"
                    data-testid="text-payment-summary"
                  >
                    {formatCurrency(invoicesData.totalPaid)} of {formatCurrency(invoicesData.totalInvoiced)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center" data-testid="text-payment-empty">
                Payment progress appears when invoices are confirmed
              </p>
            )}
          </Zone1BVisual>
        </Zone1Posture>

        <Zone2Explore data-testid="invoices-zone2">
          <InvoicesTree
            scopeNodes={scopeTreeData.rootNodes || []}
            invoices={invoicesData.confirmedInvoices}
            scopeInvoiceMap={scopeInvoiceMap}
            selectedId={selectedId}
            onSelectScope={handleSelectScope}
            onSelectInvoice={handleSelectInvoice}
            onQuickPay={isReadOnly ? undefined : handleQuickPay}
            formatCurrency={formatCurrency}
            renderExpandedDetail={renderExpandedDetail}
          />
        </Zone2Explore>

      <RecordPaymentDialog
        open={dialog.type === 'record-payment'}
        onOpenChange={(open) => !open && closeDialog()}
        invoiceRef={dialog.type === 'record-payment' ? (dialog.invoice.reference || dialog.invoice.vendorName) : ''}
        invoiceTotal={dialog.type === 'record-payment' ? dialog.invoice.lines.reduce((sum, l) => sum + l.amount, 0) : 0}
        amountPaid={dialog.type === 'record-payment' ? dialog.invoice.totalPaid : 0}
        outstanding={dialog.type === 'record-payment' ? dialog.invoice.outstanding : 0}
        currency={currency}
        onSave={handleRecordPayment}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-payment'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Payment"
        description="Are you sure you want to remove this payment record? The invoice status will be updated accordingly."
        onConfirm={() => {
          if (dialog.type === 'delete-payment') {
            invoicesData.deletePayment(dialog.invoiceId, dialog.paymentId);
          }
          closeDialog();
        }}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-invoice'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Invoice"
        description="This will permanently delete this invoice, including all line items and payment records. Any linked documents will be unlinked but not deleted."
        onConfirm={() => {
          if (dialog.type === 'delete-invoice') {
            invoicesData.deleteInvoice(dialog.invoice.id);
            setSelection({ type: 'none' });
          }
          closeDialog();
        }}
      />

      <ManualInvoiceDialog
        open={manualInvoiceOpen}
        onOpenChange={setManualInvoiceOpen}
        projectId={projectId}
        directCostScopes={directCostScopes}
        currency={currency}
      />
    </motion.div>
  );
}

interface ScopeDetailViewProps {
  scopeNode: { id: string; name: string; description: string | null };
  invoices: Invoice[];
  formatCurrency: (value: number | null) => string;
  onSelectInvoice: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
  isReadOnly: boolean;
}

function ScopeDetailView({ scopeNode, invoices, formatCurrency, onSelectInvoice, onRecordPayment, isReadOnly }: ScopeDetailViewProps) {
  const totalInvoiced = invoices.reduce((sum, inv) => 
    sum + inv.lines.reduce((lsum, l) => lsum + l.amount, 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.totalPaid, 0);
  const outstanding = totalInvoiced - totalPaid;

  return (
    <div className="renix-surface p-6 space-y-4" data-testid="scope-detail-view">
      <div className="pb-2">
        <h3 className="text-lg font-medium">{scopeNode.name}</h3>
        {scopeNode.description && (
          <p className="text-sm text-muted-foreground">{scopeNode.description}</p>
        )}
      </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Invoiced</div>
            <div className="text-lg font-medium">{formatCurrency(totalInvoiced)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="text-lg font-medium text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className="text-lg font-medium text-warning">{formatCurrency(outstanding)}</div>
          </div>
        </div>

        {invoices.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Invoices ({invoices.length})</h4>
            <div className="space-y-2">
              {invoices.map((invoice) => {
                const status = getInvoiceDisplayStatus(invoice);
                const isFinalized = invoice.status === 'finalized';
                const hasOutstanding = invoice.outstanding > 0;
                return (
                  <div
                    key={invoice.id}
                    className="p-2 rounded-md border hover-elevate cursor-pointer space-y-2"
                    onClick={() => onSelectInvoice(invoice)}
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{invoice.vendorName}</span>
                        {status && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {status}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm tabular-nums shrink-0">
                        {formatCurrency(invoice.lines.reduce((sum, l) => sum + l.amount, 0))}
                      </span>
                    </div>
                    {!isReadOnly && isFinalized && hasOutstanding && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecordPayment(invoice);
                        }}
                        data-testid={`button-record-payment-${invoice.id}`}
                      >
                        <CreditCard className="h-4 w-4 mr-1.5" />
                        Record Payment
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No invoices recorded for this scope.
            <br />
            <span className="text-xs">Invoices capture financial reality. Upload invoice documents via the AI Companion — data will be extracted and linked automatically.</span>
          </div>
        )}
    </div>
  );
}

interface InvoiceDetailViewProps {
  invoice: Invoice;
  currency: string;
  formatCurrency: (value: number | null) => string;
  isReadOnly: boolean;
  onRecordPayment: () => void;
  onDeletePayment: (paymentId: string) => void;
  onDeleteInvoice: () => void;
}

/**
 * InvoiceDetailView - Canon v1.4 Compliant
 * 
 * Displays invoice details in a structure that mirrors QuoteFocusPanel.
 * Invoices have no draft state - they are finalized upon ingestion.
 * 
 * Structure:
 * - Header: Vendor + Reference + Status Badge
 * - Totals: Right-aligned prominent display
 * - Dates: Issue/Due in 2-column grid
 * - Financial Summary: Total/Paid/Outstanding KPIs
 * - Line Items: List with amounts (immutable after ingestion)
 * - Payments: Payment history
 * - Actions: Record Payment (when outstanding > 0)
 */
function InvoiceDetailView({
  invoice,
  formatCurrency,
  isReadOnly,
  onRecordPayment,
  onDeletePayment,
  onDeleteInvoice,
}: InvoiceDetailViewProps) {
  const totalAmount = invoice.lines.reduce((sum, l) => sum + l.amount, 0);
  const status = getInvoiceDisplayStatus(invoice);
  const isFinalized = invoice.status === 'finalized';
  const isPaid = invoice.status === 'paid';

  // Separate VAT/Tax line items from regular line items for display
  const regularLines = invoice.lines.filter(l => !l.label.startsWith('VAT/Tax'));
  const taxLines = invoice.lines.filter(l => l.label.startsWith('VAT/Tax'));
  const subtotal = regularLines.reduce((sum, l) => sum + l.amount, 0);
  const taxTotal = taxLines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div
      className="renix-surface p-6 space-y-6"
      data-testid={`invoice-detail-view-${invoice.id}`}
    >
      {/* Header - matches QuoteFocusPanel header structure */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              className="text-xl font-semibold"
              data-testid={`text-invoice-ref-${invoice.id}`}
            >
              {invoice.reference || 'Invoice'}
            </h2>
            {status && (
              <Badge
                variant="outline"
                className={`border-subtle text-xs ${
                  isPaid 
                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' 
                    : ''
                }`}
                data-testid={`badge-invoice-status-${invoice.id}`}
              >
                {status}
              </Badge>
            )}
          </div>
          <p
            className="text-sm text-muted"
            data-testid={`text-invoice-vendor-${invoice.id}`}
          >
            <Building2 className="h-4 w-4 inline mr-1" />
            {invoice.vendorName}
          </p>
          {invoice.notes && (
            <p
              className="text-sm text-muted mt-2"
              data-testid={`text-invoice-notes-${invoice.id}`}
            >
              {invoice.notes}
            </p>
          )}
        </div>

        {/* Prominent total display - matches QuoteFocusPanel */}
        <div className="text-right">
          <div
            className="text-2xl font-semibold tabular-nums"
            data-testid={`text-invoice-total-${invoice.id}`}
          >
            {formatCurrency(totalAmount)}
          </div>
          <div className="text-xs text-muted">Invoice total</div>
        </div>
      </header>

      {/* Dates section */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Issue Date
          </div>
          <div>{invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : 'Not set'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Due Date
          </div>
          <div>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set'}</div>
        </div>
      </div>

      {/* Financial summary - KPI strip style */}
      <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-md">
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-medium tabular-nums">{formatCurrency(totalAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="text-lg font-medium text-green-600 dark:text-green-400 tabular-nums">
            {formatCurrency(invoice.totalPaid)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="text-lg font-medium text-warning tabular-nums">
            {formatCurrency(invoice.outstanding)}
          </div>
        </div>
      </div>

      {/* Line Items section - immutable, no edit/delete */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted">
          Line Items ({invoice.lines.length})
        </h3>
        {invoice.lines.length > 0 ? (
          <div className="space-y-1">
            {regularLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between p-2 rounded-md border text-sm"
                data-testid={`line-item-${line.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{line.label}</div>
                  {line.description && (
                    <div className="text-xs text-muted-foreground truncate">{line.description}</div>
                  )}
                </div>
                <span className="tabular-nums">{formatCurrency(line.amount)}</span>
              </div>
            ))}
            
            {/* Subtotal/Tax/Total summary */}
            {taxLines.length > 0 && (
              <div className="border-t pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal (net)</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {taxLines.map((line) => (
                  <div key={line.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{line.label}</span>
                    <span className="tabular-nums">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium border-t pt-1">
                  <span>Total (gross)</span>
                  <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
            No line items recorded.
          </div>
        )}
      </div>

      {/* Payments section */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted">
            Payments ({invoice.payments.length})
          </h3>
          <div className="space-y-1">
            {invoice.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-2 rounded-md border text-sm"
                data-testid={`payment-row-${payment.id}`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <span>{new Date(payment.paymentDate).toLocaleDateString()}</span>
                  {payment.reference && (
                    <span className="text-muted-foreground">({payment.reference})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-green-600">{formatCurrency(payment.amount)}</span>
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeletePayment(payment.id)}
                      data-testid={`button-delete-payment-${payment.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-subtle/20">
          {isFinalized && invoice.outstanding > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecordPayment}
              className="border-subtle"
              data-testid="button-record-payment"
            >
              Record Payment
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteInvoice}
            data-testid="button-delete-invoice"
          >
            Delete Invoice
          </Button>
        </div>
      )}
    </div>
  );
}

export default InvoicesFrame;
