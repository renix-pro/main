import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProject } from '../../context/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useExecutionData, type ExecutionTask, type TaskState } from './useExecutionData';
import { ExecutionTaskCard } from './ExecutionTaskCard';
import { TaskDialog, DeleteConfirmDialog } from './ExecutionDialogs';
import { GanttTimeline } from './GanttTimeline';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { ExecutionSkeleton } from '@/components/FrameSkeleton';

type KpiFilter = 'to_do' | 'in_progress' | 'done' | 'overdue' | null;

type DialogState =
  | { type: 'none' }
  | { type: 'add-task'; initialState: TaskState }
  | { type: 'edit-task'; task: ExecutionTask }
  | { type: 'delete-task'; task: ExecutionTask };

const KANBAN_COLUMNS: { state: TaskState; label: string; colorClass: string }[] = [
  { state: 'to_do', label: 'Planned', colorClass: 'text-secondary' },
  { state: 'in_progress', label: 'In Progress', colorClass: 'text-accent-copper' },
  { state: 'done', label: 'Done', colorClass: 'text-status-approved' },
];

export function ExecutionFrame() {
  const { projectId, isReadOnly } = useProject();
  const exec = useExecutionData(projectId, isReadOnly);
  const { toast } = useToast();

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [drawerTask, setDrawerTask] = useState<ExecutionTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskState | null>(null);

  const filteredTasks = useMemo(() => {
    if (!kpiFilter) return exec.tasks;
    if (kpiFilter === 'overdue') return exec.tasks.filter(t => t.overdue);
    return exec.tasks.filter(t => t.state === kpiFilter);
  }, [exec.tasks, kpiFilter]);

  const tasksByState = useMemo(() => {
    const result: Record<TaskState, ExecutionTask[]> = { to_do: [], in_progress: [], done: [] };
    for (const t of filteredTasks) {
      if (result[t.state]) result[t.state].push(t);
    }
    return result;
  }, [filteredTasks]);

  const toggleKpiFilter = useCallback((filter: KpiFilter) => {
    setKpiFilter(prev => prev === filter ? null : filter);
  }, []);

  const openDrawer = useCallback((task: ExecutionTask) => {
    setDrawerTask(task);
    setDrawerOpen(true);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, state: TaskState) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(state);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, newState: TaskState) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = exec.tasks.find(t => t.id === taskId);
    if (task && task.state !== newState) {
      exec.changeState(taskId, newState);
      toast({
        title: 'Task moved',
        description: `"${task.title}" moved to ${KANBAN_COLUMNS.find(c => c.state === newState)?.label}`,
      });
    }
  }, [exec, toast]);

  const closeDialog = () => setDialog({ type: 'none' });

  const handleSaveTask = useCallback((input: Parameters<typeof exec.createTask>[0]) => {
    if (dialog.type === 'add-task') {
      exec.createTask({ ...input, state: dialog.initialState });
    } else if (dialog.type === 'edit-task') {
      exec.updateTask(dialog.task.id, input);
    }
  }, [dialog, exec]);

  const handleConfirmDelete = useCallback(() => {
    if (dialog.type === 'delete-task') {
      exec.deleteTask(dialog.task.id);
    }
  }, [dialog, exec]);

  if (exec.isLoading) return <ExecutionSkeleton />;

  const { aggregates } = exec;

  return (
    <motion.div
      className="h-full space-y-4"
      data-testid="frame-execution"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground" data-testid="text-frame-description">
          {isReadOnly ? 'Current happenings (read-only)' : 'Current happenings'}
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kpi-tiles">
          <Card
            className={cn(
              'p-4 cursor-pointer hover-elevate active-elevate-2',
              kpiFilter === 'to_do' ? 'ring-1 ring-foreground/20' : 'bg-status-draft-subtle'
            )}
            onClick={() => toggleKpiFilter('to_do')}
            data-testid="kpi-tile-planned"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Planned</p>
            <p className="text-2xl font-semibold tabular-nums">{aggregates.counts.to_do}</p>
          </Card>
          <Card
            className={cn(
              'p-4 cursor-pointer hover-elevate active-elevate-2',
              kpiFilter === 'in_progress' ? 'ring-1 ring-foreground/20' : 'bg-status-pending-subtle'
            )}
            onClick={() => toggleKpiFilter('in_progress')}
            data-testid="kpi-tile-in-progress"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">In Progress</p>
            <p className="text-2xl font-semibold tabular-nums">{aggregates.counts.in_progress}</p>
          </Card>
          <Card
            className={cn(
              'p-4 cursor-pointer hover-elevate active-elevate-2',
              kpiFilter === 'done' ? 'ring-1 ring-foreground/20' : 'bg-status-approved-subtle'
            )}
            onClick={() => toggleKpiFilter('done')}
            data-testid="kpi-tile-done"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Done</p>
            <p className="text-2xl font-semibold tabular-nums">{aggregates.counts.done}</p>
          </Card>
          <Card
            className={cn(
              'p-4 cursor-pointer hover-elevate active-elevate-2',
              kpiFilter === 'overdue' ? 'ring-1 ring-foreground/20' : 'bg-status-declined-subtle'
            )}
            onClick={() => toggleKpiFilter('overdue')}
            data-testid="kpi-tile-overdue"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Overdue</p>
            <p className={cn('text-2xl font-semibold tabular-nums', aggregates.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground')}>{aggregates.overdueCount}</p>
          </Card>
        </div>

        <GanttTimeline tasks={exec.tasks} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="kanban-board">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = tasksByState[col.state];
            return (
              <div
                key={col.state}
                className={cn(
                  'rounded-md border border-border p-3 pb-4 min-h-[120px] transition-colors',
                  dragOverColumn === col.state && 'border-accent-copper border-2 bg-accent-copper/5'
                )}
                onDragOver={(e) => handleDragOver(e, col.state)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.state)}
                data-testid={`kanban-column-${col.state}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className={cn('text-sm font-medium', col.colorClass)} data-testid={`text-column-header-${col.state}`}>
                      {col.label}
                    </h3>
                    <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  {!isReadOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDialog({ type: 'add-task', initialState: col.state })}
                          data-testid={`button-add-task-${col.state}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add task</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-6" data-testid={`text-empty-column-${col.state}`}>
                      <p className="text-xs text-muted-foreground">
                        {col.state === 'to_do' ? 'No planned tasks yet' : col.state === 'in_progress' ? 'Nothing in progress' : 'Nothing completed yet'}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {col.state === 'to_do' ? 'Break your scope into actionable tasks to track progress.' : col.state === 'in_progress' ? 'Drag tasks here when work begins.' : 'Completed tasks will appear here.'}
                      </p>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <ExecutionTaskCard
                        key={task.id}
                        task={task}
                        isReadOnly={isReadOnly}
                        onClick={() => openDrawer(task)}
                        onDragStart={handleDragStart}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDialog
        open={dialog.type === 'add-task' || dialog.type === 'edit-task'}
        onOpenChange={(open) => !open && closeDialog()}
        task={dialog.type === 'edit-task' ? dialog.task : undefined}
        scopeNodes={exec.scopeNodes}
        onSave={handleSaveTask}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-task'}
        onOpenChange={(open) => !open && closeDialog()}
        taskTitle={dialog.type === 'delete-task' ? dialog.task.title : ''}
        onConfirm={handleConfirmDelete}
      />

      <TaskDetailsDrawer
        task={drawerTask}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerTask(null);
        }}
        isReadOnly={isReadOnly}
        log={exec.log}
        onChangeState={exec.changeState}
        onUpdateTask={exec.updateTask}
        onDeleteTask={exec.deleteTask}
      />
    </motion.div>
  );
}

export default ExecutionFrame;
