import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, Target, GitCompare, Lightbulb } from 'lucide-react';
import { useFormatters } from '@/context/ProjectContext';
import type {
  StructuredCardData,
  FinancialSummaryCardData,
  ScopeAnalysisCardData,
  ComparisonCardData,
  ActionRecommendationCardData,
} from './types';

function FinancialSummaryCard({ data }: { data: FinancialSummaryCardData }) {
  const { formatCurrency } = useFormatters();

  return (
    <Card className="border-border bg-primary/5 dark:bg-primary/10" data-testid="financial-summary-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">{data.title || 'Financial Summary'}</span>
        </div>

        {data.progressPercent !== undefined && (
          <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(data.progressPercent, 100)}%`,
                backgroundColor: 'var(--accent-copper)',
              }}
            />
          </div>
        )}

        <div className="space-y-1">
          {data.rows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-between text-sm ${
                row.highlight ? 'font-semibold pt-1 border-t border-border/20' : ''
              }`}
            >
              <span className={row.highlight ? 'text-foreground' : 'text-muted-foreground'}>
                {row.label}
              </span>
              <span className={row.highlight ? 'text-primary' : 'text-foreground'} data-testid={`text-fin-row-${i}`}>
                {typeof row.value === 'number' ? formatCurrency(row.value) : row.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScopeAnalysisCard({ data }: { data: ScopeAnalysisCardData }) {
  const quotedPercent = data.totalItems > 0
    ? Math.round((data.quotedItems / data.totalItems) * 100)
    : 0;

  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (quotedPercent / 100) * circumference;

  return (
    <Card className="border-border bg-primary/5 dark:bg-primary/10" data-testid="scope-analysis-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">Scope Analysis</span>
        </div>

        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
            <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border opacity-30" />
            <circle
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke="var(--accent-copper)"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 20 20)"
            />
          </svg>
          <div className="text-sm">
            <span className="font-medium text-foreground" data-testid="text-scope-quoted">
              {data.quotedItems} of {data.totalItems}
            </span>
            <span className="text-muted-foreground"> items quoted ({quotedPercent}%)</span>
          </div>
        </div>

        {data.gaps && data.gaps.length > 0 && (
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Unquoted areas:</span>
            <ul className="list-disc list-inside text-xs text-foreground space-y-0.5" data-testid="scope-gaps-list">
              {data.gaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ data }: { data: ComparisonCardData }) {
  return (
    <Card className="border-border bg-primary/5 dark:bg-primary/10" data-testid="comparison-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <GitCompare className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">{data.title || 'Comparison'}</span>
        </div>

        <div className="space-y-1.5">
          {data.items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-1 text-xs">
              <span className="text-muted-foreground truncate">{item.label}</span>
              <span
                className={`font-medium truncate ${item.winner === 'a' ? 'text-primary' : 'text-foreground'}`}
                data-testid={`text-compare-a-${i}`}
              >
                {item.optionA}
              </span>
              <span
                className={`font-medium truncate ${item.winner === 'b' ? 'text-primary' : 'text-foreground'}`}
                data-testid={`text-compare-b-${i}`}
              >
                {item.optionB}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRecommendationCard({
  data,
  onSendMessage,
  onNavigate,
}: {
  data: ActionRecommendationCardData;
  onSendMessage?: (msg: string) => void;
  onNavigate?: (path: string) => void;
}) {
  return (
    <Card className="border-[var(--accent-copper)]/20 bg-[var(--accent-copper)]/5" data-testid="action-recommendation-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Lightbulb className="w-4 h-4" style={{ color: 'var(--accent-copper)' }} />
          <span className="font-bold text-foreground">{data.headline}</span>
        </div>

        <p className="text-xs text-muted-foreground">{data.reason}</p>

        {data.actionLabel && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              if (data.targetFrame && onNavigate) {
                onNavigate(data.targetFrame);
              } else if (data.actionPayload && onSendMessage) {
                onSendMessage(data.actionPayload);
              }
            }}
            data-testid="button-action-recommendation"
          >
            {data.actionLabel}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function StructuredCard({
  data,
  onSendMessage,
  onNavigate,
}: {
  data: StructuredCardData;
  onSendMessage?: (msg: string) => void;
  onNavigate?: (path: string) => void;
}) {
  if (!data || !data.cardType) return null;

  try {
    switch (data.cardType) {
      case 'financial_summary':
        if (!Array.isArray(data.rows)) return null;
        return <FinancialSummaryCard data={data} />;
      case 'scope_analysis':
        if (typeof data.totalItems !== 'number') return null;
        return <ScopeAnalysisCard data={data} />;
      case 'comparison':
        if (!Array.isArray(data.items)) return null;
        return <ComparisonCard data={data} />;
      case 'action_recommendation':
        if (!data.headline) return null;
        return <ActionRecommendationCard data={data} onSendMessage={onSendMessage} onNavigate={onNavigate} />;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
