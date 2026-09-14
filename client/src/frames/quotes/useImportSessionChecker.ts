/**
 * RENIX vNext — Import Session Checker Hook
 * 
 * Checks for active import sessions on mount.
 * Import sessions persist across page refreshes.
 */

import { useEffect } from 'react';
import type { QuoteImportSession } from './QuoteImportPipeline';

interface Scope {
  id: string;
  name: string;
}

interface UseImportSessionCheckerParams {
  projectId: string;
  scopes: Scope[];
  activeImportSession: QuoteImportSession | null;
  setActiveImportSession: (session: QuoteImportSession | null) => void;
  setImportScopeId: (scopeId: string | null) => void;
}

export function useImportSessionChecker({
  projectId,
  scopes,
  activeImportSession,
  setActiveImportSession,
  setImportScopeId,
}: UseImportSessionCheckerParams): void {
  useEffect(() => {
    const checkActiveSessions = async () => {
      if (!projectId || !scopes.length || activeImportSession) return;
      
      for (const scope of scopes) {
        try {
          const res = await fetch(`/api/projects/${projectId}/scopes/${scope.id}/import-session`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            if (data.session && data.session.state !== 'completed' && data.session.state !== 'cancelled') {
              setImportScopeId(scope.id);
              setActiveImportSession(data.session);
              return;
            }
          }
        } catch (err) {
          // Ignore errors - no active session for this scope
        }
      }
    };
    
    checkActiveSessions();
  }, [projectId, scopes, activeImportSession, setActiveImportSession, setImportScopeId]);
}
