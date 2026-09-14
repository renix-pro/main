/**
 * RENIX vNext — Invoices Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Manages invoices that record financial reality.
 * Enhanced with scope grouping for CFS 3-zone layout.
 * 
 * Core invariants:
 * - Invoices represent financial reality, not intent
 * - Finalized invoices are immutable
 * - Invoices never mutate Budget, Quotes, Financing, or Execution
 * - Missing invoices are a valid state
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invoicesApi, InvoicesResponse, scopeNodesApi } from '@/lib/api';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export type InvoiceStatus = 'draft' | 'finalized' | 'paid';
export type InvoiceDisplayStatus = 'issued' | 'paid' | 'partially_paid';

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: number;
}

export interface InvoiceLine {
  id: string;
  label: string;
  description: string | null;
  amount: number;
  scopeItemId: string | null;
  scopeItemName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Invoice {
  id: string;
  vendorName: string;
  vendorId: string | null;
  reference: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  notes: string | null;
  attachments: string[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  finalizedAt: number | null;
  paidAt: number | null;
  payments: InvoicePayment[];
  totalPaid: number;
  outstanding: number;
  /** Scope ID assigned to this invoice (references scopeNodes) */
  scopeId: string | null;
}

export interface InvoicesData {
  invoices: Invoice[];
}

export interface ScopeInvoiceGroup {
  scopeId: string;
  scopeName: string;
  invoices: Invoice[];
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}

function reconstructInvoicesData(response: InvoicesResponse): InvoicesData {
  const linesMap = response.lines || {};
  const paymentsMap = response.payments || {};

  const invoices: Invoice[] = (response.invoices || []).map(inv => {
    const rawLines = linesMap[inv.id] || [];
    const rawPayments = paymentsMap[inv.id] || [];
    
    const lines: InvoiceLine[] = rawLines.map((line: any) => ({
      id: line.id,
      label: line.label,
      description: line.description,
      amount: line.amount,
      scopeItemId: line.scopeItemId,
      scopeItemName: line.scopeItemName,
      createdAt: new Date(line.createdAt).getTime(),
      updatedAt: new Date(line.updatedAt).getTime(),
    }));

    const payments: InvoicePayment[] = rawPayments.map((payment: any) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: new Date(payment.createdAt).getTime(),
    }));

    const invoiceTotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, invoiceTotal - totalPaid);
    
    return {
      id: inv.id,
      vendorName: inv.vendorName,
      vendorId: inv.vendorId,
      reference: inv.reference,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status as InvoiceStatus,
      lines,
      notes: inv.notes,
      attachments: [],
      createdAt: new Date(inv.createdAt).getTime(),
      updatedAt: new Date(inv.updatedAt).getTime(),
      createdBy: inv.createdBy,
      finalizedAt: inv.finalizedAt ? new Date(inv.finalizedAt).getTime() : null,
      paidAt: inv.paidAt ? new Date(inv.paidAt).getTime() : null,
      payments,
      totalPaid,
      outstanding,
      scopeId: inv.scopeId ?? null,
    };
  });

  return { invoices };
}

export function getInvoiceDisplayStatus(invoice: Invoice): InvoiceDisplayStatus | null {
  if (invoice.status === 'draft') return null;
  if (invoice.status === 'paid') return 'paid';
  
  const invoiceTotal = invoice.lines.reduce((sum, l) => sum + l.amount, 0);
  if (invoice.totalPaid > 0 && invoice.totalPaid < invoiceTotal) {
    return 'partially_paid';
  }
  return 'issued';
}

interface UseInvoicesDataReturn {
  data: InvoicesData;
  isLoading: boolean;
  isEmpty: boolean;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  draftCount: number;
  finalizedCount: number;
  paidCount: number;
  confirmedInvoices: Invoice[];
  scopeGroups: ScopeInvoiceGroup[];
  ungroupedInvoices: Invoice[];
  addInvoice: (
    vendorName: string,
    reference?: string,
    issueDate?: string,
    dueDate?: string,
    notes?: string
  ) => string | undefined;
  updateInvoice: (
    invoiceId: string,
    vendorName: string,
    reference?: string,
    issueDate?: string,
    dueDate?: string,
    notes?: string
  ) => void;
  deleteInvoice: (invoiceId: string) => void;
  finalizeInvoice: (invoiceId: string) => void;
  markAsPaid: (invoiceId: string) => void;
  recordPayment: (invoiceId: string, amount: number, paymentDate: string, reference?: string, notes?: string) => void;
  deletePayment: (invoiceId: string, paymentId: string) => void;
  addLine: (
    invoiceId: string,
    label: string,
    amount: number,
    description?: string,
    scopeItemId?: string,
    scopeItemName?: string
  ) => string | undefined;
  updateLine: (
    invoiceId: string,
    lineId: string,
    label: string,
    amount: number,
    description?: string
  ) => void;
  deleteLine: (invoiceId: string, lineId: string) => void;
}

export function useInvoicesData(projectId: string, isReadOnly: boolean): UseInvoicesDataReturn {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apiResponse, isLoading } = useQuery({
    queryKey: queryKeys.invoices(projectId),
    queryFn: () => invoicesApi.get(projectId),
    enabled: !!projectId,
  });

  const { data: scopeNodesResponse } = useQuery({
    queryKey: queryKeys.scopeNodes(projectId),
    queryFn: () => scopeNodesApi.get(projectId),
    enabled: !!projectId,
  });

  const data: InvoicesData = useMemo(() => {
    if (!apiResponse) return { invoices: [] };
    return reconstructInvoicesData(apiResponse);
  }, [apiResponse]);

  const scopeNodeMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (scopeNodesResponse?.nodes) {
      for (const node of scopeNodesResponse.nodes) {
        map.set(node.id, { id: node.id, name: node.name });
      }
    }
    return map;
  }, [scopeNodesResponse]);

  const confirmedInvoices = useMemo(() => 
    data.invoices.filter(i => i.status !== 'draft'),
    [data.invoices]
  );

  const { scopeGroups, ungroupedInvoices } = useMemo(() => {
    const scopeMap = new Map<string, Invoice[]>();
    const ungrouped: Invoice[] = [];

    for (const invoice of confirmedInvoices) {
      if (invoice.scopeId) {
        const existing = scopeMap.get(invoice.scopeId) || [];
        existing.push(invoice);
        scopeMap.set(invoice.scopeId, existing);
      } else {
        ungrouped.push(invoice);
      }
    }

    const groups: ScopeInvoiceGroup[] = [];
    scopeMap.forEach((invoices, scopeId) => {
      const scopeNode = scopeNodeMap.get(scopeId);
      const totalInvoiced = invoices.reduce((sum: number, inv: Invoice) => 
        sum + inv.lines.reduce((lsum: number, l: InvoiceLine) => lsum + l.amount, 0), 0);
      const totalPaid = invoices.reduce((sum: number, inv: Invoice) => sum + inv.totalPaid, 0);

      groups.push({
        scopeId,
        scopeName: scopeNode?.name || 'Unknown Scope',
        invoices,
        totalInvoiced,
        totalPaid,
        outstanding: totalInvoiced - totalPaid,
      });
    });

    groups.sort((a, b) => a.scopeName.localeCompare(b.scopeName));

    return { scopeGroups: groups, ungroupedInvoices: ungrouped };
  }, [confirmedInvoices, scopeNodeMap]);

  const invalidateInvoices = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices(projectId) });
  }, [queryClient, projectId]);

  const guardReadOnly = useCallback(<T>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('[Invoices] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const guardFinalized = useCallback(<T>(invoiceId: string, fn: () => T): T | undefined => {
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (invoice && invoice.status !== 'draft') {
      console.warn('[Invoices] Mutation blocked: invoice is finalized');
      toast({ title: 'Invoice locked', description: 'This invoice has been finalized and can\'t be edited.' });
      return undefined;
    }
    return fn();
  }, [data.invoices, toast]);

  const addInvoiceMutation = useMutationWithProposal({
    mutationFn: (params: {
      vendorName: string;
      reference?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
    }) =>
      invoicesApi.create(projectId, {
        vendorName: params.vendorName,
        reference: params.reference ?? null,
        issueDate: params.issueDate ?? null,
        dueDate: params.dueDate ?? null,
        notes: params.notes ?? null,
        status: 'draft',
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{
      vendorName: string;
      reference?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
    }>({
      category: 'invoices',
      action: 'create',
      entityType: 'invoice',
      getTitle: (params) => `Create invoice for ${params.vendorName}`,
      getDescription: (params) => {
        const parts = [`Create new invoice from ${params.vendorName}`];
        if (params.reference) parts.push(`(Ref: ${params.reference})`);
        return parts.join(' ');
      },
    }),
  });

  const addInvoice = useCallback((
    vendorName: string,
    reference?: string,
    issueDate?: string,
    dueDate?: string,
    notes?: string
  ): string | undefined => {
    return guardReadOnly(() => {
      addInvoiceMutation.mutateWithProposal({ vendorName, reference, issueDate, dueDate, notes });
      return undefined;
    });
  }, [guardReadOnly, addInvoiceMutation]);

  const updateInvoiceMutation = useMutationWithProposal({
    mutationFn: (params: {
      invoiceId: string;
      vendorName: string;
      reference?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
    }) =>
      invoicesApi.update(projectId, params.invoiceId, {
        vendorName: params.vendorName,
        reference: params.reference ?? null,
        issueDate: params.issueDate ?? null,
        dueDate: params.dueDate ?? null,
        notes: params.notes ?? null,
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{
      invoiceId: string;
      vendorName: string;
      reference?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
    }>({
      category: 'invoices',
      action: 'update',
      entityType: 'invoice',
      getEntityId: (params) => params.invoiceId,
      getTitle: (params) => `Update invoice from ${params.vendorName}`,
      getDescription: (params) => {
        const parts = [`Update invoice details for ${params.vendorName}`];
        if (params.reference) parts.push(`(Ref: ${params.reference})`);
        return parts.join(' ');
      },
    }),
  });

  const updateInvoice = useCallback((
    invoiceId: string,
    vendorName: string,
    reference?: string,
    issueDate?: string,
    dueDate?: string,
    notes?: string
  ) => {
    guardReadOnly(() => {
      guardFinalized(invoiceId, () => {
        updateInvoiceMutation.mutateWithProposal({ invoiceId, vendorName, reference, issueDate, dueDate, notes });
      });
    });
  }, [guardReadOnly, guardFinalized, updateInvoiceMutation]);

  const deleteInvoiceMutation = useMutationWithProposal({
    mutationFn: (invoiceId: string) => invoicesApi.delete(projectId, invoiceId),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<string>({
      category: 'invoices',
      action: 'delete',
      entityType: 'invoice',
      getEntityId: (invoiceId) => invoiceId,
      getTitle: () => 'Delete invoice',
      getDescription: (invoiceId) => `Permanently remove invoice ${invoiceId.slice(0, 8)}...`,
    }),
  });

  const deleteInvoice = useCallback((invoiceId: string) => {
    guardReadOnly(() => {
      deleteInvoiceMutation.mutateWithProposal(invoiceId);
    });
  }, [guardReadOnly, deleteInvoiceMutation]);

  const finalizeInvoiceMutation = useMutationWithProposal({
    mutationFn: (invoiceId: string) =>
      invoicesApi.update(projectId, invoiceId, {
        status: 'finalized',
        finalizedAt: new Date().toISOString(),
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<string>({
      category: 'invoices',
      action: 'update',
      entityType: 'invoice',
      getEntityId: (invoiceId) => invoiceId,
      getTitle: () => 'Finalize invoice',
      getDescription: () => 'Mark invoice as finalized. This action cannot be undone.',
    }),
  });

  const finalizeInvoice = useCallback((invoiceId: string) => {
    guardReadOnly(() => {
      const invoice = data.invoices.find(i => i.id === invoiceId);
      if (invoice && invoice.status === 'draft') {
        finalizeInvoiceMutation.mutateWithProposal(invoiceId);
      }
    });
  }, [guardReadOnly, data.invoices, finalizeInvoiceMutation]);

  const markAsPaidMutation = useMutationWithProposal({
    mutationFn: (invoiceId: string) =>
      invoicesApi.update(projectId, invoiceId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<string>({
      category: 'invoices',
      action: 'update',
      entityType: 'invoice',
      getEntityId: (invoiceId) => invoiceId,
      getTitle: () => 'Mark invoice as paid',
      getDescription: () => 'Record that this invoice has been paid.',
    }),
  });

  const markAsPaid = useCallback((invoiceId: string) => {
    guardReadOnly(() => {
      const invoice = data.invoices.find(i => i.id === invoiceId);
      if (invoice && invoice.status === 'finalized') {
        markAsPaidMutation.mutateWithProposal(invoiceId);
      }
    });
  }, [guardReadOnly, data.invoices, markAsPaidMutation]);

  const recordPaymentMutation = useMutationWithProposal({
    mutationFn: (params: {
      invoiceId: string;
      amount: number;
      paymentDate: string;
      reference?: string;
      notes?: string;
    }) =>
      invoicesApi.recordPayment(projectId, params.invoiceId, {
        amount: params.amount,
        paymentDate: params.paymentDate,
        reference: params.reference ?? null,
        notes: params.notes ?? null,
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{
      invoiceId: string;
      amount: number;
      paymentDate: string;
      reference?: string;
      notes?: string;
    }>({
      category: 'invoices',
      action: 'create',
      entityType: 'payment',
      getEntityId: (params) => params.invoiceId,
      getTitle: (params) => `Record payment of ${params.amount}`,
      getDescription: (params) => `Record payment of €${params.amount.toLocaleString()} on ${params.paymentDate}`,
    }),
  });

  const recordPayment = useCallback((
    invoiceId: string,
    amount: number,
    paymentDate: string,
    reference?: string,
    notes?: string
  ) => {
    guardReadOnly(() => {
      const invoice = data.invoices.find(i => i.id === invoiceId);
      if (invoice && invoice.status !== 'draft') {
        recordPaymentMutation.mutateWithProposal({ invoiceId, amount, paymentDate, reference, notes });
      }
    });
  }, [guardReadOnly, data.invoices, recordPaymentMutation]);

  const deletePaymentMutation = useMutationWithProposal({
    mutationFn: (params: { invoiceId: string; paymentId: string }) =>
      invoicesApi.deletePayment(projectId, params.invoiceId, params.paymentId),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{ invoiceId: string; paymentId: string }>({
      category: 'invoices',
      action: 'delete',
      entityType: 'payment',
      getEntityId: (params) => params.paymentId,
      getTitle: () => 'Delete Payment',
      getDescription: () => `Delete payment record`,
    }),
  });

  const deletePayment = useCallback((invoiceId: string, paymentId: string) => {
    guardReadOnly(() => {
      deletePaymentMutation.mutateWithProposal({ invoiceId, paymentId });
    });
  }, [guardReadOnly, deletePaymentMutation]);

  const addLineMutation = useMutationWithProposal({
    mutationFn: (params: {
      invoiceId: string;
      label: string;
      amount: number;
      description?: string;
      scopeItemId?: string;
      scopeItemName?: string;
    }) =>
      invoicesApi.createLine(projectId, params.invoiceId, {
        label: params.label,
        amount: params.amount,
        description: params.description ?? null,
        scopeItemId: params.scopeItemId ?? null,
        scopeItemName: params.scopeItemName ?? null,
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{
      invoiceId: string;
      label: string;
      amount: number;
      description?: string;
      scopeItemId?: string;
      scopeItemName?: string;
    }>({
      category: 'invoices',
      action: 'create',
      entityType: 'lineItem',
      getEntityId: (params) => params.invoiceId,
      getTitle: (params) => `Add line item: ${params.label}`,
      getDescription: (params) => `Add "${params.label}" for €${params.amount.toLocaleString()}`,
    }),
  });

  const addLine = useCallback((
    invoiceId: string,
    label: string,
    amount: number,
    description?: string,
    scopeItemId?: string,
    scopeItemName?: string
  ): string | undefined => {
    return guardReadOnly(() => {
      return guardFinalized(invoiceId, () => {
        addLineMutation.mutateWithProposal({ invoiceId, label, amount, description, scopeItemId, scopeItemName });
        return undefined;
      });
    });
  }, [guardReadOnly, guardFinalized, addLineMutation]);

  const updateLineMutation = useMutationWithProposal({
    mutationFn: (params: {
      lineId: string;
      label: string;
      amount: number;
      description?: string;
    }) =>
      invoicesApi.updateLine(projectId, params.lineId, {
        label: params.label,
        amount: params.amount,
        description: params.description ?? null,
      }),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{
      lineId: string;
      label: string;
      amount: number;
      description?: string;
    }>({
      category: 'invoices',
      action: 'update',
      entityType: 'lineItem',
      getEntityId: (params) => params.lineId,
      getTitle: (params) => `Update line item: ${params.label}`,
      getDescription: (params) => `Update "${params.label}" to €${params.amount.toLocaleString()}`,
    }),
  });

  const updateLine = useCallback((
    invoiceId: string,
    lineId: string,
    label: string,
    amount: number,
    description?: string
  ) => {
    guardReadOnly(() => {
      guardFinalized(invoiceId, () => {
        updateLineMutation.mutateWithProposal({ lineId, label, amount, description });
      });
    });
  }, [guardReadOnly, guardFinalized, updateLineMutation]);

  const deleteLineMutation = useMutationWithProposal({
    mutationFn: (params: { invoiceId: string; lineId: string }) => 
      invoicesApi.deleteLine(projectId, params.lineId),
    onSuccess: invalidateInvoices,
    proposalConfig: createProposalConfig<{ invoiceId: string; lineId: string }>({
      category: 'invoices',
      action: 'delete',
      entityType: 'lineItem',
      getEntityId: (params) => params.lineId,
      getTitle: () => 'Delete line item',
      getDescription: (params) => `Remove line item ${params.lineId.slice(0, 8)}... from invoice`,
    }),
  });

  const deleteLine = useCallback((invoiceId: string, lineId: string) => {
    guardReadOnly(() => {
      guardFinalized(invoiceId, () => {
        deleteLineMutation.mutateWithProposal({ invoiceId, lineId });
      });
    });
  }, [guardReadOnly, guardFinalized, deleteLineMutation]);

  const isEmpty = data.invoices.length === 0;

  const totalInvoiced = useMemo(() =>
    data.invoices
      .filter(i => i.status !== 'draft')
      .reduce((sum, i) => sum + i.lines.reduce((lsum, l) => lsum + l.amount, 0), 0),
    [data.invoices]
  );

  const totalPaid = useMemo(() =>
    data.invoices
      .filter(i => i.status !== 'draft')
      .reduce((sum, i) => sum + i.totalPaid, 0),
    [data.invoices]
  );

  const totalOutstanding = useMemo(() => 
    Math.max(0, totalInvoiced - totalPaid),
    [totalInvoiced, totalPaid]
  );

  const draftCount = useMemo(() => data.invoices.filter(i => i.status === 'draft').length, [data.invoices]);
  const finalizedCount = useMemo(() => data.invoices.filter(i => i.status === 'finalized').length, [data.invoices]);
  const paidCount = useMemo(() => data.invoices.filter(i => i.status === 'paid').length, [data.invoices]);

  return {
    data,
    isLoading,
    isEmpty,
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    draftCount,
    finalizedCount,
    paidCount,
    confirmedInvoices,
    scopeGroups,
    ungroupedInvoices,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    finalizeInvoice,
    markAsPaid,
    recordPayment,
    deletePayment,
    addLine,
    updateLine,
    deleteLine,
  };
}
