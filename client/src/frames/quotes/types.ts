/**
 * RENIX vNext — Quotes Frame Types
 * 
 * Zone-based architecture with simple state model.
 * Views: root (scope grid) → scope (inside a scope) → extraction (review overlay) → allocation
 */

import type { AcceptedExtractedData, ExtractedQuoteData } from './ExtractionReviewScreen';

export type QuoteStatus = 'imported' | 'reviewed' | 'revised' | 'accepted' | 'rejected';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type CoverageLevel = 'none' | 'partial' | 'full';

export type QuotesViewState = 
  | { view: 'root' }
  | { view: 'scope'; scopeId: string }
  | { view: 'extraction'; scopeId: string; quoteId: string; versionId: string; documentId: string; documentUrl: string; extractedData: ExtractedQuoteData }
  | { view: 'allocation'; scopeId: string; acceptedData: AcceptedExtractedData; quoteId: string; versionId: string };

export const initialViewState: QuotesViewState = { view: 'root' };

export interface ScopeTileData {
  scopeId: string;
  scopeName: string;
  derivedSum: number | null;
  quoteDocumentCount: number;
  vendorCount: number;
  coverage: CoverageLevel;
  allocatedValue: number | null; // Total value of all allocated quotes (in cents, includes draft + committed)
  committedValue: number | null; // Total value of committed quotes only (in cents)
}
