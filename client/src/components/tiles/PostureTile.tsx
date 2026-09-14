import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const statusTintClasses: Record<string, string> = {
  approved: 'bg-status-approved-subtle',
  pending: 'bg-status-pending-subtle',
  draft: 'bg-status-draft-subtle',
  declined: 'bg-status-declined-subtle',
};

interface PostureTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  statusTint?: 'approved' | 'pending' | 'draft' | 'declined';
  className?: string;
}

export function PostureTile({ label, value, subtext, statusTint, className }: PostureTileProps) {
  return (
    <Card
      className={cn(statusTint && statusTintClasses[statusTint], className)}
      data-testid={`posture-tile-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <p
          className="text-xs text-muted-foreground font-medium"
          data-testid={`posture-tile-label-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {label}
        </p>
        <p
          className="text-2xl font-bold text-foreground tabular-nums mt-1"
          data-testid={`posture-tile-value-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </p>
        {subtext && (
          <p
            className="text-xs text-muted-foreground mt-1"
            data-testid={`posture-tile-subtext-${label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
