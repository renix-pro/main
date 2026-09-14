/**
 * RENIX vNext — Authentication Module
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 */

export { AUTH_ENABLED, TEST_USER, AUTH_ROUTES, SESSION_CONFIG } from './config';
export { AuthProvider, useAuth, useUser, useIsAuthenticated, type User, type AuthState } from './AuthContext';
export { ProtectedRoute, AuthRoute } from './ProtectedRoute';
