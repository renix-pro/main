import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Clock, Trash2, FileText, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutionTask, TaskState, TaskResponsibility, ExecutionLog } from './useExecutionData';
import { DeleteConfirmDialog } from './ExecutionDialogs';
import { useRegionalContext } from '../../context/ProjectContext';

interface TaskDetailsDrawerProps {
  task: ExecutionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly: boolean;
  log: ExecutionLog[];
  onChangeState: (taskId: string, state: TaskState) => void;
  onUpdateTask: (taskId: string, input: {
    startDate?: string | null;
    endDate?: string | null;
    responsibility?: TaskResponsibility;
    notes?: string | null;
  }) => void;
  onDeleteTask: (taskId: string) => void;
}

const STATE_OPTIONS: { value: TaskState; label: string }[] = [
  { value: 'to_do', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

function formatLogDate(ts: string, locale: string): string {
  return new Date(ts).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TaskDetailsDrawer({
  task,
  open,
  onOpenChange,
  isReadOnly,
  log,
  onChangeState,
  onUpdateTask,
  onDeleteTask,
}: TaskDetailsDrawerProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { locale } = useRegionalContext();

  const taskLog = useMemo(() => {
    if (!task) return [];
    return log.filter(l => l.taskId === task.id).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [log, task]);

  if (!task) return null;

  const overdueDays = task.overdue && task.endDate
    ? Math.ceil((Date.now() - new Date(task.endDate).getTime()) / 86400000)
    : 0;

  const handleFieldChange = (field: string, value: string | null) => {
    if (isReadOnly) return;
    if (field === 'startDate') {
      onUpdateTask(task.id, { startDate: value });
    } else if (field === 'endDate') {
      onUpdateTask(task.id, { endDate: value });
    } else if (field === 'notes') {
      onUpdateTask(task.id, { notes: value });
    }
  };

  const handleResponsibilityChange = (type: 'me' | 'external' | 'unknown', label?: string) => {
    if (isReadOnly) return;
    const responsibility: TaskResponsibility = { type };
    if (type === 'external' && label) responsibility.label = label;
    onUpdateTask(task.id, { responsibility });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="task-details-drawer">
          <SheetHeader>
            <SheetTitle data-testid="text-drawer-title">{task.title}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-1.5 flex-wrap">
                {STATE_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={task.state === opt.value ? 'default' : 'outline'}
                    className={cn(
                      task.state === opt.value && opt.value === 'done' && 'bg-status-approved',
                      task.state === opt.value && opt.value === 'in_progress' && 'bg-accent-copper',
                    )}
                    onClick={() => !isReadOnly && onChangeState(task.id, opt.value)}
                    disabled={isReadOnly}
                    data-testid={`button-state-${opt.value}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {(task.overdue || task.notStarted) && (
              <div className="space-y-2" data-testid="section-attention">
                {task.overdue && (
                  <div className="flex items-center gap-2 text-xs text-destructive" data-testid="text-overdue-info">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Overdue by {overdueDays} {overdueDays === 1 ? 'day' : 'days'}</span>
                  </div>
                )}
                {task.notStarted && (
                  <div className="flex items-center gap-2 text-xs text-[var(--signal-warning)]" data-testid="text-not-started-info">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Not started — start date was {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'unknown'}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="drawer-start-date">Start Date</Label>
                <Input
                  id="drawer-start-date"
                  type="date"
                  value={task.startDate ?? ''}
                  onChange={e => handleFieldChange('startDate', e.target.value || null)}
                  disabled={isReadOnly}
                  data-testid="input-drawer-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-end-date">End Date</Label>
                <Input
                  id="drawer-end-date"
                  type="date"
                  value={task.endDate ?? ''}
                  onChange={e => handleFieldChange('endDate', e.target.value || null)}
                  disabled={isReadOnly}
                  data-testid="input-drawer-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsibility</Label>
              <Select
                value={task.responsibility.type}
                onValueChange={(v) => handleResponsibilityChange(v as 'me' | 'external' | 'unknown')}
                disabled={isReadOnly}
              >
                <SelectTrigger data-testid="select-drawer-responsibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              {task.responsibility.type === 'external' && (
                <Input
                  value={task.responsibility.label ?? ''}
                  onChange={e => handleResponsibilityChange('external', e.target.value)}
                  placeholder="e.g., contractor name"
                  disabled={isReadOnly}
                  data-testid="input-drawer-responsibility-label"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="drawer-notes">Notes</Label>
              <Textarea
                id="drawer-notes"
                value={task.notes ?? ''}
                onChange={e => handleFieldChange('notes', e.target.value || null)}
                placeholder="Add notes..."
                disabled={isReadOnly}
                data-testid="input-drawer-notes"
              />
            </div>

            {task.linkedDocuments.length > 0 && (
              <div className="space-y-2" data-testid="section-linked-documents">
                <Label>Linked Documents</Label>
                <div className="flex flex-wrap gap-1.5">
                  {task.linkedDocuments.map((doc, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {doc}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {task.linkedInvoices.length > 0 && (
              <div className="space-y-2" data-testid="section-linked-invoices">
                <Label>Linked Invoices</Label>
                <div className="flex flex-wrap gap-1.5">
                  {task.linkedInvoices.map((inv, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Receipt className="h-3 w-3 mr-1" />
                      {inv}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {taskLog.length > 0 && (
              <div className="space-y-2" data-testid="section-activity-log">
                <Label>Activity Log</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {taskLog.map(entry => (
                    <div key={entry.id} className="text-xs text-secondary flex items-start gap-2">
                      <span className="shrink-0 text-muted-foreground">{formatLogDate(entry.timestamp, locale)}</span>
                      <span>
                        {entry.action}
                        {entry.newValue && ` \u2192 ${entry.newValue}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isReadOnly && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="button-drawer-delete"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Task
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        taskTitle={task.title}
        onConfirm={() => {
          onDeleteTask(task.id);
          onOpenChange(false);
        }}
      />
    </>
  );
}
