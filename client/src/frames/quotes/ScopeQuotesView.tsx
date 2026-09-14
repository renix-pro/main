/**
 * RENIX vNext — Scope Quotes View
 * 
 * Zone-based view for a single scope's quotes.
 * 
 * Zone 1: Orientation (breadcrumb, scope status, derived total, budget signal)
 * Zone 2: Hierarchical tree of allocated quote items grouped by vendor/document
 * Zone 3: Commit action surface
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, FileText, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zone1Posture,
  Zone1ATiles,
  Zone1BVisual,
  PostureTile,
  Zone2Explore,
  Zone3Focus,
} from '@/layout/CFSLayout';
import {
  quotesApi,
  type SourceDocument,
} from '@/lib/api';

interface NativeQuoteRow {
  id: string;
  quoteVersionId: string;
  orderIndex: number;
  rowType: string;
  originalCells: Record<string, unknown>;
}

interface ScopeQuoteRowReference {
  id: string;
  scopeId: string;
  nativeQuoteRowId: string;
  quoteVersionId?: string | null;
  allocationPercentage: number;
  isCommitted: boolean;
  isInherited: boolean;
}

type ScopeStatus = 'no_quotes' | 'draft' | 'partially_committed' | 'committed';
type BudgetPressure = 'on_track' | 'attention' | 'pressure';

interface QuoteVersionProps {
  id: string;
  sourceDocumentId: string | null;
}

interface QuoteProps {
  id: string;
  vendorId: string | null;
  reference?: string;
  description?: string | null;
  versions?: QuoteVersionProps[];
}

interface VendorProps {
  id: string;
  name: string;
}

interface ScopeQuotesViewProps {
  scopeId: string;
  scopeName: string;
  onBack: () => void;
  onAddQuote: () => void;
  formatCurrency: (amount: number | null) => string;
  isReadOnly: boolean;
  hasQuotes: boolean;
  quotes?: QuoteProps[];
  vendors?: VendorProps[];
  scopeRefs?: ScopeQuoteRowReference[];
  projectId?: string;
  budgetAmount?: number | null;
}

interface DocumentGroup {
  documentId: string;
  documentName: string;
  vendorName: string;
  quoteId: string;
  versionId: string;
  rows: NativeQuoteRow[];
  scopeRefs: Map<string, ScopeQuoteRowReference>;
}

interface TreeNode {
  row: NativeQuoteRow;
  scopeRef: ScopeQuoteRowReference | null;
  children: TreeNode[];
  depth: number;
}

function extractCellValue(cells: Record<string, unknown>, key: string): string {
  const value = cells[key];
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return String(value);
}

function getRowNumber(cells: Record<string, unknown>): string {
  return extractCellValue(cells, 'number') || 
         extractCellValue(cells, 'pos') || 
         extractCellValue(cells, 'position') ||
         extractCellValue(cells, 'nr') ||
         '';
}

function getRowDescription(cells: Record<string, unknown>): string {
  return extractCellValue(cells, 'description') || 
         extractCellValue(cells, 'text') || 
         extractCellValue(cells, 'bezeichnung') ||
         extractCellValue(cells, 'leistung') ||
         extractCellValue(cells, 'item') ||
         '';
}

function getRowQuantity(cells: Record<string, unknown>): string {
  return extractCellValue(cells, 'quantity') || 
         extractCellValue(cells, 'menge') || 
         extractCellValue(cells, 'qty') ||
         '';
}

function getRowUnit(cells: Record<string, unknown>): string {
  return extractCellValue(cells, 'unit') || 
         extractCellValue(cells, 'einheit') || 
         extractCellValue(cells, 'me') ||
         '';
}

function getRowUnitPrice(cells: Record<string, unknown>): number | null {
  const value = cells['unitPrice'] ?? cells['unit_price'] ?? cells['einzelpreis'] ?? cells['ep'];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getRowTotalPrice(cells: Record<string, unknown>): number | null {
  const value = cells['totalPrice'] ?? cells['total_price'] ?? cells['gesamtpreis'] ?? cells['gp'] ?? cells['total'];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getScopeStatus(refs: ScopeQuoteRowReference[]): ScopeStatus {
  if (refs.length === 0) return 'no_quotes';
  const committedCount = refs.filter(r => r.isCommitted).length;
  if (committedCount === 0) return 'draft';
  if (committedCount === refs.length) return 'committed';
  return 'partially_committed';
}

function getScopeStatusLabel(status: ScopeStatus): string {
  switch (status) {
    case 'no_quotes': return 'No quotes';
    case 'draft': return 'Draft';
    case 'partially_committed': return 'Partially committed';
    case 'committed': return 'Committed';
  }
}

function getScopeStatusVariant(status: ScopeStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'no_quotes': return 'outline';
    case 'draft': return 'secondary';
    case 'partially_committed': return 'default';
    case 'committed': return 'default';
  }
}

function getBudgetPressure(derivedTotal: number, budgetAmount: number | null): BudgetPressure {
  if (!budgetAmount || budgetAmount <= 0) return 'on_track';
  const ratio = derivedTotal / budgetAmount;
  if (ratio <= 0.9) return 'on_track';
  if (ratio <= 1.05) return 'attention';
  return 'pressure';
}

// Helper to check if row is a subtotal/summary row (should be excluded from value calculations)
function isSubtotalRow(cells: Record<string, unknown> | undefined, rowType?: string): boolean {
  // If already classified as subtotal/total, exclude it
  if (rowType === 'subtotal' || rowType === 'total') return true;
  
  if (!cells) return false;
  
  const description = String(cells['description'] || '').toLowerCase();
  const unit = cells['unit'];
  const quantity = cells['quantity'];
  const unitPrice = cells['unitPrice'];
  
  // Rows with explicit subtotal keywords are subtotal rows
  if (
    description.includes('zwischensumme') || 
    description.includes('subtotal') || 
    description.includes('gesamtsumme') ||
    description.startsWith('summe') ||
    description.includes('summe:')
  ) {
    return true;
  }
  
  // Rows with no unit, quantity, or unitPrice but with totalPrice are likely subtotals
  if (!unit && !quantity && !unitPrice) {
    return true;
  }
  
  return false;
}

function getBudgetPressureLabel(pressure: BudgetPressure): string {
  switch (pressure) {
    case 'on_track': return 'On track';
    case 'attention': return 'Attention';
    case 'pressure': return 'Pressure';
  }
}

function getBudgetPressureVariant(pressure: BudgetPressure): 'default' | 'secondary' | 'destructive' {
  switch (pressure) {
    case 'on_track': return 'default';
    case 'attention': return 'secondary';
    case 'pressure': return 'destructive';
  }
}

function QuoteRowItem({
  node,
  formatCurrency,
  isReadOnly,
  onRemoveAllocation,
  expandedSections,
  onToggleSection,
}: {
  node: TreeNode;
  formatCurrency: (amount: number | null) => string;
  isReadOnly: boolean;
  onRemoveAllocation: (refId: string) => void;
  expandedSections: Set<string>;
  onToggleSection: (rowId: string) => void;
}) {
  const { row, scopeRef, children, depth } = node;
  const isSection = row.rowType === 'section';
  const isExpanded = expandedSections.has(row.id);
  const hasChildren = children.length > 0;

  const number = getRowNumber(row.originalCells);
  const description = getRowDescription(row.originalCells);
  const quantity = getRowQuantity(row.originalCells);
  const unit = getRowUnit(row.originalCells);
  const unitPrice = getRowUnitPrice(row.originalCells);
  const totalPrice = getRowTotalPrice(row.originalCells);

  const paddingLeft = depth * 16;

  return (
    <>
      <div
        className={`
          flex items-start gap-3 py-2 px-3 border-b border-subtle/30
          ${isSection ? 'bg-muted/20' : ''}
          ${row.rowType === 'subtotal' || row.rowType === 'total' ? 'font-medium bg-muted/10' : ''}
          ${row.rowType === 'note' ? 'text-muted italic' : ''}
        `}
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
        data-testid={`quote-row-${row.id}`}
      >
        {isSection && hasChildren && (
          <button
            onClick={() => onToggleSection(row.id)}
            className="shrink-0 p-0.5 hover:bg-muted/30 rounded transition-colors"
            data-testid={`button-toggle-section-${row.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted" />
            )}
          </button>
        )}

        {!isSection && <div className="w-5" />}

        {number && (
          <span 
            className="shrink-0 text-xs text-muted font-mono min-w-[3rem]"
            data-testid={`row-number-${row.id}`}
          >
            {number}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <span 
            className="text-sm line-clamp-2"
            data-testid={`row-description-${row.id}`}
          >
            {description || (isSection ? 'Section' : row.rowType === 'note' ? 'Note' : 'Item')}
          </span>
        </div>

        {(quantity || unit) && (
          <span className="shrink-0 text-xs text-muted min-w-[4rem] text-right hidden md:inline">
            {quantity} {unit}
          </span>
        )}

        {unitPrice !== null && (
          <span className="shrink-0 text-xs text-muted min-w-[5rem] text-right hidden md:inline">
            {formatCurrency(unitPrice)}
          </span>
        )}

        {totalPrice !== null && (
          <span 
            className="shrink-0 text-sm min-w-[6rem] text-right"
            data-testid={`row-price-${row.id}`}
          >
            {formatCurrency(totalPrice)}
          </span>
        )}

        {!isReadOnly && scopeRef && (
          <button
            onClick={() => onRemoveAllocation(scopeRef.id)}
            className="shrink-0 p-1 text-muted hover:text-destructive transition-colors"
            data-testid={`button-remove-allocation-${row.id}`}
            title="Remove allocation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isExpanded && hasChildren && (
        <>
          {children.map(child => (
            <QuoteRowItem
              key={child.row.id}
              node={child}
              formatCurrency={formatCurrency}
              isReadOnly={isReadOnly}
              onRemoveAllocation={onRemoveAllocation}
              expandedSections={expandedSections}
              onToggleSection={onToggleSection}
            />
          ))}
        </>
      )}
    </>
  );
}

function DocumentGroupCard({
  group,
  formatCurrency,
  isReadOnly,
  onRemoveAllocation,
  onOpenDocument,
}: {
  group: DocumentGroup;
  formatCurrency: (amount: number | null) => string;
  isReadOnly: boolean;
  onRemoveAllocation: (refId: string) => void;
  onOpenDocument?: (docId: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const sections = group.rows.filter(r => r.rowType === 'section');
    return new Set(sections.map(s => s.id));
  });

  const handleToggleSection = useCallback((rowId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const treeNodes = useMemo(() => {
    const sortedRows = [...group.rows].sort((a, b) => a.orderIndex - b.orderIndex);
    const nodes: TreeNode[] = [];
    const sectionStack: TreeNode[] = [];

    for (const row of sortedRows) {
      const scopeRef = group.scopeRefs.get(row.id) || null;
      const node: TreeNode = {
        row,
        scopeRef,
        children: [],
        depth: 0,
      };

      if (row.rowType === 'section') {
        while (sectionStack.length > 0) {
          const lastSection = sectionStack[sectionStack.length - 1];
          const lastNumber = getRowNumber(lastSection.row.originalCells);
          const currentNumber = getRowNumber(row.originalCells);
          if (currentNumber.startsWith(lastNumber + '.')) {
            break;
          }
          sectionStack.pop();
        }

        node.depth = sectionStack.length;

        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(node);
        } else {
          nodes.push(node);
        }

        sectionStack.push(node);
      } else {
        node.depth = sectionStack.length;
        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(node);
        } else {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }, [group.rows, group.scopeRefs]);

  const groupTotal = useMemo(() => {
    return group.rows.reduce((sum, row) => {
      // Only include line_item rows that are not subtotals
      if (row.rowType === 'line_item' && !isSubtotalRow(row.originalCells, row.rowType)) {
        const price = getRowTotalPrice(row.originalCells);
        if (price !== null) return sum + price;
      }
      return sum;
    }, 0);
  }, [group.rows]);

  return (
    <Card className="border-subtle" data-testid={`document-group-${group.documentId}`}>
      <div className="flex items-center justify-between gap-3 p-3 border-b border-subtle/50 bg-muted/10">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-muted shrink-0" />
          <div className="min-w-0">
            <span className="font-medium text-sm" data-testid={`group-vendor-${group.documentId}`}>
              {group.vendorName || 'Unknown Vendor'}
            </span>
            <span className="text-muted mx-2">·</span>
            <span className="text-sm text-muted truncate" data-testid={`group-doc-${group.documentId}`}>
              {group.documentName || 'Quote Document'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted" data-testid={`group-total-${group.documentId}`}>
            ≈ {formatCurrency(groupTotal)}
          </span>
          {onOpenDocument && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenDocument(group.documentId)}
              data-testid={`button-open-doc-${group.documentId}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-0">
        {treeNodes.map(node => (
          <QuoteRowItem
            key={node.row.id}
            node={node}
            formatCurrency={formatCurrency}
            isReadOnly={isReadOnly}
            onRemoveAllocation={onRemoveAllocation}
            expandedSections={expandedSections}
            onToggleSection={handleToggleSection}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function ScopeQuotesView({
  scopeId,
  scopeName,
  onBack,
  onAddQuote,
  formatCurrency,
  isReadOnly,
  hasQuotes,
  quotes = [],
  vendors = [],
  scopeRefs: propScopeRefs,
  projectId,
  budgetAmount,
}: ScopeQuotesViewProps) {
  const queryClient = useQueryClient();

  const { data: sourceDocsData } = useQuery({
    queryKey: ['api', 'projects', projectId, 'source-documents'],
    queryFn: () => projectId ? quotesApi.getSourceDocuments(projectId) : Promise.resolve({ sourceDocuments: [] }),
    enabled: !!projectId,
  });

  const allNativeRows: NativeQuoteRow[] = [];
  const allScopeRefs: ScopeQuoteRowReference[] = propScopeRefs || [];
  const allSourceDocs = sourceDocsData?.sourceDocuments || [];

  const scopeSpecificRefs = useMemo(() => {
    return allScopeRefs.filter(ref => ref.scopeId === scopeId);
  }, [allScopeRefs, scopeId]);

  const allocatedRowIds = useMemo(() => {
    return new Set(scopeSpecificRefs.map(ref => ref.nativeQuoteRowId));
  }, [scopeSpecificRefs]);

  const allocatedRows = useMemo(() => {
    return allNativeRows.filter(row => allocatedRowIds.has(row.id));
  }, [allNativeRows, allocatedRowIds]);

  const documentGroups = useMemo(() => {
    const versionToRows = new Map<string, NativeQuoteRow[]>();
    for (const row of allocatedRows) {
      const existing = versionToRows.get(row.quoteVersionId) || [];
      existing.push(row);
      versionToRows.set(row.quoteVersionId, existing);
    }

    const versionToRefs = new Map<string, Map<string, ScopeQuoteRowReference>>();
    for (const ref of scopeSpecificRefs) {
      const row = allocatedRows.find(r => r.id === ref.nativeQuoteRowId);
      if (row) {
        const refsMap = versionToRefs.get(row.quoteVersionId) || new Map();
        refsMap.set(ref.nativeQuoteRowId, ref);
        versionToRefs.set(row.quoteVersionId, refsMap);
      }
    }

    const groups: DocumentGroup[] = [];

    for (const quote of quotes) {
      for (const version of quote.versions || []) {
        const rows = versionToRows.get(version.id);
        if (!rows || rows.length === 0) continue;

        const vendor = vendors.find(v => v.id === quote.vendorId);
        const sourceDoc = allSourceDocs.find(d => d.id === version.sourceDocumentId);

        groups.push({
          documentId: version.sourceDocumentId || version.id,
          documentName: sourceDoc?.fileName || 'Quote Document',
          vendorName: vendor?.name || 'Unknown Vendor',
          quoteId: quote.id,
          versionId: version.id,
          rows,
          scopeRefs: versionToRefs.get(version.id) || new Map(),
        });
      }
    }

    return groups;
  }, [allocatedRows, scopeSpecificRefs, quotes, vendors, allSourceDocs]);

  const derivedTotal = useMemo(() => {
    return allocatedRows.reduce((sum, row) => {
      // Only include line_item rows that are not subtotals
      if (row.rowType === 'line_item' && !isSubtotalRow(row.originalCells, row.rowType)) {
        const price = getRowTotalPrice(row.originalCells);
        const ref = scopeSpecificRefs.find(r => r.nativeQuoteRowId === row.id);
        const allocation = ref?.allocationPercentage ?? 100;
        if (price !== null) return sum + (price * allocation / 100);
      }
      return sum;
    }, 0);
  }, [allocatedRows, scopeSpecificRefs]);

  const scopeStatus = useMemo(() => getScopeStatus(scopeSpecificRefs), [scopeSpecificRefs]);
  const budgetPressure = useMemo(() => getBudgetPressure(derivedTotal, budgetAmount ?? null), [derivedTotal, budgetAmount]);

  const removeAllocationMutation = useMutation({
    mutationFn: async (refId: string) => {
      console.warn('Legacy allocation removal features removed');
    },
    onSuccess: async () => {},
  });

  const commitScopeMutation = useMutation({
    mutationFn: async () => {
      console.warn('Legacy commit scope features removed');
    },
    onSuccess: async () => {},
  });

  const handleRemoveAllocation = useCallback((refId: string) => {
    if (isReadOnly) return;
    removeAllocationMutation.mutate(refId);
  }, [isReadOnly, removeAllocationMutation]);

  const handleCommit = useCallback(() => {
    if (isReadOnly || scopeStatus === 'committed') return;
    commitScopeMutation.mutate();
  }, [isReadOnly, scopeStatus, commitScopeMutation]);

  const hasAllocations = allocatedRows.length > 0;

  return (
    <>
      <Zone1Posture data-testid="scope-quotes-zone1">
        <Zone1ATiles data-testid="scope-quotes-zone1a">
          <header data-testid="scope-quotes-header">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-2 transition-colors"
              data-testid="button-back-to-quotes"
            >
              <span>Quotes</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium">{scopeName}</span>
            </button>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1
                  className="text-2xl font-semibold mb-1"
                  data-testid="text-scope-name"
                >
                  {scopeName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    variant={getScopeStatusVariant(scopeStatus)}
                    data-testid="badge-scope-status"
                  >
                    {getScopeStatusLabel(scopeStatus)}
                  </Badge>
                  {budgetAmount !== undefined && budgetAmount !== null && budgetAmount > 0 && (
                    <Badge 
                      variant={getBudgetPressureVariant(budgetPressure)}
                      data-testid="badge-budget-pressure"
                    >
                      {getBudgetPressureLabel(budgetPressure)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-wrap gap-2" data-testid="scope-posture-tiles">
            <PostureTile
              label="Derived Total"
              value={`≈ ${formatCurrency(derivedTotal)}`}
              data-testid="posture-tile-derived-total"
            />
            <PostureTile
              label="Allocations"
              value={allocatedRows.length}
              subtext={`${documentGroups.length} document${documentGroups.length !== 1 ? 's' : ''}`}
              data-testid="posture-tile-allocations"
            />
            {budgetAmount !== undefined && budgetAmount !== null && budgetAmount > 0 && (
              <PostureTile
                label="Budget"
                value={formatCurrency(budgetAmount)}
                data-testid="posture-tile-budget"
              />
            )}
          </div>
        </Zone1ATiles>

        <Zone1BVisual data-testid="scope-quotes-zone1b">
          <div className="text-center p-6 border border-subtle/20 rounded-lg">
            {!hasAllocations ? (
              <>
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
                <p className="text-sm text-muted" data-testid="text-no-allocations">
                  No quote items allocated to this scope
                </p>
              </>
            ) : scopeStatus === 'draft' ? (
              <>
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
                <p className="text-sm text-muted" data-testid="text-draft-status">
                  Review allocations and commit when ready
                </p>
              </>
            ) : scopeStatus === 'committed' ? (
              <>
                <FileText className="w-10 h-10 mx-auto mb-3 text-primary opacity-70" />
                <p className="text-sm text-muted" data-testid="text-committed-status">
                  All allocations committed
                </p>
              </>
            ) : (
              <>
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
                <p className="text-sm text-muted" data-testid="text-partial-status">
                  Some allocations pending commitment
                </p>
              </>
            )}
          </div>
        </Zone1BVisual>
      </Zone1Posture>

      <Zone2Explore data-testid="scope-quotes-zone2">
        {!hasAllocations ? (
          <Card className="border-subtle" data-testid="scope-quotes-empty-state">
            <CardContent className="p-8 text-center">
              <div className="text-muted mb-4">
                <FileText className="w-12 h-12 mx-auto opacity-50" />
              </div>
              <p className="text-sm text-muted mb-4" data-testid="text-no-quotes-message">
                No quotes allocated to this scope
              </p>
              {!isReadOnly && (
                <p className="text-sm text-muted" data-testid="text-upload-via-ai">
                  Use the AI assistant to upload quotes for this scope.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="document-groups-container">
            {documentGroups.map(group => (
              <DocumentGroupCard
                key={group.versionId}
                group={group}
                formatCurrency={formatCurrency}
                isReadOnly={isReadOnly}
                onRemoveAllocation={handleRemoveAllocation}
              />
            ))}
          </div>
        )}
      </Zone2Explore>

      <Zone3Focus
        hasSelection={hasAllocations && scopeStatus !== 'committed'}
        placeholderText=""
        data-testid="scope-quotes-zone3"
      >
        <div className="renix-surface p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Commit quote data for this scope</span>
            {scopeStatus === 'partially_committed' && (
              <Badge variant="secondary" className="text-xs">
                {scopeSpecificRefs.filter(r => !r.isCommitted).length} uncommitted
              </Badge>
            )}
          </div>
          <Button
            variant="default"
            disabled={!hasAllocations || scopeStatus === 'committed' || isReadOnly || commitScopeMutation.isPending}
            onClick={handleCommit}
            className="shrink-0"
            data-testid="button-commit-scope-quotes"
          >
            {commitScopeMutation.isPending ? 'Committing...' : scopeStatus === 'committed' ? 'Committed' : 'Commit'}
          </Button>
        </div>
      </Zone3Focus>
    </>
  );
}

export default ScopeQuotesView;
