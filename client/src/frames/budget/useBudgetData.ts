/**
 * RENIX vNext — Budget Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Manages total budget and allocations.
 * Budget expresses intent, not expected cost.
 * 
 * Core invariants:
 * - Exactly one total budget value (scalar-first)
 * - Allocations express intent, not expected cost
 * - Unallocated and over-allocated states are valid
 * - No auto-calculation or remainder logic
 * - Contingency is first-class
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, budgetApi, BudgetResponse } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';

export type AllocationTarget = 
  | { type: 'scope'; scopeId?: string; scopeName?: string }
  | { type: 'contingency' }
  | { type: 'unassigned' };

export interface BudgetAllocation {
  id: string;
  label: string;
  amount: number;
  target: AllocationTarget;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface BudgetData {
  totalBudget: number | null;
  currency: string;
  allocations: BudgetAllocation[];
  notes: string;
  contingencyMode: 'fixed' | 'percent';
  contingencyValue: number;
}

function toBudgetData(response: BudgetResponse, defaultCurrency: string): BudgetData {
  return {
    totalBudget: response.budget?.totalBudget ?? null,
    currency: response.budget?.currency ?? defaultCurrency,
    allocations: (response.allocations || []).map(a => ({
      id: a.id,
      label: a.label,
      amount: a.amount,
      target: a.target as AllocationTarget,
      notes: a.notes,
      createdAt: new Date(a.createdAt).getTime(),
      updatedAt: new Date(a.updatedAt).getTime(),
      createdBy: a.createdBy,
    })),
    notes: response.budget?.notes ?? '',
    contingencyMode: (response.budget?.contingencyMode as 'fixed' | 'percent') ?? 'fixed',
    contingencyValue: response.budget?.contingencyValue ?? 0,
  };
}

function getEmptyBudgetData(defaultCurrency: string): BudgetData {
  return {
    totalBudget: null,
    currency: defaultCurrency,
    allocations: [],
    notes: '',
    contingencyMode: 'fixed',
    contingencyValue: 0,
  };
}

export function useBudgetData(
  projectId: string,
  defaultCurrency: string = 'AUD',
  isReadOnly: boolean = false,
  userId: string = 'user-001'
) {
  const { toast } = useToast();
  const budgetQueryKey = queryKeys.budget(projectId);

  const { data: response, isLoading } = useQuery<BudgetResponse>({
    queryKey: budgetQueryKey,
    queryFn: () => budgetApi.get(projectId),
  });

  const data = useMemo(() => {
    if (!response) return getEmptyBudgetData(defaultCurrency);
    return toBudgetData(response, defaultCurrency);
  }, [response, defaultCurrency]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('Budget: Mutation blocked - project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const budgetMutation = useMutationWithProposal({
    mutationFn: (budgetData: { totalBudget?: number | null; currency?: string; notes?: string; contingencyMode?: 'fixed' | 'percent'; contingencyValue?: number }) =>
      budgetApi.createOrUpdate(projectId, budgetData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKey });
    },
    proposalConfig: createProposalConfig<{ totalBudget?: number | null; currency?: string; notes?: string; contingencyMode?: 'fixed' | 'percent'; contingencyValue?: number }>({
      category: 'budget',
      action: 'update',
      entityType: 'budget',
      getTitle: (vars) => {
        if (vars.totalBudget !== undefined) return 'Update Total Budget';
        if (vars.currency) return 'Update Currency';
        if (vars.notes !== undefined) return 'Update Budget Notes';
        return 'Update Budget';
      },
      getDescription: (vars) => {
        if (vars.totalBudget !== undefined) {
          return vars.totalBudget === null
            ? 'Clear total budget amount'
            : `Set total budget to ${vars.totalBudget}`;
        }
        if (vars.currency) return `Change currency to ${vars.currency}`;
        if (vars.notes !== undefined) return 'Update budget notes';
        return 'Update budget settings';
      },
    }),
  });

  const createAllocationMutation = useMutationWithProposal({
    mutationFn: (allocationData: { label: string; amount: number; target: AllocationTarget; notes?: string | null }) =>
      budgetApi.createAllocation(projectId, allocationData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKey });
    },
    onError: (error: Error) => {
      toast({ title: 'Allocation failed', description: error.message || 'Could not create allocation', variant: 'destructive' });
    },
    proposalConfig: createProposalConfig<{ label: string; amount: number; target: AllocationTarget; notes?: string | null }>({
      category: 'budget',
      action: 'create',
      entityType: 'allocation',
      getTitle: () => 'Create Budget Allocation',
      getDescription: (vars) => `Allocate ${vars.amount} to "${vars.label}"`,
    }),
  });

  const updateAllocationMutation = useMutationWithProposal({
    mutationFn: ({ allocId, data }: { allocId: string; data: { label: string; amount: number; target: AllocationTarget; notes?: string | null } }) =>
      budgetApi.updateAllocation(projectId, allocId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKey });
    },
    onError: (error: Error) => {
      toast({ title: 'Update failed', description: error.message || 'Could not update allocation', variant: 'destructive' });
    },
    proposalConfig: createProposalConfig<{ allocId: string; data: { label: string; amount: number; target: AllocationTarget; notes?: string | null } }>({
      category: 'budget',
      action: 'update',
      entityType: 'allocation',
      getTitle: () => 'Update Budget Allocation',
      getDescription: (vars) => `Update allocation to "${vars.data.label}" with ${vars.data.amount}`,
    }),
  });

  const deleteAllocationMutation = useMutationWithProposal({
    mutationFn: (allocId: string) =>
      budgetApi.deleteAllocation(projectId, allocId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetQueryKey });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message || 'Could not delete allocation', variant: 'destructive' });
    },
    proposalConfig: createProposalConfig<string>({
      category: 'budget',
      action: 'delete',
      entityType: 'allocation',
      getTitle: () => 'Delete Budget Allocation',
      getDescription: () => 'Remove this budget allocation',
    }),
  });

  const allocatedTotal = useMemo(() => {
    return data.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  }, [data.allocations]);

  const unallocatedAmount = useMemo(() => {
    if (data.totalBudget === null) return null;
    return data.totalBudget - allocatedTotal;
  }, [data.totalBudget, allocatedTotal]);

  const isOverAllocated = useMemo(() => {
    if (data.totalBudget === null) return false;
    return allocatedTotal > data.totalBudget;
  }, [data.totalBudget, allocatedTotal]);

  const setTotalBudget = useCallback((amount: number | null) => {
    guardReadOnly(() => {
      const currencyToUse = data.currency || defaultCurrency || 'USD';
      budgetMutation.mutateWithProposal({ totalBudget: amount, currency: currencyToUse });
    });
  }, [guardReadOnly, budgetMutation, data.currency, defaultCurrency]);

  const setCurrency = useCallback((currency: string) => {
    guardReadOnly(() => {
      budgetMutation.mutateWithProposal({ currency });
    });
  }, [guardReadOnly, budgetMutation]);

  const setNotes = useCallback((notes: string) => {
    guardReadOnly(() => {
      budgetMutation.mutateWithProposal({ notes });
    });
  }, [guardReadOnly, budgetMutation]);

  const setContingency = useCallback((mode: 'fixed' | 'percent', value: number) => {
    guardReadOnly(() => {
      budgetMutation.mutate({ contingencyMode: mode, contingencyValue: value });
    });
  }, [guardReadOnly, budgetMutation]);

  const addAllocation = useCallback((
    label: string,
    amount: number,
    target: AllocationTarget,
    notes?: string
  ): string | undefined => {
    return guardReadOnly(() => {
      createAllocationMutation.mutateWithProposal({
        label,
        amount,
        target,
        notes: notes ?? null,
      });
      return undefined;
    });
  }, [guardReadOnly, createAllocationMutation]);

  const updateAllocation = useCallback((
    id: string,
    label: string,
    amount: number,
    target: AllocationTarget,
    notes?: string
  ) => {
    guardReadOnly(() => {
      updateAllocationMutation.mutateWithProposal({
        allocId: id,
        data: { label, amount, target, notes: notes ?? null },
      });
    });
  }, [guardReadOnly, updateAllocationMutation]);

  const deleteAllocation = useCallback((id: string) => {
    guardReadOnly(() => {
      deleteAllocationMutation.mutateWithProposal(id);
    });
  }, [guardReadOnly, deleteAllocationMutation]);

  const hasAllocations = data.allocations.length > 0;
  const hasTotalBudget = data.totalBudget !== null;

  return {
    data,
    allocatedTotal,
    unallocatedAmount,
    isOverAllocated,
    hasAllocations,
    hasTotalBudget,
    isReadOnly,
    isLoading,
    setTotalBudget,
    setCurrency,
    setNotes,
    setContingency,
    addAllocation,
    updateAllocation,
    deleteAllocation,
  };
}
