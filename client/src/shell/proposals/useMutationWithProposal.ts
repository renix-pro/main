/**
 * RENIX vNext — Mutation with Proposal Hook
 * 
 * Wraps useMutation to intercept mutations and convert them to proposals
 * when proposal mode is active. Executes immediately when inactive.
 */

import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useProposals } from './ProposalContext';
import { MutationProposalConfig } from './types';

interface UseMutationWithProposalOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  proposalConfig: MutationProposalConfig<TVariables, TData>;
}

export function useMutationWithProposal<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationWithProposalOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> & {
  mutateWithProposal: (variables: TVariables) => void;
} {
  const { proposalConfig, ...mutationOptions } = options;
  const { addProposal, state, isProposalModeActive } = useProposals();
  
  const pendingExecutionsRef = useRef<Map<string, TVariables>>(new Map());
  const onApprovedRef = useRef(proposalConfig.onApproved);
  onApprovedRef.current = proposalConfig.onApproved;

  const wrappedMutationOptions: UseMutationOptions<TData, TError, TVariables, TContext> = {
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      mutationOptions.onSuccess?.(data, variables, context);
      onApprovedRef.current?.(data);
    },
  };
  
  const mutation = useMutation(wrappedMutationOptions);

  useEffect(() => {
    for (const proposal of state.proposals) {
      const hasEntry = pendingExecutionsRef.current.has(proposal.id);
      if (!hasEntry) continue;

      if (proposal.status === 'approved') {
        const variables = pendingExecutionsRef.current.get(proposal.id);
        pendingExecutionsRef.current.delete(proposal.id);
        if (variables !== undefined) {
          mutation.mutate(variables);
        }
      } else if (proposal.status === 'rejected' || proposal.status === 'expired') {
        pendingExecutionsRef.current.delete(proposal.id);
      }
    }
  }, [state.proposals, mutation]);

  const mutateWithProposal = useCallback(
    (variables: TVariables) => {
      if (!isProposalModeActive) {
        mutation.mutate(variables);
        return;
      }

      const proposalId = addProposal({
        category: proposalConfig.category,
        action: proposalConfig.action,
        entityType: proposalConfig.entityType,
        entityId: proposalConfig.getEntityId?.(variables),
        title: proposalConfig.getTitle(variables),
        description: proposalConfig.getDescription(variables),
        payload: variables,
      });

      pendingExecutionsRef.current.set(proposalId, variables);
    },
    [isProposalModeActive, addProposal, proposalConfig, mutation]
  );

  return {
    ...mutation,
    mutateWithProposal,
  };
}

export function createProposalConfig<TVariables>(
  config: MutationProposalConfig<TVariables>
): MutationProposalConfig<TVariables> {
  return config;
}
