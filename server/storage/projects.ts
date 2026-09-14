import {
  type Project,
  type InsertProject,
  projects,
  scopes,
  scopeNodes,
  budgetData,
  budgetAllocations,
  vendors,
  quotes,
  quoteVersions,
  quoteLineItems,
  quoteTotals,
  quoteMetadata,
  quoteFinancials,
  quoteAssessments,
  vendorSnapshots,
  invoices,
  invoiceLines,
  financingData,
  financingSources,
  executionTasks,
  visionBoards,
  visionInspirations,
  documents,
  documentAssociations,
  documentChunks,
  sourceDocuments,
  aiProposals,
  conversations,
  messages,
  invoicePayments,
  canonicalMemory,
  overviewCache,
  pendingUploads,
} from "@shared/schema";
import { eq, and, desc, ne, inArray } from "drizzle-orm";
import { LifecycleState, type LifecycleStateType } from '@shared/constants';
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getProjectsByUser(db: Db, userId: string, includeDeleted: boolean = false): Promise<Project[]> {
  const conditions = [eq(projects.userId, userId)];
  if (!includeDeleted) {
    conditions.push(ne(projects.lifecycleState, LifecycleState.DELETED));
  }
  return await db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt));
}

export async function getProjectById(db: Db, id: string, userId: string, includeDeleted: boolean = false): Promise<Project | undefined> {
  const conditions = [eq(projects.id, id), eq(projects.userId, userId)];
  if (!includeDeleted) {
    conditions.push(ne(projects.lifecycleState, LifecycleState.DELETED));
  }
  const [project] = await db.select().from(projects).where(and(...conditions));
  return project;
}

export async function getProjectByIdOnly(db: Db, id: string, includeDeleted: boolean = false): Promise<Project | undefined> {
  const conditions = [eq(projects.id, id)];
  if (!includeDeleted) {
    conditions.push(ne(projects.lifecycleState, LifecycleState.DELETED));
  }
  const [project] = await db.select().from(projects).where(and(...conditions));
  return project;
}

export async function createProject(db: Db, project: InsertProject): Promise<Project> {
  const [created] = await db.insert(projects).values(project).returning();
  return created;
}

export async function updateProject(db: Db, id: string, userId: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
  const [updated] = await db.update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  return updated;
}

export async function deleteProject(db: Db, id: string, userId: string): Promise<boolean> {
  const allFilePaths: string[] = [];

  const sourceDocs = await db.select({ objectStoragePath: sourceDocuments.objectStoragePath })
    .from(sourceDocuments)
    .where(and(eq(sourceDocuments.projectId, id), eq(sourceDocuments.userId, userId)));
  sourceDocs.forEach(doc => {
    if (doc.objectStoragePath) allFilePaths.push(doc.objectStoragePath);
  });

  const docFiles = await db.select({ fileDataUrl: documents.fileDataUrl })
    .from(documents)
    .where(and(eq(documents.projectId, id), eq(documents.userId, userId)));
  docFiles.forEach(doc => {
    if (doc.fileDataUrl?.startsWith('/objects/')) allFilePaths.push(doc.fileDataUrl);
  });

  const inspirations = await db.select({ imageUrl: visionInspirations.imageUrl })
    .from(visionInspirations)
    .where(and(eq(visionInspirations.projectId, id), eq(visionInspirations.userId, userId)));
  inspirations.forEach(insp => {
    if (insp.imageUrl?.startsWith('/objects/')) allFilePaths.push(insp.imageUrl);
  });

  const [project] = await db.select({ heroImagePath: projects.heroImagePath })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  if (project?.heroImagePath) {
    allFilePaths.push(project.heroImagePath);
  }

  if (allFilePaths.length > 0) {
    try {
      const { ObjectStorageService } = await import('../replit_integrations/object_storage/objectStorage');
      const objectStorageService = new ObjectStorageService();
      const result = await objectStorageService.deleteObjectEntities(allFilePaths);
      console.log(`[DeleteProject] Cleaned ${result.deleted} files from object storage (${result.failed} failed)`);
    } catch (storageError) {
      console.error('[DeleteProject] Object storage cleanup error (continuing with DB cleanup):', storageError);
    }
  }

  return await db.transaction(async (tx) => {
    const where = (table: any) => and(eq(table.projectId, id), eq(table.userId, userId));

    await tx.delete(aiProposals).where(where(aiProposals));
    await tx.delete(canonicalMemory).where(where(canonicalMemory));
    await tx.delete(overviewCache).where(eq(overviewCache.projectId, id));
    await tx.delete(pendingUploads).where(where(pendingUploads));

    await tx.delete(messages).where(inArray(messages.conversationId,
      tx.select({ id: conversations.id }).from(conversations).where(where(conversations))
    ));
    await tx.delete(conversations).where(where(conversations));

    await tx.delete(quoteAssessments).where(where(quoteAssessments));
    await tx.delete(quoteTotals).where(where(quoteTotals));
    await tx.delete(quoteMetadata).where(where(quoteMetadata));
    await tx.delete(quoteFinancials).where(where(quoteFinancials));
    await tx.delete(vendorSnapshots).where(where(vendorSnapshots));
    await tx.delete(quoteLineItems).where(where(quoteLineItems));
    await tx.delete(quoteVersions).where(where(quoteVersions));
    await tx.delete(quotes).where(where(quotes));

    await tx.delete(sourceDocuments).where(where(sourceDocuments));

    await tx.delete(documentChunks).where(where(documentChunks));
    await tx.delete(documentAssociations).where(where(documentAssociations));
    await tx.delete(documents).where(where(documents));

    await tx.delete(visionInspirations).where(where(visionInspirations));
    await tx.delete(visionBoards).where(where(visionBoards));

    await tx.delete(executionTasks).where(where(executionTasks));

    await tx.delete(financingSources).where(where(financingSources));
    await tx.delete(financingData).where(where(financingData));

    await tx.delete(invoicePayments).where(where(invoicePayments));
    await tx.delete(invoiceLines).where(where(invoiceLines));
    await tx.delete(invoices).where(where(invoices));

    await tx.delete(vendors).where(where(vendors));

    await tx.delete(budgetAllocations).where(where(budgetAllocations));
    await tx.delete(budgetData).where(where(budgetData));

    await tx.delete(scopeNodes).where(where(scopeNodes));
    await tx.delete(scopes).where(where(scopes));

    const result = await tx.delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  });
}

export async function softDeleteProject(db: Db, id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
  const project = await getProjectById(db, id, userId, true);
  if (!project) {
    throw new Error('Project not found');
  }
  
  const previousState = project.lifecycleState as LifecycleStateType;
  if (previousState !== LifecycleState.CLOSED) {
    throw new Error(`Cannot delete project in state '${previousState}'. Project must be closed first.`);
  }
  
  await db.update(projects)
    .set({ lifecycleState: LifecycleState.DELETED, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  
  return { previousState, newState: LifecycleState.DELETED };
}

export async function closeProject(db: Db, id: string, userId: string): Promise<{ previousState: LifecycleStateType; newState: LifecycleStateType }> {
  const project = await getProjectById(db, id, userId);
  if (!project) {
    throw new Error('Project not found');
  }
  
  const previousState = project.lifecycleState as LifecycleStateType;
  if (previousState !== LifecycleState.ACTIVE) {
    throw new Error(`Cannot close project in state '${previousState}'. Project must be active.`);
  }
  
  await db.update(projects)
    .set({ lifecycleState: LifecycleState.CLOSED, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  
  return { previousState, newState: LifecycleState.CLOSED };
}

export async function getProjectLifecycleState(db: Db, id: string, userId: string): Promise<LifecycleStateType | null> {
  const project = await getProjectById(db, id, userId, true);
  return project ? (project.lifecycleState as LifecycleStateType) : null;
}
