/**
 * RENIX vNext — Proposal System Exports
 * 
 * AI-First Pivot Step 3: Proposal Layer
 * "AI proposes, user decides" - all mutations require explicit approval
 */

export * from './types';
export { ProposalProvider, useProposals, useProposalQueue, usePendingProposals } from './ProposalContext';
export { ProposalQueue, ProposalIndicator } from './ProposalQueue';
export { useMutationWithProposal, createProposalConfig } from './useMutationWithProposal';
export { useProposalDemo } from './useProposalDemo';
