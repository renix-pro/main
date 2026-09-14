/**
 * RENIX vNext — Project Lifecycle (Client)
 * 
 * Phase 3.5: Global Project Lifecycle Semantics
 * 
 * Implements EXACTLY THREE lifecycle states:
 * 
 * 1. ACTIVE (default)
 *    - Normal operation
 *    - Reads and writes allowed
 *    - AI proposals allowed
 * 
 * 2. CLOSED
 *    - Project intent is finalized
 *    - Read-only across all domain entities
 *    - AI restricted to: explain, explore, acknowledge
 *    - NO proposals or execution diffs allowed
 * 
 * 3. DELETED (terminal, soft-delete)
 *    - Project is hidden from normal queries
 *    - No AI access
 *    - Data retained for safety
 *    - Irreversible via normal application flows
 * 
 * TRANSITION RULES:
 * - active → closed (only)
 * - closed → deleted (only)
 */

import { 
  LifecycleState, 
  type LifecycleStateType,
  isValidLifecycleTransition,
  isLifecycleWriteAllowed,
  isLifecycleReadAllowed,
  isAIProposalAllowed,
} from '@shared/constants';

export { LifecycleState, type LifecycleStateType };

/**
 * Legacy ProjectStatus type for backward compatibility.
 * @deprecated Use LifecycleStateType instead
 */
export type ProjectStatus = 'open' | 'closed';

/**
 * Maps legacy ProjectStatus to LifecycleState.
 */
export function mapLegacyStatus(status: ProjectStatus): LifecycleStateType {
  return status === 'open' ? LifecycleState.ACTIVE : LifecycleState.CLOSED;
}

/**
 * Maps LifecycleState to legacy ProjectStatus.
 */
export function mapToLegacyStatus(lifecycleState: LifecycleStateType): ProjectStatus {
  return lifecycleState === LifecycleState.ACTIVE ? 'open' : 'closed';
}

/**
 * Legacy close project function for backward compatibility.
 * @deprecated Use canClose and lifecycle state transitions instead
 */
export function closeProject(currentStatus: ProjectStatus): ProjectStatus {
  if (currentStatus === 'open') {
    return 'closed';
  }
  return currentStatus;
}

/**
 * Lifecycle transition record.
 */
export type LifecycleTransition = {
  from: LifecycleStateType;
  to: LifecycleStateType;
  triggeredBy: 'user';
  timestamp: number;
};

/**
 * Validates if a project can be closed.
 * Only ACTIVE projects can be closed.
 */
export function canClose(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState === LifecycleState.ACTIVE;
}

/**
 * Validates if a project can be deleted.
 * Only CLOSED projects can be deleted (soft-delete).
 */
export function canDelete(lifecycleState: LifecycleStateType): boolean {
  return lifecycleState === LifecycleState.CLOSED;
}

/**
 * Creates a closure transition record.
 */
export function createClosureTransition(from: LifecycleStateType = LifecycleState.ACTIVE): LifecycleTransition {
  return {
    from,
    to: LifecycleState.CLOSED,
    triggeredBy: 'user',
    timestamp: Date.now(),
  };
}

/**
 * Creates a deletion transition record.
 */
export function createDeletionTransition(from: LifecycleStateType = LifecycleState.CLOSED): LifecycleTransition {
  return {
    from,
    to: LifecycleState.DELETED,
    triggeredBy: 'user',
    timestamp: Date.now(),
  };
}

/**
 * Checks if a project is read-only based on lifecycle state.
 * CLOSED and DELETED projects are read-only.
 * Supports both legacy ProjectStatus and new LifecycleStateType.
 */
export function isReadOnly(state: LifecycleStateType | ProjectStatus): boolean {
  if (state === 'open') return false;
  if (state === LifecycleState.ACTIVE) return false;
  return true;
}

/**
 * Checks if writes are allowed based on lifecycle state.
 * Only ACTIVE projects allow writes.
 */
export function isWriteAllowed(lifecycleState: LifecycleStateType): boolean {
  return isLifecycleWriteAllowed(lifecycleState);
}

/**
 * Checks if AI proposals are allowed based on lifecycle state.
 * Only ACTIVE projects allow AI proposals.
 */
export function isAIProposalsAllowed(lifecycleState: LifecycleStateType): boolean {
  return isAIProposalAllowed(lifecycleState);
}

/**
 * Returns a user-friendly description of the lifecycle state.
 */
export function getLifecycleDescription(lifecycleState: LifecycleStateType): string {
  switch (lifecycleState) {
    case LifecycleState.ACTIVE:
      return 'Active project — all features available';
    case LifecycleState.CLOSED:
      return 'Closed project — read-only, no modifications allowed';
    case LifecycleState.DELETED:
      return 'Deleted project — no longer accessible';
    default:
      return 'Unknown state';
  }
}

/**
 * Error codes returned by the server for lifecycle violations.
 */
export const LifecycleErrorCodes = {
  PROJECT_CLOSED: 'PROJECT_CLOSED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  AI_PROPOSALS_BLOCKED: 'AI_PROPOSALS_BLOCKED',
} as const;

/**
 * Checks if an API error is a lifecycle-related error.
 */
export function isLifecycleError(error: any): boolean {
  const code = error?.code || error?.response?.data?.code;
  return Object.values(LifecycleErrorCodes).includes(code);
}

/**
 * Gets a user-friendly message for lifecycle errors.
 */
export function getLifecycleErrorMessage(error: any): string {
  const code = error?.code || error?.response?.data?.code;
  const serverMessage = error?.message || error?.response?.data?.message;
  
  switch (code) {
    case LifecycleErrorCodes.PROJECT_CLOSED:
      return serverMessage || 'This project is closed and read-only.';
    case LifecycleErrorCodes.PROJECT_DELETED:
      return serverMessage || 'This project has been deleted.';
    case LifecycleErrorCodes.AI_PROPOSALS_BLOCKED:
      return serverMessage || 'AI cannot propose changes on closed projects.';
    default:
      return serverMessage || 'An error occurred.';
  }
}
