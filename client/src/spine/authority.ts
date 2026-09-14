/**
 * RENIX vNext — Authority Separation
 * 
 * Canon v1.4 Compliant
 * 
 * Defines three explicit authority channels:
 * - read: Access to project data
 * - propose: Suggest changes (AI may use this)
 * - commit: Apply changes (requires explicit user action)
 * 
 * Critical Rule: AI (future) may only use read + propose.
 * commit ALWAYS requires explicit user action.
 * No silent mutation paths.
 */

/**
 * Authority Channel Types
 */
export type AuthorityChannel = 'read' | 'propose' | 'commit';

/**
 * Authority context for operations.
 * This structure MUST exist even if unused.
 */
export interface AuthorityContext {
  channel: AuthorityChannel;
  actor: 'user' | 'ai' | 'system';
  projectId: string;
  timestamp: number;
}

/**
 * Authority constraints by actor type.
 * 
 * user: May use all channels
 * ai: May only use read + propose (NEVER commit)
 * system: May only use read (for display purposes)
 */
export const ACTOR_PERMISSIONS: Record<AuthorityContext['actor'], AuthorityChannel[]> = {
  user: ['read', 'propose', 'commit'],
  ai: ['read', 'propose'],
  system: ['read'],
};

/**
 * Validates if an actor can perform an operation on a given channel.
 */
export function canPerform(actor: AuthorityContext['actor'], channel: AuthorityChannel): boolean {
  return ACTOR_PERMISSIONS[actor].includes(channel);
}

/**
 * Creates an authority context for an operation.
 * This is a structural placeholder for future implementation.
 */
export function createAuthorityContext(
  channel: AuthorityChannel,
  actor: AuthorityContext['actor'],
  projectId: string
): AuthorityContext {
  return {
    channel,
    actor,
    projectId,
    timestamp: Date.now(),
  };
}

/**
 * Validates that a commit operation is user-initiated.
 * This is a canon invariant: no automatic commitments.
 */
export function validateCommit(context: AuthorityContext): boolean {
  if (context.channel !== 'commit') {
    return true; // Not a commit, no validation needed
  }
  
  // Only users may commit
  return context.actor === 'user';
}
