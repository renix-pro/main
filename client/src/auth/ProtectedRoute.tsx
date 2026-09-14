/**
 * RENIX vNext — Protected Route Wrapper
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 * 
 * Wraps routes that require authentication.
 * When AUTH_ENABLED = false, always allows access.
 */

import { type ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from './AuthContext';
import { AUTH_ENABLED, AUTH_ROUTES } from './config';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // When auth is disabled, always render children
  if (!AUTH_ENABLED) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div 
          className="text-sm text-muted-foreground"
        >
          Loading...
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to={AUTH_ROUTES.login} />;
  }

  return <>{children}</>;
}

/**
 * Wrapper for auth pages (login, signup, etc.)
 * Redirects to projects if already authenticated
 */
interface AuthRouteProps {
  children: ReactNode;
}

export function AuthRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // When auth is disabled, redirect to projects
  if (!AUTH_ENABLED) {
    return <Redirect to={AUTH_ROUTES.projects} />;
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div 
          className="text-sm text-muted-foreground"
        >
          Loading...
        </div>
      </div>
    );
  }

  // Redirect to projects if already authenticated
  if (isAuthenticated) {
    return <Redirect to={AUTH_ROUTES.projects} />;
  }

  return <>{children}</>;
}
