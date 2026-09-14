/**
 * RENIX vNext — Message Cards Components
 * 
 * Card components for quote extraction display and proposal activity badges.
 */

import { FileText, CheckCircle2, ArrowRight, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FramePill } from './RichTextContent';
import { useFormatters, useRegionalContext } from '@/context/ProjectContext';

interface QuoteExtractionCardProps {
  extractedData: {
    vendorName: string | null;
    quoteDate: string | null;
    financials: {
      netTotal: number | null;
      taxAmount: number | null;
      grossTotal: number | null;
    };
  };
  fileName?: string;
  currency?: string;
}

export function QuoteExtractionCard({ 
  extractedData,
  fileName,
  currency = 'EUR'
}: QuoteExtractionCardProps) {
  const { formatCurrency } = useFormatters();
  const { locale } = useRegionalContext();
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    } catch {
      return dateStr;
    }
  };
  
  return (
    <Card 
      className="border-border bg-primary/5 dark:bg-primary/10" 
      data-testid="quote-extraction-card"
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Quote Summary</span>
          {fileName && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {fileName.length > 20 ? fileName.slice(0, 17) + '...' : fileName}
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Vendor</span>
            <p className="font-medium" data-testid="text-vendor-name">
              {extractedData.vendorName || '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Date</span>
            <p className="font-medium" data-testid="text-quote-date">
              {formatDate(extractedData.quoteDate)}
            </p>
          </div>
        </div>
        
        <div className="border-t border-border/30 pt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Net Amount</span>
            <span data-testid="text-net-amount">
              {formatCurrency(extractedData.financials.netTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span data-testid="text-tax-amount">
              {formatCurrency(extractedData.financials.taxAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border/20">
            <span>Gross Total</span>
            <span className="text-primary" data-testid="text-gross-amount">
              {formatCurrency(extractedData.financials.grossTotal)}
            </span>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground italic">
          These are AI-interpreted values. Review in Quotes frame before accepting.
        </p>
      </CardContent>
    </Card>
  );
}

interface IngestionSuccessCardProps {
  type: 'quote' | 'invoice' | 'quote_version';
  vendorName: string | null;
  scopeName: string | null;
  total: number | null;
  currency?: string;
  fileName?: string;
  reference?: string | null;
  versionNumber?: number;
  quoteId?: string;
  quoteVersionId?: string;
  scopeId?: string;
  projectId?: string;
  onNavigate?: (path: string) => void;
}

export function IngestionSuccessCard({
  type,
  vendorName,
  scopeName,
  total,
  currency = 'EUR',
  reference,
  versionNumber,
  quoteId,
  scopeId,
  projectId,
  onNavigate,
}: IngestionSuccessCardProps) {
  const { formatCurrency: projectFormatCurrency } = useFormatters();
  const formatCurrency = (value: number | null) => value === null ? null : projectFormatCurrency(value);

  const isVersion = type === 'quote_version';
  const isQuote = type === 'quote' || isVersion;
  const title = isVersion ? `Version ${versionNumber || '?'} Added` : isQuote ? 'Quote Added' : 'Invoice Recorded';
  const badgeLabel = isVersion ? `Quote v${versionNumber || '?'}` : isQuote ? 'Quote' : 'Invoice';
  const frameName = isQuote ? 'Quotes' : 'Invoices';
  const needsVerification = isQuote;

  return (
    <Card
      className="border-status-approved/20 bg-status-approved-subtle"
      data-testid="ingestion-success-card"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-status-approved" />
          <span className="text-sm font-bold text-foreground">{title}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {badgeLabel}
          </Badge>
        </div>

        {needsVerification && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="ingestion-step-indicator">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-status-approved" />
              <span className="font-medium text-foreground">Step 1: Stored</span>
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border border-status-pending flex items-center justify-center text-[8px] font-bold text-status-pending">2</span>
              <span className="font-medium text-status-pending">Review & verify</span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Vendor</span>
            <p className="font-medium" data-testid="text-success-vendor">
              {vendorName || '\u2014'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Scope</span>
            <p className="font-medium" data-testid="text-success-scope">
              {scopeName || '\u2014'}
            </p>
          </div>
          {total !== null && (
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Total</span>
              <p className="font-medium" data-testid="text-success-total">
                {formatCurrency(total)}
              </p>
            </div>
          )}
          {reference && (
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Reference</span>
              <p className="font-medium">{reference}</p>
            </div>
          )}
        </div>

        {needsVerification && projectId && onNavigate ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const params = new URLSearchParams({ verify: 'true' });
              if (quoteId) params.set('quoteId', quoteId);
              if (scopeId) params.set('scopeId', scopeId);
              onNavigate(`/project/${projectId}/quotes?${params.toString()}`);
            }}
            data-testid="button-review-verify-extraction"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Review & Verify Extraction
          </Button>
        ) : (
          <div className="text-xs text-muted-foreground pt-1">
            View in <FramePill name={frameName} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DocumentClassificationCardProps {
  documentType: string;
  confidence: string;
  coverageSummary?: string;
  fileName?: string;
  vendorName?: string | null;
  date?: string | null;
  reference?: string | null;
  lineItemCount?: number;
  financials?: {
    netTotal: number | null;
    taxAmount: number | null;
    grossTotal: number | null;
  };
  currency?: string;
  recommendedTags?: string[];
}

export function DocumentClassificationCard({
  documentType,
  confidence,
  coverageSummary,
  fileName,
  vendorName,
  date,
  reference,
  lineItemCount,
  financials,
  currency = 'EUR',
  recommendedTags,
}: DocumentClassificationCardProps) {
  const { formatCurrency } = useFormatters();

  const confidenceColorClass =
    confidence === 'high'
      ? 'text-status-approved'
      : confidence === 'medium'
        ? 'text-[var(--signal-warning)]'
        : 'text-destructive';

  const hasFinancials =
    financials &&
    (financials.netTotal !== null ||
      financials.taxAmount !== null ||
      financials.grossTotal !== null);

  return (
    <Card
      className="border-border bg-muted/30"
      data-testid="document-classification-card"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Document Analysis</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
          </Badge>
        </div>

        <div className="text-muted-foreground text-xs">
          Confidence: <span className={confidenceColorClass}>{confidence}</span>
        </div>

        {(reference || date || (lineItemCount !== undefined && lineItemCount > 0)) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {reference && (
              <span data-testid="text-classification-reference">Ref: {reference}</span>
            )}
            {date && (
              <span data-testid="text-classification-date">Date: {date}</span>
            )}
            {lineItemCount !== undefined && lineItemCount > 0 && (
              <span data-testid="text-classification-line-items">{lineItemCount} line items</span>
            )}
          </div>
        )}

        {coverageSummary && (
          <p className="text-xs text-muted-foreground italic">{coverageSummary}</p>
        )}

        {recommendedTags && recommendedTags.length > 0 && (
          <div className="flex flex-wrap gap-1" data-testid="classification-recommended-tags">
            {recommendedTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {vendorName && (
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Vendor</span>
            <p className="font-medium" data-testid="text-classification-vendor">{vendorName}</p>
          </div>
        )}

        {hasFinancials && (
          <div className="border-t border-border/30 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net Amount</span>
              <span>{formatCurrency(financials!.netTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(financials!.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border/20">
              <span>Gross Total</span>
              <span className="text-primary">{formatCurrency(financials!.grossTotal)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PreConfirmSummaryCardProps {
  type: 'quote' | 'invoice';
  fileName?: string;
  scopeName: string;
  vendorName?: string | null;
  total?: number | null;
  currency?: string;
}

export function PreConfirmSummaryCard({
  type,
  fileName,
  scopeName,
  vendorName,
  total,
  currency = 'EUR',
}: PreConfirmSummaryCardProps) {
  const { formatCurrency } = useFormatters();

  const badgeLabel = type === 'quote' ? 'Quote' : 'Invoice';

  return (
    <Card
      className="border-status-pending/20 bg-status-pending-subtle"
      data-testid="preconfirm-summary-card"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-status-pending" />
          <span className="text-sm font-bold text-foreground">Ready to Add</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {badgeLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Scope</span>
            <p className="font-medium" data-testid="text-preconfirm-scope">{scopeName}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Vendor</span>
            <p className="font-medium" data-testid="text-preconfirm-vendor">{vendorName || '\u2014'}</p>
          </div>
          {total !== null && total !== undefined && (
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Total</span>
              <p className="font-medium" data-testid="text-preconfirm-total">{formatCurrency(total)}</p>
            </div>
          )}
        </div>

        {fileName && (
          <p className="text-xs text-muted-foreground">{fileName}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface VersionChoiceCardProps {
  candidates: Array<{
    id: string;
    reference: string;
    vendorName: string | null;
    total: number | null;
    versionNumber: number;
    commitmentStatus: string | null;
  }>;
  documentId: string;
  scopeId: string;
  scopeName: string;
  objectPath?: string;
  vendorName?: string | null;
  total?: number | null;
  currency?: string;
  onConfirmNewQuote: (quoteData: { documentId: string; scopeId: string; scopeName?: string; objectPath?: string }) => void;
  onConfirmNewVersion: (data: { documentId: string; existingQuoteId: string; scopeId?: string; objectPath?: string }) => void;
}

export function VersionChoiceCard({
  candidates,
  documentId,
  scopeId,
  scopeName,
  objectPath,
  currency = 'EUR',
  onConfirmNewQuote,
  onConfirmNewVersion,
}: VersionChoiceCardProps) {
  const { formatCurrency: projectFormatCurrency } = useFormatters();
  const formatCurrency = (value: number | null) => value === null ? null : projectFormatCurrency(value);

  return (
    <Card
      className="border-status-pending/20 bg-status-pending-subtle"
      data-testid="version-choice-card"
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-status-pending" />
          <span className="text-sm font-bold text-foreground">New Quote or New Version?</span>
        </div>

        <p className="text-xs text-muted-foreground">
          This scope already has quotes. You can add this as a separate quote or as a new version of an existing one.
        </p>

        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => onConfirmNewQuote({ documentId, scopeId, scopeName, objectPath })}
          data-testid="button-add-new-quote"
        >
          Add as new quote
        </Button>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Or add as new version of:</span>
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              className="w-full flex items-center gap-2 p-2.5 rounded-md border border-border text-left text-sm hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => onConfirmNewVersion({ documentId, existingQuoteId: candidate.id, scopeId, objectPath })}
              data-testid={`button-version-candidate-${candidate.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium truncate">
                    {candidate.vendorName || 'Unknown vendor'}
                  </span>
                  {candidate.reference && (
                    <span className="text-xs text-muted-foreground truncate">
                      {candidate.reference}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {formatCurrency(candidate.total) && (
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(candidate.total)}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    v{candidate.versionNumber}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-xs font-medium text-muted-foreground">
                <span>Add as v{candidate.versionNumber + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProposalActivityBadgeProps {
  frames: string[];
}

export function ProposalActivityBadge({ frames }: ProposalActivityBadgeProps) {
  if (!frames || frames.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/30 mt-3">
      <span className="text-sm text-foreground">
        Changes pending — affects {frames.map((f, i) => (
          <span key={f}>
            {i > 0 && (i === frames.length - 1 ? ' and ' : ', ')}
            <FramePill name={f} />
          </span>
        ))}
      </span>
    </div>
  );
}
