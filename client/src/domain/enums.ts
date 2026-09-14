/**
 * RENIX vNext — Domain Enums
 * 
 * Canon v1.4 Compliant
 * 
 * STRICTLY LIMITED to canonical, unavoidable enums.
 * 
 * Do NOT add:
 * - "Healthy / unhealthy"
 * - "Ready / not ready"
 * - "Good / bad"
 * - "On track / off track"
 * 
 * If unsure, do not add an enum.
 */

/**
 * Project Status
 * 
 * Only two states exist: open and closed.
 * Re-exported from projectLifecycle for domain layer access.
 */
export { type ProjectStatus } from '../spine/projectLifecycle';

/**
 * Media Asset Type
 * 
 * Structural classification only — no interpretation.
 */
export type MediaAssetType = 'image' | 'video' | 'audio' | 'document' | 'other';

/**
 * Document Type
 * 
 * Structural classification only — no interpretation of value or validity.
 */
export type DocumentType = 'contract' | 'permit' | 'receipt' | 'warranty' | 'correspondence' | 'other';

/**
 * Currency Code
 * 
 * ISO 4217 currency codes. Structural only.
 */
export type CurrencyCode = string;

/**
 * Unit of Measure
 * 
 * Structural only — no conversion logic.
 */
export type UnitOfMeasure = string;
