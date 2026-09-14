/**
 * RENIX vNext — Proposal Context
 * 
 * Manages the proposal queue state and provides methods for
 * adding, approving, and rejecting proposals.
 */

import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Proposal, ProposalContextValue, ProposalQueueState } from './types';

const ProposalContext = createContext<ProposalContextValue | null>(null);

function generateProposalId(): string {
  return `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface ProposalProviderProps {
  children: ReactNode;
}

export function ProposalProvider({ children }: ProposalProviderProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Default to false: User-initiated direct changes execute immediately without confirmation
  // AI proposals are handled separately through the server-side proposal system
  const [isProposalModeActive, setProposalModeActive] = useState(false);

  const pendingCount = useMemo(
    () => proposals.filter(p => p.status === 'pending').length,
    [proposals]
  );

  const state: ProposalQueueState = useMemo(
    () => ({ proposals, pendingCount, isProcessing }),
    [proposals, pendingCount, isProcessing]
  );

  const addProposal = useCallback(<T,>(
    proposalData: Omit<Proposal<T>, 'id' | 'status' | 'createdAt'>
  ): string => {
    const id = generateProposalId();
    const proposal: Proposal<T> = {
      ...proposalData,
      id,
      status: 'pending',
      createdAt: new Date(),
    };
    setProposals(prev => [...prev, proposal as Proposal]);
    return id;
  }, []);

  const approveProposal = useCallback(async (id: string): Promise<void> => {
    const proposal = proposals.find(p => p.id === id);
    if (!proposal || proposal.status !== 'pending') return;

    setIsProcessing(true);
    try {
      setProposals(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, status: 'approved' as const, approvedAt: new Date() }
            : p
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [proposals]);

  const rejectProposal = useCallback((id: string, _reason?: string): void => {
    setProposals(prev =>
      prev.map(p =>
        p.id === id && p.status === 'pending'
          ? { ...p, status: 'rejected' as const, rejectedAt: new Date() }
          : p
      )
    );
  }, []);

  const clearExpired = useCallback((): void => {
    const now = new Date();
    setProposals(prev =>
      prev.map(p =>
        p.status === 'pending' && p.expiresAt && p.expiresAt < now
          ? { ...p, status: 'expired' as const }
          : p
      )
    );
  }, []);

  const pruneOldProposals = useCallback((maxAgeMs: number = 5 * 60 * 1000): void => {
    const cutoff = new Date(Date.now() - maxAgeMs);
    setProposals(prev =>
      prev.filter(p => {
        if (p.status === 'pending') return true;
        const resolvedAt = p.approvedAt || p.rejectedAt;
        if (resolvedAt) {
          return resolvedAt > cutoff;
        }
        if (p.status === 'expired') {
          return p.createdAt > cutoff;
        }
        return true;
      })
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      pruneOldProposals();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [pruneOldProposals]);

  const value: ProposalContextValue = useMemo(
    () => ({
      state,
      addProposal,
      approveProposal,
      rejectProposal,
      clearExpired,
      pruneOldProposals,
      isProposalModeActive,
      setProposalModeActive,
    }),
    [state, addProposal, approveProposal, rejectProposal, clearExpired, pruneOldProposals, isProposalModeActive]
  );

  return (
    <ProposalContext.Provider value={value}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposals(): ProposalContextValue {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposals must be used within a ProposalProvider');
  }
  return context;
}

export function useProposalQueue() {
  const { state } = useProposals();
  return state;
}

export function usePendingProposals() {
  const { state } = useProposals();
  return useMemo(
    () => state.proposals.filter(p => p.status === 'pending'),
    [state.proposals]
  );
}
