import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface VisionInspiration {
  id: string;
  imageUrl: string;
  caption: string | null;
  tags: string[];
  createdAt: number;
  preview?: LinkPreview;
  isLoadingPreview?: boolean;
  archived?: boolean;
}

export interface VisionMoodboard {
  id: string;
  title: string;
  desireStatement: string | null;
  inspirations: VisionInspiration[];
  tags: string[];
  themes: string[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VisionData {
  boards: VisionMoodboard[];
}

interface VisionBoardResponse {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  desireStatement: string | null;
  tags: string[];
  themes: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VisionInspirationResponse {
  id: string;
  boardId: string;
  projectId: string;
  userId: string;
  imageUrl: string;
  caption: string | null;
  tags: string[];
  preview: LinkPreview | null;
  archived: boolean;
  createdAt: string;
}

interface VisionResponse {
  boards: VisionBoardResponse[];
  inspirations: VisionInspirationResponse[];
}

function toVisionData(response: VisionResponse): VisionData {
  return {
    boards: (response.boards || []).map(board => ({
      ...board,
      inspirations: (response.inspirations || [])
        .filter(i => i.boardId === board.id)
        .map(i => ({
          ...i,
          createdAt: new Date(i.createdAt).getTime(),
          preview: i.preview || undefined,
        })),
      createdAt: new Date(board.createdAt).getTime(),
      updatedAt: new Date(board.updatedAt).getTime(),
    })),
  };
}

const createDefaultVision = (): VisionData => ({
  boards: [],
});

export function useVisionData(projectId: string, isReadOnly: boolean) {
  const { toast } = useToast();
  const { data: apiData, isLoading, error } = useQuery<VisionResponse>({
    queryKey: queryKeys.vision(projectId),
    enabled: !!projectId,
  });

  const data: VisionData = useMemo(() => {
    if (!apiData) return createDefaultVision();
    return toVisionData(apiData);
  }, [apiData]);

  const [activeBoardId, setActiveBoardId] = useState<string>('');

  useEffect(() => {
    if (data.boards.length > 0 && !activeBoardId) {
      const nonArchivedBoards = data.boards.filter(b => !b.archived);
      setActiveBoardId(nonArchivedBoards[0]?.id || data.boards[0]?.id || '');
    }
  }, [data.boards, activeBoardId]);

  useEffect(() => {
    const board = data.boards.find(b => b.id === activeBoardId);
    if (data.boards.length > 0 && (!board || board.archived)) {
      const nonArchivedBoards = data.boards.filter(b => !b.archived);
      if (nonArchivedBoards.length > 0) {
        setActiveBoardId(nonArchivedBoards[0].id);
      }
    }
  }, [data.boards, activeBoardId]);

  const activeBoard = data.boards.find(b => b.id === activeBoardId) || data.boards[0];
  const nonArchivedBoards = data.boards.filter(b => !b.archived);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | null => {
    if (isReadOnly) {
      console.warn('[Vision] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return null;
    }
    return fn();
  }, [isReadOnly, toast]);

  const [isGeneratingThemes, setIsGeneratingThemes] = useState(false);
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeRequestRef = useRef(0);

  const invalidateVision = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vision(projectId) });
  }, [projectId]);

  const regenerateThemes = useCallback((boardId: string) => {
    if (!boardId || isReadOnly) return;
    if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
    setIsGeneratingThemes(true);
    themeTimerRef.current = setTimeout(async () => {
      const requestId = ++themeRequestRef.current;
      try {
        await apiRequest('POST', `/api/projects/${projectId}/vision/boards/${boardId}/generate-themes`);
        if (requestId === themeRequestRef.current) {
          invalidateVision();
        }
      } catch (error) {
        console.error('[Vision] Failed to regenerate themes:', error);
      } finally {
        if (requestId === themeRequestRef.current) {
          setIsGeneratingThemes(false);
        }
      }
    }, 1500);
  }, [projectId, isReadOnly, invalidateVision]);

  const createBoardMutation = useMutationWithProposal({
    mutationFn: async (title?: string): Promise<VisionBoardResponse> => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/vision/boards`, {
        title: title || `Moodboard ${nonArchivedBoards.length + 1}`,
      });
      return res.json();
    },
    onSuccess: (newBoard: VisionBoardResponse) => {
      invalidateVision();
      setActiveBoardId(newBoard.id);
    },
    proposalConfig: createProposalConfig<string | undefined>({
      category: 'vision',
      entityType: 'board',
      action: 'create',
      getTitle: (title) => `Create Board: ${title || 'New Moodboard'}`,
      getDescription: (title) => `Add new vision board "${title || 'New Moodboard'}"`,
    }),
  });

  const renameBoardMutation = useMutationWithProposal({
    mutationFn: async ({ boardId, title }: { boardId: string; title: string }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/boards/${boardId}`, { title });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<{ boardId: string; title: string }>({
      category: 'vision',
      entityType: 'board',
      action: 'update',
      getEntityId: (vars) => vars.boardId,
      getTitle: (vars) => `Rename Board: ${vars.title}`,
      getDescription: (vars) => `Rename vision board to "${vars.title}"`,
    }),
  });

  const duplicateBoardMutation = useMutationWithProposal({
    mutationFn: async (boardId: string): Promise<VisionBoardResponse> => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/vision/boards/${boardId}/duplicate`, {});
      return res.json();
    },
    onSuccess: (newBoard: VisionBoardResponse) => {
      invalidateVision();
      setActiveBoardId(newBoard.id);
    },
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'board',
      action: 'create',
      getEntityId: (boardId) => boardId,
      getTitle: () => 'Duplicate Board',
      getDescription: () => 'Create a duplicate of this vision board',
    }),
  });

  const archiveBoardMutation = useMutationWithProposal({
    mutationFn: async (boardId: string) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/boards/${boardId}`, { archived: true });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'board',
      action: 'update',
      getEntityId: (boardId) => boardId,
      getTitle: () => 'Archive Board',
      getDescription: () => 'Archive this vision board',
    }),
  });

  const deleteBoardMutation = useMutationWithProposal({
    mutationFn: async (boardId: string) => {
      console.log('[Vision] Deleting board:', boardId);
      await apiRequest('DELETE', `/api/projects/${projectId}/vision/boards/${boardId}`);
      console.log('[Vision] Board deleted successfully:', boardId);
    },
    onSuccess: () => {
      console.log('[Vision] Delete mutation succeeded, invalidating queries');
      invalidateVision();
    },
    onError: (error) => {
      console.error('[Vision] Delete mutation failed:', error);
    },
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'board',
      action: 'delete',
      getEntityId: (boardId) => boardId,
      getTitle: () => 'Delete Board',
      getDescription: () => 'Permanently delete this vision board and all its inspirations',
    }),
  });

  const unarchiveBoardMutation = useMutationWithProposal({
    mutationFn: async (boardId: string) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/boards/${boardId}`, { archived: false });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'board',
      action: 'update',
      getEntityId: (boardId) => boardId,
      getTitle: () => 'Unarchive Board',
      getDescription: () => 'Restore this vision board from archive',
    }),
  });

  const updateDesireStatementMutation = useMutationWithProposal({
    mutationFn: async (desireStatement: string | null) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/boards/${activeBoardId}`, { desireStatement });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<string | null>({
      category: 'vision',
      entityType: 'board',
      action: 'update',
      getTitle: () => 'Update Desire Statement',
      getDescription: (statement) => 
        statement 
          ? `Set desire statement to: "${statement.substring(0, 50)}${statement.length > 50 ? '...' : ''}"`
          : 'Clear desire statement',
    }),
  });

  const addInspirationMutation = useMutationWithProposal({
    mutationFn: async (inspiration: Omit<VisionInspiration, 'id' | 'createdAt'>): Promise<VisionInspirationResponse> => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/vision/boards/${activeBoardId}/inspirations`, inspiration);
      return res.json();
    },
    onSuccess: () => { invalidateVision(); regenerateThemes(activeBoardId); },
    proposalConfig: createProposalConfig<Omit<VisionInspiration, 'id' | 'createdAt'>>({
      category: 'vision',
      entityType: 'inspiration',
      action: 'create',
      getTitle: () => 'Add Inspiration',
      getDescription: (inspiration) => 
        inspiration.caption 
          ? `Add inspiration: "${inspiration.caption.substring(0, 50)}${inspiration.caption.length > 50 ? '...' : ''}"`
          : 'Add new inspiration image',
    }),
  });

  const removeInspirationMutation = useMutationWithProposal({
    mutationFn: async (inspirationId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/vision/inspirations/${inspirationId}`);
    },
    onSuccess: () => { invalidateVision(); regenerateThemes(activeBoardId); },
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'inspiration',
      action: 'delete',
      getEntityId: (id) => id,
      getTitle: () => 'Remove Inspiration',
      getDescription: () => 'Remove this inspiration from the board',
    }),
  });

  const updateInspirationCaptionMutation = useMutationWithProposal({
    mutationFn: async ({ inspirationId, caption }: { inspirationId: string; caption: string | null }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/inspirations/${inspirationId}`, { caption });
      return res.json();
    },
    onSuccess: () => { invalidateVision(); regenerateThemes(activeBoardId); },
    proposalConfig: createProposalConfig<{ inspirationId: string; caption: string | null }>({
      category: 'vision',
      entityType: 'inspiration',
      action: 'update',
      getEntityId: (vars) => vars.inspirationId,
      getTitle: () => 'Update Inspiration Caption',
      getDescription: (vars) => 
        vars.caption 
          ? `Update caption to: "${vars.caption.substring(0, 50)}${vars.caption.length > 50 ? '...' : ''}"`
          : 'Clear inspiration caption',
    }),
  });

  const addInspirationTagMutation = useMutationWithProposal({
    mutationFn: async ({ inspirationId, tag }: { inspirationId: string; tag: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/vision/inspirations/${inspirationId}/tags`, { tag: tag.trim().toLowerCase() });
      return res.json();
    },
    onSuccess: () => { invalidateVision(); regenerateThemes(activeBoardId); },
    proposalConfig: createProposalConfig<{ inspirationId: string; tag: string }>({
      category: 'vision',
      entityType: 'tag',
      action: 'create',
      getEntityId: (vars) => vars.inspirationId,
      getTitle: (vars) => `Add Tag: ${vars.tag}`,
      getDescription: (vars) => `Add tag "${vars.tag}" to inspiration`,
    }),
  });

  const removeInspirationTagMutation = useMutationWithProposal({
    mutationFn: async ({ inspirationId, tag }: { inspirationId: string; tag: string }) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/vision/inspirations/${inspirationId}/tags/${encodeURIComponent(tag)}`);
    },
    onSuccess: () => { invalidateVision(); regenerateThemes(activeBoardId); },
    proposalConfig: createProposalConfig<{ inspirationId: string; tag: string }>({
      category: 'vision',
      entityType: 'tag',
      action: 'delete',
      getEntityId: (vars) => vars.inspirationId,
      getTitle: (vars) => `Remove Tag: ${vars.tag}`,
      getDescription: (vars) => `Remove tag "${vars.tag}" from inspiration`,
    }),
  });

  const moveInspirationToBoardMutation = useMutationWithProposal({
    mutationFn: async ({ inspirationId, targetBoardId }: { inspirationId: string; targetBoardId: string }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/inspirations/${inspirationId}`, { boardId: targetBoardId });
      return res.json();
    },
    onSuccess: (_data: unknown, vars: { inspirationId: string; targetBoardId: string }) => { invalidateVision(); regenerateThemes(activeBoardId); regenerateThemes(vars.targetBoardId); },
    proposalConfig: createProposalConfig<{ inspirationId: string; targetBoardId: string }>({
      category: 'vision',
      entityType: 'inspiration',
      action: 'update',
      getEntityId: (vars) => vars.inspirationId,
      getTitle: () => 'Move Inspiration',
      getDescription: () => 'Move inspiration to another board',
    }),
  });

  const updateInspirationPreviewMutation = useMutationWithProposal({
    mutationFn: async ({ inspirationId, preview }: { inspirationId: string; preview: LinkPreview | null }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/vision/inspirations/${inspirationId}`, { preview });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<{ inspirationId: string; preview: LinkPreview | null }>({
      category: 'vision',
      entityType: 'inspiration',
      action: 'update',
      getEntityId: (vars) => vars.inspirationId,
      getTitle: () => 'Update Link Preview',
      getDescription: (vars) => 
        vars.preview 
          ? `Update link preview for "${vars.preview.title || vars.preview.url}"`
          : 'Clear link preview',
    }),
  });

  const addBoardTagMutation = useMutationWithProposal({
    mutationFn: async (tag: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/vision/boards/${activeBoardId}/tags`, { tag: tag.trim().toLowerCase() });
      return res.json();
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'tag',
      action: 'create',
      getTitle: (tag) => `Add Board Tag: ${tag}`,
      getDescription: (tag) => `Add tag "${tag}" to the board`,
    }),
  });

  const removeBoardTagMutation = useMutationWithProposal({
    mutationFn: async (tag: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/vision/boards/${activeBoardId}/tags/${encodeURIComponent(tag)}`);
    },
    onSuccess: invalidateVision,
    proposalConfig: createProposalConfig<string>({
      category: 'vision',
      entityType: 'tag',
      action: 'delete',
      getTitle: (tag) => `Remove Board Tag: ${tag}`,
      getDescription: (tag) => `Remove tag "${tag}" from the board`,
    }),
  });

  const createBoard = useCallback((title?: string): string | null => {
    return guardReadOnly(() => {
      createBoardMutation.mutateWithProposal(title);
      return null;
    });
  }, [guardReadOnly, createBoardMutation]);

  const renameBoard = useCallback((boardId: string, title: string) => {
    guardReadOnly(() => {
      renameBoardMutation.mutateWithProposal({ boardId, title });
    });
  }, [guardReadOnly, renameBoardMutation]);

  const duplicateBoard = useCallback((boardId: string): string | null => {
    return guardReadOnly(() => {
      duplicateBoardMutation.mutateWithProposal(boardId);
      return null;
    });
  }, [guardReadOnly, duplicateBoardMutation]);

  const archiveBoard = useCallback((boardId: string) => {
    guardReadOnly(() => {
      archiveBoardMutation.mutateWithProposal(boardId);
    });
  }, [guardReadOnly, archiveBoardMutation]);

  const deleteBoard = useCallback((boardId: string) => {
    guardReadOnly(() => {
      deleteBoardMutation.mutateWithProposal(boardId);
    });
  }, [guardReadOnly, deleteBoardMutation]);

  const unarchiveBoard = useCallback((boardId: string) => {
    guardReadOnly(() => {
      unarchiveBoardMutation.mutateWithProposal(boardId);
    });
  }, [guardReadOnly, unarchiveBoardMutation]);

  const updateDesireStatement = useCallback((desireStatement: string | null) => {
    guardReadOnly(() => {
      updateDesireStatementMutation.mutateWithProposal(desireStatement);
    });
  }, [guardReadOnly, updateDesireStatementMutation]);

  const addInspiration = useCallback(async (inspiration: Omit<VisionInspiration, 'id' | 'createdAt'>): Promise<string | null> => {
    if (isReadOnly) {
      console.warn('[Vision] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return null;
    }
    try {
      const result = await addInspirationMutation.mutateAsync(inspiration);
      return result.id;
    } catch (error) {
      console.error('[Vision] Failed to add inspiration:', error);
      return null;
    }
  }, [isReadOnly, addInspirationMutation]);

  const removeInspiration = useCallback((id: string) => {
    guardReadOnly(() => {
      removeInspirationMutation.mutateWithProposal(id);
    });
  }, [guardReadOnly, removeInspirationMutation]);

  const updateInspirationCaption = useCallback((id: string, caption: string | null) => {
    guardReadOnly(() => {
      updateInspirationCaptionMutation.mutateWithProposal({ inspirationId: id, caption });
    });
  }, [guardReadOnly, updateInspirationCaptionMutation]);

  const addInspirationTag = useCallback((id: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    guardReadOnly(() => {
      addInspirationTagMutation.mutateWithProposal({ inspirationId: id, tag: trimmed });
    });
  }, [guardReadOnly, addInspirationTagMutation]);

  const removeInspirationTag = useCallback((id: string, tag: string) => {
    guardReadOnly(() => {
      removeInspirationTagMutation.mutateWithProposal({ inspirationId: id, tag });
    });
  }, [guardReadOnly, removeInspirationTagMutation]);

  const updateInspirationPreview = useCallback((id: string, preview: LinkPreview | null, isLoadingPreview?: boolean) => {
    queryClient.setQueryData<VisionResponse>(queryKeys.vision(projectId), (old) => {
      if (!old) return old;
      return {
        ...old,
        inspirations: old.inspirations.map(i =>
          i.id === id
            ? { ...i, preview: preview ?? undefined, isLoadingPreview: isLoadingPreview ?? false } as VisionInspirationResponse & { preview?: LinkPreview; isLoadingPreview?: boolean }
            : i
        ),
      };
    });
    if (preview && !isLoadingPreview) {
      updateInspirationPreviewMutation.mutateWithProposal({ inspirationId: id, preview });
    }
  }, [projectId, updateInspirationPreviewMutation]);

  const moveInspirationToBoard = useCallback((inspirationId: string, targetBoardId: string) => {
    if (activeBoardId === targetBoardId) return;
    guardReadOnly(() => {
      moveInspirationToBoardMutation.mutateWithProposal({ inspirationId, targetBoardId });
    });
  }, [guardReadOnly, activeBoardId, moveInspirationToBoardMutation]);

  const addBoardTag = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    guardReadOnly(() => {
      addBoardTagMutation.mutateWithProposal(trimmed);
    });
  }, [guardReadOnly, addBoardTagMutation]);

  const removeBoardTag = useCallback((tag: string) => {
    guardReadOnly(() => {
      removeBoardTagMutation.mutateWithProposal(tag);
    });
  }, [guardReadOnly, removeBoardTagMutation]);

  return {
    data,
    activeBoard,
    activeBoardId,
    setActiveBoardId,
    nonArchivedBoards,
    isLoading,
    error,
    createBoard,
    renameBoard,
    duplicateBoard,
    archiveBoard,
    deleteBoard,
    unarchiveBoard,
    updateDesireStatement,
    addInspiration,
    removeInspiration,
    updateInspirationCaption,
    addInspirationTag,
    removeInspirationTag,
    updateInspirationPreview,
    moveInspirationToBoard,
    addBoardTag,
    removeBoardTag,
    isGeneratingThemes,
  };
}
