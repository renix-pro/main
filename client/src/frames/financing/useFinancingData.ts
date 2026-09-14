/**
 * RENIX vNext — Financing Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Manages financing sources that express coverage of Budget intent.
 * 
 * Core invariants:
 * - Financing expresses coverage of Budget intent only
 * - Coverage ≠ approval or affordability
 * - Partial, planned, and conditional funding are valid states
 * - Financing never mutates Budget, Scope, Quotes, Invoices, or Execution
 * - Binary status model: planned or confirmed
 * - Conditions and dependencies are declarative only
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, financingApi, FinancingResponse, FinancingSource as ApiFinancingSource, fetchJson } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export interface CostResolutionBreakdown {
  invoiceBacked: number;
  quoteBacked: number;
  budgetBacked: number;
  directCostBacked: number;
  contingencyAmount: number;
  unresolvedCount: number;
}

export interface ResolvedCostDemandResult {
  totalResolvedCost: number;
  breakdown: CostResolutionBreakdown;
  confirmedFinancingCapacity: number;
  plannedFinancingCapacity: number;
  coverageDelta: number;
  monthlyLiabilityTotal: number;
  hasFinancingGap: boolean;
  gapSeverity: 'none' | 'warning' | 'critical';
}

export type FinancingStatus = 'planned' | 'confirmed';

export type FinancingType = 'equity' | 'loan' | 'grant' | 'other';

export interface FinancingSource {
  id: string;
  name: string;
  type: FinancingType;
  amount: number;
  status: FinancingStatus;
  monthlyCost: number | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface FinancingData {
  sources: FinancingSource[];
  notes: string;
}

function mapApiStatusToStatus(status: string): FinancingStatus {
  const lower = status.toLowerCase();
  if (lower === 'secured' || lower === 'confirmed') return 'confirmed';
  return 'planned';
}

function mapStatusToApiStatus(status: FinancingStatus): 'Planned' | 'Confirmed' {
  if (status === 'planned') return 'Planned';
  if (status === 'confirmed') return 'Confirmed';
  return 'Planned';
}

function mapTypeToApiType(type: FinancingType): 'Loan' | 'Grant' | 'Equity' {
  if (type === 'loan') return 'Loan';
  if (type === 'grant') return 'Grant';
  if (type === 'equity') return 'Equity';
  return 'Equity'; // default for 'other'
}

function mapApiTypeToType(apiType: string): FinancingType {
  const lower = apiType.toLowerCase();
  if (lower === 'loan') return 'loan';
  if (lower === 'grant') return 'grant';
  if (lower === 'equity') return 'equity';
  return 'other';
}

function toFinancingData(response: FinancingResponse): FinancingData {
  return {
    sources: (response.sources || []).map(s => ({
      id: s.id,
      name: s.name,
      type: mapApiTypeToType(s.type),
      amount: s.amount,
      status: mapApiStatusToStatus(s.status),
      monthlyCost: s.monthlyLiability ?? null,
      notes: s.notes,
      createdAt: new Date(s.createdAt).getTime(),
      updatedAt: new Date(s.updatedAt).getTime(),
      createdBy: s.createdBy,
    })),
    notes: response.financing?.notes ?? '',
  };
}

interface UseFinancingDataReturn {
  data: FinancingData;
  isLoading: boolean;
  isEmpty: boolean;
  totalConfirmed: number;
  totalPlanned: number;
  totalFinancingPotential: number;
  resolvedCostDemand: ResolvedCostDemandResult | null;
  isLoadingCostDemand: boolean;
  addSource: (
    name: string,
    type: FinancingType,
    amount: number,
    status: FinancingStatus,
    monthlyCost?: number | null,
    notes?: string
  ) => void;
  updateSource: (
    sourceId: string,
    name: string,
    type: FinancingType,
    amount: number,
    status: FinancingStatus,
    monthlyCost?: number | null,
    notes?: string
  ) => void;
  updateSourceStatus: (sourceId: string, status: FinancingStatus) => void;
  updateSourceField: (sourceId: string, field: keyof FinancingSource, value: any) => void;
  deleteSource: (sourceId: string) => void;
  updateNotes: (notes: string) => void;
  checkFundingGapChange: (newConfirmedAmount: number) => { wouldCreateGap: boolean; wouldWidenGap: boolean };
}

export function useFinancingData(projectId: string, isReadOnly: boolean): UseFinancingDataReturn {
  const { toast } = useToast();
  const queryKey = queryKeys.financing(projectId);

  const { data: response, isLoading } = useQuery<FinancingResponse>({
    queryKey,
  });

  const { data: resolvedCostDemand, isLoading: isLoadingCostDemand } = useQuery<ResolvedCostDemandResult>({
    queryKey: ['api', 'projects', projectId, 'resolved-cost-demand'],
    queryFn: () => fetchJson<ResolvedCostDemandResult>(`/api/projects/${projectId}/resolved-cost-demand`),
  });

  const data = useMemo<FinancingData>(() => {
    if (!response) {
      return { sources: [], notes: '' };
    }
    return toFinancingData(response);
  }, [response]);

  const guardReadOnly = useCallback(<T>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('[Financing] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  type CreateSourceVars = Partial<ApiFinancingSource>;
  type UpdateSourceVars = { sourceId: string; data: Partial<ApiFinancingSource> };

  const costDemandQueryKey = ['api', 'projects', projectId, 'resolved-cost-demand'];
  
  const createSourceMutation = useMutationWithProposal({
    mutationFn: (data: CreateSourceVars) => 
      financingApi.createSource(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: costDemandQueryKey });
    },
    proposalConfig: createProposalConfig<CreateSourceVars>({
      category: 'financing',
      action: 'create',
      entityType: 'source',
      getTitle: (vars) => `Add Financing Source: ${vars.name || 'New Source'}`,
      getDescription: (vars) => {
        const amount = vars.amount ? `€${vars.amount.toLocaleString()}` : 'unspecified amount';
        const type = vars.type || 'financing';
        return `Add ${type} source "${vars.name || 'New Source'}" for ${amount}`;
      },
    }),
  });

  const updateSourceMutation = useMutationWithProposal({
    mutationFn: ({ sourceId, data }: UpdateSourceVars) => 
      financingApi.updateSource(projectId, sourceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: costDemandQueryKey });
    },
    proposalConfig: createProposalConfig<UpdateSourceVars>({
      category: 'financing',
      action: 'update',
      entityType: 'source',
      getEntityId: (vars) => vars.sourceId,
      getTitle: (vars) => `Update Financing Source: ${vars.data.name || 'Source'}`,
      getDescription: (vars) => {
        if (vars.data.status) {
          return `Update source "${vars.data.name || 'Source'}" status to ${vars.data.status}`;
        }
        const amount = vars.data.amount ? `€${vars.data.amount.toLocaleString()}` : '';
        return `Update financing source "${vars.data.name || 'Source'}"${amount ? ` to ${amount}` : ''}`;
      },
    }),
  });

  const deleteSourceMutation = useMutationWithProposal({
    mutationFn: (sourceId: string) => 
      financingApi.deleteSource(projectId, sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: costDemandQueryKey });
    },
    proposalConfig: createProposalConfig<string>({
      category: 'financing',
      action: 'delete',
      entityType: 'source',
      getEntityId: (vars) => vars,
      getTitle: () => 'Delete Financing Source',
      getDescription: () => 'Remove this financing source from the project',
    }),
  });

  const updateNotesMutation = useMutationWithProposal({
    mutationFn: (notes: string) => 
      financingApi.createOrUpdate(projectId, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    proposalConfig: createProposalConfig<string>({
      category: 'financing',
      action: 'update',
      entityType: 'notes',
      getTitle: () => 'Update Financing Notes',
      getDescription: (notes) => notes ? 'Update financing notes' : 'Clear financing notes',
    }),
  });

  const addSource = useCallback((
    name: string,
    type: FinancingType,
    amount: number,
    status: FinancingStatus,
    monthlyCost?: number | null,
    notes?: string
  ): void => {
    guardReadOnly(() => {
      // Direct user action - execute immediately, not through proposal system
      createSourceMutation.mutate({
        name,
        type: mapTypeToApiType(type),
        amount,
        status: mapStatusToApiStatus(status),
        notes: notes ?? null,
        monthlyLiability: type === 'loan' ? (monthlyCost ?? null) : null,
      });
    });
  }, [guardReadOnly, createSourceMutation]);

  const updateSource = useCallback((
    sourceId: string,
    name: string,
    type: FinancingType,
    amount: number,
    status: FinancingStatus,
    monthlyCost?: number | null,
    notes?: string
  ) => {
    guardReadOnly(() => {
      // Direct user action - execute immediately
      updateSourceMutation.mutate({
        sourceId,
        data: {
          name,
          type: mapTypeToApiType(type),
          amount,
          status: mapStatusToApiStatus(status),
          notes: notes ?? null,
          monthlyLiability: type === 'loan' ? (monthlyCost ?? null) : null,
        },
      });
    });
  }, [guardReadOnly, updateSourceMutation]);

  const updateSourceStatus = useCallback((sourceId: string, status: FinancingStatus) => {
    const source = data.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    guardReadOnly(() => {
      // Direct user action - execute immediately
      updateSourceMutation.mutate({
        sourceId,
        data: {
          name: source.name,
          status: mapStatusToApiStatus(status),
        } as any,
      });
    });
  }, [guardReadOnly, updateSourceMutation, data.sources]);

  const deleteSource = useCallback((sourceId: string) => {
    guardReadOnly(() => {
      // Direct user action - execute immediately
      deleteSourceMutation.mutate(sourceId);
    });
  }, [guardReadOnly, deleteSourceMutation]);

  const updateNotes = useCallback((notes: string) => {
    guardReadOnly(() => {
      // Direct user action - execute immediately
      updateNotesMutation.mutate(notes);
    });
  }, [guardReadOnly, updateNotesMutation]);

  const updateSourceField = useCallback((
    sourceId: string,
    field: keyof FinancingSource,
    value: any
  ) => {
    const source = data.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    guardReadOnly(() => {
      const updateData: Partial<ApiFinancingSource> = { name: source.name };
      
      switch (field) {
        case 'name':
          updateData.name = value as string;
          break;
        case 'type':
          updateData.type = mapTypeToApiType(value as FinancingType);
          // Clear monthly cost if switching away from loan
          if (value !== 'loan') {
            updateData.monthlyLiability = null;
          }
          break;
        case 'amount':
          updateData.amount = value as number;
          break;
        case 'status':
          updateData.status = mapStatusToApiStatus(value as FinancingStatus);
          break;
        case 'monthlyCost':
          updateData.monthlyLiability = value as number | null;
          break;
        case 'notes':
          updateData.notes = value as string | null;
          break;
      }
      
      updateSourceMutation.mutate({ sourceId, data: updateData });
    });
  }, [guardReadOnly, updateSourceMutation, data.sources]);

  const checkFundingGapChange = useCallback((newConfirmedAmount: number): { wouldCreateGap: boolean; wouldWidenGap: boolean } => {
    if (!resolvedCostDemand) {
      return { wouldCreateGap: false, wouldWidenGap: false };
    }
    
    const currentCoverageDelta = resolvedCostDemand.coverageDelta;
    const currentConfirmed = resolvedCostDemand.confirmedFinancingCapacity;
    const totalCost = resolvedCostDemand.totalResolvedCost;
    
    // Calculate new coverage delta
    const newCoverageDelta = newConfirmedAmount - totalCost;
    
    // Would create gap: current delta >= 0, new delta < 0
    const wouldCreateGap = currentCoverageDelta >= 0 && newCoverageDelta < 0;
    
    // Would widen gap: current delta already < 0 and new delta is even more negative
    const wouldWidenGap = currentCoverageDelta < 0 && newCoverageDelta < currentCoverageDelta;
    
    return { wouldCreateGap, wouldWidenGap };
  }, [resolvedCostDemand]);

  const isEmpty = data.sources.length === 0;

  const totalConfirmed = useMemo(() => 
    data.sources
      .filter(s => s.status === 'confirmed')
      .reduce((sum, s) => sum + s.amount, 0),
    [data.sources]
  );

  const totalPlanned = useMemo(() =>
    data.sources
      .filter(s => s.status === 'planned')
      .reduce((sum, s) => sum + s.amount, 0),
    [data.sources]
  );

  const totalFinancingPotential = useMemo(() => 
    totalConfirmed + totalPlanned, 
    [totalConfirmed, totalPlanned]
  );

  return {
    data,
    isLoading,
    isEmpty,
    totalConfirmed,
    totalPlanned,
    totalFinancingPotential,
    resolvedCostDemand: resolvedCostDemand ?? null,
    isLoadingCostDemand,
    addSource,
    updateSource,
    updateSourceStatus,
    updateSourceField,
    deleteSource,
    updateNotes,
    checkFundingGapChange,
  };
}
