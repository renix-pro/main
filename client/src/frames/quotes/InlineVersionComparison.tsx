import { useMemo } from 'react';
import { X, ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { QuoteVersion } from './useQuotesData';

interface InlineVersionComparisonProps {
  leftVersion: QuoteVersion;
  rightVersion: QuoteVersion;
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  onClose: () => void;
}

interface LineItemDisplay {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
}

interface MatchedItem {
  type: 'changed' | 'added' | 'removed';
  left: LineItemDisplay | null;
  right: LineItemDisplay | null;
  delta: number;
  deltaPercent: number;
}

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .trim()
    .replace(/^(pos\.?\s*\d+[\s.:/-]*|nr\.?\s*\d+[\s.:/-]*|item\s*\d+[\s.:/-]*)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalizeDescription(a);
  const nb = normalizeDescription(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;

  if (longer.includes(shorter)) return shorter.length / longer.length;

  let matches = 0;
  const longerWords = longer.split(' ');
  const shorterWords = shorter.split(' ');
  for (const sw of shorterWords) {
    if (longerWords.some(lw => lw === sw || lw.includes(sw) || sw.includes(lw))) {
      matches++;
    }
  }
  const wordSimilarity = shorterWords.length > 0 ? matches / Math.max(longerWords.length, shorterWords.length) : 0;

  let commonLen = 0;
  for (let i = 0; i < Math.min(na.length, nb.length); i++) {
    if (na[i] === nb[i]) commonLen++;
    else break;
  }
  const prefixSimilarity = commonLen / longer.length;

  return Math.max(wordSimilarity, prefixSimilarity);
}

function getLineItems(version: QuoteVersion): LineItemDisplay[] {
  if (version.lineItems && version.lineItems.length > 0) {
    return version.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.totalPrice || 0,
    }));
  }
  return [];
}

function matchLineItems(leftItems: LineItemDisplay[], rightItems: LineItemDisplay[]): MatchedItem[] {
  const result: MatchedItem[] = [];
  const usedRight = new Set<number>();

  for (const leftItem of leftItems) {
    let bestIdx = -1;
    let bestScore = 0;

    for (let j = 0; j < rightItems.length; j++) {
      if (usedRight.has(j)) continue;
      const score = similarity(leftItem.description, rightItems[j].description);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0 && bestScore > 0.6) {
      usedRight.add(bestIdx);
      const rightItem = rightItems[bestIdx];
      const delta = rightItem.totalPrice - leftItem.totalPrice;
      const deltaPercent = leftItem.totalPrice !== 0 ? (delta / leftItem.totalPrice) * 100 : 0;
      result.push({ type: 'changed', left: leftItem, right: rightItem, delta, deltaPercent });
    } else {
      result.push({ type: 'removed', left: leftItem, right: null, delta: -leftItem.totalPrice, deltaPercent: -100 });
    }
  }

  for (let j = 0; j < rightItems.length; j++) {
    if (usedRight.has(j)) continue;
    const rightItem = rightItems[j];
    result.push({ type: 'added', left: null, right: rightItem, delta: rightItem.totalPrice, deltaPercent: 100 });
  }

  return result;
}

function StatusBadge({ version }: { version: QuoteVersion }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {version.extractionStatus === 'verified' ? (
        <Badge variant="approved" className="text-xs">Verified</Badge>
      ) : (
        <Badge variant="draft" className="text-xs">Draft</Badge>
      )}
      {version.commitmentStatus !== null && (
        <Badge variant={version.commitmentStatus === 'accepted' ? 'approved' : 'secondary'} className="text-xs">
          {version.commitmentStatus === 'accepted' ? 'Accepted' : version.commitmentStatus === 'superseded' ? 'Superseded' : 'Active'}
        </Badge>
      )}
    </div>
  );
}

function DeltaDisplay({ delta, deltaPercent, formatCurrency }: { delta: number; deltaPercent: number; formatCurrency: (n: number) => string }) {
  if (Math.abs(delta) < 0.01) {
    return <span className="text-muted text-xs" data-testid="delta-unchanged">--</span>;
  }
  const isIncrease = delta > 0;
  return (
    <span
      className={`text-xs font-medium tabular-nums ${isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
      data-testid="delta-value"
    >
      {isIncrease ? '+' : ''}{formatCurrency(delta)}
      {' '}
      ({isIncrease ? '+' : ''}{deltaPercent.toFixed(1)}%)
    </span>
  );
}

export function InlineVersionComparison({
  leftVersion,
  rightVersion,
  formatCurrency,
  currencySymbol,
  onClose,
}: InlineVersionComparisonProps) {
  const leftItems = useMemo(() => getLineItems(leftVersion), [leftVersion]);
  const rightItems = useMemo(() => getLineItems(rightVersion), [rightVersion]);
  const matched = useMemo(() => matchLineItems(leftItems, rightItems), [leftItems, rightItems]);

  const addedCount = matched.filter(m => m.type === 'added').length;
  const removedCount = matched.filter(m => m.type === 'removed').length;
  const changedCount = matched.filter(m => m.type === 'changed' && Math.abs(m.delta) >= 0.01).length;

  const leftTotal = leftVersion.total || 0;
  const rightTotal = rightVersion.total || 0;
  const totalDelta = rightTotal - leftTotal;
  const totalDeltaPercent = leftTotal !== 0 ? (totalDelta / leftTotal) * 100 : 0;

  return (
    <Card className="border-subtle mx-3 mb-3" data-testid="inline-version-comparison">
      <CardHeader className="py-3 border-b border-subtle flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider">
          Version Comparison: v{leftVersion.versionNumber} vs v{rightVersion.versionNumber}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-comparison"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Desktop: two-column grid */}
        <div className="hidden md:block" data-testid="comparison-desktop">
          {/* Version headers */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-4 mb-4 pb-3 border-b border-subtle">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">v{leftVersion.versionNumber}</span>
                <StatusBadge version={leftVersion} />
              </div>
              <div className="text-sm text-muted tabular-nums" data-testid="text-left-total">
                Total: {formatCurrency(leftTotal)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">v{rightVersion.versionNumber}</span>
                <StatusBadge version={rightVersion} />
              </div>
              <div className="text-sm text-muted tabular-nums" data-testid="text-right-total">
                Total: {formatCurrency(rightTotal)}
              </div>
            </div>
            <div className="flex items-center min-w-[120px]">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">Delta</span>
            </div>
          </div>

          {/* Line items comparison table */}
          <div className="space-y-1">
            {matched.map((item, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-[1fr_1fr_auto] gap-4 py-2 px-2 rounded-md text-sm ${
                  item.type === 'added' ? 'bg-green-50 dark:bg-green-950/20' :
                  item.type === 'removed' ? 'bg-red-50 dark:bg-red-950/20' : ''
                }`}
                data-testid={`comparison-row-${idx}`}
              >
                <div className={item.type === 'removed' ? '' : item.type === 'added' ? 'text-muted' : ''}>
                  {item.left ? (
                    <div className={item.type === 'removed' ? 'line-through text-muted' : ''}>
                      <span className="text-xs">{item.left.description}</span>
                      <div className="tabular-nums text-xs text-muted">
                        {item.left.quantity != null && <span>{item.left.quantity} {item.left.unit || ''} </span>}
                        <span>{formatCurrency(item.left.totalPrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted text-xs italic">--</span>
                  )}
                </div>
                <div>
                  {item.right ? (
                    <div className={item.type === 'added' ? 'font-medium' : ''}>
                      <span className="text-xs">{item.type === 'added' ? '+ ' : ''}{item.right.description}</span>
                      <div className="tabular-nums text-xs text-muted">
                        {item.right.quantity != null && <span>{item.right.quantity} {item.right.unit || ''} </span>}
                        <span>{formatCurrency(item.right.totalPrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted text-xs italic">--</span>
                  )}
                </div>
                <div className="flex items-center min-w-[120px]">
                  <DeltaDisplay delta={item.delta} deltaPercent={item.deltaPercent} formatCurrency={formatCurrency} />
                </div>
              </div>
            ))}
            {matched.length === 0 && (
              <p className="text-sm text-muted italic py-4 text-center">No line items to compare.</p>
            )}
          </div>
        </div>

        {/* Mobile: Tabs layout */}
        <div className="md:hidden" data-testid="comparison-mobile">
          <Tabs defaultValue="left">
            <TabsList className="w-full border border-subtle" data-testid="comparison-tabs-list">
              <TabsTrigger value="left" className="flex-1" data-testid="tab-trigger-left-version">
                v{leftVersion.versionNumber}
              </TabsTrigger>
              <TabsTrigger value="right" className="flex-1" data-testid="tab-trigger-right-version">
                v{rightVersion.versionNumber}
              </TabsTrigger>
              <TabsTrigger value="changes" className="flex-1" data-testid="tab-trigger-changes">
                Changes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="left" className="mt-3">
              <div className="space-y-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">v{leftVersion.versionNumber}</span>
                  <StatusBadge version={leftVersion} />
                </div>
                <div className="text-sm text-muted tabular-nums">Total: {formatCurrency(leftTotal)}</div>
              </div>
              <div className="space-y-2">
                {leftItems.map((item, idx) => (
                  <div key={idx} className="py-1.5 border-b border-subtle last:border-0" data-testid={`mobile-left-item-${idx}`}>
                    <span className="text-xs">{item.description}</span>
                    <div className="tabular-nums text-xs text-muted">
                      {item.quantity != null && <span>{item.quantity} {item.unit || ''} </span>}
                      <span>{formatCurrency(item.totalPrice)}</span>
                    </div>
                  </div>
                ))}
                {leftItems.length === 0 && <p className="text-sm text-muted italic">No line items.</p>}
              </div>
            </TabsContent>

            <TabsContent value="right" className="mt-3">
              <div className="space-y-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">v{rightVersion.versionNumber}</span>
                  <StatusBadge version={rightVersion} />
                </div>
                <div className="text-sm text-muted tabular-nums">Total: {formatCurrency(rightTotal)}</div>
              </div>
              <div className="space-y-2">
                {rightItems.map((item, idx) => (
                  <div key={idx} className="py-1.5 border-b border-subtle last:border-0" data-testid={`mobile-right-item-${idx}`}>
                    <span className="text-xs">{item.description}</span>
                    <div className="tabular-nums text-xs text-muted">
                      {item.quantity != null && <span>{item.quantity} {item.unit || ''} </span>}
                      <span>{formatCurrency(item.totalPrice)}</span>
                    </div>
                  </div>
                ))}
                {rightItems.length === 0 && <p className="text-sm text-muted italic">No line items.</p>}
              </div>
            </TabsContent>

            <TabsContent value="changes" className="mt-3">
              <div className="space-y-2">
                {matched.map((item, idx) => (
                  <div
                    key={idx}
                    className={`py-2 px-2 rounded-md text-sm ${
                      item.type === 'added' ? 'bg-green-50 dark:bg-green-950/20' :
                      item.type === 'removed' ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                    data-testid={`mobile-change-${idx}`}
                  >
                    {item.type === 'added' && item.right && (
                      <div>
                        <span className="text-xs text-green-700 dark:text-green-300 font-medium">+ {item.right.description}</span>
                        <div className="tabular-nums text-xs text-muted">{formatCurrency(item.right.totalPrice)}</div>
                      </div>
                    )}
                    {item.type === 'removed' && item.left && (
                      <div>
                        <span className="text-xs text-red-700 dark:text-red-300 line-through">{item.left.description}</span>
                        <div className="tabular-nums text-xs text-muted">{formatCurrency(item.left.totalPrice)}</div>
                      </div>
                    )}
                    {item.type === 'changed' && item.left && item.right && (
                      <div>
                        <span className="text-xs">{item.left.description}</span>
                        {Math.abs(item.delta) >= 0.01 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs tabular-nums text-muted">{formatCurrency(item.left.totalPrice)}</span>
                            <ArrowRight className="w-3 h-3 text-muted" />
                            <span className="text-xs tabular-nums">{formatCurrency(item.right.totalPrice)}</span>
                            <DeltaDisplay delta={item.delta} deltaPercent={item.deltaPercent} formatCurrency={formatCurrency} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {matched.length === 0 && <p className="text-sm text-muted italic">No changes to display.</p>}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Summary strip */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-3 border-t border-subtle" data-testid="comparison-summary">
          <div className="flex items-center gap-3 flex-wrap">
            {addedCount > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400" data-testid="summary-added">
                +{addedCount} item{addedCount !== 1 ? 's' : ''} added
              </span>
            )}
            {removedCount > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400" data-testid="summary-removed">
                -{removedCount} item{removedCount !== 1 ? 's' : ''} removed
              </span>
            )}
            {changedCount > 0 && (
              <span className="text-xs text-muted" data-testid="summary-changed">
                {changedCount} item{changedCount !== 1 ? 's' : ''} changed
              </span>
            )}
            {addedCount === 0 && removedCount === 0 && changedCount === 0 && (
              <span className="text-xs text-muted">No differences found</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalDelta > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : totalDelta < 0 ? (
              <TrendingDown className="w-4 h-4 text-green-500" />
            ) : (
              <Minus className="w-4 h-4 text-muted" />
            )}
            <span className="text-sm font-medium tabular-nums" data-testid="summary-total-delta">
              Net: {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}
              {leftTotal !== 0 && ` (${totalDeltaPercent >= 0 ? '+' : ''}${totalDeltaPercent.toFixed(1)}%)`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
