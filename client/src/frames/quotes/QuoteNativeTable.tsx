import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { NativeExtraction, NativeRow, QuoteRowType, ScopeData, ScopeReference } from './QuoteWorkspaceTypes';

interface QuoteNativeTableProps {
  nativeData: NativeExtraction;
  scopeData?: ScopeData;
  scopeReferences?: ScopeReference[];
  onAddScopeReference?: (rowId: string, scopeId: string, scopeItemId?: string, allocationPercentage?: number) => void;
  onRemoveScopeReference?: (refId: string) => void;
  onUpdateAllocationPercentage?: (refId: string, percentage: number) => void;
  isReadOnly?: boolean;
}

export function QuoteNativeTable({ 
  nativeData, 
  scopeData, 
  scopeReferences = [], 
  onAddScopeReference, 
  onRemoveScopeReference,
  onUpdateAllocationPercentage,
  isReadOnly = false 
}: QuoteNativeTableProps) {
  const columnHeaders = nativeData?.columnHeaders ?? [];
  const nativeRows = nativeData?.nativeRows ?? [];
  
  if (!nativeRows || nativeRows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted italic">No native data extracted.</p>
      </div>
    );
  }

  const getRowClassName = (rowType: QuoteRowType): string => {
    switch (rowType) {
      case 'section':
        return 'font-semibold bg-muted/30';
      case 'subtotal':
        return 'font-medium bg-muted/20 italic';
      case 'total':
        return 'font-bold bg-muted/40';
      case 'note':
        return 'text-muted italic text-xs';
      default:
        return '';
    }
  };

  const getRowIndent = (rowType: QuoteRowType): string => {
    switch (rowType) {
      case 'section':
        return '';
      case 'line_item':
        return 'pl-4';
      case 'note':
        return 'pl-6';
      case 'subtotal':
      case 'total':
        return '';
      default:
        return '';
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('display' in obj && typeof obj.display === 'string') {
        return obj.display;
      }
      if ('value' in obj) {
        return String(obj.value);
      }
    }
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  const getCellConfidence = (row: NativeRow, header: string): number | null => {
    if (!row.confidenceMap) return null;
    return row.confidenceMap[header] ?? null;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-status-approved';
    if (confidence >= 0.7) return 'text-[var(--signal-warning)]';
    return 'text-destructive';
  };

  const getRowScopeRefs = (rowId: string | undefined): ScopeReference[] => {
    if (!rowId) return [];
    return scopeReferences.filter(ref => ref.nativeQuoteRowId === rowId);
  };

  const getScopeName = (scopeId: string): string => {
    const scope = scopeData?.scopes.find(s => s.id === scopeId);
    return scope?.name || 'Unknown Scope';
  };

  const getScopeItemName = (scopeItemId: string | null): string | null => {
    if (!scopeItemId) return null;
    const item = scopeData?.items.find(i => i.id === scopeItemId);
    return item?.name || null;
  };

  const hasScopeAllocation = scopeData && scopeData.scopes.length > 0;

  return (
    <div className="border border-subtle overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-subtle">
            {columnHeaders.map((header, index) => (
              <TableHead
                key={index}
                className="text-xs uppercase tracking-wider text-muted whitespace-nowrap"
                data-testid={`native-header-${index}`}
              >
                {header}
              </TableHead>
            ))}
            {hasScopeAllocation && (
              <TableHead 
                className="text-xs uppercase tracking-wider text-muted whitespace-nowrap w-40"
                data-testid="native-header-scope"
              >
                Scope
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nativeRows.map((row, rowIndex) => {
            const rowRefs = getRowScopeRefs(row.id);
            const isLineItem = row.rowType === 'line_item';
            
            return (
              <TableRow
                key={rowIndex}
                className={`border-subtle/20 ${getRowClassName(row.rowType)}`}
                data-testid={`native-row-${rowIndex}`}
                data-row-type={row.rowType}
              >
                {columnHeaders.map((header, colIndex) => {
                  const confidence = getCellConfidence(row, header);
                  const cellValue = formatCellValue(row.originalCells[header]);
                  const isFirstCol = colIndex === 0;
                  
                  return (
                    <TableCell
                      key={colIndex}
                      className={`text-sm whitespace-nowrap ${isFirstCol ? getRowIndent(row.rowType) : ''}`}
                      data-testid={`native-cell-${rowIndex}-${colIndex}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{cellValue}</span>
                        {confidence !== null && confidence < 0.9 && (
                          <span 
                            className={`text-[10px] ${getConfidenceColor(confidence)}`}
                            title={`Confidence: ${Math.round(confidence * 100)}%`}
                            data-testid={`confidence-${rowIndex}-${colIndex}`}
                          >
                            {confidence < 0.7 ? '⚠' : '○'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                {hasScopeAllocation && (
                  <TableCell className="text-sm" data-testid={`native-cell-scope-${rowIndex}`}>
                    {isLineItem && row.id ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {rowRefs.length > 0 ? (
                          rowRefs.map(ref => (
                            <div key={ref.id} className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className="text-xs border-subtle gap-1"
                                data-testid={`scope-badge-${ref.id}`}
                              >
                                {getScopeItemName(ref.scopeItemId) || getScopeName(ref.scopeId)}
                                {!isReadOnly && onRemoveScopeReference && (
                                  <button 
                                    onClick={() => onRemoveScopeReference(ref.id)}
                                    className="ml-1 hover:text-destructive"
                                    data-testid={`button-remove-scope-${ref.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </Badge>
                              {!isReadOnly && onUpdateAllocationPercentage ? (
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={ref.allocationPercentage}
                                  onChange={(e) => {
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdateAllocationPercentage(ref.id, val);
                                  }}
                                  className="w-14 h-6 text-xs px-1 text-center"
                                  data-testid={`input-allocation-${ref.id}`}
                                />
                              ) : (
                                <span className="text-xs text-muted">{ref.allocationPercentage}%</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-muted italic">Unassigned</span>
                        )}
                        {!isReadOnly && onAddScopeReference && scopeData && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6"
                                data-testid={`button-add-scope-${rowIndex}`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="start">
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                                  Assign to Scope
                                </p>
                                {scopeData.scopes.map(scope => (
                                  <div key={scope.id} className="space-y-1">
                                    <button
                                      className="w-full text-left px-2 py-1 text-sm rounded hover-elevate"
                                      onClick={() => {
                                        onAddScopeReference(row.id!, scope.id);
                                      }}
                                      data-testid={`button-assign-scope-${scope.id}`}
                                    >
                                      {scope.name}
                                    </button>
                                    {scopeData.items
                                      .filter(item => item.scopeId === scope.id)
                                      .map(item => (
                                        <button
                                          key={item.id}
                                          className="w-full text-left px-4 py-1 text-xs text-muted rounded hover-elevate"
                                          onClick={() => {
                                            onAddScopeReference(row.id!, scope.id, item.id);
                                          }}
                                          data-testid={`button-assign-scope-item-${item.id}`}
                                        >
                                          {item.name}
                                        </button>
                                      ))
                                    }
                                  </div>
                                ))}
                                {scopeData.scopes.length === 0 && (
                                  <p className="text-xs text-muted italic px-2 py-1">
                                    No scopes defined for this project.
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
