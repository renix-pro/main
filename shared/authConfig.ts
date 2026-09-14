/**
 * RENIX vNext — Shared Auth Configuration
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 * 
 * Centralized auth configuration shared between client and server.
 */

/**
 * Global authentication mode flag.
 * 
 * When false:
 * - Auth UI exists but is bypassed
 * - App auto-authenticates a test user
 * - No login/signup screen is shown
 * 
 * When true:
 * - Auth is enforced strictly
 * - No unauthenticated access to Project Space
 */
export const AUTH_ENABLED = true;

/**
 * Test user for development (used when AUTH_ENABLED = false)
 */
export const TEST_USER = {
  id: 'test-user-001',
  email: 'test@renix.local',
  name: 'Test User',
};

/**
 * Auth route paths
 */
export const AUTH_ROUTES = {
  login: '/login',
  signup: '/signup',
  resetPassword: '/reset-password',
  setNewPassword: '/set-new-password',
  projects: '/projects',
} as const;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  cookieName: 'renix_session',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;
