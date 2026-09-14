export interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
}

export interface ExtractedQuote {
  vendorName?: string;
  vendorContact?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  reference?: string;
  date?: string;
  validUntil?: string;
  lineItems: ExtractedLineItem[];
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  total?: number;
  currency?: string;
  notes?: string;
  confidence?: number;
}

export type QuoteRowType = 'section' | 'line_item' | 'note' | 'subtotal' | 'total';

export interface NativeRow {
  id?: string;
  rowType: QuoteRowType;
  originalCells: Record<string, unknown>;
  orderIndex: number;
  confidenceMap?: Record<string, number>;
}

export interface NativeExtraction {
  nativeRows: NativeRow[];
  columnHeaders: string[];
  language?: string;
  confidence: number;
}

export interface FullExtractionResult {
  native: NativeExtraction;
  derived: ExtractedQuote;
}

export interface ScopeData {
  scopes: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; name: string; scopeId: string }>;
  items: Array<{ id: string; name: string; scopeId: string; areaId: string | null }>;
}

export interface ScopeReference {
  id: string;
  nativeQuoteRowId: string;
  scopeId: string;
  scopeAreaId: string | null;
  scopeItemId: string | null;
  allocationPercentage: number;
}

export function formatDate(timestamp: number, locale: string = 'en-AU'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}
