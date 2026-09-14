import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, doublePrecision, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Users table for authentication
 * Phase 12 Auth Addendum - persistent user storage
 */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  salt: text("salt"),
  googleId: text("google_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  passwordHash: true,
  salt: true,
  googleId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/**
 * Password reset tokens table
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

/**
 * Session table for express-session with connect-pg-simple
 * Phase 12 Auth Addendum - persistent session storage
 */
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

/**
 * Auth tokens table for token-based auth fallback
 * Phase 12 Auth Addendum - persistent token storage (when cookies are blocked)
 */
export const authTokens = pgTable("auth_tokens", {
  token: varchar("token").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  userEmail: text("user_email").notNull(),
  userName: text("user_name").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Pending uploads - ownership tokens for upload-first flows
 * Binds object storage paths to project/user at presign time
 */
export const pendingUploads = pgTable("pending_uploads", {
  token: varchar("token").primaryKey(),
  objectPath: text("object_path").notNull(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  purpose: text("purpose").notNull().default("quote"),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  consumed: boolean("consumed").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPendingUploadSchema = createInsertSchema(pendingUploads).omit({
  createdAt: true,
});

export type InsertPendingUpload = z.infer<typeof insertPendingUploadSchema>;
export type PendingUpload = typeof pendingUploads.$inferSelect;

// ============================================================================
// DOMAIN ENTITY TABLES
// ============================================================================

/**
 * Projects - Core project metadata
 * 
 * LIFECYCLE STATE (Phase 3.5):
 * - lifecycleState: 'active' | 'closed' | 'deleted'
 * - Transition rules: active→closed, closed→deleted only
 * - Write guards enforce: only ACTIVE allows writes
 * - Read guards enforce: DELETED blocks all access
 */
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type"),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  color: text("color").notNull(),
  regionalContext: jsonb("regional_context").notNull(),
  members: jsonb("members").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lifecycleState: text("lifecycle_state").notNull().default("active"),
  lifecycleChangedAt: timestamp("lifecycle_changed_at"),
  lifecycleChangedBy: varchar("lifecycle_changed_by").references(() => users.id),
  heroImagePath: text("hero_image_path"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lifecycleState: true,
  lifecycleChangedAt: true,
  lifecycleChangedBy: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

/**
 * Scopes - Scope definitions within a project
 * 
 * @legacy_read_only — DO NOT EXTEND OR WRITE NEW LOGIC
 * This table is part of the LEGACY fixed-hierarchy scope model (scopes → scope_areas → scope_items).
 * The CANONICAL scope model is `scope_nodes` (recursive tree structure).
 * Existing read paths may continue; NO new writes are permitted.
 * See Canon v1.4 for migration guidance.
 */
export const scopes = pgTable("scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  scopesProjectIdx: index("idx_scopes_project").on(table.projectId),
  scopesUserIdx: index("idx_scopes_user").on(table.userId),
}));

export const insertScopeSchema = createInsertSchema(scopes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScope = z.infer<typeof insertScopeSchema>;
export type Scope = typeof scopes.$inferSelect;

/**
 * Scope Nodes - Recursive tree structure for scope definitions
 * Canon v1.4 Compliant — Tree-based declarative inclusion model
 * 
 * @canonical — THIS IS THE AUTHORITATIVE SCOPE MODEL
 * 
 * Replaces the fixed Scope → Area → Item hierarchy with
 * an unbounded recursive tree structure.
 * 
 * Each node represents an included part of the project.
 * Nodes can exist at any depth and may have children.
 * Order and position carry no semantic meaning.
 * 
 * All new scope logic MUST use this model.
 * Legacy models (scopes, scope_areas, scope_items) are READ-ONLY.
 */
export const scopeNodes = pgTable("scope_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  parentId: varchar("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  isExpanded: boolean("is_expanded").notNull().default(true),
  costType: varchar("cost_type", { length: 20 }).notNull().default("standard"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  scopeNodesProjectIdx: index("idx_scope_nodes_project").on(table.projectId),
  scopeNodesUserIdx: index("idx_scope_nodes_user").on(table.userId),
  scopeNodesParentIdx: index("idx_scope_nodes_parent").on(table.parentId),
}));

export const insertScopeNodeSchema = createInsertSchema(scopeNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScopeNode = z.infer<typeof insertScopeNodeSchema>;
export type ScopeNode = typeof scopeNodes.$inferSelect;

/**
 * Budget Data - Budget metadata per project (one per project)
 */
export const budgetData = pgTable("budget_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalBudget: integer("total_budget"),
  currency: text("currency").notNull(),
  notes: text("notes").notNull().default(""),
  contingencyMode: text("contingency_mode").notNull().default("fixed"),
  contingencyValue: integer("contingency_value").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  budgetDataProjectIdx: index("idx_budget_data_project").on(table.projectId),
  budgetDataUserIdx: index("idx_budget_data_user").on(table.userId),
}));

export const insertBudgetDataSchema = createInsertSchema(budgetData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBudgetData = z.infer<typeof insertBudgetDataSchema>;
export type BudgetData = typeof budgetData.$inferSelect;

/**
 * Budget Allocations - Individual budget allocations
 */
export const budgetAllocations = pgTable("budget_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id").notNull().references(() => budgetData.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  target: jsonb("target").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  budgetAllocationsProjectIdx: index("idx_budget_allocations_project").on(table.projectId),
  budgetAllocationsBudgetIdx: index("idx_budget_allocations_budget").on(table.budgetId),
}));

export const insertBudgetAllocationSchema = createInsertSchema(budgetAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBudgetAllocation = z.infer<typeof insertBudgetAllocationSchema>;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;

/**
 * Vendors - Vendor registry
 */
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vendorsProjectIdx: index("idx_vendors_project").on(table.projectId),
  vendorsUserIdx: index("idx_vendors_user").on(table.userId),
}));

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

/**
 * Quotes - Individual quote documents (flat model)
 * Each quote is a self-contained entity with its own document, financials, and status.
 * Related versions share a lineageId and are linked via previousQuoteId.
 * - sourceDocumentId links to the uploaded document
 * - extractionStatus: 'draft' (AI extraction not confirmed) | 'verified' (user confirmed)
 * - commitmentStatus: null (pending verification) | 'active' | 'superseded' | 'accepted'
 */
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  scopeId: varchar("scope_id").references(() => scopeNodes.id),
  description: text("description"),
  status: text("status").notNull().default("new"), // new | draft | committed | accepted
  previousQuoteId: varchar("previous_quote_id"),
  lineageId: varchar("lineage_id"),
  sourceDocumentId: varchar("source_document_id").notNull().references(() => sourceDocuments.id),
  versionNumber: integer("version_number").notNull().default(1),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  extractionStatus: text("extraction_status").notNull().default("draft"),
  commitmentStatus: text("commitment_status"),
  legacyVersionId: varchar("legacy_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  quotesProjectIdx: index("idx_quotes_project").on(table.projectId),
  quotesUserIdx: index("idx_quotes_user").on(table.userId),
  quotesScopeIdx: index("idx_quotes_scope").on(table.scopeId),
  quotesLineageIdx: index("idx_quotes_lineage").on(table.lineageId),
}));

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

/**
 * Quote Versions - Immutable quote snapshots
 * Each version links to exactly ONE source document (immutable)
 * Versions are never edited - only superseded by new versions
 */
export const quoteVersions = pgTable("quote_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  sourceDocumentId: varchar("source_document_id").notNull().references(() => sourceDocuments.id),
  versionNumber: integer("version_number").notNull(),
  validUntil: timestamp("valid_until"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  extractionStatus: text("extraction_status").notNull().default("draft"),
  commitmentStatus: text("commitment_status"),
}, (table) => ({
  quoteVersionsQuoteIdx: index("idx_quote_versions_quote").on(table.quoteId),
  quoteVersionsProjectIdx: index("idx_quote_versions_project").on(table.projectId),
}));

export const insertQuoteVersionSchema = createInsertSchema(quoteVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertQuoteVersion = z.infer<typeof insertQuoteVersionSchema>;
export type QuoteVersion = typeof quoteVersions.$inferSelect;


/**
 * Quote Financials - Extracted financial totals from quotes
 * Separate from line items, stores net/tax/gross for the entire quote
 * is_user_corrected tracks whether user has modified AI-extracted values
 * 
 * @canonical — THIS IS THE AUTHORITATIVE SOURCE FOR QUOTE TOTALS
 * 
 * Used for:
 * - Budget reasoning
 * - AI context assembly
 * - Expected cost calculations (Financing Frame)
 * 
 * Other quote total fields (quoteVersions.total, quoteTotals) are derived or display-only.
 * All financial calculations MUST read from this table.
 */
export const quoteFinancials = pgTable("quote_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  quoteVersionId: varchar("quote_version_id").references(() => quoteVersions.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  netAmount: integer("net_amount"),
  taxRate: doublePrecision("tax_rate"),
  taxAmount: integer("tax_amount"),
  grossAmount: integer("gross_amount"),
  currency: text("currency").notNull().default("EUR"),
  extractedConfidence: text("extracted_confidence").notNull().default("low"), // high | medium | low
  isUserCorrected: boolean("is_user_corrected").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  quoteFinancialsQuoteIdx: index("idx_quote_financials_quote").on(table.quoteId),
  quoteFinancialsProjectIdx: index("idx_quote_financials_project").on(table.projectId),
}));

export const insertQuoteFinancialsSchema = createInsertSchema(quoteFinancials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuoteFinancials = z.infer<typeof insertQuoteFinancialsSchema>;
export type QuoteFinancials = typeof quoteFinancials.$inferSelect;

/**
 * Quote Assessments - AI-generated assessment paragraphs for quotes
 * Cached with contextHash to detect staleness
 */
export const quoteAssessments = pgTable("quote_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  assessment: text("assessment").notNull(),
  model: text("model").notNull(),
  contextHash: text("context_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  quoteAssessmentsQuoteIdx: index("idx_quote_assessments_quote").on(table.quoteId),
  quoteAssessmentsProjectIdx: index("idx_quote_assessments_project").on(table.projectId),
}));

export const insertQuoteAssessmentSchema = createInsertSchema(quoteAssessments).omit({
  id: true,
  createdAt: true,
});

export type InsertQuoteAssessment = z.infer<typeof insertQuoteAssessmentSchema>;
export type QuoteAssessment = typeof quoteAssessments.$inferSelect;

/**
 * Invoices - Invoice headers
 */
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  vendorName: text("vendor_name").notNull(),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  scopeId: varchar("scope_id").references(() => scopeNodes.id),
  reference: text("reference"),
  issueDate: timestamp("issue_date"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
  finalizedAt: timestamp("finalized_at"),
  paidAt: timestamp("paid_at"),
}, (table) => ({
  invoicesProjectIdx: index("idx_invoices_project").on(table.projectId),
  invoicesUserIdx: index("idx_invoices_user").on(table.userId),
  invoicesScopeIdx: index("idx_invoices_scope").on(table.scopeId),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

/**
 * Invoice Lines - Invoice line items
 */
export const invoiceLines = pgTable("invoice_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  description: text("description"),
  amount: integer("amount").notNull(),
  scopeItemId: varchar("scope_item_id"),
  scopeItemName: text("scope_item_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  invoiceLinesInvoiceIdx: index("idx_invoice_lines_invoice").on(table.invoiceId),
  invoiceLinesProjectIdx: index("idx_invoice_lines_project").on(table.projectId),
}));

export const insertInvoiceLineSchema = createInsertSchema(invoiceLines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoiceLine = z.infer<typeof insertInvoiceLineSchema>;
export type InvoiceLine = typeof invoiceLines.$inferSelect;

/**
 * Invoice Payments - Append-only payment records for invoices
 * 
 * Canon v1.4 Compliant — Phase 10.1
 * 
 * Core invariants:
 * - Payments are append-only (no updates/deletes)
 * - Amount stored in minor units (cents) as MoneyValue
 * - Payment cannot exceed outstanding amount (enforced at API level)
 */
export const invoicePayments = pgTable("invoice_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // Amount in minor units (cents)
  currency: text("currency").notNull().default("EUR"),
  paymentDate: timestamp("payment_date").notNull(),
  reference: text("reference"), // External payment reference
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  invoicePaymentsInvoiceIdx: index("idx_invoice_payments_invoice").on(table.invoiceId),
  invoicePaymentsProjectIdx: index("idx_invoice_payments_project").on(table.projectId),
}));

export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({
  id: true,
  createdAt: true,
});

export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type InvoicePayment = typeof invoicePayments.$inferSelect;

/**
 * Financing Sources - Financing sources
 */
export const financingSources = pgTable("financing_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // Loan | Grant | Equity
  amount: integer("amount").notNull(), // Amount confirmed (stored as whole currency units)
  status: text("status").notNull(), // Planned | Confirmed
  monthlyLiability: integer("monthly_liability"), // Monthly EMI/payment obligation
  notes: text("notes"),
  linkedDocuments: text("linked_documents").array(), // Array of document IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  financingSourcesProjectIdx: index("idx_financing_sources_project").on(table.projectId),
  financingSourcesUserIdx: index("idx_financing_sources_user").on(table.userId),
}));

export const insertFinancingSourceSchema = createInsertSchema(financingSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFinancingSource = z.infer<typeof insertFinancingSourceSchema>;
export type FinancingSource = typeof financingSources.$inferSelect;

/**
 * Financing Data - Financing metadata per project
 */
export const financingData = pgTable("financing_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  financingDataProjectIdx: index("idx_financing_data_project").on(table.projectId),
}));

export const insertFinancingDataSchema = createInsertSchema(financingData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFinancingData = z.infer<typeof insertFinancingDataSchema>;
export type FinancingData = typeof financingData.$inferSelect;

/**
 * Execution Tasks - Execution tasks
 */
export const executionTasks = pgTable("execution_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  description: text("description"),
  scopeItemId: varchar("scope_item_id").references(() => scopeNodes.id),
  scopeItemName: text("scope_item_name"),
  status: text("status").notNull().default("to_do"),
  assignee: text("assignee"),
  responsibility: jsonb("responsibility"),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  completedAt: timestamp("completed_at"),
  linkedDocuments: text("linked_documents").array(),
  linkedInvoices: text("linked_invoices").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  executionTasksProjectIdx: index("idx_execution_tasks_project").on(table.projectId),
  executionTasksUserIdx: index("idx_execution_tasks_user").on(table.userId),
}));

export const insertExecutionTaskSchema = createInsertSchema(executionTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertExecutionTask = z.infer<typeof insertExecutionTaskSchema>;
export type ExecutionTask = typeof executionTasks.$inferSelect;

/**
 * Vision Boards - Moodboards
 */
export const visionBoards = pgTable("vision_boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  desireStatement: text("desire_statement"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  themes: jsonb("themes").notNull().default(sql`'[]'::jsonb`),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  visionBoardsProjectIdx: index("idx_vision_boards_project").on(table.projectId),
  visionBoardsUserIdx: index("idx_vision_boards_user").on(table.userId),
}));

export const insertVisionBoardSchema = createInsertSchema(visionBoards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVisionBoard = z.infer<typeof insertVisionBoardSchema>;
export type VisionBoard = typeof visionBoards.$inferSelect;

/**
 * Vision Inspirations - Inspiration images
 */
export const visionInspirations = pgTable("vision_inspirations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => visionBoards.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  preview: jsonb("preview"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  visionInspirationsProjectIdx: index("idx_vision_inspirations_project").on(table.projectId),
  visionInspirationsBoardIdx: index("idx_vision_inspirations_board").on(table.boardId),
}));

export const insertVisionInspirationSchema = createInsertSchema(visionInspirations).omit({
  id: true,
  createdAt: true,
});

export type InsertVisionInspiration = z.infer<typeof insertVisionInspirationSchema>;
export type VisionInspiration = typeof visionInspirations.$inferSelect;

/**
 * Documents - Document/media assets
 */
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  documentType: text("document_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  fileDataUrl: text("file_data_url"),
  checksum: text("checksum"),
  extractedText: text("extracted_text"), // Raw text content extracted from the document
  extractedAt: timestamp("extracted_at"), // When text extraction was performed
  summary: text("summary"), // AI-generated summary of the document
  summaryGeneratedAt: timestamp("summary_generated_at"), // When summary was generated
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  confirmed: boolean("confirmed").default(false).notNull(), // Document is only visible after user confirms ingestion
}, (table) => ({
  documentsProjectIdx: index("idx_documents_project").on(table.projectId),
  documentsUserIdx: index("idx_documents_user").on(table.userId),
}));

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
  extractedText: true,
  extractedAt: true,
  summary: true,
  summaryGeneratedAt: true,
  confirmed: true, // Starts as false, set to true when user confirms ingestion
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

/**
 * Document Associations - Document associations
 */
export const documentAssociations = pgTable("document_associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  associationType: text("association_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityLabel: text("entity_label").notNull(),
}, (table) => ({
  docAssocDocumentIdx: index("idx_doc_associations_document").on(table.documentId),
  docAssocProjectIdx: index("idx_doc_associations_project").on(table.projectId),
  docAssocEntityIdx: index("idx_doc_associations_entity").on(table.entityId),
}));

export const insertDocumentAssociationSchema = createInsertSchema(documentAssociations).omit({
  id: true,
});

export type InsertDocumentAssociation = z.infer<typeof insertDocumentAssociationSchema>;
export type DocumentAssociation = typeof documentAssociations.$inferSelect;

// ============================================================================
// QUOTES DOMAIN ENTITIES (Enhanced Quote Processing)
// ============================================================================

/**
 * Source Documents - Quote source documents (PDF, images, etc)
 * IMMUTABLE: Once created, documents are never modified
 * Per spec: "Quotes are uploaded ONCE as immutable documents"
 */
export const sourceDocuments = pgTable("source_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, CSV
  fileSizeBytes: integer("file_size_bytes"),
  objectStoragePath: text("object_storage_path"), // path in object storage bucket
  languageDetected: text("language_detected"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  checksum: text("checksum"), // for deduplication and integrity
  pageCount: integer("page_count"),
  fileDataUrl: text("file_data_url"), // for base64/data URL fallback
  documentId: varchar("document_id").references(() => documents.id),
  // UDI State Machine: UPLOADED → STORED → CLASSIFIED → TAGGED → INGESTED (terminal)
  ingestionState: text("ingestion_state").notNull().default("uploaded"), // uploaded | stored | classified | tagged | ingested
  // Multi-label classification with confidence
  classificationTypes: jsonb("classification_types").$type<Array<{type: string, confidence: 'low' | 'medium' | 'high'}>>(),
  // Contextual tags for memory
  contextualTags: jsonb("contextual_tags").$type<Record<string, string[]>>(),
  // Interpretation state: null | interpreting | interpreted
  interpretationState: text("interpretation_state"),
}, (table) => ({
  sourceDocumentsProjectIdx: index("idx_source_documents_project").on(table.projectId),
  sourceDocumentsUserIdx: index("idx_source_documents_user").on(table.userId),
}));

export const insertSourceDocumentSchema = createInsertSchema(sourceDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertSourceDocument = z.infer<typeof insertSourceDocumentSchema>;
export type SourceDocument = typeof sourceDocuments.$inferSelect;

/**
 * Vendor Snapshots - Version-bound vendor info
 */
export const vendorSnapshots = pgTable("vendor_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").notNull().references(() => quoteVersions.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  contactDetails: jsonb("contact_details"),
  confidence: text("confidence").notNull(),
}, (table) => ({
  vendorSnapshotsVersionIdx: index("idx_vendor_snapshots_version").on(table.quoteVersionId),
  vendorSnapshotsProjectIdx: index("idx_vendor_snapshots_project").on(table.projectId),
}));

export const insertVendorSnapshotSchema = createInsertSchema(vendorSnapshots).omit({
  id: true,
});

export type InsertVendorSnapshot = z.infer<typeof insertVendorSnapshotSchema>;
export type VendorSnapshot = typeof vendorSnapshots.$inferSelect;

/**
 * Quote Metadata - Quote metadata per version
 */
export const quoteMetadata = pgTable("quote_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").notNull().references(() => quoteVersions.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  quoteNumber: text("quote_number"),
  quoteDate: timestamp("quote_date"),
  validUntil: timestamp("valid_until"),
  currency: text("currency"),
  confidenceMap: jsonb("confidence_map"),
  nativeExtractionData: jsonb("native_extraction_data"),
}, (table) => ({
  quoteMetadataVersionIdx: index("idx_quote_metadata_version").on(table.quoteVersionId),
  quoteMetadataProjectIdx: index("idx_quote_metadata_project").on(table.projectId),
}));

export const insertQuoteMetadataSchema = createInsertSchema(quoteMetadata).omit({
  id: true,
});

export type InsertQuoteMetadata = z.infer<typeof insertQuoteMetadataSchema>;
export type QuoteMetadata = typeof quoteMetadata.$inferSelect;

/**
 * Quote Line Items - Enhanced line items (supplement quoteLines for now)
 * 
 * @legacy_read_only — DO NOT EXTEND OR WRITE NEW LOGIC
 * This table is a LEGACY INGESTION ARTIFACT from quote extraction.
 * Quotes are NOT modeled as line-item domain entities.
 * The CANONICAL source for quote totals is `quote_financials`.
 * Line-level detail is for display/audit only — not for financial calculations.
 * Existing read paths may continue; NO new domain logic may be built on this.
 */
export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").notNull().references(() => quoteVersions.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalNumber: text("original_number"),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity"),
  unit: text("unit"),
  unitPrice: integer("unit_price"),
  totalPrice: integer("total_price"),
  specificationNotes: text("specification_notes"),
  isBundled: boolean("is_bundled").notNull().default(false),
  isOptional: boolean("is_optional").notNull().default(false),
  lineType: text("line_type").notNull().default('item'),
}, (table) => ({
  quoteLineItemsVersionIdx: index("idx_quote_line_items_version").on(table.quoteVersionId),
  quoteLineItemsProjectIdx: index("idx_quote_line_items_project").on(table.projectId),
}));

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
});

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

/**
 * Quote Totals - Calculated totals
 */
export const quoteTotals = pgTable("quote_totals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").notNull().references(() => quoteVersions.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  subtotal: integer("subtotal"),
  totalTax: integer("total_tax"),
  grandTotal: integer("grand_total"),
  confidenceMap: jsonb("confidence_map"),
}, (table) => ({
  quoteTotalsVersionIdx: index("idx_quote_totals_version").on(table.quoteVersionId),
  quoteTotalsProjectIdx: index("idx_quote_totals_project").on(table.projectId),
}));

export const insertQuoteTotalSchema = createInsertSchema(quoteTotals).omit({
  id: true,
});

export type InsertQuoteTotal = z.infer<typeof insertQuoteTotalSchema>;
export type QuoteTotal = typeof quoteTotals.$inferSelect;



// ============================================================================
// CHAT / CONVERSATION TABLES (for AI integration)
// ============================================================================

/**
 * Conversations - Chat conversation threads
 * Project-scoped to ensure data isolation between projects
 * UNIQUE constraint on (project_id, user_id) ensures one conversation per project/user
 */
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectUserUnique: uniqueIndex("conversations_project_user_idx").on(table.projectId, table.userId),
}));

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

/**
 * Messages - Chat messages within conversations
 */
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  messagesConversationIdx: index("idx_messages_conversation").on(table.conversationId),
}));

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

/**
 * AI Proposals - Proposal objects for AI-suggested changes
 * All AI changes must be proposals that require explicit user approval
 */
export const aiProposals = pgTable("ai_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Nullable for project proposals
  userId: varchar("user_id").notNull().references(() => users.id),
  author: text("author").notNull().default("AI"),
  model: text("model").notNull(),
  targetFrame: text("target_frame").notNull(),
  targetEntities: text("target_entities").array().notNull().default(sql`'{}'::text[]`),
  proposedDiff: jsonb("proposed_diff").notNull(),
  rationale: text("rationale").notNull(),
  assumptions: text("assumptions").array().notNull().default(sql`'{}'::text[]`),
  downstreamImpacts: text("downstream_impacts").array().notNull().default(sql`'{}'::text[]`),
  riskLevel: text("risk_level").notNull().default("low"),
  status: text("status").notNull().default("pending"),
  provenance: jsonb("provenance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  aiProposalsProjectIdx: index("idx_ai_proposals_project").on(table.projectId),
  aiProposalsUserIdx: index("idx_ai_proposals_user").on(table.userId),
  aiProposalsStatusIdx: index("idx_ai_proposals_status").on(table.status),
}));

export const insertAiProposalSchema = createInsertSchema(aiProposals).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type InsertAiProposal = z.infer<typeof insertAiProposalSchema>;
export type AiProposal = typeof aiProposals.$inferSelect;

// ============================================================================
// CANONICAL MEMORY (Three-Layer AI Memory Model - Layer 2)
// ============================================================================

/**
 * Canonical Memory - Immutable, append-only decision log
 * 
 * Preserves decisions and facts that must never be forgotten.
 * Written ONLY when:
 * - A proposal is ACCEPTED
 * - A proposal is REJECTED with consequence
 * - Scope is removed
 * - Quote is accepted
 * - Budget intent changes materially
 * 
 * Each entry is a curated, human-readable summary.
 * NEVER stores raw diffs, full objects, or conversation text.
 */
export const canonicalMemory = pgTable("canonical_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // scope_change | budget_change | quote_acceptance | scope_removal | financing_change | proposal_accepted | proposal_rejected
  summary: text("summary").notNull(), // Short semantic sentence describing the event
  relatedFrames: text("related_frames").array().notNull().default(sql`'{}'::text[]`), // Frames affected by this event
  metadata: jsonb("metadata"), // Optional structured data (entity IDs, amounts, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  canonicalMemoryProjectIdx: index("idx_canonical_memory_project").on(table.projectId),
  canonicalMemoryUserIdx: index("idx_canonical_memory_user").on(table.userId),
}));

export const insertCanonicalMemorySchema = createInsertSchema(canonicalMemory).omit({
  id: true,
  createdAt: true,
});

export type InsertCanonicalMemory = z.infer<typeof insertCanonicalMemorySchema>;
export type CanonicalMemory = typeof canonicalMemory.$inferSelect;

export type CanonicalMemoryType = 
  | 'scope_change'
  | 'scope_removal'
  | 'budget_change'
  | 'quote_acceptance'
  | 'financing_change'
  | 'vendor_added'
  | 'invoice_created'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'execution_tasks_created';

/**
 * Overview Cache - Caches AI-generated overview projections per project
 * Avoids repeated LLM calls for the same unchanged project state
 */
export const overviewCache = pgTable("overview_cache", {
  projectId: varchar("project_id").primaryKey().references(() => projects.id),
  contractJson: jsonb("contract_json").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export type OverviewCache = typeof overviewCache.$inferSelect;

// ============================================================================
// RAG DOCUMENT CHUNKS (Semantic Document Retrieval)
// ============================================================================

/**
 * Document Chunks — Stores text chunks from uploaded documents for RAG retrieval.
 * Each document is split into overlapping chunks at upload time.
 * PostgreSQL full-text search (tsvector) is used for keyword-based retrieval.
 * The tsvector column is maintained via a database trigger for efficiency.
 */
export const documentChunks = pgTable("document_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  charStart: integer("char_start").notNull(),
  charEnd: integer("char_end").notNull(),
  metadata: jsonb("metadata").$type<{
    fileName?: string;
    documentType?: string;
    pageNumber?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_document_chunks_project").on(table.projectId),
  index("idx_document_chunks_document").on(table.documentId),
]);

export type DocumentChunk = typeof documentChunks.$inferSelect;

// ============================================================================
// DOCUMENT ANNOTATIONS (append-only notes attached to a document)
// ============================================================================

/**
 * Document annotations — free-text notes a user attaches to a document.
 * Append-only by product rule: annotations are never edited, only added.
 */
export const documentAnnotations = pgTable("document_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  docAnnotationDocumentIdx: index("idx_doc_annotations_document").on(table.documentId),
  docAnnotationProjectIdx: index("idx_doc_annotations_project").on(table.projectId),
}));

export const insertDocumentAnnotationSchema = createInsertSchema(documentAnnotations).omit({
  id: true,
  createdAt: true,
});

export type DocumentAnnotation = typeof documentAnnotations.$inferSelect;
export type InsertDocumentAnnotation = z.infer<typeof insertDocumentAnnotationSchema>;

// ============================================================================
// QUOTE SCOPE REFERENCES (allocation of native quote rows to scope nodes)
// ============================================================================

/**
 * Quote scope references — allocate a single row of a quote's native extraction
 * to a scope node, optionally at a partial percentage. One native row may be
 * split across several scopes; percentages are stored per reference.
 *
 * `nativeQuoteRowId` is the row id inside the version's stored native
 * extraction JSON (quote_metadata.native_extraction_data), not a table FK.
 */
export const quoteScopeReferences = pgTable("quote_scope_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteVersionId: varchar("quote_version_id").notNull(),
  nativeQuoteRowId: text("native_quote_row_id").notNull(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  scopeId: varchar("scope_id").notNull(),
  scopeAreaId: varchar("scope_area_id"),
  scopeItemId: varchar("scope_item_id"),
  allocationPercentage: integer("allocation_percentage").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  quoteScopeRefVersionIdx: index("idx_quote_scope_refs_version").on(table.quoteVersionId),
  quoteScopeRefProjectIdx: index("idx_quote_scope_refs_project").on(table.projectId),
  quoteScopeRefScopeIdx: index("idx_quote_scope_refs_scope").on(table.scopeId),
}));

export const insertQuoteScopeReferenceSchema = createInsertSchema(quoteScopeReferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type QuoteScopeReference = typeof quoteScopeReferences.$inferSelect;
export type InsertQuoteScopeReference = z.infer<typeof insertQuoteScopeReferenceSchema>;
