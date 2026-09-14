/**
 * RENIX vNext — Quotes Mode State Hook
 * 
 * Manages the four-mode navigation state for Quotes Frame.
 * NOTE: Per Section 14, there is NO "Inbox" concept - uses "library" for secondary view.
 */

import { useState, useCallback } from 'react';
import { 
  QuotesMode, 
  QuotesModeState, 
  QuotesLibraryFilters, 
  QuoteWorkspaceState,
  ComparisonSelection,
  initialModeState 
} from './types';

export function useQuotesModeState() {
  const [state, setState] = useState<QuotesModeState>(initialModeState);

  // Mode navigation
  const setMode = useCallback((mode: QuotesMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const goToOverview = useCallback(() => setMode('overview'), [setMode]);
  const goToLibrary = useCallback(() => setMode('library'), [setMode]);
  const goToWorkspace = useCallback(() => setMode('workspace'), [setMode]);
  const goToComparison = useCallback(() => setMode('comparison'), [setMode]);

  // Library filter management (secondary view for search/audit)
  const setLibraryFilters = useCallback((filters: Partial<QuotesLibraryFilters>) => {
    setState(prev => ({
      ...prev,
      library: {
        ...prev.library,
        filters: { ...prev.library.filters, ...filters },
      },
    }));
  }, []);

  const clearLibraryFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      library: { filters: initialModeState.library.filters },
    }));
  }, []);

  // Workspace selection
  const openQuoteInWorkspace = useCallback((quoteId: string, versionId?: string) => {
    setState(prev => ({
      ...prev,
      mode: 'workspace',
      workspace: {
        quoteId,
        versionId: versionId || null,
        documentId: null,
      },
    }));
  }, []);

  const setWorkspaceVersion = useCallback((versionId: string) => {
    setState(prev => ({
      ...prev,
      workspace: { ...prev.workspace, versionId },
    }));
  }, []);

  const setWorkspaceDocument = useCallback((documentId: string | null) => {
    setState(prev => ({
      ...prev,
      workspace: { ...prev.workspace, documentId },
    }));
  }, []);

  const closeWorkspace = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'overview',
      workspace: initialModeState.workspace,
    }));
  }, []);

  // Comparison selection
  const addToComparison = useCallback((versionId: string) => {
    setState(prev => ({
      ...prev,
      comparison: {
        ...prev.comparison,
        quoteVersionIds: prev.comparison.quoteVersionIds.includes(versionId)
          ? prev.comparison.quoteVersionIds
          : [...prev.comparison.quoteVersionIds, versionId],
      },
    }));
  }, []);

  const removeFromComparison = useCallback((versionId: string) => {
    setState(prev => ({
      ...prev,
      comparison: {
        ...prev.comparison,
        quoteVersionIds: prev.comparison.quoteVersionIds.filter(id => id !== versionId),
      },
    }));
  }, []);

  const setScopeItemsForComparison = useCallback((scopeItemIds: string[]) => {
    setState(prev => ({
      ...prev,
      comparison: { ...prev.comparison, scopeItemIds },
    }));
  }, []);

  const clearComparison = useCallback(() => {
    setState(prev => ({
      ...prev,
      comparison: initialModeState.comparison,
    }));
  }, []);

  const enterComparisonMode = useCallback(() => {
    if (state.comparison.quoteVersionIds.length >= 2) {
      setState(prev => ({ ...prev, mode: 'comparison' }));
    }
  }, [state.comparison.quoteVersionIds.length]);

  const enterComparisonForScope = useCallback((scopeId: string) => {
    setState(prev => ({
      ...prev,
      mode: 'comparison',
      comparison: {
        ...prev.comparison,
        focusedScopeId: scopeId,
      },
    }));
  }, []);

  const setFocusedScope = useCallback((scopeId: string | null) => {
    setState(prev => ({
      ...prev,
      comparison: {
        ...prev.comparison,
        focusedScopeId: scopeId,
      },
    }));
  }, []);

  return {
    // State
    mode: state.mode,
    libraryFilters: state.library.filters,
    workspaceState: state.workspace,
    comparisonSelection: state.comparison,

    // Mode navigation
    setMode,
    goToOverview,
    goToLibrary,
    goToWorkspace,
    goToComparison,

    // Library actions (secondary view for search/audit)
    setLibraryFilters,
    clearLibraryFilters,

    // Workspace actions
    openQuoteInWorkspace,
    setWorkspaceVersion,
    setWorkspaceDocument,
    closeWorkspace,

    // Comparison actions
    addToComparison,
    removeFromComparison,
    setScopeItemsForComparison,
    clearComparison,
    enterComparisonMode,
    enterComparisonForScope,
    setFocusedScope,
    focusedScopeId: state.comparison.focusedScopeId,
    canCompare: state.comparison.quoteVersionIds.length >= 2,
  };
}

export type QuotesModeStateReturn = ReturnType<typeof useQuotesModeState>;
