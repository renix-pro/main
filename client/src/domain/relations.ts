/**
 * RENIX vNext — Domain Relations
 * 
 * Canon v1.4 Compliant
 * 
 * Relationships are REFERENTIAL, not controlling.
 * 
 * Relations do NOT:
 * - Mutate other frames
 * - Encode dependencies
 * - Enforce sequencing
 * 
 * This file documents the structural relationships between entities
 * for reference purposes only. No enforcement logic.
 */

/**
 * Entity relationship definitions.
 * 
 * These describe which entities reference which other entities.
 * No cascade rules. No enforcement.
 */
export const ENTITY_RELATIONS = {
  Project: {
    hasMany: ['ProjectMember', 'Vision', 'InspirationBoard', 'Scope', 'Vendor', 'BudgetLine', 'Quote', 'Invoice', 'FinancingSource', 'MediaAsset', 'Document', 'Note'],
  },
  
  ProjectMember: {
    belongsTo: ['Project', 'User'],
  },
  
  Vision: {
    belongsTo: ['Project'],
  },
  
  InspirationBoard: {
    belongsTo: ['Project'],
    hasMany: ['InspirationItem'],
  },
  
  InspirationItem: {
    belongsTo: ['InspirationBoard'],
    references: ['MediaAsset'],
  },
  
  Scope: {
    belongsTo: ['Project'],
    hasMany: ['Area'],
  },
  
  Area: {
    belongsTo: ['Scope'],
    hasMany: ['WorkItem'],
  },
  
  WorkItem: {
    belongsTo: ['Area'],
  },
  
  Vendor: {
    belongsTo: ['Project'],
    hasMany: ['Quote', 'Invoice'],
  },
  
  BudgetLine: {
    belongsTo: ['Project'],
    references: ['Area', 'WorkItem'],
  },
  
  Quote: {
    belongsTo: ['Project'],
    references: ['Vendor'],
  },
  
  Invoice: {
    belongsTo: ['Project'],
    references: ['Vendor', 'Quote'],
    hasMany: ['InvoiceLine'],
  },
  
  InvoiceLine: {
    belongsTo: ['Invoice'],
    references: ['WorkItem'],
  },
  
  FinancingSource: {
    belongsTo: ['Project'],
  },
  
  MediaAsset: {
    belongsTo: ['Project'],
  },
  
  Document: {
    belongsTo: ['Project'],
    references: ['MediaAsset'],
  },
  
  Note: {
    belongsTo: ['Project'],
    polymorphic: true,
  },
} as const;

/**
 * Entity type names for type-safe entity type references.
 */
export type EntityTypeName = keyof typeof ENTITY_RELATIONS;

/**
 * Frame-to-entity mapping.
 * 
 * Documents which entities are authoritative for each frame.
 * No cross-frame mutation allowed.
 */
export const FRAME_ENTITY_AUTHORITY = {
  overview: [],
  vision: ['Vision', 'InspirationBoard', 'InspirationItem'],
  scope: ['Scope', 'Area', 'WorkItem'],
  budget: ['BudgetLine'],
  quotes: ['Quote', 'Vendor'],
  invoices: ['Invoice', 'InvoiceLine'],
  financing: ['FinancingSource'],
  execution: [],
  documents: ['Document', 'MediaAsset'],
} as const;

/**
 * Shared entities across frames.
 * 
 * These entities may be referenced by multiple frames.
 */
export const SHARED_ENTITIES = ['Note', 'Vendor', 'MediaAsset'] as const;
