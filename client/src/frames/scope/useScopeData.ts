/**
 * RENIX vNext — Scope Frame Data Hook
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * The Scope Frame declares WHAT is included in a project.
 * It holds multiple Scopes.
 * It is declarative, non-operational, non-financial, and non-temporal.
 * 
 * Canonical Structure:
 * Project
 *  └─ Scope Frame
 *      ├─ Scope (0..N)
 *      │   ├─ Item
 *      │   └─ (legacy, now tree-based)
 *      │       └─ Item
 * 
 * Rules:
 * - A Project may have zero or many Scopes
 * - Each Scope is a first-class peer entity
 * - Legacy scope hook (now superseded by useScopeTreeData)
 * - Kept for budget frame compatibility
 * - No further nesting allowed
 * 
 * All mutations are blocked when project is read-only.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { queryKeys, scopeApi, ScopeData } from '@/lib/api';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export interface ScopeItem {
  id: string;
  name: string;
  description: string | null;
  isOptional: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface Scope {
  id: string;
  name: string;
  description: string | null;
  directItems: ScopeItem[];
  isOptional: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ScopeFrameData {
  scopes: Scope[];
}

function reconstructScopeData(response: ScopeData): ScopeFrameData {
  const scopes = response.scopes || [];
  return {
    scopes: scopes.map(scope => ({
      id: scope.id,
      name: scope.name,
      description: scope.description,
      isOptional: scope.isOptional,
      createdAt: new Date(scope.createdAt).getTime(),
      updatedAt: new Date(scope.updatedAt).getTime(),
      createdBy: scope.createdBy,
      directItems: [],
    })),
  };
}

export function useScopeData(projectId: string, isReadOnly: boolean = false, userId: string = 'user-001') {
  const { toast } = useToast();
  const { data: apiResponse, isLoading } = useQuery({
    queryKey: queryKeys.scope(projectId),
    queryFn: () => scopeApi.get(projectId),
  });

  const data: ScopeFrameData = useMemo(() => {
    if (!apiResponse) return { scopes: [] };
    return reconstructScopeData(apiResponse);
  }, [apiResponse]);

  const invalidateScope = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scope(projectId) });
  }, [projectId]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('Scope: Mutation blocked - project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  type CreateScopeVars = { name: string; description?: string; isOptional?: boolean };
  type UpdateScopeVars = { scopeId: string; name: string; description?: string; isOptional?: boolean };

  const createScopeMutation = useMutationWithProposal({
    mutationFn: (data: CreateScopeVars) =>
      scopeApi.createScope(projectId, {
        name: data.name,
        description: data.description ?? null,
        isOptional: data.isOptional ?? false,
        createdBy: userId,
      }),
    onSuccess: invalidateScope,
    proposalConfig: createProposalConfig<CreateScopeVars>({
      category: 'scope',
      entityType: 'Scope',
      action: 'create',
      getTitle: (vars) => `Create Scope: ${vars.name}`,
      getDescription: (vars) => 
        vars.description 
          ? `Add new scope "${vars.name}" with description: ${vars.description}`
          : `Add new scope "${vars.name}"`,
    }),
  });

  const updateScopeMutation = useMutationWithProposal({
    mutationFn: (data: UpdateScopeVars) =>
      scopeApi.updateScope(projectId, data.scopeId, {
        name: data.name,
        description: data.description ?? null,
        isOptional: data.isOptional,
      }),
    onSuccess: invalidateScope,
    proposalConfig: createProposalConfig<UpdateScopeVars>({
      category: 'scope',
      entityType: 'Scope',
      action: 'update',
      getEntityId: (vars) => vars.scopeId,
      getTitle: (vars) => `Update Scope: ${vars.name}`,
      getDescription: (vars) => `Modify scope to "${vars.name}"`,
    }),
  });

  // Delete uses regular mutation (confirmation dialog is sufficient, no proposal needed)
  const deleteScopeMutation = useMutation({
    mutationFn: (scopeId: string) => scopeApi.deleteScope(projectId, scopeId),
    onSuccess: invalidateScope,
  });

  const addScope = useCallback((name: string, description?: string, isOptional: boolean = false): string | undefined => {
    return guardReadOnly(() => {
      const tempId = crypto.randomUUID();
      createScopeMutation.mutateWithProposal({ name, description, isOptional });
      return tempId;
    });
  }, [guardReadOnly, createScopeMutation]);

  const updateScope = useCallback((scopeId: string, name: string, description?: string, isOptional?: boolean) => {
    guardReadOnly(() => {
      updateScopeMutation.mutateWithProposal({ scopeId, name, description, isOptional });
    });
  }, [guardReadOnly, updateScopeMutation]);

  const deleteScope = useCallback((scopeId: string) => {
    guardReadOnly(() => {
      deleteScopeMutation.mutate(scopeId);
    });
  }, [guardReadOnly, deleteScopeMutation]);


  const toggleScopeOptional = useCallback((scopeId: string) => {
    guardReadOnly(() => {
      const scope = data.scopes.find(s => s.id === scopeId);
      if (scope) {
        updateScopeMutation.mutateWithProposal({
          scopeId,
          name: scope.name,
          description: scope.description ?? undefined,
          isOptional: !scope.isOptional,
        });
      }
    });
  }, [guardReadOnly, data.scopes, updateScopeMutation]);

  const isEmpty = data.scopes.length === 0;

  const totalItems = useMemo(() => {
    return data.scopes.reduce((sum, scope) => sum + scope.directItems.length, 0);
  }, [data.scopes]);

  return {
    data,
    isEmpty,
    isReadOnly,
    isLoading,
    totalItems,
    addScope,
    updateScope,
    deleteScope,
    toggleScopeOptional,
  };
}
