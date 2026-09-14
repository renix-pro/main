/**
 * RENIX vNext — Domain Entities
 * 
 * Canon v1.4 Compliant
 * 
 * These are pure DATA STRUCTURES with no behavior, no logic.
 * 
 * Entity Design Rules:
 * 1. FACTS ONLY — What was declared, who declared it, when it was declared
 * 2. NO CROSS-FRAME AUTHORITY — Relationships are referential, not controlling
 * 3. TEMPORAL INTEGRITY — Allow for versioning structurally
 * 
 * Entities must NOT store:
 * - Readiness, Completion, Health, Risk, Progress, Validity, Interpretation
 * 
 * Entities must be valid even when empty or incomplete.
 */

import type { 
  ProjectStatus, 
  MediaAssetType, 
  DocumentType, 
  CurrencyCode, 
  UnitOfMeasure 
} from './enums';

/**
 * Base entity fields for all domain entities.
 */
export interface BaseEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

/**
 * User
 * 
 * A person who interacts with Renix.
 */
export interface User extends BaseEntity {
  email: string;
  displayName: string;
}

/**
 * Project
 * 
 * The primary unit of orientation.
 * A long-lived context that may be a renovation, new build, or other construction effort.
 */
export interface Project extends BaseEntity {
  name: string;
  status: ProjectStatus;
  region: string;
  currency: CurrencyCode;
  description: string | null;
}

/**
 * ProjectMember
 * 
 * Associates a User with a Project.
 * No role hierarchy — structure only.
 */
export interface ProjectMember extends BaseEntity {
  projectId: string;
  userId: string;
  role: string;
}

/**
 * Vision
 * 
 * Intent and inspiration for the project.
 * Must remain expressive and non-prescriptive.
 */
export interface Vision extends BaseEntity {
  projectId: string;
  narrative: string | null;
  whyThisProject: string | null;
  timelineIntent: string | null;
  budgetComfortRange: string | null;
  confidenceLevel: string | null;
  externalDependencies: string | null;
}

/**
 * InspirationBoard
 * 
 * A collection of inspiration items for a project.
 */
export interface InspirationBoard extends BaseEntity {
  projectId: string;
  name: string;
  description: string | null;
}

/**
 * InspirationItem
 * 
 * A single inspiration artifact (image, link, note).
 */
export interface InspirationItem extends BaseEntity {
  boardId: string;
  mediaAssetId: string | null;
  url: string | null;
  caption: string | null;
}

/**
 * Scope
 * 
 * The top-level container for what is being changed.
 * Declarative only — NOT tasks.
 */
export interface Scope extends BaseEntity {
  projectId: string;
  description: string | null;
}

/**
 * Area
 * 
 * A physical or logical area within the project scope.
 * Examples: Kitchen, Master Bathroom, Exterior.
 */
export interface Area extends BaseEntity {
  scopeId: string;
  name: string;
  description: string | null;
}

/**
 * WorkItem
 * 
 * A unit of work within an area.
 * Declarative only — NOT a task. No completion state.
 */
export interface WorkItem extends BaseEntity {
  areaId: string;
  name: string;
  description: string | null;
  quantity: number | null;
  unit: UnitOfMeasure | null;
}

/**
 * Vendor
 * 
 * An external party (contractor, supplier, etc.).
 * Facts only — no rating, no health.
 */
export interface Vendor extends BaseEntity {
  projectId: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
}

/**
 * BudgetLine
 * 
 * Represents INTENT, not cost or estimate.
 * Budget ≠ Quotes ≠ Invoices ≠ Financing.
 */
export interface BudgetLine extends BaseEntity {
  projectId: string;
  areaId: string | null;
  workItemId: string | null;
  description: string;
  intendedAmount: number | null;
  currency: CurrencyCode | null;
  notes: string | null;
}

/**
 * Quote
 * 
 * A vendor-authored estimate.
 * Remains a vendor fact — no validation, no acceptance logic.
 */
export interface Quote extends BaseEntity {
  projectId: string;
  vendorId: string | null;
  reference: string | null;
  issuedAt: number | null;
  validUntil: number | null;
  totalAmount: number | null;
  currency: CurrencyCode | null;
  notes: string | null;
}

/**
 * Invoice
 * 
 * Financial reality — a vendor-authored fact.
 * Invoice ≠ Quote ≠ Budget ≠ Financing.
 */
export interface Invoice extends BaseEntity {
  projectId: string;
  vendorId: string | null;
  quoteId: string | null;
  reference: string | null;
  issuedAt: number | null;
  dueAt: number | null;
  paidAt: number | null;
  totalAmount: number | null;
  currency: CurrencyCode | null;
  notes: string | null;
}

/**
 * InvoiceLine
 * 
 * A line item within an invoice.
 * Vendor-authored fact.
 */
export interface InvoiceLine extends BaseEntity {
  invoiceId: string;
  quoteLineId: string | null;
  workItemId: string | null;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  currency: CurrencyCode | null;
}

/**
 * FinancingSource
 * 
 * Expresses coverage intent, not feasibility.
 * Cash-flow constraints — no validation logic.
 */
export interface FinancingSource extends BaseEntity {
  projectId: string;
  name: string;
  sourceType: string | null;
  amount: number | null;
  currency: CurrencyCode | null;
  availableFrom: number | null;
  availableUntil: number | null;
  notes: string | null;
}

/**
 * MediaAsset
 * 
 * Memory and evidence — an uploaded file or asset.
 */
export interface MediaAsset extends BaseEntity {
  projectId: string;
  type: MediaAssetType;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
  caption: string | null;
}

/**
 * Document
 * 
 * Memory and evidence — a project document.
 */
export interface Document extends BaseEntity {
  projectId: string;
  type: DocumentType;
  name: string;
  mediaAssetId: string | null;
  issuedAt: number | null;
  expiresAt: number | null;
  notes: string | null;
}


/**
 * Note
 * 
 * A freeform observation or note attached to any entity.
 */
export interface Note extends BaseEntity {
  projectId: string;
  entityType: string;
  entityId: string;
  content: string;
}

/**
 * Observation
 * 
 * Alias for Note — used interchangeably in the canon.
 */
export type Observation = Note;
