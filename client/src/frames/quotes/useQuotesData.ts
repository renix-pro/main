/**
 * RENIX vNext — Quotes Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Manages vendors, quotes, versions, and lines.
 * Two-axis status model:
 * - extractionStatus: 'draft' | 'verified' (Axis A - extraction validation)
 * - commitmentStatus: 'active' | 'superseded' | 'accepted' | null (Axis B - user decision)
 *   null = pending verification (ingested but not yet verified)
 * 
 * Object model:
 * - Vendor
 * - Quote (exactly one Vendor)
 * - Quote Version (immutable snapshots)
 * - Quote Line (atomic assertions)
 * 
 * Rules:
 * - One active Version per Quote
 * - Status transitions are reversible
 * - All prior versions remain visible
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, quotesApi, QuotesResponse } from '@/lib/api';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export interface VendorContactDetails {
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Vendor {
  id: string;
  name: string;
  notes: string | null;
  contactDetails?: VendorContactDetails | null;
  createdAt: number;
  updatedAt: number;
}

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface QuoteVersion {
  id: string;
  versionNumber: number;
  lineItems: QuoteLineItem[];
  total: number;
  validUntil: string | null;
  notes: string | null;
  createdAt: number;
  extractionStatus: 'draft' | 'verified';
  commitmentStatus: 'active' | 'superseded' | 'accepted' | null;
  sourceDocumentId: string | null;
}

export interface QuoteFinancialsSummary {
  netAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  grossAmount: number | null;
  currency: string;
}

export interface Quote {
  id: string;
  vendorId: string | null;
  scopeId: string | null;
  description: string | null;
  lineageId: string | null;
  versions: QuoteVersion[];
  financials: QuoteFinancialsSummary | null;
  createdAt: number;
  updatedAt: number;
}

export interface QuotesData {
  vendors: Vendor[];
  quotes: Quote[];
}

export interface QuotesFrameData extends QuotesData {}

export type QuoteStatus = 'draft' | 'pending' | 'committed' | 'accepted' | 'superseded';

export function getEffectiveQuoteStatus(quote: Quote): 'draft' | 'verified' | 'active' | 'superseded' | 'accepted' {
  const latestVersion = quote.versions?.[quote.versions.length - 1];
  if (!latestVersion) return 'draft';
  if (latestVersion.commitmentStatus === 'accepted') return 'accepted';
  if (latestVersion.commitmentStatus === 'superseded') return 'superseded';
  if (latestVersion.commitmentStatus === 'active') return 'active';
  if (latestVersion.extractionStatus === 'verified') return 'verified';
  return 'draft';
}

export function isQuoteCommitted(quote: Quote): boolean {
  const status = getEffectiveQuoteStatus(quote);
  return status === 'active' || status === 'accepted';
}

export function isQuotePending(quote: Quote): boolean {
  const status = getEffectiveQuoteStatus(quote);
  return status === 'draft' || status === 'verified';
}

function reconstructQuotesData(response: QuotesResponse): QuotesData {
  const vendors: Vendor[] = (response.vendors || []).map(v => ({
    id: v.id,
    name: v.name,
    notes: v.notes,
    contactDetails: (v as any).contactDetails || null,
    createdAt: new Date(v.createdAt).getTime(),
    updatedAt: new Date(v.updatedAt).getTime(),
  }));

  const lineItemsMap = (response as any).lineItems || {};
  const versionsMap = response.versions || {};
  
  const transformVersion = (version: any, versionId: string): QuoteVersion => {
    const rawLineItems = lineItemsMap[versionId] || [];
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      lineItems: rawLineItems.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      total: version.total ?? 0,
      validUntil: version.validUntil,
      notes: version.notes,
      createdAt: new Date(version.createdAt).getTime(),
      extractionStatus: version.extractionStatus ?? 'draft',
      commitmentStatus: version.commitmentStatus ?? null,
      sourceDocumentId: version.sourceDocumentId || null,
    };
  };
  
  const versionsByQuote = new Map<string, QuoteVersion[]>();
  for (const quoteId of Object.keys(versionsMap)) {
    const rawVersions = versionsMap[quoteId] || [];
    const transformedVersions = rawVersions.map((v: any) => transformVersion(v, v.id));
    versionsByQuote.set(quoteId, transformedVersions);
  }

  const financialsMap = (response as any).financials || {};

  const quotes: Quote[] = (response.quotes || []).map(q => ({
    id: q.id,
    vendorId: q.vendorId ?? null,
    scopeId: q.scopeId ?? null,
    description: q.description,
    lineageId: (q as any).lineageId ?? null,
    versions: versionsByQuote.get(q.id) || [],
    financials: financialsMap[q.id] ?? null,
    createdAt: new Date(q.createdAt).getTime(),
    updatedAt: new Date(q.updatedAt).getTime(),
  }));

  return { vendors, quotes };
}

type CreateVendorVars = { name: string; notes?: string };
type UpdateVendorVars = { id: string; name: string; notes?: string };
type CreateQuoteVars = { vendorId: string; description?: string };
type UpdateQuoteVars = { id: string; description?: string };
type CreateVersionVars = {
  quoteId: string;
  validUntil?: string;
  notes?: string;
};
type AcceptVersionVars = { quoteId: string; versionId: string };

export function useQuotesData(
  projectId: string,
  currency: string = 'AUD',
  isReadOnly: boolean = false
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: apiResponse, isLoading } = useQuery({
    queryKey: queryKeys.quotes(projectId),
    queryFn: () => quotesApi.get(projectId),
    enabled: !!projectId,
  });

  const data: QuotesData = useMemo(() => {
    if (!apiResponse) return { vendors: [], quotes: [] };
    return reconstructQuotesData(apiResponse);
  }, [apiResponse]);

  const invalidateQuotes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes(projectId) });
  }, [queryClient, projectId]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('Quotes: Mutation blocked - project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const getQuoteStatus = useCallback((quote: Quote): QuoteStatus => {
    const activeVersion = quote.versions.find(v => v.commitmentStatus === 'active') 
      || quote.versions.find(v => v.commitmentStatus === 'accepted')
      || quote.versions.find(v => v.commitmentStatus === null);
    if (!activeVersion) return 'draft';
    if (activeVersion.commitmentStatus === null) return 'pending';
    if (activeVersion.commitmentStatus === 'accepted') return 'accepted';
    if (activeVersion.extractionStatus === 'verified') return 'committed';
    return 'pending';
  }, []);

  const getActiveVersion = useCallback((quote: Quote): QuoteVersion | undefined => {
    return quote.versions.find(v => v.commitmentStatus === 'active')
      || quote.versions.find(v => v.commitmentStatus === 'accepted')
      || quote.versions[0];
  }, []);

  const getAcceptedVersion = useCallback((quote: Quote): QuoteVersion | undefined => {
    return quote.versions.find(v => v.commitmentStatus === 'accepted');
  }, []);

  const totalQuotedAmount = useMemo(() => {
    return data.quotes.reduce((sum, quote) => {
      const activeVersion = quote.versions.find(v =>
        v.extractionStatus === 'verified' &&
        (v.commitmentStatus === 'active' || v.commitmentStatus === 'accepted')
      );
      return sum + (activeVersion?.total ?? 0);
    }, 0);
  }, [data.quotes]);

  const totalAcceptedAmount = useMemo(() => {
    return data.quotes.reduce((sum, quote) => {
      const acceptedVersion = quote.versions.find(v => v.commitmentStatus === 'accepted');
      return sum + (acceptedVersion?.total ?? 0);
    }, 0);
  }, [data.quotes]);

  const totalNonSupersededAmount = useMemo(() => {
    return data.quotes.reduce((sum, quote) => {
      const activeVersion = quote.versions.find(v =>
        v.extractionStatus === 'verified' &&
        (v.commitmentStatus === 'active' || v.commitmentStatus === 'accepted')
      );
      if (!activeVersion) return sum;
      return sum + (activeVersion.total ?? 0);
    }, 0);
  }, [data.quotes]);

  const addVendorMutation = useMutationWithProposal({
    mutationFn: (params: CreateVendorVars) =>
      quotesApi.createVendor(projectId, {
        name: params.name,
        notes: params.notes ?? null,
      }),
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<CreateVendorVars>({
      category: 'quotes',
      entityType: 'vendor',
      action: 'create',
      getTitle: (vars) => `Create Vendor: ${vars.name}`,
      getDescription: (vars) => `Add new vendor "${vars.name}"`,
    }),
  });

  const addVendor = useCallback((name: string, _contactInfo?: string, notes?: string): string | undefined => {
    return guardReadOnly(() => {
      addVendorMutation.mutateWithProposal({ name, notes });
      return undefined;
    });
  }, [guardReadOnly, addVendorMutation]);

  const updateVendorMutation = useMutationWithProposal({
    mutationFn: (params: UpdateVendorVars) =>
      quotesApi.updateVendor(projectId, params.id, {
        name: params.name,
        notes: params.notes ?? null,
      }),
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<UpdateVendorVars>({
      category: 'quotes',
      entityType: 'vendor',
      action: 'update',
      getEntityId: (vars) => vars.id,
      getTitle: (vars) => `Update Vendor: ${vars.name}`,
      getDescription: (vars) => `Modify vendor to "${vars.name}"`,
    }),
  });

  const updateVendor = useCallback((id: string, name: string, _contactInfo?: string, notes?: string) => {
    guardReadOnly(() => {
      updateVendorMutation.mutateWithProposal({ id, name, notes });
    });
  }, [guardReadOnly, updateVendorMutation]);

  const deleteVendorMutation = useMutationWithProposal({
    mutationFn: (vendorId: string) => quotesApi.deleteVendor(projectId, vendorId),
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<string>({
      category: 'quotes',
      entityType: 'vendor',
      action: 'delete',
      getEntityId: (vars) => vars,
      getTitle: () => 'Delete Vendor',
      getDescription: () => 'Remove this vendor and all associated quotes',
    }),
  });

  const deleteVendor = useCallback((id: string) => {
    guardReadOnly(() => {
      deleteVendorMutation.mutateWithProposal(id);
    });
  }, [guardReadOnly, deleteVendorMutation]);

  const addQuoteMutation = useMutationWithProposal({
    mutationFn: (params: CreateQuoteVars) =>
      quotesApi.createQuote(projectId, {
        vendorId: params.vendorId,
        description: params.description ?? null,
      }),
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<CreateQuoteVars>({
      category: 'quotes',
      entityType: 'quote',
      action: 'create',
      getTitle: (vars) => `Create Quote: ${vars.description || 'New Quote'}`,
      getDescription: (vars) => `Add new quote "${vars.description || 'New Quote'}"`,
    }),
  });

  const addQuote = useCallback((vendorId: string, _reference: string, description?: string): string | undefined => {
    return guardReadOnly(() => {
      addQuoteMutation.mutateWithProposal({ vendorId, description });
      return undefined;
    });
  }, [guardReadOnly, addQuoteMutation]);

  const updateQuoteMutation = useMutationWithProposal({
    mutationFn: (params: UpdateQuoteVars) =>
      quotesApi.updateQuote(projectId, params.id, {
        description: params.description ?? null,
      }),
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<UpdateQuoteVars>({
      category: 'quotes',
      entityType: 'quote',
      action: 'update',
      getEntityId: (vars) => vars.id,
      getTitle: (vars) => `Update Quote: ${vars.description || 'Quote'}`,
      getDescription: (vars) => `Modify quote "${vars.description || 'Quote'}"`,
    }),
  });

  const updateQuote = useCallback((id: string, _reference: string, description?: string) => {
    guardReadOnly(() => {
      updateQuoteMutation.mutateWithProposal({ id, description });
    });
  }, [guardReadOnly, updateQuoteMutation]);

  const deleteQuoteMutation = useMutationWithProposal({
    mutationFn: (quoteId: string) => quotesApi.deleteQuote(projectId, quoteId),
    onSuccess: invalidateQuotes,
    onError: () => {
      toast({
        title: 'Could not delete quote',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
    proposalConfig: createProposalConfig<string>({
      category: 'quotes',
      entityType: 'quote',
      action: 'delete',
      getEntityId: (vars) => vars,
      getTitle: () => 'Delete Quote',
      getDescription: () => 'Remove this quote and all its versions',
    }),
  });

  const deleteQuote = useCallback((id: string) => {
    guardReadOnly(() => {
      deleteQuoteMutation.mutateWithProposal(id);
    });
  }, [guardReadOnly, deleteQuoteMutation]);

  const addVersionMutation = useMutationWithProposal({
    mutationFn: async (params: CreateVersionVars) => {
      const quote = data.quotes.find(q => q.id === params.quoteId);
      const newVersionNumber = quote ? quote.versions.length + 1 : 1;

      const version = await quotesApi.createVersion(projectId, params.quoteId, {
        versionNumber: newVersionNumber,
        validUntil: params.validUntil ?? null,
        notes: params.notes ?? null,
      });

      return version;
    },
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<CreateVersionVars>({
      category: 'quotes',
      entityType: 'version',
      action: 'create',
      getEntityId: (vars) => vars.quoteId,
      getTitle: () => `Create Quote Version`,
      getDescription: () => `Add new quote version`,
    }),
  });

  const addVersion = useCallback((
    quoteId: string,
    _lines: { label: string; amount: number; notes?: string }[],
    validUntil?: string,
    notes?: string
  ): string | undefined => {
    return guardReadOnly(() => {
      const quote = data.quotes.find(q => q.id === quoteId);
      if (!quote) return undefined;
      addVersionMutation.mutateWithProposal({ quoteId, validUntil, notes });
      return undefined;
    });
  }, [guardReadOnly, addVersionMutation, data.quotes]);

  const updateVersionStatusMutation = useMutationWithProposal({
    mutationFn: async (params: { versionId: string; extractionStatus?: string; commitmentStatus?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${params.versionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          extractionStatus: params.extractionStatus,
          commitmentStatus: params.commitmentStatus,
        }),
      });
      if (!response.ok) throw new Error('Failed to update version status');
      return response.json();
    },
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<{ versionId: string; extractionStatus?: string; commitmentStatus?: string }>({
      category: 'quotes',
      entityType: 'version',
      action: 'update',
      getEntityId: (vars) => vars.versionId,
      getTitle: () => 'Update Version Status',
      getDescription: (vars) => {
        const parts: string[] = [];
        if (vars.extractionStatus) parts.push(`extraction: ${vars.extractionStatus}`);
        if (vars.commitmentStatus) parts.push(`commitment: ${vars.commitmentStatus}`);
        return `Update version status: ${parts.join(', ')}`;
      },
    }),
  });

  const updateVersionStatus = useCallback((versionId: string, updates: { extractionStatus?: string; commitmentStatus?: string }) => {
    guardReadOnly(() => {
      updateVersionStatusMutation.mutateWithProposal({ versionId, ...updates });
    });
  }, [guardReadOnly, updateVersionStatusMutation]);

  const acceptVersionMutation = useMutationWithProposal({
    mutationFn: async (params: AcceptVersionVars) => {
      const response = await fetch(`/api/projects/${projectId}/versions/${params.versionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commitmentStatus: 'accepted' }),
      });
      if (!response.ok) throw new Error('Failed to accept version');
      return response.json();
    },
    onSuccess: invalidateQuotes,
    proposalConfig: createProposalConfig<AcceptVersionVars>({
      category: 'quotes',
      entityType: 'version',
      action: 'update',
      getEntityId: (vars) => vars.versionId,
      getTitle: () => 'Accept Quote Version',
      getDescription: () => 'Accept this quote version.',
    }),
  });

  const acceptVersion = useCallback((quoteId: string, versionId: string) => {
    guardReadOnly(() => {
      const quote = data.quotes.find(q => q.id === quoteId);
      if (!quote) return;

      const version = quote.versions.find(v => v.id === versionId);
      if (!version) {
        console.warn('Quotes: Cannot accept version - version not found');
        toast({ title: 'Version not found', description: 'This quote version may have been updated. Please refresh to see the latest.' });
        return;
      }

      acceptVersionMutation.mutateWithProposal({ quoteId, versionId });
    });
  }, [guardReadOnly, data.quotes, acceptVersionMutation]);

  const getVendor = useCallback((vendorId: string | null): Vendor | undefined => {
    if (!vendorId) return undefined;
    return data.vendors.find(v => v.id === vendorId);
  }, [data.vendors]);

  const getQuotesByVendor = useCallback((vendorId: string): Quote[] => {
    return data.quotes.filter(q => q.vendorId === vendorId);
  }, [data.quotes]);

  return {
    data,
    isLoading,
    currency,
    isReadOnly,
    totalQuotedAmount,
    totalAcceptedAmount,
    totalNonSupersededAmount,
    getQuoteStatus,
    getActiveVersion,
    getAcceptedVersion,
    getVendor,
    getQuotesByVendor,
    addVendor,
    updateVendor,
    deleteVendor,
    addQuote,
    updateQuote,
    deleteQuote,
    addVersion,
    acceptVersion,
    updateVersionStatus,
  };
}
