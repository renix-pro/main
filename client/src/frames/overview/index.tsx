import { useState, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useFormatters } from '../../context/ProjectContext';
import { useOverviewAI } from './useOverviewAI';
import { OverviewSkeleton } from '@/components/FrameSkeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/tiles';
import { RefreshCw, Info, AlertCircle, Shield, ChevronRight, ArrowRight, AlertTriangle, CircleAlert, Lightbulb, Target, MessageSquareText, Wallet, Sparkles, HelpCircle, CheckCircle2, Circle, ChevronDown, ChevronUp, PiggyBank, ListChecks, X } from 'lucide-react';
import { useAICompanion } from '@/shell/AICompanionContext';
import { useResetOnboarding } from '@/components/OnboardingTour';
import type {
  CostRealityMetrics,
  ScopeClarityMetrics,
  ExecutionReadinessMetrics,
  AssumptionsVsConfirmedMetrics,
  FinancingCoverageMetrics,
  AttentionSignal,
} from './overviewTypes';
import type { CanonicalFrame } from '../../spine/appSpine';

function ConfidenceDots({ level, max = 5 }: { level: number; max?: number }) {
  const color = level >= 4 ? 'bg-[var(--signal-success)]' : level >= 2 ? 'bg-[var(--signal-warning)]' : 'bg-[var(--signal-danger)]';
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full transition-colors ${
            i < level ? color : 'bg-muted-foreground/15'
          }`}
        />
      ))}
    </div>
  );
}

function CostRealityTileContent({ metrics, interpretation, formatCurrency, onNavigate }: {
  metrics: CostRealityMetrics;
  interpretation: string;
  formatCurrency: (amount: number | null) => string;
  onNavigate: (frame: CanonicalFrame) => void;
}) {
  if (!metrics.budgetDefined) {
    return (
      <MetricCard
        label="Cost Reality"
        emptyText="No budget defined yet."
        navHint={{ label: 'View details', onClick: () => onNavigate('budget') }}
      />
    );
  }

  const committedPct = metrics.totalBudget > 0 ? Math.round((metrics.committedTotal / metrics.totalBudget) * 100) : 0;
  const invoicedPct = Math.round(metrics.invoicedRatio * 100);

  const hasDirectCosts = metrics.directCostTotal > 0;
  const hasContingency = metrics.contingencyAmount > 0;

  return (
    <MetricCard
      label="Cost Reality"
      statusTint="draft"
      navHint={{ label: 'View details', onClick: () => onNavigate('budget') }}
    >
      <div className="space-y-2" data-testid="overview-kpi-cost-reality">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-foreground/70 flex-wrap">
            <span>Committed</span>
            <span data-testid="text-committed-amount" className="font-medium text-foreground/80">
              {formatCurrency(metrics.committedTotal)} of {formatCurrency(metrics.totalBudget)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                committedPct > 95 ? 'bg-[var(--signal-danger)]' : committedPct > 70 ? 'bg-[var(--signal-warning)]' : 'bg-[var(--accent-copper)]'
              }`}
              style={{ width: `${Math.min(100, committedPct)}%` }}
            />
          </div>
          <div className="text-right">
            <span className="text-xs text-foreground/60" data-testid="text-committed-pct">{committedPct}%</span>
          </div>
          {(hasDirectCosts || hasContingency || metrics.totalQuoted > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-foreground/50 pt-0.5">
              {metrics.totalQuoted > 0 && (
                <span data-testid="text-committed-quotes">Quotes {formatCurrency(metrics.totalQuoted)}</span>
              )}
              {hasDirectCosts && (
                <span data-testid="text-committed-direct">Direct {formatCurrency(metrics.directCostTotal)}</span>
              )}
              {hasContingency && (
                <span data-testid="text-committed-contingency">Contingency {formatCurrency(metrics.contingencyAmount)}</span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-foreground/70 flex-wrap">
            <span>Invoiced</span>
            <span data-testid="text-invoiced-amount" className="font-medium text-foreground/80">
              {formatCurrency(metrics.totalInvoiced)} of {formatCurrency(metrics.totalBudget)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--signal-info)] transition-all"
              style={{ width: `${Math.min(100, invoicedPct)}%` }}
            />
          </div>
          <div className="text-right">
            <span className="text-xs text-foreground/60" data-testid="text-invoiced-pct">{invoicedPct}%</span>
          </div>
        </div>
        <p className="text-xs text-foreground/60">{interpretation}</p>
      </div>
    </MetricCard>
  );
}

function ScopeClarityTileContent({ metrics, interpretation, onNavigate }: {
  metrics: ScopeClarityMetrics;
  interpretation: string;
  onNavigate: (frame: CanonicalFrame) => void;
}) {
  return (
    <MetricCard
      label="Scope Clarity"
      statusTint="pending"
      navHint={{ label: 'View details', onClick: () => onNavigate('scope') }}
    >
      <div className="space-y-2" data-testid="overview-kpi-scope-clarity">
        <ConfidenceDots level={metrics.level} />
        <div className="text-xs text-foreground/70 space-y-0.5">
          <p data-testid="text-scope-total">{metrics.totalScopeNodes} scope area{metrics.totalScopeNodes !== 1 ? 's' : ''}</p>
          {metrics.totalScopeNodes > 0 && (
            <p data-testid="text-scope-coverage">
              {metrics.nodesWithQuotes} with quotes, {metrics.nodesWithAllocations} with allocations, {metrics.nodesWithTasks} with tasks
            </p>
          )}
        </div>
        <p className="text-xs text-foreground/60">{interpretation}</p>
      </div>
    </MetricCard>
  );
}

function ExecutionReadinessTileContent({ metrics, interpretation, onNavigate }: {
  metrics: ExecutionReadinessMetrics;
  interpretation: string;
  onNavigate: (frame: CanonicalFrame) => void;
}) {
  return (
    <MetricCard
      label="Execution Readiness"
      statusTint="approved"
      navHint={{ label: 'View details', onClick: () => onNavigate('execution') }}
    >
      <div className="space-y-2" data-testid="overview-kpi-execution-readiness">
        <ConfidenceDots level={metrics.level} />
        {metrics.totalTasks > 0 ? (
          <div className="text-xs text-foreground/70 space-y-0.5">
            <p data-testid="text-tasks-summary">
              {metrics.doneTasks} done, {metrics.inProgressTasks} in progress, {metrics.todoTasks} to-do
              {metrics.blockedTasks > 0 ? `, ${metrics.blockedTasks} blocked` : ''}
            </p>
          </div>
        ) : (
          <p className="text-xs text-foreground/70" data-testid="text-no-tasks">No tasks created yet</p>
        )}
        <p className="text-xs text-foreground/60">{interpretation}</p>
      </div>
    </MetricCard>
  );
}

function FinancingCoverageTileContent({ metrics, budgetDefined, totalBudget, formatCurrency, onNavigate }: {
  metrics: FinancingCoverageMetrics;
  budgetDefined: boolean;
  totalBudget: number;
  formatCurrency: (amount: number | null) => string;
  onNavigate: (frame: CanonicalFrame) => void;
}) {
  if (metrics.totalFinancingSources === 0 && !budgetDefined) {
    return (
      <MetricCard
        label="Financing"
        statusTint="pending"
        emptyText="No financing sources set up yet."
        navHint={{ label: 'View details', onClick: () => onNavigate('financing') }}
      />
    );
  }

  const coveragePct = Math.round(metrics.coverageRatio * 100);
  const gap = budgetDefined ? totalBudget - metrics.totalFinancing : 0;
  const hasGap = budgetDefined && gap > 0;

  return (
    <MetricCard
      label="Financing"
      statusTint="pending"
      navHint={{ label: 'View details', onClick: () => onNavigate('financing') }}
    >
      <div className="space-y-2" data-testid="overview-kpi-financing">
        {metrics.totalFinancingSources > 0 && (
          <div className="text-xs text-foreground/70 space-y-0.5">
            <p data-testid="text-financing-confirmed">
              Confirmed: <span className="font-medium text-foreground/80">{formatCurrency(metrics.confirmedFinancing)}</span>
            </p>
            {metrics.plannedFinancing > 0 && (
              <p data-testid="text-financing-planned">
                Planned: <span className="font-medium text-foreground/80">{formatCurrency(metrics.plannedFinancing)}</span>
              </p>
            )}
          </div>
        )}
        {budgetDefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-foreground/70 flex-wrap">
              <span>Budget coverage</span>
              <span data-testid="text-financing-coverage" className="font-medium text-foreground/80">{coveragePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  coveragePct >= 100 ? 'bg-[var(--signal-success)]' : coveragePct >= 70 ? 'bg-[var(--accent-copper)]' : 'bg-[var(--signal-warning)]'
                }`}
                style={{ width: `${Math.min(100, coveragePct)}%` }}
              />
            </div>
          </div>
        )}
        {hasGap && (
          <p className="text-xs text-foreground/60" data-testid="text-financing-gap">
            Gap: <span className="font-medium text-foreground/80">{formatCurrency(gap)}</span>
          </p>
        )}
      </div>
    </MetricCard>
  );
}

function AssumptionsVsConfirmedChart({ metrics, interpretation }: { metrics: AssumptionsVsConfirmedMetrics; interpretation: string }) {
  if (metrics.totalScopeNodes === 0) {
    return (
      <Card className="p-4 space-y-3" data-testid="overview-chart-assumptions-facts">
        <div className="text-xs uppercase tracking-wider text-foreground/60">Project Foundation</div>
        <p className="text-sm text-foreground/70">No scope areas defined yet.</p>
      </Card>
    );
  }

  const barH = 100;
  const barW = 48;
  const assumedH = Math.max(metrics.assumedRatio > 0 ? 4 : 0, metrics.assumedRatio * barH);
  const confirmedH = Math.max(metrics.confirmedRatio > 0 ? 4 : 0, metrics.confirmedRatio * barH);

  return (
    <Card className="p-4 space-y-3" data-testid="overview-chart-assumptions-facts">
      <div className="text-xs uppercase tracking-wider text-foreground/60">Project Foundation</div>
      <div className="flex items-end justify-center gap-10">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-medium" data-testid="text-assumed-count">{metrics.assumedNodes}</span>
          <svg width={barW} height={barH} aria-label="Not yet quoted bar">
            <rect x="0" y="0" width={barW} height={barH} rx="6" className="fill-muted/30 dark:fill-muted/20" />
            <rect
              x="0"
              y={barH - assumedH}
              width={barW}
              height={assumedH}
              rx="6"
              fill="var(--signal-warning)"
              opacity="0.6"
            />
          </svg>
          <span className="text-xs text-foreground/60">Not yet quoted</span>
          <span className="text-xs font-medium" data-testid="text-assumed-pct">{Math.round(metrics.assumedRatio * 100)}%</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-medium" data-testid="text-confirmed-count">{metrics.confirmedNodes}</span>
          <svg width={barW} height={barH} aria-label="Quoted or invoiced bar">
            <rect x="0" y="0" width={barW} height={barH} rx="6" className="fill-muted/30 dark:fill-muted/20" />
            <rect
              x="0"
              y={barH - confirmedH}
              width={barW}
              height={confirmedH}
              rx="6"
              fill="var(--signal-success)"
              opacity="0.7"
            />
          </svg>
          <span className="text-xs text-foreground/60">Confirmed</span>
          <span className="text-xs font-medium" data-testid="text-confirmed-pct">{Math.round(metrics.confirmedRatio * 100)}%</span>
        </div>
      </div>
      <p className="text-xs text-foreground/60 text-center">
        {metrics.confirmedNodes} of {metrics.totalScopeNodes} scope area{metrics.totalScopeNodes !== 1 ? 's' : ''} have committed quotes, invoices, or locked direct costs
      </p>
      <p className="text-xs text-foreground/60">{interpretation}</p>
    </Card>
  );
}

function severityIcon(severity: AttentionSignal['severity']) {
  switch (severity) {
    case 'high':
      return <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--signal-danger)]" />;
    case 'medium':
      return <CircleAlert className="h-4 w-4 shrink-0 text-[var(--signal-warning)]" />;
    case 'low':
    default:
      return <Lightbulb className="h-4 w-4 shrink-0 text-[var(--signal-info)]" />;
  }
}

const FRAME_ACTION_LABELS: Record<string, string> = {
  scope: 'Review Scope',
  budget: 'Check Budget',
  quotes: 'Review Quotes',
  invoices: 'View Invoices',
  financing: 'Check Financing',
  execution: 'View Tasks',
  documents: 'View Documents',
  vision: 'View Vision',
};

function AttentionSignalsSection({ signals, onNavigate }: { signals: AttentionSignal[]; onNavigate: (frame: CanonicalFrame) => void }) {
  if (signals.length === 0) return null;

  const sorted = [...signals].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 1) - (order[b.severity] ?? 1);
  });

  return (
    <div className="space-y-3" data-testid="overview-attention-signals">
      <h3 className="text-sm font-medium">Attention Signals</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sorted.map((signal, idx) => (
          <Card key={idx} className="p-4 space-y-2" data-testid={`overview-attention-signal-${idx}`}>
            <div className="flex items-start gap-2.5">
              {severityIcon(signal.severity)}
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-medium">{signal.title}</h4>
                <p className="text-xs text-foreground/60">{signal.reason}</p>
              </div>
            </div>
            {signal.targetFrame && FRAME_ACTION_LABELS[signal.targetFrame] && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs h-7 mt-1"
                onClick={() => onNavigate(signal.targetFrame as CanonicalFrame)}
                data-testid={`button-signal-action-${idx}`}
              >
                {FRAME_ACTION_LABELS[signal.targetFrame]}
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function NarrativeSection({ narrative }: { narrative: string }) {
  if (!narrative) return null;
  return (
    <Card className="p-5 relative overflow-hidden" data-testid="overview-narrative">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--accent-copper)] opacity-40 rounded-l" />
      <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/50 mb-2">Project Narrative</h3>
      <p className="text-sm text-foreground/70 leading-relaxed">{narrative}</p>
    </Card>
  );
}

function ReassuranceBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Card className="p-4 bg-status-approved-subtle" data-testid="overview-reassurance">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 shrink-0 text-[var(--signal-success)]" />
        <p className="flex-1 text-sm text-[var(--signal-success)]">{message}</p>
      </div>
    </Card>
  );
}

const GETTING_STARTED_ACTIONS = [
  {
    id: 'scope',
    icon: Target,
    title: 'Define your renovation scope',
    description: 'Start with a clear plan. Pick a template or build your scope from scratch.',
    frame: 'scope' as CanonicalFrame,
    testId: 'action-define-scope',
  },
  {
    id: 'budget',
    icon: Wallet,
    title: 'Set your target budget',
    description: 'Define how much you want to spend. RENIX tracks costs against your target.',
    frame: 'budget' as CanonicalFrame,
    testId: 'action-set-budget',
  },
  {
    id: 'quote',
    icon: MessageSquareText,
    title: 'Upload a contractor quote',
    description: 'Drop a quote into the AI chat — it extracts vendor, line items, and totals automatically.',
    frame: null,
    testId: 'action-upload-quote',
  },
  {
    id: 'financing',
    icon: PiggyBank,
    title: 'Set up your financing',
    description: 'Record how you are funding the project — equity, loans, or grants.',
    frame: 'financing' as CanonicalFrame,
    testId: 'action-set-financing',
  },
];

function EmptyOverviewActionSurface({ onNavigate, onOpenAI, onReplayTour }: {
  onNavigate: (frame: CanonicalFrame) => void;
  onOpenAI: () => void;
  onReplayTour: () => void;
}) {
  return (
    <div data-testid="frame-overview" className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-getting-started-title">
            Every great renovation starts with a clear plan
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto" data-testid="text-getting-started-body">
            Follow these steps to set up your project and get the most out of RENIX.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GETTING_STARTED_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => action.frame ? onNavigate(action.frame) : onOpenAI()}
                className="renix-surface p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer"
                data-testid={action.testId}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplayTour}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground gap-1.5"
            data-testid="button-replay-tour"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Replay tour
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ActivationMilestone {
  id: string;
  label: string;
  completed: boolean;
  frame: CanonicalFrame | null;
  testId: string;
}

function ActivationChecklist({ milestones, totalMilestones, totalCompleted, onNavigate, onOpenAI, onReplayTour, projectId }: {
  milestones: ActivationMilestone[];
  totalMilestones: number;
  totalCompleted: number;
  onNavigate: (frame: CanonicalFrame) => void;
  onOpenAI: () => void;
  onReplayTour: () => void;
  projectId: string;
}) {
  const storageKey = `renix-checklist-collapsed-${projectId}`;
  const allDone = totalCompleted >= totalMilestones;
  const completedCount = totalCompleted;

  const [collapsed, setCollapsed] = useState(() => {
    if (allDone) return true;
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  if (allDone) {
    return (
      <Card className="p-4" data-testid="overview-activation-checklist-complete">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--signal-success)]" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">Setup complete</h3>
            <p className="text-xs text-muted-foreground">You've completed all setup steps. Your project is ready to go.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3" data-testid="overview-activation-checklist">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium text-foreground">Getting Started</h3>
          <span className="text-xs text-muted-foreground">{completedCount} of {totalMilestones}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onReplayTour}
            className="text-muted-foreground/50 hover:text-muted-foreground"
            data-testid="button-replay-tour-checklist"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-muted-foreground/50 hover:text-muted-foreground"
            data-testid="button-toggle-checklist"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent-copper)] transition-all duration-500"
          style={{ width: `${(completedCount / totalMilestones) * 100}%` }}
        />
      </div>

      {!collapsed && (
        <div className="space-y-2 pt-1">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-center gap-3 py-1.5"
              data-testid={milestone.testId}
            >
              {milestone.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--signal-success)]" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/30" />
              )}
              <span className={`text-sm flex-1 min-w-0 ${milestone.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {milestone.label}
              </span>
              {!milestone.completed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => milestone.frame ? onNavigate(milestone.frame) : onOpenAI()}
                  className="shrink-0"
                  data-testid={`button-go-${milestone.id}`}
                >
                  Go <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const OPTIONAL_HINTS = [
  {
    id: 'vision',
    label: 'Capture your renovation inspiration',
    description: 'Save images, links, and ideas in the Vision frame.',
    frame: 'vision' as CanonicalFrame,
    testId: 'hint-vision',
  },
  {
    id: 'documents',
    label: 'Upload project documents',
    description: 'Store contracts, permits, and reference files in Documents.',
    frame: 'documents' as CanonicalFrame,
    testId: 'hint-documents',
  },
];

function OptionalHints({ projectId, onNavigate, allDone }: {
  projectId: string;
  onNavigate: (frame: CanonicalFrame) => void;
  allDone: boolean;
}) {
  const storageKey = `renix-hints-dismissed-${projectId}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = [...prev, id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  if (allDone) return null;

  const visible = OPTIONAL_HINTS.filter(h => !dismissed.includes(h.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="optional-hints">
      {visible.map(hint => (
        <div
          key={hint.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/20 border border-border/30"
          data-testid={hint.testId}
        >
          <Lightbulb className="h-4 w-4 shrink-0 text-[var(--accent-copper)]" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-foreground">{hint.label}</span>
            <span className="text-xs text-muted-foreground ml-1.5">{hint.description}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(hint.frame)}
            className="shrink-0 text-xs"
            data-testid={`button-go-${hint.id}`}
          >
            Go <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
          <button
            onClick={() => dismiss(hint.id)}
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            data-testid={`button-dismiss-${hint.id}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function OverviewFrame() {
  const { projectId, setActiveFrame } = useProject();
  const { formatCurrency } = useFormatters();
  const { contract, isEmpty, isLoading, isRefreshing, isError, error, refetch, forceRefresh } = useOverviewAI(projectId);
  const { open: openAI } = useAICompanion();
  const resetOnboarding = useResetOnboarding();

  const handleOpenAI = useCallback(() => {
    openAI();
  }, [openAI]);

  const handleReplayTour = useCallback(() => {
    resetOnboarding();
  }, [resetOnboarding]);

  if (isLoading) return <OverviewSkeleton />;

  if (isEmpty) {
    return (
      <EmptyOverviewActionSurface
        onNavigate={setActiveFrame}
        onOpenAI={handleOpenAI}
        onReplayTour={handleReplayTour}
      />
    );
  }

  if (isError || !contract) {
    return (
      <div data-testid="frame-overview" className="h-full flex items-center justify-center">
        <Card className="p-8 max-w-md text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-foreground/70">
            {error?.message || 'Unable to generate overview. Please try again.'}
          </p>
          <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-overview">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { computed, interpretations } = contract;

  const allMilestones: ActivationMilestone[] = [
    {
      id: 'scope',
      label: 'Define your renovation scope',
      completed: computed.scopeClarity.totalScopeNodes > 0,
      frame: 'scope',
      testId: 'milestone-scope',
    },
    {
      id: 'budget',
      label: 'Set your target budget',
      completed: computed.costReality.budgetDefined,
      frame: 'budget',
      testId: 'milestone-budget',
    },
    {
      id: 'quote',
      label: 'Upload a contractor quote',
      completed: computed.entityCounts.quotes > 0,
      frame: null,
      testId: 'milestone-quote',
    },
    {
      id: 'financing',
      label: 'Set up your financing',
      completed: computed.entityCounts.financingSources > 0,
      frame: 'financing',
      testId: 'milestone-financing',
    },
    {
      id: 'execution',
      label: 'Plan your first execution task',
      completed: computed.entityCounts.tasks > 0,
      frame: 'execution',
      testId: 'milestone-execution',
    },
  ];

  const totalCompleted = allMilestones.filter(m => m.completed).length;
  const firstIncompleteIdx = allMilestones.findIndex(m => !m.completed);
  const startIdx = firstIncompleteIdx === -1
    ? Math.max(0, allMilestones.length - 4)
    : Math.min(firstIncompleteIdx, Math.max(0, allMilestones.length - 4));
  const visibleMilestones = allMilestones.slice(startIdx, startIdx + 4);

  return (
    <div data-testid="frame-overview" className="h-full overflow-y-auto p-1 space-y-6">
      <ActivationChecklist
        milestones={visibleMilestones}
        totalMilestones={allMilestones.length}
        totalCompleted={totalCompleted}
        onNavigate={setActiveFrame}
        onOpenAI={handleOpenAI}
        onReplayTour={handleReplayTour}
        projectId={projectId}
      />

      <OptionalHints projectId={projectId} onNavigate={setActiveFrame} allDone={totalCompleted >= allMilestones.length} />

      <NarrativeSection narrative={interpretations.narrative} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="overview-kpis">
        <CostRealityTileContent
          metrics={computed.costReality}
          interpretation={interpretations.costRealityInterpretation}
          formatCurrency={formatCurrency}
          onNavigate={setActiveFrame}
        />
        <FinancingCoverageTileContent
          metrics={computed.financingCoverage}
          budgetDefined={computed.costReality.budgetDefined}
          totalBudget={computed.costReality.totalBudget}
          formatCurrency={formatCurrency}
          onNavigate={setActiveFrame}
        />
        <ScopeClarityTileContent
          metrics={computed.scopeClarity}
          interpretation={interpretations.scopeClarityInterpretation}
          onNavigate={setActiveFrame}
        />
        <ExecutionReadinessTileContent
          metrics={computed.executionReadiness}
          interpretation={interpretations.executionReadinessInterpretation}
          onNavigate={setActiveFrame}
        />
      </div>

      <div data-testid="overview-charts">
        <AssumptionsVsConfirmedChart
          metrics={computed.assumptionsVsConfirmed}
          interpretation={interpretations.assumptionsInterpretation}
        />
      </div>

      <AttentionSignalsSection signals={interpretations.attentionSignals} onNavigate={setActiveFrame} />

      <ReassuranceBanner message={interpretations.reassurance} />

      <div className="flex items-center justify-center pb-4">
        <Button
          size="sm"
          variant="ghost"
          className="bg-background"
          onClick={forceRefresh}
          disabled={isRefreshing}
          data-testid="button-refresh-overview"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="inline-block min-w-[4.5rem] text-left">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </div>
    </div>
  );
}

export default OverviewFrame;
