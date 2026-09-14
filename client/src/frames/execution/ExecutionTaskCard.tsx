import { User, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExecutionTask, TaskState } from './useExecutionData';

interface ExecutionTaskCardProps {
  task: ExecutionTask;
  isReadOnly: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

function fmtDate(dateStr: string, withYear: boolean): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', withYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

function buildDateRange(startStr: string | null, endStr: string | null): string {
  if (!startStr && !endStr) return '';
  if (startStr && endStr) {
    const crossYear = new Date(startStr).getFullYear() !== new Date(endStr).getFullYear();
    return `${fmtDate(startStr, crossYear)} \u2013 ${fmtDate(endStr, crossYear)}`;
  }
  return fmtDate(startStr || endStr!, false);
}

function responsibilityLabel(r: ExecutionTask['responsibility']): string {
  if (r.type === 'me') return 'Me';
  if (r.type === 'external') return r.label || 'External';
  return 'Unknown';
}

export function ExecutionTaskCard({ task, isReadOnly, onClick, onDragStart }: ExecutionTaskCardProps) {
  const isDone = task.state === 'done';
  const respLabel = responsibilityLabel(task.responsibility);
  const isExternal = task.responsibility.type === 'external';
  const ResponsibilityIcon = isExternal ? Users : User;
  const dateRange = buildDateRange(task.startDate, task.endDate);

  return (
    <Card
      className={cn(
        'p-3 cursor-pointer hover-elevate active-elevate-2',
        isDone && 'opacity-70',
        task.overdue ? 'bg-status-declined-subtle'
          : task.state === 'done' ? 'bg-status-approved-subtle'
          : task.state === 'in_progress' ? 'bg-status-pending-subtle'
          : ''
      )}
      draggable={!isReadOnly}
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      data-testid={`task-card-${task.id}`}
      data-state={task.state}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {isDone && (
            <CheckCircle2 className="h-3.5 w-3.5 text-status-approved shrink-0" />
          )}
          <p className="text-sm font-medium leading-tight line-clamp-2" title={task.title} data-testid={`text-task-title-${task.id}`}>
            {task.title}
          </p>
        </div>

        {task.scopeNodeName && (
          <div>
            <Badge variant="secondary" className="text-[11px] max-w-full truncate" title={task.scopeNodeName} data-testid={`text-task-scope-${task.id}`}>
              {task.scopeNodeName}
            </Badge>
          </div>
        )}

        {respLabel && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate" title={respLabel}>
            <ResponsibilityIcon className="h-3 w-3 shrink-0" />
            <span className="truncate" data-testid={`badge-responsibility-${task.id}`}>{respLabel}</span>
          </div>
        )}

        {dateRange && (
          <p className="text-xs text-muted-foreground truncate" title={dateRange} data-testid={`text-task-dates-${task.id}`}>
            {dateRange}
          </p>
        )}

        {task.overdue && (
          <Badge variant="destructive" className="text-xs" data-testid={`badge-overdue-${task.id}`}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        )}
      </div>
    </Card>
  );
}
