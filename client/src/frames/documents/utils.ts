/**
 * RENIX vNext — Document Utilities
 * 
 * Shared utilities for document frame components.
 */

import type { DocumentType, DocumentAssociation } from './useDocumentsData';

/**
 * Standard document types supported by the UI.
 * Non-standard types (e.g., 'permit', 'plan', 'contract' from legacy data)
 * will be normalized to 'other'.
 */
export const STANDARD_DOCUMENT_TYPES: DocumentType[] = ['document', 'image', 'media', 'other'];

/**
 * Normalizes any document type string to a standard DocumentType.
 * Non-standard types are mapped to 'other' to prevent UI crashes.
 * 
 * @param rawType - The raw document type string from the database
 * @returns A valid DocumentType
 */
export function normalizeDocumentType(rawType: string): DocumentType {
  if (STANDARD_DOCUMENT_TYPES.includes(rawType as DocumentType)) {
    return rawType as DocumentType;
  }
  return 'other';
}

export type DocumentPurpose = 'quote' | 'invoice' | 'document' | 'image' | 'media' | 'other';

/**
 * Derives the business purpose of a document from its associations.
 * Association types take precedence over raw file type:
 * - Has 'invoice' association → Invoice
 * - Has 'quote' association → Quote
 * - Otherwise → falls back to normalized file type label
 */
export function deriveDocumentPurpose(associations: DocumentAssociation[], rawDocumentType: string): DocumentPurpose {
  const hasInvoice = associations.some(a => a.type === 'invoice');
  if (hasInvoice) return 'invoice';
  
  const hasQuote = associations.some(a => a.type === 'quote');
  if (hasQuote) return 'quote';
  
  const normalized = normalizeDocumentType(rawDocumentType);
  return normalized;
}

/**
 * Returns the human-readable label for a document purpose.
 */
export function getPurposeLabel(purpose: DocumentPurpose): string {
  switch (purpose) {
    case 'quote': return 'Quote';
    case 'invoice': return 'Invoice';
    case 'document': return 'Doc';
    case 'image': return 'Image';
    case 'media': return 'Media';
    default: return 'Other';
  }
}
