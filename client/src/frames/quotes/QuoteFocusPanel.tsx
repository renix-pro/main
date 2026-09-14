/**
 * RENIX vNext — Quote Focus Panel (Zone 3)
 * 
 * CFS Compliant — Displays and edits a single quote.
 * All editing (versions, lines) happens here.
 * Uses RENIX design tokens for styling.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFormatters, useRegionalContext } from '../../context/ProjectContext';
import type { Quote, QuoteVersion, QuoteStatus, Vendor } from './useQuotesData';

function formatDateWithLocale(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'accepted': return 'Accepted';
    case 'committed': return 'Committed';
    case 'pending': return 'Pending';
    case 'superseded': return 'Superseded';
    default: return 'Draft';
  }
}

interface QuoteFocusPanelProps {
  quote: Quote;
  vendor: Vendor;
  status: QuoteStatus;
  activeVersion?: QuoteVersion;
  acceptedVersion?: QuoteVersion;
  isReadOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddVersion: () => void;
  onAcceptVersion: (versionId: string) => void;
}

export function QuoteFocusPanel({
  quote,
  vendor,
  status,
  activeVersion,
  acceptedVersion,
  isReadOnly,
  onEdit,
  onDelete,
  onAddVersion,
  onAcceptVersion,
}: QuoteFocusPanelProps) {
  const { formatCurrency } = useFormatters();
  const { locale } = useRegionalContext();
  const displayVersion = activeVersion || acceptedVersion;
  const hasAccepted = !!acceptedVersion;

  return (
    <div
      className="renix-surface p-6 space-y-6"
      data-testid={`quote-focus-panel-${quote.id}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              className="text-xl font-semibold"
              data-testid={`text-focus-quote-ref-${quote.id}`}
            >
              {quote.description || 'Untitled'}
            </h2>
            <Badge
              variant="outline"
              className="border-subtle text-xs"
              data-testid={`badge-focus-status-${quote.id}`}
            >
              {getStatusLabel(status)}
            </Badge>
          </div>
          <p
            className="text-sm text-muted"
            data-testid={`text-focus-vendor-${quote.id}`}
          >
            {vendor.name}
          </p>
          {quote.description && (
            <p
              className="text-sm text-muted mt-2"
              data-testid={`text-focus-desc-${quote.id}`}
            >
              {quote.description}
            </p>
          )}
        </div>

        {displayVersion && (
          <div className="text-right">
            <div
              className="text-2xl font-semibold tabular-nums"
              data-testid={`text-focus-total-${quote.id}`}
            >
              {formatCurrency(displayVersion.total)}
            </div>
            <div className="text-xs text-muted">Current total</div>
          </div>
        )}
      </header>

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2 border-t border-subtle/20 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="border-subtle"
            data-testid={`button-focus-edit-${quote.id}`}
          >
            Edit Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddVersion}
            className="border-subtle"
            data-testid={`button-focus-add-version-${quote.id}`}
          >
            Add Version
          </Button>
          {!hasAccepted && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="border-subtle"
              data-testid={`button-focus-delete-${quote.id}`}
            >
              Delete Quote
            </Button>
          )}
        </div>
      )}

      {quote.versions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted">
            Versions ({quote.versions.length})
          </h3>
          <div className="space-y-3">
            {quote.versions.slice().reverse().map(version => (
              <div
                key={version.id}
                className={`border p-4 ${
                  version.commitmentStatus === 'accepted'
                    ? 'border-subtle border-2'
                    : version.commitmentStatus === 'active'
                    ? 'border-subtle'
                    : version.commitmentStatus === null
                    ? 'border-subtle/20'
                    : 'border-subtle/30'
                }`}
                data-testid={`focus-version-${version.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">v{version.versionNumber}</span>
                    {version.extractionStatus === 'draft' && (
                      <Badge variant="draft" className="text-xs">Draft</Badge>
                    )}
                    {version.extractionStatus === 'verified' && version.commitmentStatus === 'accepted' && (
                      <Badge
                        variant="outline"
                        className="border-subtle text-xs"
                      >
                        Accepted
                      </Badge>
                    )}
                    {version.extractionStatus === 'verified' && version.commitmentStatus === 'active' && (
                      <Badge
                        variant="outline"
                        className="border-subtle/50 text-xs"
                      >
                        Active
                      </Badge>
                    )}
                    {version.extractionStatus === 'verified' && version.commitmentStatus === 'superseded' && (
                      <Badge
                        variant="secondary"
                        className="text-xs opacity-60"
                      >
                        Superseded
                      </Badge>
                    )}
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(version.total)}
                  </span>
                </div>

                <div className="space-y-1 mb-3">
                  {version.lineItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted">{item.description}</span>
                      <span className="tabular-nums">{item.totalPrice != null ? formatCurrency(item.totalPrice) : '\u2014'}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{formatDateWithLocale(version.createdAt, locale)}</span>
                  {version.validUntil && (
                    <span>Valid until {version.validUntil}</span>
                  )}
                </div>

                {version.notes && (
                  <p className="text-xs text-muted mt-2 italic">
                    {version.notes}
                  </p>
                )}

                {!isReadOnly && version.extractionStatus === 'verified' && version.commitmentStatus === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full border-subtle"
                    onClick={() => onAcceptVersion(version.id)}
                    data-testid={`button-focus-accept-${version.id}`}
                  >
                    Accept This Version
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {quote.versions.length === 0 && (
        <div className="border border-dashed border-subtle rounded-lg renix-surface p-8 text-center">
          <p className="text-sm text-muted">
            No versions yet. Add a version with line items to specify quoted amounts.
          </p>
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-subtle"
              onClick={onAddVersion}
              data-testid="button-focus-first-version"
            >
              Add First Version
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
