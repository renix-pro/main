import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  queryKeys,
  executionApi,
  ExecutionResponse,
  ExecutionTask as ApiExecutionTask,
  TaskAggregatesResponse,
  ScopeNodeData,
  ScopeNodesResponse,
  ExecutionLog,
} from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useMutationWithProposal, createProposalConfig } from '@/shell/proposals';
import { useToast } from '@/hooks/use-toast';

export type TaskState = 'to_do' | 'in_progress' | 'done';

export interface TaskResponsibility {
  type: 'me' | 'external' | 'unknown';
  label?: string;
}

export interface ExecutionTask {
  id: string;
  title: string;
  description: string | null;
  scopeNodeId: string | null;
  scopeNodeName: string | null;
  state: TaskState;
  responsibility: TaskResponsibility;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  notes: string | null;
  linkedDocuments: string[];
  linkedInvoices: string[];
  overdue: boolean;
  notStarted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAggregates {
  counts: { to_do: number; in_progress: number; done: number };
  overdueCount: number;
  overdueTaskIds: string[];
  notStartedCount: number;
  notStartedTaskIds: string[];
}

export type { ExecutionLog, ScopeNodeData };

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapApiTask(t: ApiExecutionTask): ExecutionTask {
  return {
    id: t.id,
    title: t.label,
    description: t.description,
    scopeNodeId: t.scopeItemId,
    scopeNodeName: t.scopeItemName,
    state: (t.status as TaskState) || 'to_do',
    responsibility: t.responsibility ?? { type: 'unknown' },
    startDate: toDateOnly(t.plannedStart),
    endDate: toDateOnly(t.plannedEnd),
    completedAt: t.completedAt,
    notes: t.notes,
    linkedDocuments: t.linkedDocuments ?? [],
    linkedInvoices: t.linkedInvoices ?? [],
    overdue: t.overdue ?? false,
    notStarted: t.notStarted ?? false,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function mapAggregates(r: TaskAggregatesResponse): TaskAggregates {
  return {
    counts: r.counts,
    overdueCount: r.overdue.count,
    overdueTaskIds: r.overdue.taskIds,
    notStartedCount: r.notStarted.count,
    notStartedTaskIds: r.notStarted.taskIds,
  };
}

const emptyAggregates: TaskAggregates = {
  counts: { to_do: 0, in_progress: 0, done: 0 },
  overdueCount: 0,
  overdueTaskIds: [],
  notStartedCount: 0,
  notStartedTaskIds: [],
};

export function useExecutionData(projectId: string, isReadOnly: boolean) {
  const { toast } = useToast();
  const executionQueryKey = queryKeys.execution(projectId);
  const aggregatesQueryKey = [...queryKeys.execution(projectId), 'aggregates'] as const;
  const scopeNodesQueryKey = queryKeys.scopeNodes(projectId);

  const { data: executionResponse, isLoading: isLoadingExecution } = useQuery<ExecutionResponse>({
    queryKey: executionQueryKey,
  });

  const { data: aggregatesResponse, isLoading: isLoadingAggregates } = useQuery<TaskAggregatesResponse>({
    queryKey: aggregatesQueryKey,
    queryFn: () => executionApi.getAggregates(projectId),
  });

  const { data: scopeNodesResponse } = useQuery<ScopeNodesResponse>({
    queryKey: scopeNodesQueryKey,
  });

  const tasks = useMemo<ExecutionTask[]>(() => {
    if (!executionResponse?.tasks) return [];
    return executionResponse.tasks.map(mapApiTask);
  }, [executionResponse]);

  const log = useMemo<ExecutionLog[]>(() => {
    return executionResponse?.log ?? [];
  }, [executionResponse]);

  const aggregates = useMemo<TaskAggregates>(() => {
    if (!aggregatesResponse) return emptyAggregates;
    return mapAggregates(aggregatesResponse);
  }, [aggregatesResponse]);

  const scopeNodes = useMemo<ScopeNodeData[]>(() => {
    return scopeNodesResponse?.nodes ?? [];
  }, [scopeNodesResponse]);

  const isLoading = isLoadingExecution || isLoadingAggregates;
  const isEmpty = tasks.length === 0;

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: executionQueryKey });
    queryClient.invalidateQueries({ queryKey: aggregatesQueryKey });
  }, [executionQueryKey, aggregatesQueryKey]);

  const guardReadOnly = useCallback(<T,>(fn: () => T): T | undefined => {
    if (isReadOnly) {
      console.warn('[Execution] Mutation blocked: project is read-only');
      toast({ title: 'Read-only project', description: 'This project is currently read-only. Changes won\'t be saved.' });
      return undefined;
    }
    return fn();
  }, [isReadOnly, toast]);

  const createTaskMutation = useMutationWithProposal({
    mutationFn: (taskData: Partial<ApiExecutionTask>) =>
      executionApi.createTask(projectId, taskData),
    onSuccess: () => invalidateAll(),
    proposalConfig: createProposalConfig<Partial<ApiExecutionTask>>({
      category: 'execution',
      action: 'create',
      entityType: 'task',
      getTitle: (vars) => `Create Task: ${vars.label || 'New Task'}`,
      getDescription: (vars) => {
        const parts = [`Create new execution task "${vars.label || 'New Task'}"`];
        if (vars.scopeItemName) parts.push(`linked to scope "${vars.scopeItemName}"`);
        return parts.join(' ');
      },
    }),
  });

  const updateTaskMutation = useMutationWithProposal({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<ApiExecutionTask> }) =>
      executionApi.updateTask(projectId, taskId, data),
    onSuccess: () => invalidateAll(),
    proposalConfig: createProposalConfig<{ taskId: string; data: Partial<ApiExecutionTask> }>({
      category: 'execution',
      action: 'update',
      entityType: 'task',
      getEntityId: (vars) => vars.taskId,
      getTitle: (vars) => {
        if (vars.data.status) return `Update Task Status`;
        return `Update Task: ${vars.data.label || 'Task'}`;
      },
      getDescription: (vars) => {
        if (vars.data.status) return `Change task status to "${vars.data.status}"`;
        return `Update task "${vars.data.label || 'Task'}"`;
      },
    }),
  });

  const deleteTaskMutation = useMutationWithProposal({
    mutationFn: (taskId: string) =>
      executionApi.deleteTask(projectId, taskId),
    onSuccess: () => invalidateAll(),
    proposalConfig: createProposalConfig<string>({
      category: 'execution',
      action: 'delete',
      entityType: 'task',
      getEntityId: (vars) => vars,
      getTitle: () => 'Delete Task',
      getDescription: () => 'Remove this execution task',
    }),
  });

  const createTask = useCallback((input: {
    title: string;
    scopeNodeId?: string | null;
    scopeNodeName?: string | null;
    state?: TaskState;
    startDate?: string | null;
    endDate?: string | null;
    responsibility?: TaskResponsibility;
    notes?: string | null;
  }) => {
    guardReadOnly(() => {
      createTaskMutation.mutateWithProposal({
        label: input.title,
        scopeItemId: input.scopeNodeId ?? null,
        scopeItemName: input.scopeNodeName ?? null,
        status: input.state ?? 'to_do',
        plannedStart: input.startDate ?? null,
        plannedEnd: input.endDate ?? null,
        responsibility: input.responsibility ?? { type: 'me' },
        notes: input.notes ?? null,
      });
    });
  }, [guardReadOnly, createTaskMutation]);

  const updateTask = useCallback((taskId: string, input: {
    title?: string;
    scopeNodeId?: string | null;
    scopeNodeName?: string | null;
    state?: TaskState;
    startDate?: string | null;
    endDate?: string | null;
    responsibility?: TaskResponsibility;
    notes?: string | null;
  }) => {
    guardReadOnly(() => {
      const data: Partial<ApiExecutionTask> = {};
      if (input.title !== undefined) data.label = input.title;
      if (input.scopeNodeId !== undefined) data.scopeItemId = input.scopeNodeId;
      if (input.scopeNodeName !== undefined) data.scopeItemName = input.scopeNodeName;
      if (input.state !== undefined) data.status = input.state;
      if (input.startDate !== undefined) data.plannedStart = input.startDate;
      if (input.endDate !== undefined) data.plannedEnd = input.endDate;
      if (input.responsibility !== undefined) data.responsibility = input.responsibility;
      if (input.notes !== undefined) data.notes = input.notes;
      updateTaskMutation.mutateWithProposal({ taskId, data });
    });
  }, [guardReadOnly, updateTaskMutation]);

  const deleteTask = useCallback((taskId: string) => {
    guardReadOnly(() => {
      deleteTaskMutation.mutateWithProposal(taskId);
    });
  }, [guardReadOnly, deleteTaskMutation]);

  const changeState = useCallback((taskId: string, newState: TaskState) => {
    guardReadOnly(() => {
      updateTaskMutation.mutateWithProposal({
        taskId,
        data: { status: newState },
      });
    });
  }, [guardReadOnly, updateTaskMutation]);

  return {
    tasks,
    log,
    aggregates,
    scopeNodes,
    isLoading,
    isEmpty,
    createTask,
    updateTask,
    deleteTask,
    changeState,
  };
}
