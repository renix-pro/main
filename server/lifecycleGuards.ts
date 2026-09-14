/**
 * RENIX vNext — Project Lifecycle Guards
 * 
 * Phase 3.5: Global Project Lifecycle Semantics
 * 
 * This module provides CENTRALIZED lifecycle enforcement for the entire application.
 * All domain write operations MUST flow through these guards.
 * 
 * LIFECYCLE STATES:
 * - ACTIVE: Normal operation, reads and writes allowed
 * - CLOSED: Read-only, no writes, AI restricted to explain/explore
 * - DELETED: No access at all, soft-deleted from queries
 * 
 * TRANSITION RULES (Explicit & Minimal):
 * - active → closed (only)
 * - closed → deleted (only)
 * All other transitions MUST fail loudly.
 * 
 * GUARDRAILS:
 * - Fail loudly in development (throw errors)
 * - Warn in production initially (log + reject gracefully)
 */

import { db } from './db';
import { eq, and, ne } from 'drizzle-orm';
import { projects } from '@shared/schema';
import { 
  LifecycleState, 
  LifecycleStateType,
  isValidLifecycleTransition,
  isLifecycleWriteAllowed,
  isLifecycleReadAllowed,
  isAIProposalAllowed,
  isAIAccessAllowed
} from '@shared/constants';

// ============================================================================
// ERROR TYPES
// ============================================================================

export class LifecycleError extends Error {
  constructor(
    message: string,
    public readonly projectId: string,
    public readonly currentState: LifecycleStateType,
    public readonly operation: 'read' | 'write' | 'transition' | 'ai_proposal' | 'ai_access'
  ) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export class InvalidTransitionError extends LifecycleError {
  constructor(
    projectId: string,
    from: LifecycleStateType,
    to: LifecycleStateType
  ) {
    super(
      `Invalid lifecycle transition: ${from} → ${to}. Only allowed: active→closed, closed→deleted`,
      projectId,
      from,
      'transition'
    );
    this.name = 'InvalidTransitionError';
  }
}

export class WriteBlockedError extends LifecycleError {
  constructor(projectId: string, currentState: LifecycleStateType) {
    super(
      `Write blocked: project '${projectId}' is in '${currentState}' state. Only 'active' projects allow writes.`,
      projectId,
      currentState,
      'write'
    );
    this.name = 'WriteBlockedError';
  }
}

export class ReadBlockedError extends LifecycleError {
  constructor(projectId: string, currentState: LifecycleStateType) {
    super(
      `Read blocked: project '${projectId}' is in '${currentState}' state. Deleted projects are not accessible.`,
      projectId,
      currentState,
      'read'
    );
    this.name = 'ReadBlockedError';
  }
}

export class AIProposalBlockedError extends LifecycleError {
  constructor(projectId: string, currentState: LifecycleStateType) {
    super(
      `AI proposal blocked: project '${projectId}' is in '${currentState}' state. Only 'active' projects allow proposals.`,
      projectId,
      currentState,
      'ai_proposal'
    );
    this.name = 'AIProposalBlockedError';
  }
}

export class AIAccessBlockedError extends LifecycleError {
  constructor(projectId: string, currentState: LifecycleStateType) {
    super(
      `AI access blocked: project '${projectId}' is in '${currentState}' state. Deleted projects have no AI access.`,
      projectId,
      currentState,
      'ai_access'
    );
    this.name = 'AIAccessBlockedError';
  }
}

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

const isDevelopment = process.env.NODE_ENV !== 'production';

function handleViolation(error: LifecycleError): void {
  if (isDevelopment) {
    // Development: FAIL LOUDLY
    console.error(`[LIFECYCLE GUARD] ${error.name}: ${error.message}`);
    throw error;
  } else {
    // Production: WARN (initially) - can be tightened later
    console.warn(`[LIFECYCLE GUARD] ${error.name}: ${error.message}`);
    throw error; // Still throw, but log as warning
  }
}

// ============================================================================
// LIFECYCLE STATE LOOKUP
// ============================================================================

/**
 * Fetches the current lifecycle state of a project.
 * Returns null if project doesn't exist.
 */
export async function getProjectLifecycleState(
  projectId: string,
  userId: string
): Promise<LifecycleStateType | null> {
  const [project] = await db
    .select({ lifecycleState: projects.lifecycleState })
    .from(projects)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ))
    .limit(1);
  
  if (!project) return null;
  return project.lifecycleState as LifecycleStateType;
}

/**
 * Fetches the full project with lifecycle info.
 * Excludes deleted projects from default queries.
 */
export async function getProjectWithLifecycle(
  projectId: string,
  userId: string,
  includeDeleted: boolean = false
): Promise<{
  id: string;
  lifecycleState: LifecycleStateType;
  lifecycleChangedAt: Date | null;
  lifecycleChangedBy: string | null;
} | null> {
  let query = db
    .select({
      id: projects.id,
      lifecycleState: projects.lifecycleState,
      lifecycleChangedAt: projects.lifecycleChangedAt,
      lifecycleChangedBy: projects.lifecycleChangedBy,
    })
    .from(projects)
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId),
      ...(includeDeleted ? [] : [ne(projects.lifecycleState, LifecycleState.DELETED)])
    ))
    .limit(1);
  
  const [result] = await query;
  if (!result) return null;
  
  return {
    ...result,
    lifecycleState: result.lifecycleState as LifecycleStateType,
  };
}

// ============================================================================
// LIFECYCLE GUARDS
// ============================================================================

/**
 * Guards a write operation on a project.
 * Only ACTIVE projects allow writes.
 * 
 * @throws WriteBlockedError if project is not active
 */
export async function guardWriteOperation(
  projectId: string,
  userId: string
): Promise<void> {
  const state = await getProjectLifecycleState(projectId, userId);
  
  if (!state) {
    // Project not found - let the caller handle this
    return;
  }
  
  if (!isLifecycleWriteAllowed(state)) {
    handleViolation(new WriteBlockedError(projectId, state));
  }
}

/**
 * Guards a read operation on a project.
 * ACTIVE and CLOSED allow reads. DELETED blocks all access.
 * 
 * @throws ReadBlockedError if project is deleted
 */
export async function guardReadOperation(
  projectId: string,
  userId: string
): Promise<void> {
  const state = await getProjectLifecycleState(projectId, userId);
  
  if (!state) {
    // Project not found - let the caller handle this
    return;
  }
  
  if (!isLifecycleReadAllowed(state)) {
    handleViolation(new ReadBlockedError(projectId, state));
  }
}

/**
 * Guards an AI proposal creation.
 * Only ACTIVE projects allow AI proposals.
 * 
 * @throws AIProposalBlockedError if project is not active
 */
export async function guardAIProposal(
  projectId: string,
  userId: string
): Promise<void> {
  const state = await getProjectLifecycleState(projectId, userId);
  
  if (!state) {
    return;
  }
  
  if (!isAIProposalAllowed(state)) {
    handleViolation(new AIProposalBlockedError(projectId, state));
  }
}

/**
 * Guards any AI access to a project.
 * DELETED projects block all AI access.
 * 
 * @throws AIAccessBlockedError if project is deleted
 */
export async function guardAIAccess(
  projectId: string,
  userId: string
): Promise<void> {
  const state = await getProjectLifecycleState(projectId, userId);
  
  if (!state) {
    return;
  }
  
  if (!isAIAccessAllowed(state)) {
    handleViolation(new AIAccessBlockedError(projectId, state));
  }
}

// ============================================================================
// LIFECYCLE TRANSITIONS
// ============================================================================

/**
 * Transitions a project's lifecycle state.
 * Enforces strict transition rules: active→closed, closed→deleted only.
 * 
 * @throws InvalidTransitionError if transition is not allowed
 */
export async function transitionLifecycleState(
  projectId: string,
  userId: string,
  toState: LifecycleStateType
): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
  const currentState = await getProjectLifecycleState(projectId, userId);
  
  if (!currentState) {
    throw new Error(`Project '${projectId}' not found for user '${userId}'`);
  }
  
  // Validate transition
  if (!isValidLifecycleTransition(currentState, toState)) {
    handleViolation(new InvalidTransitionError(projectId, currentState, toState));
    // If we get here in production (warning mode), still return to prevent undefined behavior
    return { previousState: currentState, newState: currentState };
  }
  
  // Perform transition
  const now = new Date();
  await db
    .update(projects)
    .set({
      lifecycleState: toState,
      lifecycleChangedAt: now,
      lifecycleChangedBy: userId,
      updatedAt: now,
    })
    .where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId)
    ));
  
  console.log(`[LIFECYCLE] Project '${projectId}' transitioned: ${currentState} → ${toState}`);
  
  return { previousState: currentState, newState: toState };
}

/**
 * Closes a project (active → closed).
 * Convenience wrapper for transitionLifecycleState.
 */
export async function closeProject(
  projectId: string,
  userId: string
): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
  return transitionLifecycleState(projectId, userId, LifecycleState.CLOSED);
}

/**
 * Soft-deletes a project (closed → deleted).
 * Convenience wrapper for transitionLifecycleState.
 * Note: Only closed projects can be deleted.
 */
export async function softDeleteProject(
  projectId: string,
  userId: string
): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
  return transitionLifecycleState(projectId, userId, LifecycleState.DELETED);
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Returns a Drizzle condition that excludes deleted projects.
 * Use this in all default project queries.
 */
export function excludeDeletedCondition() {
  return ne(projects.lifecycleState, LifecycleState.DELETED);
}

/**
 * Returns a Drizzle condition that includes only active projects.
 */
export function activeOnlyCondition() {
  return eq(projects.lifecycleState, LifecycleState.ACTIVE);
}

// ============================================================================
// SYNC GUARDS (for routes that already have project data)
// ============================================================================

/**
 * Synchronous guard for when project data is already loaded.
 * Use when you've already fetched the project and need to validate.
 */
export function guardWriteSync(
  projectId: string,
  lifecycleState: LifecycleStateType
): void {
  if (!isLifecycleWriteAllowed(lifecycleState)) {
    handleViolation(new WriteBlockedError(projectId, lifecycleState));
  }
}

/**
 * Synchronous guard for read operations when project data is already loaded.
 */
export function guardReadSync(
  projectId: string,
  lifecycleState: LifecycleStateType
): void {
  if (!isLifecycleReadAllowed(lifecycleState)) {
    handleViolation(new ReadBlockedError(projectId, lifecycleState));
  }
}

/**
 * Synchronous guard for AI proposals when project data is already loaded.
 */
export function guardAIProposalSync(
  projectId: string,
  lifecycleState: LifecycleStateType
): void {
  if (!isAIProposalAllowed(lifecycleState)) {
    handleViolation(new AIProposalBlockedError(projectId, lifecycleState));
  }
}
