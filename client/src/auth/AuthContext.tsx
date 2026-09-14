/**
 * RENIX vNext — Authentication Context
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 * 
 * Provides authentication state and actions.
 * When AUTH_ENABLED = false, auto-authenticates test user.
 * Supports token-based auth fallback for browsers that block cookies.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AUTH_ENABLED, TEST_USER } from './config';
import { clearLastActiveProjectId } from '../persistence/sessionState';
import { queryClient } from '../lib/queryClient';

const AUTH_TOKEN_KEY = 'renix-auth-token';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  googleLogin: (credential: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      if (!AUTH_ENABLED) {
        // Auto-authenticate test user when auth is disabled
        setState({
          user: TEST_USER,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      // Check for existing session (try cookie first, then token)
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          const data = await response.json();
          setState({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Clear any stale token
          setStoredToken(null);
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false): Promise<{ success: boolean; error?: string }> => {
    if (!AUTH_ENABLED) {
      // When auth is disabled, always succeed
      setState({
        user: TEST_USER,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, remember }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        // Store the token for fallback authentication (when cookies are blocked)
        if (data.token) {
          setStoredToken(data.token);
        }

        setState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: data.message || 'Login failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, passwordConfirm: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    if (password !== passwordConfirm) {
      return { success: false, error: 'Passwords do not match' };
    }

    if (!AUTH_ENABLED) {
      // When auth is disabled, always succeed
      setState({
        user: TEST_USER,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        // Store the token for fallback authentication (when cookies are blocked)
        if (data.token) {
          setStoredToken(data.token);
        }

        setState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: data.message || 'Signup failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const googleLogin = useCallback(async (credential: string): Promise<{ success: boolean; error?: string }> => {
    if (!AUTH_ENABLED) {
      setState({
        user: TEST_USER,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    }

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        if (data.token) {
          setStoredToken(data.token);
        }

        setState({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return { success: true };
      }

      return { success: false, error: data.message || 'Google login failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    const currentUserId = state.user?.id;
    
    if (AUTH_ENABLED) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
        });
      } catch {
        // Ignore errors
      }
    }

    // Clear auth token
    setStoredToken(null);

    // Clear all cached query data to prevent stale data from previous user
    queryClient.clear();

    // Clear session state (last active project, scoped to user)
    clearLastActiveProjectId(currentUserId);

    // Clear project context from localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('renix-project-')) {
        localStorage.removeItem(key);
      }
    });

    setState({
      user: AUTH_ENABLED ? null : TEST_USER,
      isAuthenticated: !AUTH_ENABLED,
      isLoading: false,
    });
  }, [state.user?.id]);

  const updateProfile = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/profile/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setState(prev => ({
          ...prev,
          user: data.user,
        }));
        return { success: true };
      }

      return { success: false, error: data.message || 'Update failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const changeUserPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true };
      }

      return { success: false, error: data.message || 'Password change failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!AUTH_ENABLED) {
      return { success: true, message: 'Password reset is not yet available. Please contact support.' };
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      }

      return { success: false, error: data.message || 'Request failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    googleLogin,
    logout,
    requestPasswordReset,
    updateProfile,
    changePassword: changeUserPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
