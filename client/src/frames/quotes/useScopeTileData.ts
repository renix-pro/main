/**
 * RENIX vNext — Scope Tile Data Hook
 * 
 * Computes tile data for each scope including:
 * - Quote document counts
 * - Vendor counts
 * - Coverage levels
 * - Allocated and committed values
 */

import { useMemo } from 'react';
import type { Quote } from './useQuotesData';
import type { ScopeTileData, CoverageLevel } from './types';

interface Scope {
  id: string;
  name: string;
  description: string | null;
  isOptional: boolean;
}

interface ScopeReference {
  id: string;
  scopeId: string;
  quoteVersionId?: string | null;
  nativeQuoteRowId?: string | null;
  allocationPercentage?: number | null;
  isCommitted?: boolean;
  extractionStatus?: string;
  commitmentStatus?: string;
  nativeRowOriginalCells?: Record<string, unknown> | Array<{ key: string; value: unknown }>;
}

interface NativeRow {
  id: string;
  quoteVersionId?: string;
}

interface UseScopeTileDataParams {
  scopes: Scope[];
  quotes: Quote[];
  scopeReferences: ScopeReference[];
  nativeRows: NativeRow[];
}

function isSubtotalRow(cells: Record<string, unknown> | Array<{ key: string; value: unknown }> | undefined): boolean {
  if (!cells) return false;
  
  if (!Array.isArray(cells)) {
    const description = String(cells['description'] || '').toLowerCase();
    const unit = cells['unit'];
    const quantity = cells['quantity'];
    const unitPrice = cells['unitPrice'];
    
    if (
      description.includes('zwischensumme') || 
      description.includes('subtotal') || 
      description.includes('gesamtsumme') ||
      description.startsWith('summe') ||
      description.includes('summe:')
    ) {
      return true;
    }
    
    if (!unit && !quantity && !unitPrice) {
      return true;
    }
  }
  
  return false;
}

function extractRowValue(cells: Record<string, unknown> | Array<{ key: string; value: unknown }> | undefined): number {
  if (!cells) return 0;
  
  if (isSubtotalRow(cells)) return 0;
  
  if (Array.isArray(cells)) {
    const totalCell = cells.find(c => c.key?.toLowerCase() === 'totalprice' || c.key?.toLowerCase() === 'total');
    if (totalCell && typeof totalCell.value === 'number') {
      return totalCell.value;
    }
    return 0;
  }
  
  const value = cells['totalPrice'] ?? cells['total'] ?? cells['Total'] ?? cells['TotalPrice'];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function useScopeTileData({
  scopes,
  quotes,
  scopeReferences,
  nativeRows,
}: UseScopeTileDataParams): ScopeTileData[] {
  return useMemo(() => {
    const versionToQuote = new Map<string, Quote>();
    
    for (const quote of quotes) {
      for (const version of quote.versions || []) {
        versionToQuote.set(version.id, quote);
      }
    }
    
    return scopes.map(scope => {
      let derivedSum: number | null = null;
      let allocatedValue: number | null = null;
      let committedValue: number | null = null;
      const allocatedQuoteIds = new Set<string>();
      const allocatedVendorIds = new Set<string>();
      
      const scopeRefs = scopeReferences.filter(ref => ref.scopeId === scope.id);
      
      for (const ref of scopeRefs) {
        if (ref.quoteVersionId) {
          const quote = versionToQuote.get(ref.quoteVersionId);
          if (quote) {
            allocatedQuoteIds.add(quote.id);
            if (quote.vendorId) {
              allocatedVendorIds.add(quote.vendorId);
            }
          }
        }
        
        if (ref.nativeRowOriginalCells) {
          const rowValue = extractRowValue(ref.nativeRowOriginalCells);
          if (rowValue > 0) {
            const allocationMultiplier = (ref.allocationPercentage ?? 100) / 100;
            const adjustedValue = Math.round(rowValue * allocationMultiplier);
            
            allocatedValue = (allocatedValue || 0) + adjustedValue;
            
            if (ref.isCommitted || ref.extractionStatus === 'verified') {
              committedValue = (committedValue || 0) + adjustedValue;
            }
          }
        }
      }
      
      const quoteDocumentCount = allocatedQuoteIds.size;
      let coverage: CoverageLevel = 'none';
      if (quoteDocumentCount > 0) {
        coverage = quoteDocumentCount >= 2 ? 'full' : 'partial';
      }

      return {
        scopeId: scope.id,
        scopeName: scope.name,
        derivedSum,
        quoteDocumentCount,
        vendorCount: allocatedVendorIds.size,
        coverage,
        allocatedValue,
        committedValue,
      };
    });
  }, [scopes, quotes, scopeReferences, nativeRows]);
}
