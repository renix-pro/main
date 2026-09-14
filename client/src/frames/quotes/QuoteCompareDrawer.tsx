import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ArrowDown, ArrowUp, Minus, Sparkles, Check, X, ArrowLeftRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RenixLoader } from '@/components/RenixLoader';
import type { Quote, Vendor, QuoteVersion } from './useQuotesData';

function getActiveVersion(versions: any[]) {
  return versions?.find((v: any) => v.commitmentStatus === 'active')
    || versions?.find((v: any) => v.commitmentStatus === 'accepted')
    || versions?.[0];
}

interface QuoteWithContext {
  quote: Quote;
  vendor: Vendor | undefined;
  version: QuoteVersion | undefined;
  total: number;
}

interface AlignedRow {
  left: { description: string; totalPrice: number | null; id: string } | null;
  right: { description: string; totalPrice: number | null; id: string } | null;
}

function buildAlignedRows(leftItems: any[], rightItems: any[]): AlignedRow[] {
  const maxLen = Math.max(leftItems.length, rightItems.length);
  const rows: AlignedRow[] = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push({
      left: leftItems[i] ? { description: leftItems[i].description, totalPrice: leftItems[i].totalPrice, id: leftItems[i].id } : null,
      right: rightItems[i] ? { description: rightItems[i].description, totalPrice: rightItems[i].totalPrice, id: rightItems[i].id } : null,
    });
  }
  return rows;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === 'active') return <Badge data-testid="compare-badge-active">Active</Badge>;
  if (status === 'superseded') return <Badge variant="secondary" className="opacity-60" data-testid="compare-badge-superseded">Superseded</Badge>;
  if (status === 'accepted') return <Badge variant="approved" data-testid="compare-badge-accepted">Accepted</Badge>;
  return null;
}

interface AIComparisonInsightProps {
  projectId: string;
  quoteIds: string[];
}

function AIComparisonInsight({ projectId, quoteIds }: AIComparisonInsightProps) {
  const sortedIds = useMemo(() => [...quoteIds].sort(), [quoteIds]);

  const { data, isLoading, error } = useQuery<{ insights: string[] }>({
    queryKey: ['/api/projects', projectId, 'quotes', 'compare-insight', ...sortedIds],
    queryFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/quotes/compare-insight`, { quoteIds: sortedIds });
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (error) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30" data-testid="ai-insight-loading">
        <RenixLoader size="sm" />
        <span className="text-sm text-muted-foreground">Analyzing quotes...</span>
      </div>
    );
  }

  if (!data?.insights?.length) return null;

  return (
    <div className="rounded-lg border border-accent-copper/30 bg-accent-copper/5 p-4 space-y-2" data-testid="ai-comparison-insight">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-accent-copper" />
        AI Comparison Insight
      </div>
      <ul className="space-y-1.5">
        {data.insights.map((insight, i) => (
          <li key={i} className="text-sm text-muted-foreground leading-relaxed pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-accent-copper" data-testid={`ai-insight-bullet-${i}`}>
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface QuoteCompareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: Quote[];
  vendors: Vendor[];
  formatCurrency: (amount: number) => string;
  projectId?: string;
  onAcceptVersion?: (quote: Quote, version: QuoteVersion) => void;
  onToggleCommitmentStatus?: (quoteId: string, versionId: string, newStatus: 'active' | 'superseded') => void;
  isReadOnly?: boolean;
}

export function QuoteCompareDrawer({
  open,
  onOpenChange,
  quotes,
  vendors,
  formatCurrency,
  projectId,
  onAcceptVersion,
  onToggleCommitmentStatus,
  isReadOnly,
}: QuoteCompareDrawerProps) {
  const [mobileTab, setMobileTab] = useState(0);

  const quotesWithTotals: QuoteWithContext[] = useMemo(() => {
    return quotes.map(q => {
      const version = getActiveVersion(q.versions);
      const vendor = vendors.find(v => v.id === q.vendorId);
      return {
        quote: q,
        vendor,
        version,
        total: version?.total ?? 0,
      };
    });
  }, [quotes, vendors]);

  const { lowest, highest } = useMemo(() => {
    if (quotesWithTotals.length === 0) return { lowest: 0, highest: 0 };
    const totals = quotesWithTotals.map(q => q.total);
    return {
      lowest: Math.min(...totals),
      highest: Math.max(...totals),
    };
  }, [quotesWithTotals]);

  const delta = useMemo(() => {
    if (quotesWithTotals.length !== 2) return null;
    return quotesWithTotals[1].total - quotesWithTotals[0].total;
  }, [quotesWithTotals]);

  const alignedRows = useMemo(() => {
    if (quotesWithTotals.length !== 2) return [];
    const leftItems = quotesWithTotals[0].version?.lineItems || [];
    const rightItems = quotesWithTotals[1].version?.lineItems || [];
    return buildAlignedRows(leftItems, rightItems);
  }, [quotesWithTotals]);

  const quoteIds = useMemo(() => quotes.map(q => q.id), [quotes]);

  const isTwoQuotes = quotesWithTotals.length === 2;

  function getTotalClassName(total: number) {
    const isLowest = total === lowest && quotesWithTotals.length > 1;
    const isHighest = total === highest && quotesWithTotals.length > 1 && lowest !== highest;
    if (isLowest) return 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950';
    if (isHighest) return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950';
    return 'border-border bg-muted/30';
  }

  function getTotalLabel(total: number) {
    const isLowest = total === lowest && quotesWithTotals.length > 1;
    const isHighest = total === highest && quotesWithTotals.length > 1 && lowest !== highest;
    if (isLowest) return { text: 'Lowest', icon: ArrowDown, className: 'text-green-700 dark:text-green-400' };
    if (isHighest) return { text: 'Highest', icon: ArrowUp, className: 'text-red-700 dark:text-red-400' };
    return null;
  }

  function renderQuoteActions(qc: QuoteWithContext) {
    if (isReadOnly || !qc.version) return null;
    const cs = qc.version.commitmentStatus;
    const es = qc.version.extractionStatus;
    const canAccept = cs === 'active' && es === 'verified' && onAcceptVersion;
    const canSupersede = cs === 'active' && es === 'verified' && onToggleCommitmentStatus;
    const canReactivate = cs === 'superseded' && es === 'verified' && onToggleCommitmentStatus;

    if (!canAccept && !canSupersede && !canReactivate) return null;

    return (
      <div className="flex gap-2 flex-wrap pt-2">
        {canAccept && (
          <Button
            size="sm"
            onClick={() => onAcceptVersion!(qc.quote, qc.version!)}
            data-testid={`button-accept-${qc.quote.id}`}
          >
            <Check className="h-4 w-4 mr-1" />
            Accept Quote
          </Button>
        )}
        {canSupersede && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleCommitmentStatus!(qc.quote.id, qc.version!.id, 'superseded')}
            data-testid={`button-supersede-${qc.quote.id}`}
          >
            <X className="h-4 w-4 mr-1" />
            Supersede
          </Button>
        )}
        {canReactivate && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleCommitmentStatus!(qc.quote.id, qc.version!.id, 'active')}
            data-testid={`button-reactivate-${qc.quote.id}`}
          >
            Reactivate
          </Button>
        )}
      </div>
    );
  }

  function renderQuoteHeader(qc: QuoteWithContext) {
    const label = getTotalLabel(qc.total);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground" data-testid={`compare-vendor-${qc.quote.id}`}>
            {qc.vendor?.name || 'Unknown Vendor'}
          </span>
          {qc.version?.versionNumber != null && (
            <Badge variant="outline" className="text-xs" data-testid={`compare-version-${qc.quote.id}`}>
              v{qc.version.versionNumber}
            </Badge>
          )}
          <StatusBadge status={qc.version?.commitmentStatus} />
        </div>
        <div className={`rounded-md border p-3 ${getTotalClassName(qc.total)}`} data-testid={`total-bar-${qc.quote.id}`}>
          <div className="text-2xl font-bold tabular-nums text-foreground" data-testid={`total-amount-${qc.quote.id}`}>
            {formatCurrency(qc.total)}
          </div>
          {label && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${label.className}`} data-testid={`total-label-${qc.quote.id}`}>
              <label.icon className="h-3 w-3" />
              {label.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden p-0"
        data-testid="quote-compare-drawer"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-2 flex-wrap" data-testid="compare-drawer-header">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            <DialogTitle data-testid="compare-drawer-title">Compare Quotes</DialogTitle>
            <Badge variant="secondary" data-testid="compare-drawer-count">
              {quotes.length}
            </Badge>
          </div>
          <DialogDescription className="sr-only">Side by side quote comparison</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {projectId && quoteIds.length >= 2 && (
            <AIComparisonInsight projectId={projectId} quoteIds={quoteIds} />
          )}

          {delta !== null && (
            <div
              className={`flex items-center justify-center gap-2 text-sm rounded-md border p-2.5 ${
                delta > 0
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                  : delta < 0
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                    : 'border-border bg-muted/30 text-muted-foreground'
              }`}
              data-testid="delta-display"
            >
              {delta > 0 ? <ArrowUp className="h-4 w-4" /> : delta < 0 ? <ArrowDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              <span className="font-medium tabular-nums" data-testid="delta-amount">
                {delta === 0 ? 'No difference' : `${delta > 0 ? '+' : ''}${formatCurrency(Math.abs(delta))} difference`}
              </span>
            </div>
          )}

          {/* Mobile: Tab toggle for 2-quote comparison */}
          {isTwoQuotes && (
            <div className="md:hidden flex rounded-lg border border-border overflow-hidden" data-testid="mobile-tab-toggle">
              {quotesWithTotals.map((qc, idx) => (
                <button
                  key={qc.quote.id}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    mobileTab === idx
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => setMobileTab(idx)}
                  data-testid={`mobile-tab-${idx}`}
                >
                  {qc.vendor?.name || `Quote ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Desktop: Side-by-side headers */}
          {isTwoQuotes && (
            <div className="hidden md:grid md:grid-cols-2 gap-4" data-testid="desktop-headers">
              {quotesWithTotals.map(qc => (
                <div key={qc.quote.id} className="space-y-2">
                  {renderQuoteHeader(qc)}
                  {renderQuoteActions(qc)}
                </div>
              ))}
            </div>
          )}

          {/* Mobile: Show active tab header */}
          {isTwoQuotes && (
            <div className="md:hidden" data-testid="mobile-header">
              {renderQuoteHeader(quotesWithTotals[mobileTab])}
              {renderQuoteActions(quotesWithTotals[mobileTab])}
            </div>
          )}

          {/* Desktop: Aligned line items table */}
          {isTwoQuotes && alignedRows.length > 0 && (
            <div className="hidden md:block border border-border rounded-lg overflow-hidden" data-testid="aligned-line-items">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground w-[35%]">
                      {quotesWithTotals[0].vendor?.name || 'Quote A'}
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground w-[15%]">Amount</th>
                    <th className="text-left p-3 font-medium text-muted-foreground w-[35%] border-l border-border">
                      {quotesWithTotals[1].vendor?.name || 'Quote B'}
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground w-[15%]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {alignedRows.map((row, idx) => {
                    const leftPrice = row.left?.totalPrice;
                    const rightPrice = row.right?.totalPrice;
                    const hasBoth = leftPrice != null && rightPrice != null;
                    const priceDiff = hasBoth ? rightPrice - leftPrice : null;

                    return (
                      <tr
                        key={idx}
                        className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                        data-testid={`aligned-row-${idx}`}
                      >
                        <td className={`p-3 text-foreground ${!row.left ? 'bg-muted/10' : ''}`}>
                          {row.left?.description || <span className="text-muted-foreground/40 italic">—</span>}
                        </td>
                        <td className={`p-3 text-right tabular-nums text-foreground ${!row.left ? 'bg-muted/10' : ''}`}>
                          {row.left?.totalPrice != null ? formatCurrency(row.left.totalPrice) : ''}
                          {priceDiff != null && priceDiff !== 0 && (
                            <div className={`text-xs mt-0.5 ${priceDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {priceDiff > 0 ? `${formatCurrency(priceDiff)} less` : `${formatCurrency(Math.abs(priceDiff))} more`}
                            </div>
                          )}
                        </td>
                        <td className={`p-3 text-foreground border-l border-border ${!row.right ? 'bg-muted/10' : ''}`}>
                          {row.right?.description || <span className="text-muted-foreground/40 italic">—</span>}
                        </td>
                        <td className={`p-3 text-right tabular-nums text-foreground ${!row.right ? 'bg-muted/10' : ''}`}>
                          {row.right?.totalPrice != null ? formatCurrency(row.right.totalPrice) : ''}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-3 text-foreground">Total</td>
                    <td className="p-3 text-right tabular-nums text-foreground" data-testid="aligned-total-left">
                      {formatCurrency(quotesWithTotals[0].total)}
                    </td>
                    <td className="p-3 text-foreground border-l border-border">Total</td>
                    <td className="p-3 text-right tabular-nums text-foreground" data-testid="aligned-total-right">
                      {formatCurrency(quotesWithTotals[1].total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile: Line items for active tab */}
          {isTwoQuotes && (
            <div className="md:hidden" data-testid="mobile-line-items">
              {(() => {
                const items = quotesWithTotals[mobileTab]?.version?.lineItems || [];
                if (items.length === 0) return (
                  <div className="text-sm text-muted-foreground text-center py-4">No line items</div>
                );
                return (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left p-2.5 font-medium text-muted-foreground">Description</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-border last:border-b-0" data-testid={`mobile-line-item-${item.id}`}>
                            <td className="p-2.5 text-foreground">{item.description}</td>
                            <td className="p-2.5 text-right tabular-nums text-foreground">
                              {item.totalPrice != null ? formatCurrency(item.totalPrice) : '—'}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-semibold">
                          <td className="p-2.5 text-foreground">Total</td>
                          <td className="p-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(quotesWithTotals[mobileTab].total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Fallback: stacked layout for 3+ quotes */}
          {!isTwoQuotes && quotesWithTotals.map((qc, idx) => (
            <div key={qc.quote.id} data-testid={`compare-section-${qc.quote.id}`}>
              {idx > 0 && <div className="border-t border-border my-4" />}
              {renderQuoteHeader(qc)}
              {renderQuoteActions(qc)}
              {(qc.version?.lineItems || []).length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Description</th>
                        <th className="text-right p-2.5 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(qc.version?.lineItems || []).map(item => (
                        <tr key={item.id} className="border-b border-border last:border-b-0" data-testid={`compare-line-item-${item.id}`}>
                          <td className="p-2.5 text-foreground">{item.description}</td>
                          <td className="p-2.5 text-right tabular-nums text-foreground">
                            {item.totalPrice != null ? formatCurrency(item.totalPrice) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
