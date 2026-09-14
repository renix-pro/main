import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ExecutionTask, TaskState } from './useExecutionData';
import { useRegionalContext } from '../../context/ProjectContext';

interface GanttTimelineProps {
  tasks: ExecutionTask[];
}

const DAY_MS = 86400000;

function stateColor(state: TaskState): string {
  if (state === 'in_progress') return 'bg-accent-copper';
  if (state === 'done') return 'bg-status-approved';
  return 'bg-muted-foreground/40';
}

export function GanttTimeline({ tasks }: GanttTimelineProps) {
  const { locale } = useRegionalContext();
  const datedTasks = useMemo(() => {
    return tasks.filter(t => t.startDate && t.endDate);
  }, [tasks]);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (datedTasks.length === 0) return { minDate: 0, maxDate: 0, totalDays: 0 };
    let earliest = Infinity;
    let latest = -Infinity;
    for (const t of datedTasks) {
      const s = new Date(t.startDate!).getTime();
      const e = new Date(t.endDate!).getTime();
      if (s < earliest) earliest = s;
      if (e > latest) latest = e;
    }
    const now = Date.now();
    for (const t of datedTasks) {
      if (t.overdue && now > latest) latest = now;
    }
    const padding = DAY_MS * 3;
    earliest -= padding;
    latest += padding;
    const days = Math.max(Math.ceil((latest - earliest) / DAY_MS), 1);
    return { minDate: earliest, maxDate: latest, totalDays: days };
  }, [datedTasks]);

  const monthLabels = useMemo(() => {
    if (totalDays === 0) return [];
    const labels: { label: string; left: number }[] = [];
    const start = new Date(minDate);
    start.setDate(1);
    const end = new Date(maxDate);
    const current = new Date(start);
    while (current <= end) {
      const pos = ((current.getTime() - minDate) / (maxDate - minDate)) * 100;
      if (pos >= 0 && pos <= 100) {
        labels.push({
          label: current.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
          left: pos,
        });
      }
      current.setMonth(current.getMonth() + 1);
    }
    return labels;
  }, [minDate, maxDate, totalDays, locale]);

  if (datedTasks.length === 0) {
    return (
      <Card className="p-4" data-testid="gantt-timeline">
        <h3 className="text-sm font-medium mb-3">Timeline</h3>
        <p className="text-xs text-muted-foreground text-center py-4">
          Add start and end dates to tasks to see them on the timeline.
        </p>
      </Card>
    );
  }

  const range = maxDate - minDate;

  return (
    <Card className="p-4" data-testid="gantt-timeline">
      <h3 className="text-sm font-medium mb-3">Timeline</h3>
      <div className="space-y-1.5">
        <div className="relative h-5 ml-[140px]">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-secondary whitespace-nowrap"
              style={{ left: `${m.left}%`, transform: 'translateX(-50%)' }}
            >
              {m.label}
            </span>
          ))}
        </div>
        {datedTasks.map(task => {
          const startMs = new Date(task.startDate!).getTime();
          const endMs = new Date(task.endDate!).getTime();
          const left = ((startMs - minDate) / range) * 100;
          const width = Math.max(((endMs - startMs) / range) * 100, 0.5);

          let overdueWidth = 0;
          if (task.overdue) {
            const now = Date.now();
            overdueWidth = Math.max(((now - endMs) / range) * 100, 0.5);
          }

          return (
            <div key={task.id} className="flex items-center gap-2 h-7" data-testid={`gantt-bar-${task.id}`}>
              <div className="w-[140px] shrink-0 truncate text-xs text-secondary pr-2 text-right">
                {task.title}
              </div>
              <div className="flex-1 relative h-4">
                <div
                  className={cn('absolute top-0 h-full rounded-sm', stateColor(task.state))}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
                {task.overdue && overdueWidth > 0 && (
                  <div
                    className="absolute top-0 h-full rounded-r-sm bg-destructive/60"
                    style={{
                      left: `${left + width}%`,
                      width: `${overdueWidth}%`,
                      backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
