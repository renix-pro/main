import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const statusTintClasses: Record<string, string> = {
  approved: 'bg-status-approved-subtle',
  pending: 'bg-status-pending-subtle',
  draft: 'bg-status-draft-subtle',
  declined: 'bg-status-declined-subtle',
};

interface MetricCardProps {
  label: string;
  value?: string | number;
  emptyText?: string;
  navHint?: { label: string; href?: string; onClick?: () => void };
  icon?: LucideIcon;
  statusTint?: string;
  children?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  emptyText,
  navHint,
  icon: Icon,
  statusTint,
  children,
  className,
}: MetricCardProps) {
  const tintClass = statusTint && statusTintClasses[statusTint];
  const hasValue = value !== undefined && value !== null;
  const slug = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <Card
      className={cn(tintClass, className)}
      data-testid={`metric-card-${slug}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <Icon
                className="h-4 w-4 text-muted-foreground shrink-0"
                data-testid={`metric-card-icon-${slug}`}
              />
            )}
            <p
              className="text-xs text-muted-foreground font-medium truncate"
              data-testid={`metric-card-label-${slug}`}
            >
              {label}
            </p>
          </div>
          {navHint && (
            navHint.onClick ? (
              <button
                type="button"
                onClick={navHint.onClick}
                className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 cursor-pointer"
                data-testid={`metric-card-nav-${slug}`}
              >
                <span>{navHint.label}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <a
                href={navHint.href}
                className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"
                data-testid={`metric-card-nav-${slug}`}
              >
                <span>{navHint.label}</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            )
          )}
        </div>

        {hasValue ? (
          <p
            className="text-2xl font-bold text-foreground tabular-nums mt-1"
            data-testid={`metric-card-value-${slug}`}
          >
            {value}
          </p>
        ) : (
          <p
            className="text-sm text-muted-foreground mt-1"
            data-testid={`metric-card-empty-${slug}`}
          >
            {emptyText ?? '—'}
          </p>
        )}

        {children && (
          <div className="mt-2" data-testid={`metric-card-children-${slug}`}>
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
