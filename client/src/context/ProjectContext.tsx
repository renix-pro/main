/**
 * RENIX vNext — Project Context
 * 
 * Canon v1.4 Compliant — Phase 12 Addendum
 * 
 * This is the SOLE GLOBAL TRUTH for project state.
 * 
 * Regional Settings (Phase 12 Addendum):
 * - Currency, measurement system, and locale are PART OF PROJECT IDENTITY
 * - They are captured AT PROJECT CREATION
 * - They are IMMUTABLE for the lifetime of the project
 * - There is NO post-creation edit capability
 * 
 * Includes ONLY:
 * - projectId
 * - projectName
 * - projectStatus: "open" | "closed"
 * - regionalContext (explicit, IMMUTABLE after creation)
 * - activeFrame
 * - isReadOnly (derived strictly from projectStatus)
 * 
 * Explicitly EXCLUDES:
 * - stages
 * - progress
 * - tasks
 * - financial data
 * - AI state
 * - workflow state
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type CanonicalFrame, DEFAULT_FRAME, isCanonicalFrame } from '../spine/appSpine';
import { isReadOnly as checkReadOnly, closeProject as performClose, type ProjectStatus } from '../spine/projectLifecycle';
import { 
  type RegionalContext, 
  detectRegion, 
  getRegionalContext,
  formatCurrency as formatCurrencyUtil,
  formatNumber as formatNumberUtil,
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
  formatMeasurement as formatMeasurementUtil,
} from './regionalContext';
import { getProjectById, type ProjectMetadata, type ProjectRegionalContext } from '../persistence/useProjectsData';
import { setLastActiveProjectId } from '../persistence/sessionState';
import { useAuth } from '../auth';
import { queryKeys, projectsApi, type Project } from '../lib/api';

export type { ProjectStatus, RegionalContext };

export interface ProjectState {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  regionalContext: RegionalContext;
  activeFrame: CanonicalFrame;
  lastMeaningfulUpdate: number;
}

export interface ProjectContextValue extends ProjectState {
  isReadOnly: boolean;
  region: string;
  currency: string;
  setActiveFrame: (frame: CanonicalFrame) => void;
  closeProject: () => void;
  recordMeaningfulUpdate: () => void;
  formatCurrency: (amount: number | null) => string;
  formatNumber: (value: number, decimals?: number) => string;
  formatDate: (date: Date | number | string) => string;
  formatDateTime: (date: Date | number | string) => string;
  formatMeasurement: (value: number, unit: 'length' | 'area' | 'volume') => string;
  highlightDocumentId: string | null;
  navigateToDocument: (documentId: string) => void;
  clearHighlightDocument: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// Load project from global projects storage
function loadProjectFromGlobalStore(projectId: string): Partial<ProjectState> | null {
  const project = getProjectById(projectId);
  if (project) {
    // Handle legacy projects without regionalContext (backward compatibility)
    const regionCode = project.regionalContext?.region ?? detectRegion();
    const currencyCode = project.regionalContext?.currency;
    
    // Use getRegionalContext to build full RegionalContext from region code
    const regionalContext = getRegionalContext(regionCode, true);
    // Override currency if different from region default
    if (currencyCode && currencyCode !== regionalContext.currency) {
      regionalContext.currency = currencyCode;
    }
    return {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status === 'archived' ? 'closed' : project.status,
      regionalContext,
      lastMeaningfulUpdate: project.updatedAt ?? project.createdAt ?? Date.now() - 3600000,
    };
  }
  return null;
}

interface ProjectProviderProps {
  children: ReactNode;
  initialProject?: Partial<ProjectState>;
}

export function ProjectProvider({ children, initialProject }: ProjectProviderProps) {
  const projectId = initialProject?.projectId ?? 'demo-project-001';
  
  // Subscribe to projects query to update when data becomes available
  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const [state, setState] = useState<ProjectState>(() => {
    // Load from global projects storage (where useProjectsData stores projects)
    const stored = loadProjectFromGlobalStore(projectId);
    const detectedRegion = detectRegion();
    
    // Regional context is set at project creation and is IMMUTABLE
    // If stored, use stored (already confirmed); otherwise use detected with confirmation
    const regionalContext = stored?.regionalContext ?? 
      initialProject?.regionalContext ?? 
      getRegionalContext(detectedRegion, true); // Auto-confirm for demo project
    
    return {
      projectId,
      projectName: stored?.projectName ?? initialProject?.projectName ?? 'Untitled Project',
      projectStatus: stored?.projectStatus ?? initialProject?.projectStatus ?? 'open',
      regionalContext,
      activeFrame: initialProject?.activeFrame ?? DEFAULT_FRAME,
      lastMeaningfulUpdate: stored?.lastMeaningfulUpdate ?? initialProject?.lastMeaningfulUpdate ?? Date.now() - 3600000,
    };
  });

  // Update state when projects data becomes available (handles page reload case)
  useEffect(() => {
    if (projectsData?.projects) {
      const project = projectsData.projects.find((p: Project) => p.id === projectId);
      if (project) {
        const regionCode = (project.regionalContext as ProjectRegionalContext)?.region ?? detectRegion();
        const currencyCode = (project.regionalContext as ProjectRegionalContext)?.currency;
        const regionalContext = getRegionalContext(regionCode, true);
        if (currencyCode && currencyCode !== regionalContext.currency) {
          regionalContext.currency = currencyCode;
        }
        
        setState(prev => ({
          ...prev,
          projectName: project.name,
          projectStatus: project.status === 'archived' ? 'closed' : project.status as ProjectStatus,
          regionalContext,
          lastMeaningfulUpdate: project.updatedAt 
            ? new Date(project.updatedAt).getTime() 
            : project.createdAt 
              ? new Date(project.createdAt).getTime() 
              : prev.lastMeaningfulUpdate,
        }));
      }
    }
  }, [projectsData, projectId]);

  const isReadOnly = checkReadOnly(state.projectStatus);

  const { user } = useAuth();
  
  // Persist last active project for session restoration (scoped per user)
  useEffect(() => {
    setLastActiveProjectId(state.projectId, user?.id);
  }, [state.projectId, user?.id]);

  const setActiveFrame = useCallback((frame: CanonicalFrame) => {
    if (!isCanonicalFrame(frame)) {
      return;
    }
    setState(prev => ({ ...prev, activeFrame: frame }));
  }, []);

  const closeProject = useCallback(() => {
    setState(prev => ({
      ...prev,
      projectStatus: performClose(prev.projectStatus),
    }));
  }, []);

  const recordMeaningfulUpdate = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastMeaningfulUpdate: Date.now(),
    }));
  }, []);

  // NOTE: updateRegionalContext and confirmRegionalContext have been REMOVED
  // per Phase 12 Addendum. Regional settings are immutable after project creation.

  const formatCurrency = useCallback((amount: number | null) => {
    return formatCurrencyUtil(amount, state.regionalContext);
  }, [state.regionalContext]);

  const formatNumber = useCallback((value: number, decimals?: number) => {
    return formatNumberUtil(value, state.regionalContext, decimals);
  }, [state.regionalContext]);

  const formatDate = useCallback((date: Date | number | string) => {
    return formatDateUtil(date, state.regionalContext);
  }, [state.regionalContext]);

  const formatDateTime = useCallback((date: Date | number | string) => {
    return formatDateTimeUtil(date, state.regionalContext);
  }, [state.regionalContext]);

  const formatMeasurement = useCallback((value: number, unit: 'length' | 'area' | 'volume') => {
    return formatMeasurementUtil(value, unit, state.regionalContext);
  }, [state.regionalContext]);

  const [highlightDocumentId, setHighlightDocumentId] = useState<string | null>(null);

  const navigateToDocument = useCallback((documentId: string) => {
    setHighlightDocumentId(documentId);
    setState(prev => ({ ...prev, activeFrame: 'documents' as CanonicalFrame }));
  }, []);

  const clearHighlightDocument = useCallback(() => {
    setHighlightDocumentId(null);
  }, []);

  const value: ProjectContextValue = {
    ...state,
    region: state.regionalContext.country,
    currency: state.regionalContext.currency,
    isReadOnly,
    setActiveFrame,
    closeProject,
    recordMeaningfulUpdate,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateTime,
    formatMeasurement,
    highlightDocumentId,
    navigateToDocument,
    clearHighlightDocument,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export function useProjectSafe(): ProjectContextValue | null {
  return useContext(ProjectContext);
}

export function useActiveFrame(): CanonicalFrame {
  const { activeFrame } = useProject();
  return activeFrame;
}

export function useIsReadOnly(): boolean {
  const { isReadOnly } = useProject();
  return isReadOnly;
}

export function useRegionalContext(): RegionalContext {
  const { regionalContext } = useProject();
  return regionalContext;
}

export function useFormatters() {
  const { formatCurrency, formatNumber, formatDate, formatDateTime, formatMeasurement, currency } = useProject();
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;
  return { formatCurrency, formatNumber, formatDate, formatDateTime, formatMeasurement, currency, currencySymbol };
}
