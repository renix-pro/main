/**
 * RENIX vNext — API Client Utilities
 * 
 * Query keys and API helpers for React Query integration.
 */

import { apiRequest } from './queryClient';
import { getAuthHeaders } from '@/auth/AuthContext';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const queryKeys = {
  // Projects
  projects: ['api', 'projects'] as const,
  project: (projectId: string) => ['api', 'projects', projectId] as const,
  
  // Scope
  scope: (projectId: string) => ['api', 'projects', projectId, 'scope'] as const,
  
  // Scope Nodes (tree-based)
  scopeNodes: (projectId: string) => ['api', 'projects', projectId, 'scope-nodes'] as const,
  
  // Budget
  budget: (projectId: string) => ['api', 'projects', projectId, 'budget'] as const,
  
  // Quotes
  quotes: (projectId: string) => ['api', 'projects', projectId, 'quotes'] as const,
  
  // Source Documents
  sourceDocuments: (projectId: string) => ['api', 'projects', projectId, 'source-documents'] as const,
  
  // Invoices
  invoices: (projectId: string) => ['api', 'projects', projectId, 'invoices'] as const,
  
  // Financing
  financing: (projectId: string) => ['api', 'projects', projectId, 'financing'] as const,
  
  // Execution
  execution: (projectId: string) => ['api', 'projects', projectId, 'execution'] as const,
  
  // Vision
  vision: (projectId: string) => ['api', 'projects', projectId, 'vision'] as const,
  
  // Documents
  documents: (projectId: string) => ['api', 'projects', projectId, 'documents'] as const,
  
  // Auth
  currentUser: ['api', 'auth', 'me'] as const,
};

// ============================================================================
// API HELPERS
// ============================================================================

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { 
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function postJson<T>(url: string, data: unknown): Promise<T> {
  const res = await apiRequest('POST', url, data);
  return res.json();
}

export async function patchJson<T>(url: string, data: unknown): Promise<T> {
  const res = await apiRequest('PATCH', url, data);
  return res.json();
}

export async function deleteRequest(url: string): Promise<void> {
  await apiRequest('DELETE', url);
}

// ============================================================================
// PROJECT API
// ============================================================================

export interface ProjectMember {
  id: string;
  name: string;
  role: 'owner' | 'contributor' | 'viewer';
}

export interface ProjectRegionalContext {
  region: string;
  currency: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  type: string | null;
  description: string;
  status: string;
  color: string;
  regionalContext: ProjectRegionalContext;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
  heroImagePath: string | null;
}

export interface CreateProjectInput {
  name: string;
  type?: string;
  description: string;
  color: string;
  regionalContext: ProjectRegionalContext;
  members?: ProjectMember[];
}

export interface UpdateProjectInput {
  name?: string;
  type?: string;
  description?: string;
  status?: string;
  color?: string;
  members?: ProjectMember[];
}

export const projectsApi = {
  list: () => fetchJson<{ projects: Project[] }>('/api/projects'),
  get: (id: string) => fetchJson<Project>(`/api/projects/${id}`),
  create: (data: CreateProjectInput) => postJson<Project>('/api/projects', data),
  update: (id: string, data: UpdateProjectInput) => patchJson<Project>(`/api/projects/${id}`, data),
  delete: (id: string) => deleteRequest(`/api/projects/${id}`),
};

// ============================================================================
// SCOPE API
// ============================================================================

export interface Scope {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description: string | null;
  isOptional: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ScopeData {
  scopes: Scope[];
}

export const scopeApi = {
  get: (projectId: string) => fetchJson<ScopeData>(`/api/projects/${projectId}/scope`),
  createScope: (projectId: string, data: Partial<Scope>) => 
    postJson<Scope>(`/api/projects/${projectId}/scopes`, data),
  updateScope: (projectId: string, scopeId: string, data: Partial<Scope>) => 
    patchJson<Scope>(`/api/projects/${projectId}/scopes/${scopeId}`, data),
  deleteScope: (projectId: string, scopeId: string) => 
    deleteRequest(`/api/projects/${projectId}/scopes/${scopeId}`),
};

// ============================================================================
// SCOPE NODES API (Tree-based structure)
// ============================================================================

export interface ScopeNodeData {
  id: string;
  projectId: string;
  userId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  tags: string[];
  sortOrder: number;
  isExpanded: boolean;
  costType: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ScopeNodesResponse {
  nodes: ScopeNodeData[];
}

export interface CreateScopeNodeInput {
  parentId?: string | null;
  name: string;
  description?: string | null;
  tags?: string[];
  createdBy: string;
}

export interface UpdateScopeNodeInput {
  name?: string;
  description?: string | null;
  tags?: string[];
  isExpanded?: boolean;
}

export interface MoveScopeNodeInput {
  newParentId: string | null;
  sortOrder?: number;
}

export interface ReorderScopeNodeInput {
  sortOrder: number;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
}

export interface ScopeNodeImpact {
  nodeId: string;
  nodeName: string;
  descendantCount: number;
  budgetAllocations: {
    count: number;
    totalAmount: number;
    currency: string;
  };
  quoteReferences: {
    count: number;
    vendorNames: string[];
  };
  executionTasks: {
    count: number;
  };
  hasImpact: boolean;
}

export const scopeNodesApi = {
  get: (projectId: string) => 
    fetchJson<ScopeNodesResponse>(`/api/projects/${projectId}/scope-nodes`),
  create: (projectId: string, data: CreateScopeNodeInput) => 
    postJson<ScopeNodeData>(`/api/projects/${projectId}/scope-nodes`, data),
  update: (projectId: string, nodeId: string, data: UpdateScopeNodeInput) => 
    patchJson<ScopeNodeData>(`/api/projects/${projectId}/scope-nodes/${nodeId}`, data),
  move: (projectId: string, nodeId: string, data: MoveScopeNodeInput) => 
    postJson<ScopeNodeData>(`/api/projects/${projectId}/scope-nodes/${nodeId}/move`, data),
  reorder: (projectId: string, nodeId: string, data: ReorderScopeNodeInput) => 
    postJson<ScopeNodeData>(`/api/projects/${projectId}/scope-nodes/${nodeId}/reorder`, data),
  batchCreate: (projectId: string, groups: { name: string; description?: string | null; tags?: string[]; items: (string | { name: string; description?: string | null })[] }[]) =>
    postJson<{ nodes: ScopeNodeData[]; count: number }>(`/api/projects/${projectId}/scope-nodes/batch`, { groups }),
  batchReorder: (projectId: string, updates: { nodeId: string; sortOrder: number }[]) =>
    postJson<{ success: boolean }>(`/api/projects/${projectId}/scope-nodes/batch-reorder`, { updates }),
  delete: (projectId: string, nodeId: string) => 
    deleteRequest(`/api/projects/${projectId}/scope-nodes/${nodeId}`),
  migrate: (projectId: string) => 
    postJson<MigrationResult>(`/api/projects/${projectId}/scope-nodes/migrate`, {}),
  getImpact: (projectId: string, nodeId: string) => 
    fetchJson<ScopeNodeImpact>(`/api/projects/${projectId}/scope-nodes/${nodeId}/impact`),
};

// ============================================================================
// BUDGET API
// ============================================================================

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  projectId: string;
  userId: string;
  label: string;
  amount: number;
  target: unknown;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface BudgetData {
  id: string;
  projectId: string;
  userId: string;
  totalBudget: number | null;
  currency: string;
  notes: string | null;
  contingencyMode: 'fixed' | 'percent' | null;
  contingencyValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetResponse {
  budget: BudgetData | null;
  allocations: BudgetAllocation[];
}

export const budgetApi = {
  get: (projectId: string) => fetchJson<BudgetResponse>(`/api/projects/${projectId}/budget`),
  createOrUpdate: (projectId: string, data: Partial<BudgetData>) => 
    postJson<BudgetData>(`/api/projects/${projectId}/budget`, data),
  createAllocation: (projectId: string, data: Partial<BudgetAllocation>) => 
    postJson<BudgetAllocation>(`/api/projects/${projectId}/budget/allocations`, data),
  updateAllocation: (projectId: string, allocId: string, data: Partial<BudgetAllocation>) => 
    patchJson<BudgetAllocation>(`/api/projects/${projectId}/budget/allocations/${allocId}`, data),
  deleteAllocation: (projectId: string, allocId: string) => 
    deleteRequest(`/api/projects/${projectId}/budget/allocations/${allocId}`),
};

// ============================================================================
// QUOTES API
// ============================================================================

export interface Vendor {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteVersion {
  id: string;
  quoteId: string;
  projectId: string;
  userId: string;
  versionNumber: number;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  extractionStatus: string;
  commitmentStatus: string | null;
}

export interface Quote {
  id: string;
  vendorId: string;
  scopeId: string | null;
  projectId: string;
  userId: string;
  description: string | null;
  status: 'new' | 'draft' | 'committed' | 'accepted';
  lineageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteFinancialsData {
  netAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  grossAmount: number | null;
  currency: string;
}

export interface QuotesResponse {
  vendors: Vendor[];
  quotes: Quote[];
  versions: Record<string, QuoteVersion[]>;
  financials?: Record<string, QuoteFinancialsData>;
}

export const quotesApi = {
  get: (projectId: string) => fetchJson<QuotesResponse>(`/api/projects/${projectId}/quotes`),
  createVendor: (projectId: string, data: Partial<Vendor>) => 
    postJson<Vendor>(`/api/projects/${projectId}/vendors`, data),
  updateVendor: (projectId: string, vendorId: string, data: Partial<Vendor>) => 
    patchJson<Vendor>(`/api/projects/${projectId}/vendors/${vendorId}`, data),
  deleteVendor: (projectId: string, vendorId: string) => 
    deleteRequest(`/api/projects/${projectId}/vendors/${vendorId}`),
  createQuote: (projectId: string, data: Partial<Quote>) => 
    postJson<Quote>(`/api/projects/${projectId}/quotes`, data),
  updateQuote: (projectId: string, quoteId: string, data: Partial<Quote>) => 
    patchJson<Quote>(`/api/projects/${projectId}/quotes/${quoteId}`, data),
  deleteQuote: (projectId: string, quoteId: string) => 
    deleteRequest(`/api/projects/${projectId}/quotes/${quoteId}`),
  createVersion: (projectId: string, quoteId: string, data: Partial<QuoteVersion>) => 
    postJson<QuoteVersion>(`/api/projects/${projectId}/quotes/${quoteId}/versions`, data),
  updateVersion: (projectId: string, versionId: string, data: Partial<QuoteVersion>) => 
    patchJson<QuoteVersion>(`/api/projects/${projectId}/quote-versions/${versionId}`, data),
  // Source Documents
  // The server returns a bare array (routes/quotes.ts GET /source-documents).
  getSourceDocuments: (projectId: string) => 
    fetchJson<SourceDocument[]>(`/api/projects/${projectId}/source-documents`),
  createSourceDocument: (projectId: string, data: Partial<SourceDocument>) => 
    postJson<SourceDocument>(`/api/projects/${projectId}/source-documents`, data),
  deleteSourceDocument: (projectId: string, docId: string) => 
    deleteRequest(`/api/projects/${projectId}/source-documents/${docId}`),

  // Vendor Snapshots
  getVendorSnapshot: (projectId: string, versionId: string) => 
    fetchJson<VendorSnapshot | null>(`/api/projects/${projectId}/quote-versions/${versionId}/vendor-snapshot`),
  createVendorSnapshot: (projectId: string, versionId: string, data: Partial<VendorSnapshot>) => 
    postJson<VendorSnapshot>(`/api/projects/${projectId}/quote-versions/${versionId}/vendor-snapshot`, data),

  // Quote Metadata
  getQuoteMetadata: (projectId: string, versionId: string) => 
    fetchJson<QuoteMetadata | null>(`/api/projects/${projectId}/quote-versions/${versionId}/metadata`),
  createQuoteMetadata: (projectId: string, versionId: string, data: Partial<QuoteMetadata>) => 
    postJson<QuoteMetadata>(`/api/projects/${projectId}/quote-versions/${versionId}/metadata`, data),
  updateQuoteMetadata: (projectId: string, metaId: string, data: Partial<QuoteMetadata>) => 
    patchJson<QuoteMetadata>(`/api/projects/${projectId}/quote-metadata/${metaId}`, data),

  // Quote Line Items (enhanced)
  getLineItems: (projectId: string, versionId: string) => 
    fetchJson<{ lineItems: QuoteLineItem[] }>(`/api/projects/${projectId}/quote-versions/${versionId}/line-items`),
  createLineItem: (projectId: string, versionId: string, data: Partial<QuoteLineItem>) => 
    postJson<QuoteLineItem>(`/api/projects/${projectId}/quote-versions/${versionId}/line-items`, data),
  updateLineItem: (projectId: string, itemId: string, data: Partial<QuoteLineItem>) => 
    patchJson<QuoteLineItem>(`/api/projects/${projectId}/quote-line-items/${itemId}`, data),
  deleteLineItem: (projectId: string, itemId: string) => 
    deleteRequest(`/api/projects/${projectId}/quote-line-items/${itemId}`),

  // Quote Totals
  getTotals: (projectId: string, versionId: string) => 
    fetchJson<QuoteTotal | null>(`/api/projects/${projectId}/quote-versions/${versionId}/totals`),
  createTotals: (projectId: string, versionId: string, data: Partial<QuoteTotal>) => 
    postJson<QuoteTotal>(`/api/projects/${projectId}/quote-versions/${versionId}/totals`, data),
  updateTotals: (projectId: string, totalId: string, data: Partial<QuoteTotal>) => 
    patchJson<QuoteTotal>(`/api/projects/${projectId}/quote-totals/${totalId}`, data),
};

// ============================================================================
// EXTENDED QUOTES TYPES
// ============================================================================

// Source Documents
export interface SourceDocument {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileType: string;
  languageDetected: string | null;
  uploadedAt: string;
  checksum: string | null;
  pageCount: number | null;
  fileDataUrl: string | null;
}

// Vendor Snapshots (version-bound)
export interface VendorSnapshot {
  id: string;
  quoteVersionId: string;
  projectId: string;
  userId: string;
  name: string;
  contactDetails: unknown | null;
  confidence: 'high' | 'medium' | 'low';
}

// Quote Metadata
export interface QuoteMetadata {
  id: string;
  quoteVersionId: string;
  projectId: string;
  userId: string;
  quoteNumber: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  currency: string | null;
  confidenceMap: Record<string, string> | null;
}

// Enhanced Quote Line Items
export interface QuoteLineItem {
  id: string;
  quoteVersionId: string;
  projectId: string;
  userId: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  specificationNotes: string | null;
  isBundled: boolean;
  isOptional: boolean;
}

// Quote Totals
export interface QuoteTotal {
  id: string;
  quoteVersionId: string;
  projectId: string;
  userId: string;
  subtotal: number | null;
  totalTax: number | null;
  grandTotal: number | null;
  confidenceMap: Record<string, string> | null;
}

// ============================================================================
// INVOICES API
// ============================================================================

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  projectId: string;
  userId: string;
  label: string;
  description: string | null;
  amount: number;
  scopeItemId: string | null;
  scopeItemName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  userId: string;
  vendorName: string;
  vendorId: string | null;
  scopeId: string | null;
  reference: string | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  finalizedAt: string | null;
  paidAt: string | null;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  lines: Record<string, InvoiceLine[]>;
  payments?: Record<string, InvoicePayment[]>;
}

export interface InvoicePaymentInput {
  amount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export const invoicesApi = {
  get: (projectId: string) => fetchJson<InvoicesResponse>(`/api/projects/${projectId}/invoices`),
  create: (projectId: string, data: Partial<Invoice>) => 
    postJson<Invoice>(`/api/projects/${projectId}/invoices`, data),
  update: (projectId: string, invoiceId: string, data: Partial<Invoice>) => 
    patchJson<Invoice>(`/api/projects/${projectId}/invoices/${invoiceId}`, data),
  delete: (projectId: string, invoiceId: string) => 
    deleteRequest(`/api/projects/${projectId}/invoices/${invoiceId}`),
  createLine: (projectId: string, invoiceId: string, data: Partial<InvoiceLine>) => 
    postJson<InvoiceLine>(`/api/projects/${projectId}/invoices/${invoiceId}/lines`, data),
  updateLine: (projectId: string, lineId: string, data: Partial<InvoiceLine>) => 
    patchJson<InvoiceLine>(`/api/projects/${projectId}/invoice-lines/${lineId}`, data),
  deleteLine: (projectId: string, lineId: string) => 
    deleteRequest(`/api/projects/${projectId}/invoice-lines/${lineId}`),
  recordPayment: (projectId: string, invoiceId: string, data: InvoicePaymentInput) =>
    postJson<InvoicePayment>(`/api/projects/${projectId}/invoices/${invoiceId}/payments`, data),
  deletePayment: (projectId: string, invoiceId: string, paymentId: string) =>
    deleteRequest(`/api/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`),
};

// ============================================================================
// FINANCING API
// ============================================================================

export interface FinancingSource {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  type: 'Loan' | 'Grant' | 'Equity';
  amount: number; // Amount confirmed (stored as whole currency units)
  status: 'Planned' | 'Confirmed';
  monthlyLiability: number | null; // Monthly EMI/payment obligation
  notes: string | null;
  linkedDocuments: string[] | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface FinancingData {
  id: string;
  projectId: string;
  userId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancingResponse {
  financing: FinancingData | null;
  sources: FinancingSource[];
}

export const financingApi = {
  get: (projectId: string) => fetchJson<FinancingResponse>(`/api/projects/${projectId}/financing`),
  createOrUpdate: (projectId: string, data: Partial<FinancingData>) => 
    postJson<FinancingData>(`/api/projects/${projectId}/financing`, data),
  createSource: (projectId: string, data: Partial<FinancingSource>) => 
    postJson<FinancingSource>(`/api/projects/${projectId}/financing/sources`, data),
  updateSource: (projectId: string, sourceId: string, data: Partial<FinancingSource>) => 
    patchJson<FinancingSource>(`/api/projects/${projectId}/financing/sources/${sourceId}`, data),
  deleteSource: (projectId: string, sourceId: string) => 
    deleteRequest(`/api/projects/${projectId}/financing/sources/${sourceId}`),
};

// ============================================================================
// EXECUTION API
// ============================================================================

export interface TaskResponsibility {
  type: 'me' | 'external' | 'unknown';
  label?: string;
}

export interface ExecutionTask {
  id: string;
  projectId: string;
  userId: string;
  label: string;
  description: string | null;
  scopeItemId: string | null;
  scopeItemName: string | null;
  status: string;
  assignee: string | null;
  responsibility: TaskResponsibility | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  completedAt: string | null;
  linkedDocuments: string[] | null;
  linkedInvoices: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  overdue: boolean;
  notStarted: boolean;
}

export interface ExecutionLog {
  id: string;
  taskId: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  timestamp: string;
  actor: string;
}

export interface ExecutionResponse {
  tasks: ExecutionTask[];
  log?: ExecutionLog[];
}

export interface TaskAggregatesResponse {
  counts: { to_do: number; in_progress: number; done: number };
  overdue: { count: number; taskIds: string[] };
  notStarted: { count: number; taskIds: string[] };
}

export const executionApi = {
  get: (projectId: string) => fetchJson<ExecutionResponse>(`/api/projects/${projectId}/execution`),
  getAggregates: (projectId: string) => fetchJson<TaskAggregatesResponse>(`/api/projects/${projectId}/execution/tasks/aggregates`),
  createTask: (projectId: string, data: Partial<ExecutionTask>) => 
    postJson<ExecutionTask>(`/api/projects/${projectId}/execution/tasks`, data),
  updateTask: (projectId: string, taskId: string, data: Partial<ExecutionTask>) => 
    patchJson<ExecutionTask>(`/api/projects/${projectId}/execution/tasks/${taskId}`, data),
  deleteTask: (projectId: string, taskId: string) => 
    deleteRequest(`/api/projects/${projectId}/execution/tasks/${taskId}`),
};

// ============================================================================
// VISION API
// ============================================================================

export interface VisionInspiration {
  id: string;
  boardId: string;
  projectId: string;
  userId: string;
  imageUrl: string;
  caption: string | null;
  tags: string[];
  preview: unknown;
  archived: boolean;
  createdAt: string;
}

export interface VisionBoard {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  desireStatement: string | null;
  tags: string[];
  themes: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VisionResponse {
  boards: VisionBoard[];
  inspirations: VisionInspiration[];
}

export const visionApi = {
  get: (projectId: string) => fetchJson<VisionResponse>(`/api/projects/${projectId}/vision`),
  createBoard: (projectId: string, data: Partial<VisionBoard>) => 
    postJson<VisionBoard>(`/api/projects/${projectId}/vision/boards`, data),
  updateBoard: (projectId: string, boardId: string, data: Partial<VisionBoard>) => 
    patchJson<VisionBoard>(`/api/projects/${projectId}/vision/boards/${boardId}`, data),
  deleteBoard: (projectId: string, boardId: string) => 
    deleteRequest(`/api/projects/${projectId}/vision/boards/${boardId}`),
  createInspiration: (projectId: string, boardId: string, data: Partial<VisionInspiration>) => 
    postJson<VisionInspiration>(`/api/projects/${projectId}/vision/boards/${boardId}/inspirations`, data),
  updateInspiration: (projectId: string, inspId: string, data: Partial<VisionInspiration>) => 
    patchJson<VisionInspiration>(`/api/projects/${projectId}/vision/inspirations/${inspId}`, data),
  deleteInspiration: (projectId: string, inspId: string) => 
    deleteRequest(`/api/projects/${projectId}/vision/inspirations/${inspId}`),
};

// ============================================================================
// DOCUMENTS API
// ============================================================================

export interface DocumentAssociation {
  id: string;
  documentId: string;
  projectId: string;
  userId: string;
  associationType: string;
  entityId: string;
  entityLabel: string;
}

export interface Document {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  title: string;
  description: string | null;
  tags: string[];
  fileDataUrl: string | null;
  uploadedAt: string;
  uploadedBy: string;
}

export interface DocumentsResponse {
  documents: Document[];
  associations: DocumentAssociation[];
}

export const documentsApi = {
  get: (projectId: string) => fetchJson<DocumentsResponse>(`/api/projects/${projectId}/documents`),
  create: (projectId: string, data: Partial<Document>) => 
    postJson<Document>(`/api/projects/${projectId}/documents`, data),
  update: (projectId: string, docId: string, data: Partial<Document>) => 
    patchJson<Document>(`/api/projects/${projectId}/documents/${docId}`, data),
  delete: (projectId: string, docId: string) => 
    deleteRequest(`/api/projects/${projectId}/documents/${docId}`),
  addAssociation: (projectId: string, docId: string, data: Partial<DocumentAssociation>) => 
    postJson<DocumentAssociation>(`/api/projects/${projectId}/documents/${docId}/associations`, data),
  removeAssociation: (projectId: string, assocId: string) => 
    deleteRequest(`/api/projects/${projectId}/document-associations/${assocId}`),
};
