/**
 * RENIX vNext — Quotes Library Mode (Secondary View)
 * 
 * Canon v1.4 Compliant — Zone 2/3 content for quotes collection view.
 * NOTE: Per Section 14, this is NOT an "Inbox". It is a secondary audit/search view.
 * The primary landing view is the Scope-Centric Overview.
 * 
 * Zone 1 (Posture) is rendered by the parent QuotesFrame and is ALWAYS visible.
 * This component only renders:
 * Zone 2 (Explore): Filterable grid of quote tiles
 * Zone 3 (Focus): Quote detail when selected
 */

import { useState, useMemo } from 'react';
import { Search, Plus, FileText, Clock } from 'lucide-react';
import {
  Zone2Explore,
  Zone3Focus,
} from '@/layout/CFSLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Vendor, Quote, QuoteVersion } from './useQuotesData';
import type { QuoteStatus } from './types';

interface QuotesLibraryContentProps {
  vendors: Vendor[];
  quotes: Quote[];
  versions: Record<string, QuoteVersion[]>;
  formatCurrency: (amount: number) => string;
  isReadOnly: boolean;
  onSelectQuote: (quoteId: string) => void;
  onAddQuote: () => void;
  onAddVendor: () => void;
}

function getQuoteDisplayStatus(quote: Quote): QuoteStatus {
  const activeVersion = quote.versions.find(v => v.commitmentStatus === 'active')
    || quote.versions.find(v => v.commitmentStatus === 'accepted')
    || quote.versions[0];
  if (!activeVersion) return 'imported';
  if (activeVersion.commitmentStatus === null) return 'imported';
  if (activeVersion.commitmentStatus === 'accepted') return 'accepted';
  if (activeVersion.extractionStatus === 'verified') return 'reviewed';
  if (quote.versions.length > 1) return 'revised';
  return 'imported';
}

function getStatusBadgeVariant(status: QuoteStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'revised':
    case 'reviewed':
      return 'secondary';
    case 'imported':
    default:
      return 'outline';
  }
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function QuotesLibraryContent({
  vendors,
  quotes,
  versions,
  formatCurrency,
  isReadOnly,
  onSelectQuote,
  onAddQuote,
  onAddVendor,
}: QuotesLibraryContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach(v => map.set(v.id, v));
    return map;
  }, [vendors]);

  const getVendorInfo = (vendorId: string | null): { vendor: Vendor | null; label: string } => {
    if (!vendorId) return { vendor: null, label: 'Vendor pending' };
    const vendor = vendorMap.get(vendorId);
    return { vendor: vendor ?? null, label: vendor?.name ?? 'Unknown vendor' };
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const { label: vendorName } = getVendorInfo(quote.vendorId);
      const status = getQuoteDisplayStatus(quote);

      if (vendorFilter === 'unassigned' && quote.vendorId !== null) {
        return false;
      }
      if (vendorFilter !== 'all' && vendorFilter !== 'unassigned' && quote.vendorId !== vendorFilter) {
        return false;
      }

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesVendor = vendorName.toLowerCase().includes(searchLower);
        const matchesDescription = quote.description?.toLowerCase().includes(searchLower);
        if (!matchesVendor && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [quotes, vendorMap, vendorFilter, statusFilter, searchTerm]);

  const selectedQuote = useMemo(() => {
    if (!selectedQuoteId) return null;
    return quotes.find(q => q.id === selectedQuoteId) || null;
  }, [selectedQuoteId, quotes]);

  const handleQuoteClick = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
  };

  const handleOpenInWorkspace = () => {
    if (selectedQuoteId) {
      onSelectQuote(selectedQuoteId);
    }
  };

  return (
    <>
      <Zone2Explore data-testid="quotes-zone2-library">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <Input
                  placeholder="Search quotes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-quotes"
                />
              </div>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-vendor-filter">
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  <SelectItem value="unassigned">Vendor pending</SelectItem>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="imported">Imported</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="revised">Revised</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredQuotes.length === 0 ? (
            <Card className="border-dashed" data-testid="quotes-empty-state">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 mb-4 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {quotes.length === 0
                    ? 'No quotes yet. Add your first quote to get started.'
                    : 'No quotes match your current filters.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              data-testid="quotes-grid"
            >
              {filteredQuotes.map(quote => {
                const { label: vendorLabel } = getVendorInfo(quote.vendorId);
                const status = getQuoteDisplayStatus(quote);
                const activeVersion = quote.versions.find(v => v.commitmentStatus === 'active')
                  || quote.versions.find(v => v.commitmentStatus === 'accepted')
                  || quote.versions[0];
                const total = activeVersion?.total ?? 0;
                const isSelected = selectedQuoteId === quote.id;

                return (
                  <Card
                    key={quote.id}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      isSelected ? 'ring-2 ring-foreground' : ''
                    }`}
                    onClick={() => handleQuoteClick(quote.id)}
                    data-testid={`quote-tile-${quote.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-medium text-sm truncate"
                            data-testid={`text-vendor-name-${quote.id}`}
                          >
                            {vendorLabel}
                          </h3>
                          <p
                            className="text-xs opacity-60 truncate"
                            data-testid={`text-quote-reference-${quote.id}`}
                          >
                            {quote.description || 'Untitled'}
                          </p>
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(status)}
                          className="flex-shrink-0 text-xs"
                          data-testid={`badge-status-${quote.id}`}
                        >
                          {status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div
                          className="text-xl font-semibold"
                          data-testid={`text-quote-total-${quote.id}`}
                        >
                          {formatCurrency(total)}
                        </div>
                        <div className="flex items-center justify-between text-xs opacity-60">
                          <span
                            className="flex items-center gap-1"
                            data-testid={`text-version-count-${quote.id}`}
                          >
                            <FileText className="w-3 h-3" />
                            {quote.versions.length} version{quote.versions.length !== 1 ? 's' : ''}
                          </span>
                          <span
                            className="flex items-center gap-1"
                            data-testid={`text-last-updated-${quote.id}`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatRelativeDate(quote.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Zone2Explore>

      <Zone3Focus
        hasSelection={!!selectedQuote}
        placeholderText="Select a quote above to view details"
        data-testid="quotes-zone3-library"
      >
        {selectedQuote && (
          <div className="border border-black/20 dark:border-white/20 p-6" data-testid="quote-focus-panel">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold" data-testid="text-focus-vendor">
                  {getVendorInfo(selectedQuote.vendorId).label}
                </h2>
                <p className="text-sm opacity-60" data-testid="text-focus-reference">
                  {selectedQuote.description || 'Untitled'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={getStatusBadgeVariant(getQuoteDisplayStatus(selectedQuote))}
                  data-testid="badge-focus-status"
                >
                  {getQuoteDisplayStatus(selectedQuote)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInWorkspace}
                  data-testid="button-open-workspace"
                >
                  Open in Workspace
                </Button>
              </div>
            </div>

            {selectedQuote.description && (
              <p className="text-sm mb-4 opacity-80" data-testid="text-focus-description">
                {selectedQuote.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-black/20 dark:border-white/20 p-4">
                <div className="text-xs uppercase tracking-wider opacity-60 mb-1">
                  Latest Total
                </div>
                <div className="text-xl font-semibold" data-testid="text-focus-total">
                  {formatCurrency(
                    (selectedQuote.versions.find(v => v.commitmentStatus === 'active')
                      || selectedQuote.versions.find(v => v.commitmentStatus === 'accepted')
                      || selectedQuote.versions[0])?.total ?? 0
                  )}
                </div>
              </div>
              <div className="border border-black/20 dark:border-white/20 p-4">
                <div className="text-xs uppercase tracking-wider opacity-60 mb-1">
                  Versions
                </div>
                <div className="text-xl font-semibold" data-testid="text-focus-versions">
                  {selectedQuote.versions.length}
                </div>
              </div>
            </div>

            {selectedQuote.versions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Version History</h3>
                <div className="space-y-2" data-testid="version-history-list">
                  {selectedQuote.versions
                    .slice()
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map(version => (
                      <div
                        key={version.id}
                        className={`flex items-center justify-between p-3 border ${
                          version.commitmentStatus === 'active' || version.commitmentStatus === 'accepted' ? 'border-foreground' : version.commitmentStatus === null ? 'border-black/10 dark:border-white/10' : 'border-black/20 dark:border-white/20'
                        }`}
                        data-testid={`version-item-${version.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            v{version.versionNumber}
                          </span>
                          {version.extractionStatus === 'draft' && (
                            <Badge variant="draft" className="text-xs">
                              Draft
                            </Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'active' && (
                            <Badge variant="outline" className="text-xs">
                              Active
                            </Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'accepted' && (
                            <Badge variant="default" className="text-xs">
                              Accepted
                            </Badge>
                          )}
                          {version.extractionStatus === 'verified' && version.commitmentStatus === 'superseded' && (
                            <Badge variant="secondary" className="text-xs opacity-60">
                              Superseded
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(version.total)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Zone3Focus>
    </>
  );
}

export { QuotesLibraryContent as QuotesLibrary };
