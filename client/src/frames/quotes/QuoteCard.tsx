/**
 * RENIX vNext — Quote Card Component
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Displays a quote with its versions and status.
 * Two-axis status model: extractionStatus + commitmentStatus.
 */

import { MoreHorizontal, Pencil, Trash2, Plus, Check, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useFormatters, useRegionalContext } from '../../context/ProjectContext';
import type { Quote, QuoteVersion, QuoteStatus, Vendor } from './useQuotesData';

function formatDateWithLocale(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getStatusBadge(status: QuoteStatus) {
  switch (status) {
    case 'accepted':
      return <Badge variant="approved"><Check className="h-3 w-3 mr-1" />Accepted</Badge>;
    case 'committed':
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Committed</Badge>;
    case 'pending':
      return <Badge variant="pending"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case 'superseded':
      return <Badge variant="secondary">Superseded</Badge>;
    default:
      return <Badge variant="draft"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
  }
}

interface QuoteCardProps {
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

export function QuoteCard({
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
}: QuoteCardProps) {
  const { formatCurrency } = useFormatters();
  const { locale } = useRegionalContext();
  const displayVersion = activeVersion || acceptedVersion;
  const hasAccepted = !!acceptedVersion;

  const cardTint = status === 'accepted' ? 'bg-status-approved-subtle'
    : status === 'committed' ? 'bg-status-pending-subtle'
    : status === 'pending' ? ''
    : status === 'superseded' ? ''
    : 'bg-status-draft-subtle';

  return (
    <Card className={cardTint} data-testid={`quote-card-${quote.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="text-base font-medium" data-testid={`text-quote-ref-${quote.id}`}>
              {quote.description || 'Untitled'}
            </CardTitle>
            {getStatusBadge(status)}
          </div>
          <p className="text-sm text-secondary" data-testid={`text-quote-vendor-${quote.id}`}>
            {vendor.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {displayVersion && (
            <span className="text-lg font-semibold tabular-nums" data-testid={`text-quote-total-${quote.id}`}>
              {formatCurrency(displayVersion.total)}
            </span>
          )}
          {!isReadOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-quote-menu-${quote.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-quote-${quote.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddVersion} data-testid={`button-add-version-${quote.id}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Version
                </DropdownMenuItem>
                {!hasAccepted && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`button-delete-quote-${quote.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      {quote.versions.length > 0 && (
        <CardContent className="pt-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="versions" className="border-none">
              <AccordionTrigger className="py-2 text-sm hover:no-underline text-secondary" data-testid={`accordion-versions-${quote.id}`}>
                {quote.versions.length} version{quote.versions.length !== 1 ? 's' : ''}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {quote.versions.slice().reverse().map(version => (
                    <div
                      key={version.id}
                      className={`p-3 border rounded-md border-subtle ${version.commitmentStatus === 'accepted' ? 'bg-status-approved-subtle' : version.commitmentStatus === 'active' ? 'bg-status-pending-subtle' : version.commitmentStatus === null ? 'bg-muted/30' : 'bg-surface-secondary'}`}
                      data-testid={`version-${version.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">v{version.versionNumber}</span>
                          {version.extractionStatus === 'draft' && (
                            <Badge variant="draft" className="text-xs">Draft</Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'accepted' && (
                            <Badge variant="approved" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'active' && (
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'superseded' && (
                            <Badge variant="secondary" className="text-xs opacity-60">Superseded</Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(version.total)}
                        </span>
                      </div>

                      <div className="space-y-1 mb-2">
                        {version.lineItems.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-secondary">{item.description}</span>
                            <span className="tabular-nums">{item.totalPrice != null ? formatCurrency(item.totalPrice) : '\u2014'}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs text-secondary">
                        <span>{formatDateWithLocale(version.createdAt, locale)}</span>
                        {version.validUntil && (
                          <span>Valid until {version.validUntil}</span>
                        )}
                      </div>

                      {!isReadOnly && version.extractionStatus === 'verified' && version.commitmentStatus === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => onAcceptVersion(version.id)}
                          data-testid={`button-accept-version-${version.id}`}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept This Version
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}
