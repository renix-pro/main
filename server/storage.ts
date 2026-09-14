import {
  type PasswordResetToken,
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Scope,
  type InsertScope,
  type ScopeNode,
  type InsertScopeNode,
  type BudgetData,
  type InsertBudgetData,
  type BudgetAllocation,
  type InsertBudgetAllocation,
  type Vendor,
  type InsertVendor,
  type Quote,
  type InsertQuote,
  type QuoteVersion,
  type InsertQuoteVersion,
  type Invoice,
  type InsertInvoice,
  type InvoiceLine,
  type InsertInvoiceLine,
  type InvoicePayment,
  type InsertInvoicePayment,
  type FinancingData,
  type InsertFinancingData,
  type FinancingSource,
  type InsertFinancingSource,
  type ExecutionTask,
  type InsertExecutionTask,
  type VisionBoard,
  type InsertVisionBoard,
  type VisionInspiration,
  type InsertVisionInspiration,
  type Document,
  type InsertDocument,
  type DocumentAssociation,
  type InsertDocumentAssociation,
  type SourceDocument,
  type InsertSourceDocument,
  type VendorSnapshot,
  type InsertVendorSnapshot,
  type QuoteMetadata,
  type InsertQuoteMetadata,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type QuoteTotal,
  type InsertQuoteTotal,
  type PendingUpload,
  type InsertPendingUpload,
  type AiProposal,
  type InsertAiProposal,
  type QuoteFinancials,
  type InsertQuoteFinancials,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { db } from "./db";
import { type LifecycleStateType } from '@shared/constants';

import * as userStorage from './storage/users';
import * as projectStorage from './storage/projects';
import * as scopeStorage from './storage/scope';
import * as budgetStorage from './storage/budget';
import * as quotesStorage from './storage/quotes';
import * as invoicesStorage from './storage/invoices';
import * as financingStorage from './storage/financing';
import * as executionStorage from './storage/execution';
import * as visionStorage from './storage/vision';
import * as documentsStorage from './storage/documents';
import * as documentCleanup from './storage/documentCleanup';
import * as aiStorage from './storage/ai';

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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Pick<User, 'name' | 'passwordHash' | 'salt' | 'googleId'>>): Promise<User | undefined>;

  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(tokenId: string): Promise<void>;

  getProjectsByUser(userId: string, includeDeleted?: boolean): Promise<Project[]>;
  getProjectById(id: string, userId: string, includeDeleted?: boolean): Promise<Project | undefined>;
  getProjectByIdOnly(id: string, includeDeleted?: boolean): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, userId: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  softDeleteProject(id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }>;
  closeProject(id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }>;
  getProjectLifecycleState(id: string, userId: string): Promise<LifecycleStateType | null>;

  getScopesByProject(projectId: string, userId: string): Promise<Scope[]>;
  createScope(scope: InsertScope): Promise<Scope>;
  updateScope(id: string, userId: string, updates: Partial<InsertScope>): Promise<Scope | undefined>;
  deleteScope(id: string, userId: string): Promise<boolean>;

  getScopeNodesByProject(projectId: string, userId: string): Promise<ScopeNode[]>;
  getScopeNodeById(id: string, userId: string): Promise<ScopeNode | undefined>;
  createScopeNode(node: InsertScopeNode): Promise<ScopeNode>;
  updateScopeNode(id: string, userId: string, updates: Partial<InsertScopeNode>): Promise<ScopeNode | undefined>;
  moveScopeNode(id: string, userId: string, newParentId: string | null, newSortOrder?: number): Promise<ScopeNode | undefined>;
  reorderScopeNode(id: string, userId: string, newSortOrder: number): Promise<ScopeNode | undefined>;
  batchReorderScopeNodes(userId: string, updates: { nodeId: string; sortOrder: number }[]): Promise<boolean>;
  archiveScopeNode(id: string, userId: string): Promise<boolean>;
  deleteScopeNode(id: string, userId: string): Promise<boolean>;
  getScopeNodeImpact(nodeId: string, projectId: string, userId: string): Promise<ScopeNodeImpact | null>;

  getBudgetByProject(projectId: string, userId: string): Promise<BudgetData | undefined>;
  createBudget(budget: InsertBudgetData): Promise<BudgetData>;
  updateBudget(id: string, userId: string, updates: Partial<InsertBudgetData>): Promise<BudgetData | undefined>;

  getAllocationsByBudget(budgetId: string, userId: string): Promise<BudgetAllocation[]>;
  createAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation>;
  updateAllocation(id: string, userId: string, updates: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined>;
  deleteAllocation(id: string, userId: string): Promise<boolean>;

  getVendorsByProject(projectId: string, userId: string): Promise<Vendor[]>;
  getVendorByName(projectId: string, userId: string, name: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, userId: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string, userId: string): Promise<boolean>;

  getQuotesByProject(projectId: string, userId: string): Promise<Quote[]>;
  getQuoteById(id: string, userId: string): Promise<Quote | undefined>;
  getQuoteByLegacyVersionId(legacyVersionId: string, userId: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, userId: string, updates: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string, userId: string): Promise<boolean>;

  getVersionsByQuote(quoteId: string, userId: string): Promise<QuoteVersion[]>;
  getQuoteVersionById(id: string, userId: string): Promise<QuoteVersion | undefined>;
  createQuoteVersion(version: InsertQuoteVersion): Promise<QuoteVersion>;
  updateQuoteVersion(id: string, userId: string, updates: Partial<InsertQuoteVersion>): Promise<QuoteVersion | undefined>;
  updateVersionStatus(versionId: string, userId: string, updates: { extractionStatus?: string; commitmentStatus?: string }): Promise<QuoteVersion | undefined>;


  getFinancialsByQuote(quoteId: string, userId: string): Promise<QuoteFinancials | undefined>;
  getFinancialsByVersion(versionId: string, userId: string): Promise<QuoteFinancials | undefined>;
  createQuoteFinancials(financials: InsertQuoteFinancials): Promise<QuoteFinancials>;
  updateQuoteFinancials(id: string, userId: string, updates: Partial<InsertQuoteFinancials>): Promise<QuoteFinancials | undefined>;

  getInvoicesByProject(projectId: string, userId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string, userId: string): Promise<boolean>;

  getLinesByInvoice(invoiceId: string, userId: string): Promise<InvoiceLine[]>;
  createInvoiceLine(line: InsertInvoiceLine): Promise<InvoiceLine>;
  updateInvoiceLine(id: string, userId: string, updates: Partial<InsertInvoiceLine>): Promise<InvoiceLine | undefined>;
  deleteInvoiceLine(id: string, userId: string): Promise<boolean>;

  getPaymentsByInvoice(invoiceId: string, userId: string): Promise<InvoicePayment[]>;
  getPaymentsByProject(projectId: string, userId: string): Promise<InvoicePayment[]>;
  createInvoicePayment(payment: InsertInvoicePayment): Promise<InvoicePayment>;
  deleteInvoicePayment(paymentId: string, userId: string): Promise<boolean>;
  getInvoiceTotalAmount(invoiceId: string, userId: string): Promise<number>;
  getInvoicePaidAmount(invoiceId: string, userId: string): Promise<number>;
  getInvoiceOutstandingAmount(invoiceId: string, userId: string): Promise<number>;
  deleteInvoiceCascade(invoiceId: string, userId: string): Promise<boolean>;

  getFinancingByProject(projectId: string, userId: string): Promise<FinancingData | undefined>;
  createFinancingData(data: InsertFinancingData): Promise<FinancingData>;
  updateFinancingData(id: string, userId: string, updates: Partial<InsertFinancingData>): Promise<FinancingData | undefined>;

  getSourcesByProject(projectId: string, userId: string): Promise<FinancingSource[]>;
  createSource(source: InsertFinancingSource): Promise<FinancingSource>;
  updateSource(id: string, userId: string, updates: Partial<InsertFinancingSource>): Promise<FinancingSource | undefined>;
  deleteSource(id: string, userId: string): Promise<boolean>;

  getTasksByProject(projectId: string, userId: string): Promise<ExecutionTask[]>;
  createTask(task: InsertExecutionTask): Promise<ExecutionTask>;
  updateTask(id: string, userId: string, updates: Partial<InsertExecutionTask>): Promise<ExecutionTask | undefined>;
  deleteTask(id: string, userId: string): Promise<boolean>;

  getTaskAggregates(projectId: string, userId: string): Promise<executionStorage.TaskAggregates>;

  getBoardsByProject(projectId: string, userId: string): Promise<VisionBoard[]>;
  getBoardById(id: string, projectId: string, userId: string): Promise<VisionBoard | undefined>;
  createBoard(board: InsertVisionBoard): Promise<VisionBoard>;
  updateBoard(id: string, projectId: string, userId: string, updates: Partial<InsertVisionBoard>): Promise<VisionBoard | undefined>;
  deleteBoard(id: string, projectId: string, userId: string): Promise<boolean>;

  getInspirationsByProject(projectId: string, userId: string): Promise<VisionInspiration[]>;
  getInspirationsByBoard(boardId: string, userId: string): Promise<VisionInspiration[]>;
  getInspirationById(id: string, projectId: string, userId: string): Promise<VisionInspiration | undefined>;
  createInspiration(insp: InsertVisionInspiration): Promise<VisionInspiration>;
  updateInspiration(id: string, projectId: string, userId: string, updates: Partial<InsertVisionInspiration>): Promise<VisionInspiration | undefined>;
  deleteInspiration(id: string, projectId: string, userId: string): Promise<boolean>;

  getDocumentsByProject(projectId: string, userId: string): Promise<Document[]>;
  getDocumentById(documentId: string, userId: string): Promise<Document | undefined>;
  getDocumentByChecksum(projectId: string, userId: string, checksum: string): Promise<Document | null>;
  createDocument(doc: InsertDocument, opts?: { confirmed?: boolean }): Promise<Document>;
  updateDocument(id: string, userId: string, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  confirmDocument(id: string, userId: string): Promise<Document | undefined>;
  deleteDocument(id: string, userId: string): Promise<boolean>;

  getAssociationsByDocument(documentId: string, userId: string): Promise<DocumentAssociation[]>;
  createAssociation(assoc: InsertDocumentAssociation): Promise<DocumentAssociation>;
  deleteAssociation(id: string, userId: string): Promise<boolean>;
  deleteAssociationsByEntity(associationType: string, entityId: string, userId: string): Promise<number>;
  getAssociationsByEntity(associationType: string, entityId: string, userId: string): Promise<DocumentAssociation[]>;
  cleanupEntityDocuments(entityType: string, entityId: string, userId: string): Promise<{ deletedDocuments: number; removedAssociations: number }>;
  cleanupScopeAssociations(scopeId: string, userId: string): Promise<number>;

  getSourceDocumentsByProject(projectId: string, userId: string): Promise<SourceDocument[]>;
  getSourceDocumentByChecksum(projectId: string, userId: string, checksum: string): Promise<SourceDocument | null>;
  createSourceDocument(doc: InsertSourceDocument): Promise<SourceDocument>;
  updateSourceDocument(id: string, userId: string, updates: Partial<{
    ingestionState: string;
    classificationTypes: Array<{type: string, confidence: 'low' | 'medium' | 'high'}>;
    contextualTags: Record<string, string[]>;
    interpretationState: string | null;
  }>): Promise<SourceDocument | null>;
  deleteSourceDocument(id: string, userId: string): Promise<boolean>;

  getVendorSnapshotByVersion(quoteVersionId: string, userId: string): Promise<VendorSnapshot | undefined>;
  createVendorSnapshot(snapshot: InsertVendorSnapshot): Promise<VendorSnapshot>;
  updateVendorSnapshot(id: string, userId: string, updates: { name?: string; contactDetails?: any; confidence?: string }): Promise<VendorSnapshot | undefined>;

  getQuoteMetadataByVersion(quoteVersionId: string, userId: string): Promise<QuoteMetadata | undefined>;
  createQuoteMetadata(metadata: InsertQuoteMetadata): Promise<QuoteMetadata>;
  updateQuoteMetadata(id: string, userId: string, updates: Partial<InsertQuoteMetadata>): Promise<QuoteMetadata | undefined>;

  getLineItemsByVersion(quoteVersionId: string, userId: string): Promise<QuoteLineItem[]>;
  createQuoteLineItem(item: InsertQuoteLineItem): Promise<QuoteLineItem>;
  updateQuoteLineItem(id: string, userId: string, updates: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem | undefined>;
  deleteQuoteLineItem(id: string, userId: string): Promise<boolean>;
  deleteSubtotalAndTotalLineItems(quoteVersionId: string, userId: string): Promise<number>;

  getTotalsByVersion(quoteVersionId: string, userId: string): Promise<QuoteTotal | undefined>;
  createQuoteTotals(totals: InsertQuoteTotal): Promise<QuoteTotal>;
  updateQuoteTotals(id: string, userId: string, updates: Partial<InsertQuoteTotal>): Promise<QuoteTotal | undefined>;

  getAuthToken(token: string): Promise<{ userId: string; userEmail: string; userName: string; expiresAt: Date } | undefined>;
  createAuthToken(token: string, userId: string, userEmail: string, userName: string, expiresAt: Date): Promise<void>;
  deleteAuthToken(token: string): Promise<void>;

  createPendingUpload(upload: InsertPendingUpload): Promise<PendingUpload>;
  getPendingUpload(token: string): Promise<PendingUpload | undefined>;
  consumePendingUpload(token: string): Promise<PendingUpload | undefined>;
  deleteExpiredPendingUploads(): Promise<void>;

  getProposal(id: string, userId: string): Promise<AiProposal | undefined>;
  getProposalsByUser(userId: string, projectId?: string): Promise<AiProposal[]>;
  createProposal(proposal: InsertAiProposal): Promise<AiProposal>;
  updateProposalStatus(id: string, userId: string, status: string, reason?: string): Promise<AiProposal | undefined>;
  deleteProposal(id: string, userId: string): Promise<boolean>;

  getConversationsByProject(projectId: string, userId: string): Promise<Conversation[]>;
  getConversationById(id: string, userId: string): Promise<Conversation | undefined>;
  getProjectConversation(projectId: string, userId: string): Promise<Conversation | undefined>;
  getOrCreateProjectConversation(projectId: string, userId: string): Promise<Conversation>;
  createConversationWithFirstMessage(
    projectId: string,
    userId: string,
    userMessage: string,
    assistantMessage: string,
    assistantMetadata?: Record<string, any>
  ): Promise<{ conversation: Conversation; userMessageId: string | null; assistantMessageId: string | null }>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, userId: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string, userId: string): Promise<boolean>;

  getMessagesByConversation(conversationId: string, userId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<InsertMessage>): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<boolean>;
}

export class PgStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return userStorage.getUser(db, id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return userStorage.getUserByEmail(db, email);
  }

  async createUser(user: InsertUser): Promise<User> {
    return userStorage.createUser(db, user);
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'name' | 'passwordHash' | 'salt' | 'googleId'>>): Promise<User | undefined> {
    return userStorage.updateUser(db, id, updates);
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    return userStorage.createPasswordResetToken(db, userId, token, expiresAt);
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return userStorage.getPasswordResetToken(db, token);
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    return userStorage.markTokenUsed(db, tokenId);
  }

  async getProjectsByUser(userId: string, includeDeleted: boolean = false): Promise<Project[]> {
    return projectStorage.getProjectsByUser(db, userId, includeDeleted);
  }

  async getProjectById(id: string, userId: string, includeDeleted: boolean = false): Promise<Project | undefined> {
    return projectStorage.getProjectById(db, id, userId, includeDeleted);
  }

  async getProjectByIdOnly(id: string, includeDeleted: boolean = false): Promise<Project | undefined> {
    return projectStorage.getProjectByIdOnly(db, id, includeDeleted);
  }

  async createProject(project: InsertProject): Promise<Project> {
    return projectStorage.createProject(db, project);
  }

  async updateProject(id: string, userId: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    return projectStorage.updateProject(db, id, userId, updates);
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    return projectStorage.deleteProject(db, id, userId);
  }

  async softDeleteProject(id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
    return projectStorage.softDeleteProject(db, id, userId);
  }

  async closeProject(id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
    return projectStorage.closeProject(db, id, userId);
  }

  async getProjectLifecycleState(id: string, userId: string): Promise<LifecycleStateType | null> {
    return projectStorage.getProjectLifecycleState(db, id, userId);
  }

  async getScopesByProject(projectId: string, userId: string): Promise<Scope[]> {
    return scopeStorage.getScopesByProject(db, projectId, userId);
  }

  async createScope(scope: InsertScope): Promise<Scope> {
    return scopeStorage.createScope(db, scope);
  }

  async updateScope(id: string, userId: string, updates: Partial<InsertScope>): Promise<Scope | undefined> {
    return scopeStorage.updateScope(db, id, userId, updates);
  }

  async deleteScope(id: string, userId: string): Promise<boolean> {
    return scopeStorage.deleteScope(db, id, userId);
  }

  async getScopeNodesByProject(projectId: string, userId: string): Promise<ScopeNode[]> {
    return scopeStorage.getScopeNodesByProject(db, projectId, userId);
  }

  async getScopeNodeById(id: string, userId: string): Promise<ScopeNode | undefined> {
    return scopeStorage.getScopeNodeById(db, id, userId);
  }

  async createScopeNode(node: InsertScopeNode): Promise<ScopeNode> {
    return scopeStorage.createScopeNode(db, node);
  }

  async updateScopeNode(id: string, userId: string, updates: Partial<InsertScopeNode>): Promise<ScopeNode | undefined> {
    return scopeStorage.updateScopeNode(db, id, userId, updates);
  }

  async moveScopeNode(id: string, userId: string, newParentId: string | null, newSortOrder?: number): Promise<ScopeNode | undefined> {
    return scopeStorage.moveScopeNode(db, id, userId, newParentId, newSortOrder);
  }

  async reorderScopeNode(id: string, userId: string, newSortOrder: number): Promise<ScopeNode | undefined> {
    return scopeStorage.reorderScopeNode(db, id, userId, newSortOrder);
  }

  async batchReorderScopeNodes(userId: string, updates: { nodeId: string; sortOrder: number }[]): Promise<boolean> {
    return scopeStorage.batchReorderScopeNodes(db, userId, updates);
  }

  async archiveScopeNode(id: string, userId: string): Promise<boolean> {
    return scopeStorage.archiveScopeNode(db, id, userId);
  }

  async deleteScopeNode(id: string, userId: string): Promise<boolean> {
    return scopeStorage.deleteScopeNode(db, id, userId);
  }

  async getScopeNodeImpact(nodeId: string, projectId: string, userId: string): Promise<ScopeNodeImpact | null> {
    return scopeStorage.getScopeNodeImpact(db, nodeId, projectId, userId, {
      getBudgetByProject: (pId, uId) => budgetStorage.getBudgetByProject(db, pId, uId),
      getAllocationsByBudget: (bId, uId) => budgetStorage.getAllocationsByBudget(db, bId, uId),
      getQuotesByProject: (pId, uId) => quotesStorage.getQuotesByProject(db, pId, uId),
      getVersionsByQuote: (qId, uId) => quotesStorage.getVersionsByQuote(db, qId, uId),
      getTasksByProject: (pId, uId) => executionStorage.getTasksByProject(db, pId, uId),
    });
  }

  async getBudgetByProject(projectId: string, userId: string): Promise<BudgetData | undefined> {
    return budgetStorage.getBudgetByProject(db, projectId, userId);
  }

  async createBudget(budget: InsertBudgetData): Promise<BudgetData> {
    return budgetStorage.createBudget(db, budget);
  }

  async updateBudget(id: string, userId: string, updates: Partial<InsertBudgetData>): Promise<BudgetData | undefined> {
    return budgetStorage.updateBudget(db, id, userId, updates);
  }

  async getAllocationsByBudget(budgetId: string, userId: string): Promise<BudgetAllocation[]> {
    return budgetStorage.getAllocationsByBudget(db, budgetId, userId);
  }

  async createAllocation(allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
    return budgetStorage.createAllocation(db, allocation);
  }

  async updateAllocation(id: string, userId: string, updates: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined> {
    return budgetStorage.updateAllocation(db, id, userId, updates);
  }

  async deleteAllocation(id: string, userId: string): Promise<boolean> {
    return budgetStorage.deleteAllocation(db, id, userId);
  }

  async getVendorsByProject(projectId: string, userId: string): Promise<Vendor[]> {
    return quotesStorage.getVendorsByProject(db, projectId, userId);
  }

  async getVendorByName(projectId: string, userId: string, name: string): Promise<Vendor | undefined> {
    return quotesStorage.getVendorByName(db, projectId, userId, name);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    return quotesStorage.createVendor(db, vendor);
  }

  async updateVendor(id: string, userId: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined> {
    return quotesStorage.updateVendor(db, id, userId, updates);
  }

  async deleteVendor(id: string, userId: string): Promise<boolean> {
    return quotesStorage.deleteVendor(db, id, userId);
  }

  async getQuotesByProject(projectId: string, userId: string): Promise<Quote[]> {
    return quotesStorage.getQuotesByProject(db, projectId, userId);
  }

  async getQuoteById(id: string, userId: string): Promise<Quote | undefined> {
    return quotesStorage.getQuoteById(db, id, userId);
  }

  async getQuoteByLegacyVersionId(legacyVersionId: string, userId: string): Promise<Quote | undefined> {
    return quotesStorage.getQuoteByLegacyVersionId(db, legacyVersionId, userId);
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    return quotesStorage.createQuote(db, quote);
  }

  async updateQuote(id: string, userId: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    return quotesStorage.updateQuote(db, id, userId, updates);
  }

  async deleteQuote(id: string, userId: string): Promise<boolean> {
    return quotesStorage.deleteQuote(db, id, userId);
  }

  async getVersionsByQuote(quoteId: string, userId: string): Promise<QuoteVersion[]> {
    return quotesStorage.getVersionsByQuote(db, quoteId, userId);
  }

  async getQuoteVersionById(id: string, userId: string): Promise<QuoteVersion | undefined> {
    return quotesStorage.getQuoteVersionById(db, id, userId);
  }

  async createQuoteVersion(version: InsertQuoteVersion): Promise<QuoteVersion> {
    return quotesStorage.createQuoteVersion(db, version);
  }

  async updateQuoteVersion(id: string, userId: string, updates: Partial<InsertQuoteVersion>): Promise<QuoteVersion | undefined> {
    return quotesStorage.updateQuoteVersion(db, id, userId, updates);
  }

  async updateVersionStatus(versionId: string, userId: string, updates: { extractionStatus?: string; commitmentStatus?: string }): Promise<QuoteVersion | undefined> {
    return quotesStorage.updateVersionStatus(db, versionId, userId, updates);
  }


  async getFinancialsByQuote(quoteId: string, userId: string): Promise<QuoteFinancials | undefined> {
    return quotesStorage.getFinancialsByQuote(db, quoteId, userId);
  }

  async getFinancialsByVersion(versionId: string, userId: string): Promise<QuoteFinancials | undefined> {
    return quotesStorage.getFinancialsByVersion(db, versionId, userId);
  }

  async createQuoteFinancials(financials: InsertQuoteFinancials): Promise<QuoteFinancials> {
    return quotesStorage.createQuoteFinancials(db, financials);
  }

  async updateQuoteFinancials(id: string, userId: string, updates: Partial<InsertQuoteFinancials>): Promise<QuoteFinancials | undefined> {
    return quotesStorage.updateQuoteFinancials(db, id, userId, updates);
  }

  async getInvoicesByProject(projectId: string, userId: string): Promise<Invoice[]> {
    return invoicesStorage.getInvoicesByProject(db, projectId, userId);
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    return invoicesStorage.createInvoice(db, invoice);
  }

  async updateInvoice(id: string, userId: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    return invoicesStorage.updateInvoice(db, id, userId, updates);
  }

  async deleteInvoice(id: string, userId: string): Promise<boolean> {
    return invoicesStorage.deleteInvoice(db, id, userId);
  }

  async getLinesByInvoice(invoiceId: string, userId: string): Promise<InvoiceLine[]> {
    return invoicesStorage.getLinesByInvoice(db, invoiceId, userId);
  }

  async createInvoiceLine(line: InsertInvoiceLine): Promise<InvoiceLine> {
    return invoicesStorage.createInvoiceLine(db, line);
  }

  async updateInvoiceLine(id: string, userId: string, updates: Partial<InsertInvoiceLine>): Promise<InvoiceLine | undefined> {
    return invoicesStorage.updateInvoiceLine(db, id, userId, updates);
  }

  async deleteInvoiceLine(id: string, userId: string): Promise<boolean> {
    return invoicesStorage.deleteInvoiceLine(db, id, userId);
  }

  async getPaymentsByInvoice(invoiceId: string, userId: string): Promise<InvoicePayment[]> {
    return invoicesStorage.getPaymentsByInvoice(db, invoiceId, userId);
  }

  async getPaymentsByProject(projectId: string, userId: string): Promise<InvoicePayment[]> {
    return invoicesStorage.getPaymentsByProject(db, projectId, userId);
  }

  async createInvoicePayment(payment: InsertInvoicePayment): Promise<InvoicePayment> {
    return invoicesStorage.createInvoicePayment(db, payment);
  }

  async deleteInvoicePayment(paymentId: string, userId: string): Promise<boolean> {
    return invoicesStorage.deleteInvoicePayment(db, paymentId, userId);
  }

  async getInvoiceTotalAmount(invoiceId: string, userId: string): Promise<number> {
    return invoicesStorage.getInvoiceTotalAmount(db, invoiceId, userId);
  }

  async getInvoicePaidAmount(invoiceId: string, userId: string): Promise<number> {
    return invoicesStorage.getInvoicePaidAmount(db, invoiceId, userId);
  }

  async getInvoiceOutstandingAmount(invoiceId: string, userId: string): Promise<number> {
    return invoicesStorage.getInvoiceOutstandingAmount(db, invoiceId, userId);
  }

  async deleteInvoiceCascade(invoiceId: string, userId: string): Promise<boolean> {
    return invoicesStorage.deleteInvoiceCascade(db, invoiceId, userId, documentCleanup.cleanupEntityDocuments);
  }

  async getFinancingByProject(projectId: string, userId: string): Promise<FinancingData | undefined> {
    return financingStorage.getFinancingByProject(db, projectId, userId);
  }

  async createFinancingData(data: InsertFinancingData): Promise<FinancingData> {
    return financingStorage.createFinancingData(db, data);
  }

  async updateFinancingData(id: string, userId: string, updates: Partial<InsertFinancingData>): Promise<FinancingData | undefined> {
    return financingStorage.updateFinancingData(db, id, userId, updates);
  }

  async getSourcesByProject(projectId: string, userId: string): Promise<FinancingSource[]> {
    return financingStorage.getSourcesByProject(db, projectId, userId);
  }

  async createSource(source: InsertFinancingSource): Promise<FinancingSource> {
    return financingStorage.createSource(db, source);
  }

  async updateSource(id: string, userId: string, updates: Partial<InsertFinancingSource>): Promise<FinancingSource | undefined> {
    return financingStorage.updateSource(db, id, userId, updates);
  }

  async deleteSource(id: string, userId: string): Promise<boolean> {
    return financingStorage.deleteSource(db, id, userId);
  }

  async getTasksByProject(projectId: string, userId: string): Promise<ExecutionTask[]> {
    return executionStorage.getTasksByProject(db, projectId, userId);
  }

  async createTask(task: InsertExecutionTask): Promise<ExecutionTask> {
    return executionStorage.createTask(db, task);
  }

  async updateTask(id: string, userId: string, updates: Partial<InsertExecutionTask>): Promise<ExecutionTask | undefined> {
    return executionStorage.updateTask(db, id, userId, updates);
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    return executionStorage.deleteTask(db, id, userId);
  }

  async getTaskAggregates(projectId: string, userId: string): Promise<executionStorage.TaskAggregates> {
    return executionStorage.getTaskAggregates(db, projectId, userId);
  }

  async getBoardsByProject(projectId: string, userId: string): Promise<VisionBoard[]> {
    return visionStorage.getBoardsByProject(db, projectId, userId);
  }

  async getBoardById(id: string, projectId: string, userId: string): Promise<VisionBoard | undefined> {
    return visionStorage.getBoardById(db, id, projectId, userId);
  }

  async createBoard(board: InsertVisionBoard): Promise<VisionBoard> {
    return visionStorage.createBoard(db, board);
  }

  async updateBoard(id: string, projectId: string, userId: string, updates: Partial<InsertVisionBoard>): Promise<VisionBoard | undefined> {
    return visionStorage.updateBoard(db, id, projectId, userId, updates);
  }

  async deleteBoard(id: string, projectId: string, userId: string): Promise<boolean> {
    return visionStorage.deleteBoard(db, id, projectId, userId);
  }

  async getInspirationsByProject(projectId: string, userId: string): Promise<VisionInspiration[]> {
    return visionStorage.getInspirationsByProject(db, projectId, userId);
  }

  async getInspirationsByBoard(boardId: string, userId: string): Promise<VisionInspiration[]> {
    return visionStorage.getInspirationsByBoard(db, boardId, userId);
  }

  async getInspirationById(id: string, projectId: string, userId: string): Promise<VisionInspiration | undefined> {
    return visionStorage.getInspirationById(db, id, projectId, userId);
  }

  async createInspiration(insp: InsertVisionInspiration): Promise<VisionInspiration> {
    return visionStorage.createInspiration(db, insp);
  }

  async updateInspiration(id: string, projectId: string, userId: string, updates: Partial<InsertVisionInspiration>): Promise<VisionInspiration | undefined> {
    return visionStorage.updateInspiration(db, id, projectId, userId, updates);
  }

  async deleteInspiration(id: string, projectId: string, userId: string): Promise<boolean> {
    return visionStorage.deleteInspiration(db, id, projectId, userId);
  }

  async getDocumentsByProject(projectId: string, userId: string): Promise<Document[]> {
    return documentsStorage.getDocumentsByProject(db, projectId, userId);
  }

  async getDocumentById(documentId: string, userId: string): Promise<Document | undefined> {
    return documentsStorage.getDocumentById(db, documentId, userId);
  }

  async getDocumentByChecksum(projectId: string, userId: string, checksum: string): Promise<Document | null> {
    return documentsStorage.getDocumentByChecksum(db, projectId, userId, checksum);
  }

  async createDocument(doc: InsertDocument, opts?: { confirmed?: boolean }): Promise<Document> {
    return documentsStorage.createDocument(db, doc, opts);
  }

  async updateDocument(id: string, userId: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    return documentsStorage.updateDocument(db, id, userId, updates);
  }

  async confirmDocument(id: string, userId: string): Promise<Document | undefined> {
    return documentsStorage.confirmDocument(db, id, userId);
  }

  async deleteDocument(id: string, userId: string): Promise<boolean> {
    return documentsStorage.deleteDocument(db, id, userId);
  }

  async getAssociationsByDocument(documentId: string, userId: string): Promise<DocumentAssociation[]> {
    return documentsStorage.getAssociationsByDocument(db, documentId, userId);
  }

  async createAssociation(assoc: InsertDocumentAssociation): Promise<DocumentAssociation> {
    return documentsStorage.createAssociation(db, assoc);
  }

  async deleteAssociation(id: string, userId: string): Promise<boolean> {
    return documentsStorage.deleteAssociation(db, id, userId);
  }

  async deleteAssociationsByEntity(associationType: string, entityId: string, userId: string): Promise<number> {
    return documentsStorage.deleteAssociationsByEntity(db, associationType, entityId, userId);
  }

  async getAssociationsByEntity(associationType: string, entityId: string, userId: string): Promise<DocumentAssociation[]> {
    return documentsStorage.getAssociationsByEntity(db, associationType, entityId, userId);
  }

  async cleanupEntityDocuments(entityType: string, entityId: string, userId: string): Promise<{ deletedDocuments: number; removedAssociations: number }> {
    return documentCleanup.cleanupEntityDocuments(db, entityType, entityId, userId);
  }

  async cleanupScopeAssociations(scopeId: string, userId: string): Promise<number> {
    return documentCleanup.cleanupScopeAssociations(db, scopeId, userId);
  }

  async getSourceDocumentsByProject(projectId: string, userId: string): Promise<SourceDocument[]> {
    return documentsStorage.getSourceDocumentsByProject(db, projectId, userId);
  }

  async getSourceDocumentByChecksum(projectId: string, userId: string, checksum: string): Promise<SourceDocument | null> {
    return documentsStorage.getSourceDocumentByChecksum(db, projectId, userId, checksum);
  }

  async createSourceDocument(doc: InsertSourceDocument): Promise<SourceDocument> {
    return documentsStorage.createSourceDocument(db, doc);
  }

  async updateSourceDocument(id: string, userId: string, updates: Partial<{
    ingestionState: string;
    classificationTypes: Array<{type: string, confidence: 'low' | 'medium' | 'high'}>;
    contextualTags: Record<string, string[]>;
    interpretationState: string | null;
  }>): Promise<SourceDocument | null> {
    return documentsStorage.updateSourceDocument(db, id, userId, updates);
  }

  async deleteSourceDocument(id: string, userId: string): Promise<boolean> {
    return documentsStorage.deleteSourceDocument(db, id, userId);
  }

  async getVendorSnapshotByVersion(quoteVersionId: string, userId: string): Promise<VendorSnapshot | undefined> {
    return quotesStorage.getVendorSnapshotByVersion(db, quoteVersionId, userId);
  }

  async createVendorSnapshot(snapshot: InsertVendorSnapshot): Promise<VendorSnapshot> {
    return quotesStorage.createVendorSnapshot(db, snapshot);
  }

  async updateVendorSnapshot(id: string, userId: string, updates: { name?: string; contactDetails?: any; confidence?: string }): Promise<VendorSnapshot | undefined> {
    return quotesStorage.updateVendorSnapshot(db, id, userId, updates);
  }

  async getQuoteMetadataByVersion(quoteVersionId: string, userId: string): Promise<QuoteMetadata | undefined> {
    return quotesStorage.getQuoteMetadataByVersion(db, quoteVersionId, userId);
  }

  async createQuoteMetadata(metadata: InsertQuoteMetadata): Promise<QuoteMetadata> {
    return quotesStorage.createQuoteMetadata(db, metadata);
  }

  async updateQuoteMetadata(id: string, userId: string, updates: Partial<InsertQuoteMetadata>): Promise<QuoteMetadata | undefined> {
    return quotesStorage.updateQuoteMetadata(db, id, userId, updates);
  }

  async getLineItemsByVersion(quoteVersionId: string, userId: string): Promise<QuoteLineItem[]> {
    return quotesStorage.getLineItemsByVersion(db, quoteVersionId, userId);
  }

  async createQuoteLineItem(item: InsertQuoteLineItem): Promise<QuoteLineItem> {
    return quotesStorage.createQuoteLineItem(db, item);
  }

  async updateQuoteLineItem(id: string, userId: string, updates: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem | undefined> {
    return quotesStorage.updateQuoteLineItem(db, id, userId, updates);
  }

  async deleteQuoteLineItem(id: string, userId: string): Promise<boolean> {
    return quotesStorage.deleteQuoteLineItem(db, id, userId);
  }

  async deleteSubtotalAndTotalLineItems(quoteVersionId: string, userId: string): Promise<number> {
    return quotesStorage.deleteSubtotalAndTotalLineItems(db, quoteVersionId, userId);
  }

  async getTotalsByVersion(quoteVersionId: string, userId: string): Promise<QuoteTotal | undefined> {
    return quotesStorage.getTotalsByVersion(db, quoteVersionId, userId);
  }

  async createQuoteTotals(totals: InsertQuoteTotal): Promise<QuoteTotal> {
    return quotesStorage.createQuoteTotals(db, totals);
  }

  async updateQuoteTotals(id: string, userId: string, updates: Partial<InsertQuoteTotal>): Promise<QuoteTotal | undefined> {
    return quotesStorage.updateQuoteTotals(db, id, userId, updates);
  }

  async getAuthToken(token: string): Promise<{ userId: string; userEmail: string; userName: string; expiresAt: Date } | undefined> {
    return aiStorage.getAuthToken(db, token);
  }

  async createAuthToken(token: string, userId: string, userEmail: string, userName: string, expiresAt: Date): Promise<void> {
    return aiStorage.createAuthToken(db, token, userId, userEmail, userName, expiresAt);
  }

  async deleteAuthToken(token: string): Promise<void> {
    return aiStorage.deleteAuthToken(db, token);
  }

  async createPendingUpload(upload: InsertPendingUpload): Promise<PendingUpload> {
    return quotesStorage.createPendingUpload(db, upload);
  }

  async getPendingUpload(token: string): Promise<PendingUpload | undefined> {
    return quotesStorage.getPendingUpload(db, token);
  }

  async consumePendingUpload(token: string): Promise<PendingUpload | undefined> {
    return quotesStorage.consumePendingUpload(db, token);
  }

  async deleteExpiredPendingUploads(): Promise<void> {
    return quotesStorage.deleteExpiredPendingUploads(db);
  }

  async getProposal(id: string, userId: string): Promise<AiProposal | undefined> {
    return aiStorage.getProposal(db, id, userId);
  }

  async getProposalsByUser(userId: string, projectId?: string): Promise<AiProposal[]> {
    return aiStorage.getProposalsByUser(db, userId, projectId);
  }

  async createProposal(proposal: InsertAiProposal): Promise<AiProposal> {
    return aiStorage.createProposal(db, proposal);
  }

  async updateProposalStatus(id: string, userId: string, status: string, reason?: string): Promise<AiProposal | undefined> {
    return aiStorage.updateProposalStatus(db, id, userId, status, reason);
  }

  async deleteProposal(id: string, userId: string): Promise<boolean> {
    return aiStorage.deleteProposal(db, id, userId);
  }

  async getConversationsByProject(projectId: string, userId: string): Promise<Conversation[]> {
    return aiStorage.getConversationsByProject(db, projectId, userId);
  }

  async getConversationById(id: string, userId: string): Promise<Conversation | undefined> {
    return aiStorage.getConversationById(db, id, userId);
  }

  async getProjectConversation(projectId: string, userId: string): Promise<Conversation | undefined> {
    return aiStorage.getProjectConversation(db, projectId, userId);
  }

  async getOrCreateProjectConversation(projectId: string, userId: string): Promise<Conversation> {
    return aiStorage.getOrCreateProjectConversation(db, projectId, userId);
  }

  async createConversationWithFirstMessage(
    projectId: string,
    userId: string,
    userMessage: string,
    assistantMessage: string,
    assistantMetadata?: Record<string, any>
  ): Promise<{ conversation: Conversation; userMessageId: string | null; assistantMessageId: string | null }> {
    return aiStorage.createConversationWithFirstMessage(db, projectId, userId, userMessage, assistantMessage, assistantMetadata);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    return aiStorage.createConversation(db, conversation);
  }

  async updateConversation(id: string, userId: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    return aiStorage.updateConversation(db, id, userId, updates);
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    return aiStorage.deleteConversation(db, id, userId);
  }

  async getMessagesByConversation(conversationId: string, userId: string): Promise<Message[]> {
    return aiStorage.getMessagesByConversation(db, conversationId, userId);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    return aiStorage.createMessage(db, message);
  }

  async updateMessage(id: string, updates: Partial<InsertMessage>): Promise<Message | undefined> {
    return aiStorage.updateMessage(db, id, updates);
  }

  async deleteMessage(id: string): Promise<boolean> {
    return aiStorage.deleteMessage(db, id);
  }
}

export const storage = new PgStorage();
