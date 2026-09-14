/**
 * RENIX vNext — Proposal Demo Hook
 * 
 * Demonstrates how to create proposals for testing the UI.
 * This will be replaced with actual mutation integration.
 */

import { useCallback } from 'react';
import { useProposals } from './ProposalContext';
import { ProposalCategory, ProposalAction } from './types';

export function useProposalDemo() {
  const { addProposal, isProposalModeActive, setProposalModeActive } = useProposals();

  const createDemoProposal = useCallback((
    category: ProposalCategory = 'scope',
    action: ProposalAction = 'create'
  ) => {
    const demos: Record<ProposalAction, { title: string; description: string; entityType: string }> = {
      create: {
        title: 'Add Kitchen Renovation Scope',
        description: 'Create a new scope for kitchen renovation including cabinets, countertops, and appliances.',
        entityType: 'Scope',
      },
      update: {
        title: 'Update Budget Allocation',
        description: 'Increase contingency from 10% to 15% based on project risk assessment.',
        entityType: 'Budget',
      },
      delete: {
        title: 'Remove Obsolete Quote',
        description: 'Delete outdated quote from Vendor A that has been superseded.',
        entityType: 'Quote',
      },
    };

    const demo = demos[action];
    
    return addProposal({
      category,
      action,
      entityType: demo.entityType,
      title: demo.title,
      description: demo.description,
      payload: { demo: true, action, category },
    });
  }, [addProposal]);

  return {
    createDemoProposal,
    isProposalModeActive,
    setProposalModeActive,
  };
}
