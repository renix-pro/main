import { useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { queryKeys, projectsApi, type Project } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type ProjectType = 'renovation' | 'new-build' | 'extension' | 'unsure';
export type UserRole = 'owner' | 'contributor' | 'viewer';

export interface ProjectMember {
  id: string;
  name: string;
  role: UserRole;
}

export const PROJECT_COLORS = [
  { id: 'slate', label: 'Slate', value: 'hsl(215, 20%, 65%)' },
  { id: 'blue', label: 'Blue', value: 'hsl(221, 83%, 53%)' },
  { id: 'teal', label: 'Teal', value: 'hsl(187, 85%, 43%)' },
  { id: 'green', label: 'Green', value: 'hsl(142, 71%, 45%)' },
  { id: 'amber', label: 'Amber', value: 'hsl(38, 92%, 50%)' },
  { id: 'rose', label: 'Rose', value: 'hsl(350, 89%, 60%)' },
  { id: 'violet', label: 'Violet', value: 'hsl(263, 70%, 58%)' },
  { id: 'orange', label: 'Orange', value: 'hsl(25, 95%, 53%)' },
] as const;

export type ProjectColor = typeof PROJECT_COLORS[number]['id'];

export const SUPPORTED_REGIONS = [
  { id: 'AU', label: 'Australia', currency: 'AUD' },
  { id: 'US', label: 'United States', currency: 'USD' },
  { id: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { id: 'CA', label: 'Canada', currency: 'CAD' },
  { id: 'NZ', label: 'New Zealand', currency: 'NZD' },
  { id: 'DE', label: 'Germany', currency: 'EUR' },
  { id: 'FR', label: 'France', currency: 'EUR' },
  { id: 'JP', label: 'Japan', currency: 'JPY' },
] as const;

export type RegionId = typeof SUPPORTED_REGIONS[number]['id'];
export type CurrencyCode = typeof SUPPORTED_REGIONS[number]['currency'];

export interface ProjectRegionalContext {
  region: RegionId;
  currency: CurrencyCode;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  type?: ProjectType;
  description: string;
  status: 'open' | 'closed' | 'archived';
  members: ProjectMember[];
  createdAt: number;
  updatedAt?: number;
  color: ProjectColor;
  regionalContext: ProjectRegionalContext;
  hasEntered?: boolean;
  heroImagePath?: string | null;
}

function getRandomColor(): ProjectColor {
  const colors = PROJECT_COLORS.map(c => c.id);
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getColorValue(colorId: ProjectColor): string {
  const color = PROJECT_COLORS.find(c => c.id === colorId);
  return color?.value ?? PROJECT_COLORS[0].value;
}

export const PROJECTS_STORAGE_KEY = 'renix-global-projects-v1';

export function getProjectById(projectId: string): ProjectMetadata | null {
  const data = queryClient.getQueryData<{ projects: Project[] }>(queryKeys.projects);
  if (data?.projects) {
    const project = data.projects.find(p => p.id === projectId);
    if (project) {
      return toProjectMetadata(project);
    }
  }
  return null;
}

function toProjectMetadata(p: Project): ProjectMetadata {
  return {
    id: p.id,
    name: p.name,
    type: (p.type as ProjectType) || undefined,
    description: p.description,
    status: p.status as 'open' | 'closed' | 'archived',
    members: p.members as ProjectMember[],
    createdAt: new Date(p.createdAt).getTime(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
    color: p.color as ProjectColor,
    regionalContext: p.regionalContext as ProjectRegionalContext,
    heroImagePath: p.heroImagePath ?? null,
  };
}

export function useProjectsData() {
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
    retry: false,
  });

  const projects: ProjectMetadata[] = (() => {
    if (isLoading || error) return [];
    if (!data?.projects) return [];
    return data.projects.map(toProjectMetadata);
  })();

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof projectsApi.update>[1] }) => 
      projectsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete project',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const createProject = useCallback((
    name: string, 
    type: ProjectType | undefined, 
    description: string,
    regionalContext: ProjectRegionalContext,
    onCreated?: (projectId: string) => void
  ) => {
    const color = getRandomColor();
    createMutation.mutate({
      name,
      type: type || undefined,
      description,
      color,
      regionalContext: {
        region: regionalContext.region,
        currency: regionalContext.currency,
      },
      members: [{ id: 'u1', name: 'Current User', role: 'owner' }],
    }, {
      onSuccess: (data: Project) => {
        if (onCreated && data?.id) {
          onCreated(data.id);
        }
      },
    });
  }, [createMutation]);

  const updateProjectMetadata = useCallback((
    id: string, 
    updates: Partial<Omit<ProjectMetadata, 'id' | 'createdAt' | 'regionalContext'>>
  ) => {
    updateMutation.mutate({ id, updates });
  }, [updateMutation]);

  const archiveProject = useCallback((id: string) => {
    updateMutation.mutate({ id, updates: { status: 'archived' } });
  }, [updateMutation]);

  const restoreProject = useCallback((id: string) => {
    updateMutation.mutate({ id, updates: { status: 'open' } });
  }, [updateMutation]);

  const deleteProject = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const getProject = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const markProjectEntered = useCallback((_id: string) => {
    // No-op: tracking handled by server now
  }, []);

  const setRegionalContext = useCallback((_id: string, _context: ProjectRegionalContext) => {
    // No-op: regional context is set at creation and immutable
  }, []);

  return {
    projects,
    isLoading,
    createProject,
    updateProjectMetadata,
    archiveProject,
    restoreProject,
    deleteProject,
    getProject,
    markProjectEntered,
    setRegionalContext
  };
}
