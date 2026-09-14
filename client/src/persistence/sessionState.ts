/**
 * RENIX vNext — Session State Persistence
 * 
 * Persists the user's last active project across sessions.
 * On return, the application starts on the Overview frame of the last active project.
 * 
 * STORED DATA:
 * - projectId: The ID of the last active project
 * - timestamp: When this was last updated
 * 
 * SECURITY:
 * - Keys are scoped per user ID to prevent cross-user session bleed
 * - Cleared on logout to prevent leakage on shared devices
 * - projectId is validated before use (project must still exist)
 */

const LAST_ACTIVE_PROJECT_KEY_PREFIX = 'renix-last-active-project';

interface SessionState {
  projectId: string;
  timestamp: number;
}

function getKey(userId?: string): string {
  return userId ? `${LAST_ACTIVE_PROJECT_KEY_PREFIX}-${userId}` : LAST_ACTIVE_PROJECT_KEY_PREFIX;
}

export function getLastActiveProjectId(userId?: string): string | null {
  try {
    const stored = localStorage.getItem(getKey(userId));
    if (stored) {
      const state: SessionState = JSON.parse(stored);
      return state.projectId;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function setLastActiveProjectId(projectId: string, userId?: string): void {
  try {
    const state: SessionState = {
      projectId,
      timestamp: Date.now(),
    };
    localStorage.setItem(getKey(userId), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function clearLastActiveProjectId(userId?: string): void {
  try {
    localStorage.removeItem(getKey(userId));
    if (userId) {
      localStorage.removeItem(LAST_ACTIVE_PROJECT_KEY_PREFIX);
    }
  } catch {
    // Ignore errors
  }
}
