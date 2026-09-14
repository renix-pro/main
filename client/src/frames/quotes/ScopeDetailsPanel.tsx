import { useMemo, useState, useCallback, useEffect } from 'react';
import { MessageSquare, Check, Eye, GitCompare, X, MoreHorizontal, Trash2, ArrowLeftRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject, useFormatters } from '../../context/ProjectContext';
import { useScopeTreeData } from '@/frames/scope/useScopeTreeData';
import { useQuotesData, type Quote, type Vendor, type QuoteVersion, isQuoteCommitted, isQuotePending } from './useQuotesData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { QuoteDetailPanel } from './QuoteDetailPanel';
import { QuoteCompareDrawer } from './QuoteCompareDrawer';
import { useToast } from '@/hooks/use-toast';

function getActiveVersion(versions: any[]) {
  return versions?.find((v: any) => v.commitmentStatus === 'active')
    || versions?.find((v: any) => v.commitmentStatus === 'accepted')
    || versions?.[0];
}



interface QuoteCardProps {
  quote: Quote;
  vendor: Vendor | undefined;
  formatCurrency: (amount: number) => string;
  onViewDetails: () => void;
  onCompare: () => void;
  onDeleteQuote?: () => void;
  isCompareMode: boolean;
  isSelectedForCompare: boolean;
  onToggleCompare: () => void;
  onToggleCommitmentStatus?: (quoteId: string, versionId: string, newStatus: 'active' | 'superseded') => void;
  isTogglingStatus?: boolean;
  scopeQuoteCount?: number;
}

function QuoteCard({ quote, vendor, formatCurrency, onViewDetails, onCompare, onDeleteQuote, isCompareMode, isSelectedForCompare, onToggleCompare, onToggleCommitmentStatus, isTogglingStatus, scopeQuoteCount }: QuoteCardProps) {
  const version = getActiveVersion(quote.versions);
  const commitmentStatus = version?.commitmentStatus;
  const extractionStatus = version?.extractionStatus;
  const versionNumber = version?.versionNumber;
  const total = version?.total;
  const validUntil = version?.validUntil;
  const isSuperseded = commitmentStatus === 'superseded';
  const isAccepted = commitmentStatus === 'accepted';
  const isActive = commitmentStatus === 'active';
  const isPendingVerification = commitmentStatus === null;
  const isVerified = extractionStatus === 'verified';
  const hasSiblings = (scopeQuoteCount ?? 0) > 1;
  const canToggle = isVerified && isActive && hasSiblings && version?.id && onToggleCommitmentStatus;

  return (
    <Card
      className={`${isSuperseded ? 'opacity-60' : ''} ${isCompareMode && isSelectedForCompare ? 'ring-2 ring-primary' : ''}`}
      data-testid={`quote-card-${quote.id}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          {isCompareMode && (
            <div className="pt-1 flex-shrink-0" data-testid={`compare-checkbox-wrapper-${quote.id}`}>
              <Checkbox
                checked={isSelectedForCompare}
                onCheckedChange={onToggleCompare}
                data-testid={`checkbox-compare-${quote.id}`}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground" data-testid={`text-vendor-${quote.id}`}>
                    {vendor?.name || 'Unknown Vendor'}
                  </span>
                  {versionNumber != null && (quote.versions?.length ?? 0) > 1 && (
                    <Badge variant="outline" className="text-xs" data-testid={`badge-version-${quote.id}`}>
                      v{versionNumber}
                    </Badge>
                  )}
                  {isPendingVerification && (
                    <Badge
                      variant="draft"
                      data-testid={`badge-draft-${quote.id}`}
                    >
                      Draft
                    </Badge>
                  )}
                  {extractionStatus === 'draft' && (
                    <Badge
                      variant="outline"
                      className="text-xs border-status-pending text-status-pending"
                      data-testid={`badge-needs-verification-${quote.id}`}
                    >
                      Needs Verification
                    </Badge>
                  )}
                  {isActive && (
                    <Badge
                      className={`${canToggle ? 'cursor-pointer' : ''} ${isTogglingStatus ? 'opacity-50 pointer-events-none' : ''}`}
                      title={canToggle ? 'Click to supersede' : undefined}
                      onClick={canToggle ? () => onToggleCommitmentStatus!(quote.id, version!.id, 'superseded') : undefined}
                      data-testid={`badge-active-${quote.id}`}
                    >
                      Active
                    </Badge>
                  )}
                  {isSuperseded && (
                    <Badge
                      variant="secondary"
                      className={`${canToggle ? 'cursor-pointer' : ''} ${isTogglingStatus ? 'opacity-50 pointer-events-none' : ''}`}
                      title={canToggle ? 'Click to set as active' : undefined}
                      onClick={canToggle ? () => onToggleCommitmentStatus!(quote.id, version!.id, 'active') : undefined}
                      data-testid={`badge-superseded-${quote.id}`}
                    >
                      Superseded
                    </Badge>
                  )}
                  {isAccepted && (
                    <Badge variant="approved" data-testid={`badge-accepted-${quote.id}`}>
                      Accepted
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold text-foreground ${isSuperseded ? 'line-through' : ''}`} data-testid={`text-total-${quote.id}`}>
                  {total != null ? formatCurrency(total) : '\u2014'}
                </div>
                <div className="text-sm text-muted-foreground" data-testid={`text-valid-${quote.id}`}>
                  {validUntil ? `Valid until ${new Date(validUntil).toLocaleDateString()}` : '\u2014'}
                </div>
              </div>
            </div>

            {!isCompareMode && (
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={onViewDetails}
                  data-testid={`button-view-quote-${quote.id}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View details
                </Button>
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={onCompare}
                  data-testid={`button-compare-quote-${quote.id}`}
                >
                  <GitCompare className="h-4 w-4 mr-1" />
                  Compare
                </Button>
                {!isAccepted && onDeleteQuote && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 ml-auto"
                        data-testid={`button-quote-menu-${quote.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
                        onClick={onDeleteQuote}
                        data-testid={`menu-delete-quote-${quote.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete quote
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScopeActionsProps {
  quotes: Quote[];
  onAskAI: () => void;
  onCommit: () => void;
}

function ScopeActions({ quotes, onAskAI, onCommit }: ScopeActionsProps) {
  const hasActionableQuotes = quotes.some(q => isQuotePending(q));

  return (
    <div className="border-t border-border pt-4 flex flex-wrap gap-2" data-testid="scope-actions">
      <Button 
        variant="ghost"
        size="sm"
        onClick={onAskAI}
        data-testid="button-ask-ai"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Ask AI
      </Button>

      <Button
        disabled={!hasActionableQuotes}
        onClick={onCommit}
        size="sm"
        data-testid="button-commit-quote"
      >
        <Check className="h-4 w-4 mr-2" />
        Commit Quote
      </Button>
    </div>
  );
}

interface LineageGroup {
  lineageId: string;
  quotes: Quote[];
}

function groupByLineage(quotes: Quote[]): LineageGroup[] {
  const lineageMap = new Map<string, Quote[]>();
  const noLineage: Quote[] = [];

  for (const q of quotes) {
    const lid = q.lineageId;
    if (lid) {
      const group = lineageMap.get(lid) || [];
      group.push(q);
      lineageMap.set(lid, group);
    } else {
      noLineage.push(q);
    }
  }

  const groups: LineageGroup[] = [];

  for (const [lineageId, groupQuotes] of Array.from(lineageMap.entries())) {
    groupQuotes.sort((a: Quote, b: Quote) => {
      const vA = getActiveVersion(a.versions)?.versionNumber ?? 0;
      const vB = getActiveVersion(b.versions)?.versionNumber ?? 0;
      return vB - vA;
    });
    groups.push({ lineageId, quotes: groupQuotes });
  }

  for (const q of noLineage) {
    groups.push({ lineageId: q.id, quotes: [q] });
  }

  return groups;
}

interface ScopeDetailsPanelProps {
  scopeId: string;
  onViewQuoteDetails?: (quoteId: string) => void;
  onCompareQuote?: (quoteId: string) => void;
  onAskAI?: () => void;
  onCommitQuote?: () => void;
  onAddVersion?: (quoteId: string) => void;
  onAcceptVersion?: (quote: Quote, version: QuoteVersion) => void;
  onDeleteQuote?: (quoteId: string) => void;
  openQuoteId?: string;
  openInEditMode?: boolean;
}

export function ScopeDetailsPanel({ 
  scopeId, 
  onViewQuoteDetails,
  onCompareQuote,
  onAskAI,
  onCommitQuote,
  onAddVersion,
  onAcceptVersion,
  onDeleteQuote,
  openQuoteId,
  openInEditMode,
}: ScopeDetailsPanelProps) {
  const { projectId, isReadOnly, currency } = useProject();
  const { formatCurrency } = useFormatters();
  const quotes = useQuotesData(projectId, currency, isReadOnly);
  const scopeTree = useScopeTreeData(projectId, isReadOnly);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);

  // Programmatic open: when a parent passes openQuoteId (e.g. from deep-link navigation),
  // open that quote's sheet immediately on mount.
  useEffect(() => {
    if (openQuoteId) {
      setDetailQuoteId(openQuoteId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [showCompareDrawer, setShowCompareDrawer] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const scope = scopeTree.nodes.find(n => n.id === scopeId);
  const allQuotes = quotes.data?.quotes || [];
  const scopeQuotes = useMemo(() => {
    return allQuotes.filter(q => q.scopeId === scopeId);
  }, [allQuotes, scopeId]);
  
  const vendors = quotes.data?.vendors || [];
  const detailQuote = detailQuoteId ? allQuotes.find(q => q.id === detailQuoteId) ?? null : null;
  const detailVendor = detailQuote ? vendors.find(v => v.id === detailQuote.vendorId) : undefined;

  const activeCount = scopeQuotes.filter(q => getActiveVersion(q.versions)?.commitmentStatus === 'active').length;
  const supersededCount = scopeQuotes.filter(q => getActiveVersion(q.versions)?.commitmentStatus === 'superseded').length;
  const acceptedCount = scopeQuotes.filter(q => getActiveVersion(q.versions)?.commitmentStatus === 'accepted').length;
  const pendingCount = scopeQuotes.filter(q => getActiveVersion(q.versions)?.commitmentStatus == null).length;

  const comparableQuotes = useMemo(() => {
    return scopeQuotes.filter(q => {
      const v = getActiveVersion(q.versions);
      return v && (v.commitmentStatus === 'active' || v.extractionStatus === 'verified');
    });
  }, [scopeQuotes]);

  const lineageGroups = useMemo(() => groupByLineage(scopeQuotes), [scopeQuotes]);

  const selectedQuotes = useMemo(() => {
    return scopeQuotes.filter(q => selectedForCompare.has(q.id));
  }, [scopeQuotes, selectedForCompare]);

  const handleViewDetails = (quoteId: string) => {
    setDetailQuoteId(quoteId);
  };

  const handleCompare = (quoteId: string) => {
    setCompareMode(true);
    setSelectedForCompare(new Set([quoteId]));
  };

  const handleToggleCompare = (quoteId: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else if (next.size < 2) {
        next.add(quoteId);
      } else {
        const oldest = next.values().next().value;
        if (oldest !== undefined) next.delete(oldest);
        next.add(quoteId);
      }
      return next;
    });
  };

  const handleCancelCompare = () => {
    setCompareMode(false);
    setSelectedForCompare(new Set());
    setShowCompareDrawer(false);
  };

  const handleOpenCompareDrawer = () => {
    setShowCompareDrawer(true);
  };

  const handleQuickCompare = useCallback(() => {
    if (comparableQuotes.length === 2) {
      setSelectedForCompare(new Set(comparableQuotes.map(q => q.id)));
      setShowCompareDrawer(true);
    } else if (comparableQuotes.length > 2) {
      const recent = comparableQuotes.slice(0, 2);
      setCompareMode(true);
      setSelectedForCompare(new Set(recent.map(q => q.id)));
    }
  }, [comparableQuotes]);

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI();
    }
  };

  const handleCommit = () => {
    if (onCommitQuote) {
      onCommitQuote();
    }
  };

  const handleToggleCommitmentStatus = useCallback(async (quoteId: string, versionId: string, newStatus: 'active' | 'superseded') => {
    if (isTogglingStatus) return;

    const targetQuote = allQuotes.find(q => q.id === quoteId);
    const targetVersion = targetQuote?.versions?.find((v: any) => v.id === versionId);
    if (!targetVersion || targetVersion.extractionStatus !== 'verified' || targetVersion.commitmentStatus !== 'active') return;

    setIsTogglingStatus(true);
    try {
      if (newStatus === 'active') {
        if (targetQuote?.lineageId) {
          const siblingsInLineage = allQuotes.filter(q => q.lineageId === targetQuote.lineageId && q.id !== quoteId);
          for (const sibling of siblingsInLineage) {
            const siblingVersion = getActiveVersion(sibling.versions);
            if (siblingVersion?.commitmentStatus === 'active') {
              const sibRes = await fetch(`/api/projects/${projectId}/versions/${siblingVersion.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ commitmentStatus: 'superseded' }),
              });
              if (!sibRes.ok) throw new Error('Failed to supersede sibling quote');
            }
          }
        }
      }

      const response = await fetch(`/api/projects/${projectId}/versions/${versionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commitmentStatus: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      await queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
      toast({ title: `Quote ${newStatus === 'active' ? 'activated' : 'superseded'}` });
    } catch (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    } finally {
      setIsTogglingStatus(false);
    }
  }, [allQuotes, projectId, queryClient, toast, isTogglingStatus]);

  if (!scope) {
    return (
      <Card data-testid="scope-not-found">
        <CardContent className="py-8 text-center">
          <div className="text-muted-foreground">Scope not found</div>
        </CardContent>
      </Card>
    );
  }

  const statusParts: string[] = [];
  if (activeCount > 0) statusParts.push(`${activeCount} active`);
  if (supersededCount > 0) statusParts.push(`${supersededCount} superseded`);
  if (acceptedCount > 0) statusParts.push(`${acceptedCount} accepted`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} pending`);

  return (
    <Card className="mt-4 animate-in fade-in-0 slide-in-from-top-2 duration-200" data-testid="scope-details-panel">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-scope-title">{scope.name}</h2>
            <div className="mt-1 flex gap-1 text-sm text-muted-foreground flex-wrap" data-testid="text-scope-counts">
              <span data-testid="text-quotes-count">{scopeQuotes.length} quote{scopeQuotes.length !== 1 ? 's' : ''}</span>
              {statusParts.map((part, i) => (
                <span key={i}>
                  <span className="text-muted-foreground/40">&middot;</span> {part}
                </span>
              ))}
            </div>
          </div>
          {comparableQuotes.length >= 2 && !compareMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickCompare}
              data-testid="button-quick-compare"
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Compare Quotes
            </Button>
          )}
        </div>

        <div className="space-y-4" data-testid="quotes-list">
          {lineageGroups.length > 0 ? (
            lineageGroups.map((group, groupIdx) => (
              <div key={group.lineageId} data-testid={`lineage-group-${group.lineageId}`}>
                {groupIdx > 0 && (
                  <div className="border-t border-border/50 my-2" />
                )}
                <div className={group.quotes.length > 1 ? 'border-l-2 border-border pl-3 space-y-2' : 'space-y-2'}>
                  {group.quotes.map(q => (
                    <QuoteCard 
                      key={q.id} 
                      quote={q}
                      vendor={vendors.find(v => v.id === q.vendorId)}
                      formatCurrency={formatCurrency}
                      onViewDetails={() => handleViewDetails(q.id)}
                      onCompare={() => handleCompare(q.id)}
                      onDeleteQuote={onDeleteQuote ? () => {
                        onDeleteQuote(q.id);
                        if (detailQuoteId === q.id) setDetailQuoteId(null);
                      } : undefined}
                      isCompareMode={compareMode}
                      isSelectedForCompare={selectedForCompare.has(q.id)}
                      onToggleCompare={() => handleToggleCompare(q.id)}
                      onToggleCommitmentStatus={handleToggleCommitmentStatus}
                      isTogglingStatus={isTogglingStatus}
                      scopeQuoteCount={scopeQuotes.length}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground" data-testid="empty-quotes-state">
              No quotes for this scope yet
            </div>
          )}
        </div>

        {compareMode && (
          <div
            className="sticky bottom-0 border-t border-border bg-background pt-3 pb-1 flex items-center justify-between flex-wrap gap-2"
            data-testid="compare-floating-bar"
          >
            <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
              {selectedForCompare.size < 2
                ? `Select ${2 - selectedForCompare.size} more quote${2 - selectedForCompare.size !== 1 ? 's' : ''} to compare`
                : `${selectedForCompare.size} quotes selected`}
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelCompare}
                data-testid="button-cancel-compare"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedForCompare.size < 2}
                onClick={handleOpenCompareDrawer}
                data-testid="button-open-compare"
              >
                <GitCompare className="h-4 w-4 mr-1" />
                Compare
              </Button>
            </div>
          </div>
        )}

        {!isReadOnly && scopeQuotes.length > 0 && !compareMode && (
          <ScopeActions
            quotes={scopeQuotes}
            onAskAI={handleAskAI}
            onCommit={handleCommit}
          />
        )}
      </CardContent>

      <Sheet open={detailQuoteId !== null} onOpenChange={(open) => { if (!open) setDetailQuoteId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col overflow-y-auto p-0 [&>button[class*='absolute']]:hidden" data-testid="quote-detail-drawer">
          <SheetHeader className="sr-only">
            <SheetTitle>Quote Details</SheetTitle>
            <SheetDescription>Quote detail panel</SheetDescription>
          </SheetHeader>
          {detailQuote && (
            <QuoteDetailPanel
              projectId={projectId}
              quote={detailQuote}
              vendor={detailVendor}
              allQuotes={allQuotes}
              vendors={vendors}
              formatCurrency={formatCurrency}
              scopeName={scope?.name}
              isReadOnly={isReadOnly}
              initialEditMode={openInEditMode && detailQuoteId === openQuoteId ? true : undefined}
              onSelectLineageQuote={(quoteId) => setDetailQuoteId(quoteId)}
              onAddVersion={() => {
                if (detailQuoteId) onAddVersion?.(detailQuoteId);
              }}
              onAcceptVersion={(version) => {
                if (detailQuote) onAcceptVersion?.(detailQuote, version);
              }}
              onSelectVersion={(versionId) => console.log('Select version:', versionId)}
              onDeleteQuote={() => {
                if (detailQuoteId) {
                  onDeleteQuote?.(detailQuoteId);
                  setDetailQuoteId(null);
                }
              }}
              onClose={() => setDetailQuoteId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <QuoteCompareDrawer
        open={showCompareDrawer}
        onOpenChange={(open) => {
          setShowCompareDrawer(open);
          if (!open) handleCancelCompare();
        }}
        quotes={selectedQuotes}
        vendors={vendors}
        formatCurrency={formatCurrency}
        projectId={projectId}
        onAcceptVersion={onAcceptVersion}
        onToggleCommitmentStatus={handleToggleCommitmentStatus}
        isReadOnly={isReadOnly}
      />
    </Card>
  );
}
