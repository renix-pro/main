/**
 * RENIX vNext — AI Attention State Module
 * 
 * Computes attention state from authoritative system state.
 * Attention is COMPUTED, not inferred from conversation.
 * 
 * Exactly ONE of:
 *   pending_decision | missing_information | 
 *   dependency_blocked | review_recommended | no_attention
 */

import type { 
  AttentionState, 
  AttentionDetail, 
  AssistOption, 
  AuthoritativeState 
} from './types';

export function resolveAttentionState(
  state: AuthoritativeState
): { attention_state: AttentionState; attention_detail?: AttentionDetail } {
  if (state.pendingProposals.length > 0) {
    const proposal = state.pendingProposals[0];
    return {
      attention_state: 'pending_decision',
      attention_detail: {
        what: `You have ${state.pendingProposals.length} pending proposal${state.pendingProposals.length > 1 ? 's' : ''} awaiting your decision`,
        where: proposal.targetFrame,
      },
    };
  }

  if (state.project) {
    if (state.scope.totalCount > 0 && state.budget.intent === null) {
      return {
        attention_state: 'missing_information',
        attention_detail: {
          what: 'Budget intent has not been defined yet',
          where: 'Budget',
        },
      };
    }
  }

  if (state.budget.intent && state.scope.totalCount === 0) {
    return {
      attention_state: 'dependency_blocked',
      attention_detail: {
        what: 'Budget allocations cannot proceed without defined scope',
        where: 'Scope',
      },
    };
  }

  if (state.budget.intent && state.budget.variance < 0) {
    return {
      attention_state: 'review_recommended',
      attention_detail: {
        what: 'Budget allocations exceed the defined intent',
        where: 'Budget',
      },
    };
  }

  if (state.expectedCost.hasFinancingGap && state.expectedCost.gapSeverity === 'critical') {
    return {
      attention_state: 'review_recommended',
      attention_detail: {
        what: `Critical financing shortfall: ${Math.abs(state.expectedCost.coverageDelta).toLocaleString()} below expected cost`,
        where: 'Financing',
      },
    };
  }

  if (state.expectedCost.hasFinancingGap && state.expectedCost.gapSeverity === 'warning') {
    return {
      attention_state: 'review_recommended',
      attention_detail: {
        what: `Financing gap of ${Math.abs(state.expectedCost.coverageDelta).toLocaleString()} detected`,
        where: 'Financing',
      },
    };
  }

  return { attention_state: 'no_attention' };
}

export function generateAssistOptions(
  attentionState: AttentionState,
  attentionDetail?: AttentionDetail,
  isNewProposal: boolean = false
): AssistOption[] {
  switch (attentionState) {
    case 'pending_decision':
      if (isNewProposal) {
        return [
          { label: 'I have questions', action: 'send_message', payload: 'Tell me more about this proposal' },
          { label: 'Modify', action: 'send_message', payload: 'I want to adjust this proposal' },
        ];
      }
      return [
        { label: 'Show pending proposal', action: 'send_message', payload: 'Show me the pending proposal' },
        { label: 'Cancel proposal', action: 'send_message', payload: 'Cancel the pending proposal' },
      ];

    case 'missing_information':
      if (attentionDetail?.where === 'Budget') {
        return [
          { label: 'Set budget intent', action: 'send_message', payload: 'I want to set my budget' },
          { label: 'Skip for now', action: 'dismiss' },
        ];
      }
      return [
        { label: 'Provide information', action: 'send_message', payload: attentionDetail?.what || 'I can provide the missing information' },
        { label: 'Skip for now', action: 'dismiss' },
      ];

    case 'dependency_blocked':
      return [
        { label: `Go to ${attentionDetail?.where || 'relevant frame'}`, action: 'navigate', payload: attentionDetail?.where?.toLowerCase() || 'scope' },
        { label: 'Explain dependency', action: 'send_message', payload: 'Explain the dependency' },
      ];

    case 'review_recommended':
      return [
        { label: `Review ${attentionDetail?.where || 'issue'}`, action: 'navigate', payload: attentionDetail?.where?.toLowerCase() || 'overview' },
        { label: 'Dismiss', action: 'dismiss' },
      ];

    case 'no_attention':
    default:
      return [];
  }
}

export { AttentionState, AttentionDetail, AssistOption };
