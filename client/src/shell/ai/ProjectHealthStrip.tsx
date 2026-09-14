import { useIsMobile } from '@/hooks/use-mobile';
import { useFormatters } from '@/context/ProjectContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ProjectHealthData {
  budget: {
    total: number;
    allocated: number;
  };
  scope: {
    areaCount: number;
    itemCount: number;
    quotedPercent: number;
  };
  invoices: {
    outstandingAmount: number;
    status: 'green' | 'amber' | 'red';
  };
}

interface ProjectHealthStripProps {
  data: ProjectHealthData;
}

function MiniProgressArc({ percent }: { percent: number }) {
  const r = 8;
  const cx = 10;
  const cy = 10;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-border opacity-30"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--accent-copper)"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-500"
      />
    </svg>
  );
}

function StatusDot({ status }: { status: 'green' | 'amber' | 'red' }) {
  const colorClass =
    status === 'green'
      ? 'bg-status-approved'
      : status === 'amber'
        ? 'bg-[var(--signal-warning)]'
        : 'bg-destructive';

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClass}`}
      data-testid={`status-dot-invoices-${status}`}
    />
  );
}

function overallHealth(data: ProjectHealthData): 'Good' | 'Needs Attention' {
  if (data.invoices.status === 'red') return 'Needs Attention';
  if (data.budget.total > 0 && data.budget.allocated / data.budget.total < 0.3) return 'Needs Attention';
  if (data.scope.itemCount > 0 && data.scope.quotedPercent < 20) return 'Needs Attention';
  return 'Good';
}

export function ProjectHealthStrip({ data }: ProjectHealthStripProps) {
  const isMobile = useIsMobile();
  const { formatCurrency } = useFormatters();

  const allocatedPercent =
    data.budget.total > 0
      ? Math.round((data.budget.allocated / data.budget.total) * 100)
      : 0;

  const health = overallHealth(data);

  if (isMobile) {
    const healthColor =
      health === 'Good' ? 'text-status-approved' : 'text-[var(--signal-warning)]';

    return (
      <div
        className="renix-surface flex items-center gap-2 px-3 py-2"
        data-testid="project-health-strip"
      >
        <StatusDot status={health === 'Good' ? 'green' : 'amber'} />
        <span className="text-xs text-muted-foreground">
          Project Health:{' '}
          <span className={`font-medium ${healthColor}`} data-testid="text-health-status">
            {health}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="renix-surface flex items-center gap-4 px-3 py-2 flex-wrap"
      data-testid="project-health-strip"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1.5 text-xs cursor-default"
            data-testid="health-budget"
          >
            <MiniProgressArc percent={allocatedPercent} />
            <span className="text-muted-foreground">Budget:</span>
            <span className="font-medium text-foreground" data-testid="text-budget-allocated">
              {allocatedPercent}% allocated
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {formatCurrency(data.budget.allocated)} of {formatCurrency(data.budget.total)} allocated
        </TooltipContent>
      </Tooltip>

      <span className="w-px h-4 bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1.5 text-xs cursor-default"
            data-testid="health-scope"
          >
            <span className="text-muted-foreground">Scope:</span>
            <span className="font-medium text-foreground" data-testid="text-scope-summary">
              {data.scope.areaCount} area{data.scope.areaCount !== 1 ? 's' : ''} · {data.scope.itemCount} item{data.scope.itemCount !== 1 ? 's' : ''} · {data.scope.quotedPercent}% quoted
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {data.scope.quotedPercent}% of scope items have quotes
        </TooltipContent>
      </Tooltip>

      <span className="w-px h-4 bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1.5 text-xs cursor-default"
            data-testid="health-invoices"
          >
            <StatusDot status={data.invoices.status} />
            <span className="text-muted-foreground">Invoices:</span>
            <span className="font-medium text-foreground" data-testid="text-invoices-outstanding">
              {formatCurrency(data.invoices.outstandingAmount)} outstanding
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {data.invoices.status === 'green'
            ? 'All invoices up to date'
            : data.invoices.status === 'amber'
              ? 'Some invoices approaching due date'
              : 'Overdue invoices require attention'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
