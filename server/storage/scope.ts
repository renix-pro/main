import {
  type Scope,
  type InsertScope,
  scopes,
  type ScopeNode,
  type InsertScopeNode,
  scopeNodes,
  vendors,
  executionTasks,
  quotes,
  invoices,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import type { db as DbType } from "../db";
import type { ScopeNodeImpact } from "../storage";

type Db = typeof DbType;

export async function getScopesByProject(db: Db, projectId: string, userId: string): Promise<Scope[]> {
  return await db.select().from(scopes)
    .where(and(eq(scopes.projectId, projectId), eq(scopes.userId, userId)))
    .orderBy(desc(scopes.createdAt));
}

export async function createScope(db: Db, scope: InsertScope): Promise<Scope> {
  const [created] = await db.insert(scopes).values(scope).returning();
  return created;
}

export async function updateScope(db: Db, id: string, userId: string, updates: Partial<InsertScope>): Promise<Scope | undefined> {
  const [updated] = await db.update(scopes)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(scopes.id, id), eq(scopes.userId, userId)))
    .returning();
  return updated;
}

export async function deleteScope(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(scopes)
    .where(and(eq(scopes.id, id), eq(scopes.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getScopeNodesByProject(db: Db, projectId: string, userId: string): Promise<ScopeNode[]> {
  return db.select().from(scopeNodes)
    .where(and(eq(scopeNodes.projectId, projectId), eq(scopeNodes.userId, userId)))
    .orderBy(scopeNodes.sortOrder, scopeNodes.createdAt);
}

export async function getScopeNodeById(db: Db, id: string, userId: string): Promise<ScopeNode | undefined> {
  const [node] = await db.select().from(scopeNodes)
    .where(and(eq(scopeNodes.id, id), eq(scopeNodes.userId, userId)));
  return node;
}

export async function createScopeNode(db: Db, node: InsertScopeNode): Promise<ScopeNode> {
  if (node.sortOrder === undefined || node.sortOrder === 0) {
    const [maxResult] = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${scopeNodes.sortOrder}), 0)` })
      .from(scopeNodes)
      .where(
        and(
          eq(scopeNodes.projectId, node.projectId),
          eq(scopeNodes.userId, node.userId),
          node.parentId
            ? eq(scopeNodes.parentId, node.parentId)
            : sql`${scopeNodes.parentId} IS NULL`
        )
      );
    node = { ...node, sortOrder: (maxResult?.maxSort ?? 0) + 1000 };
  }
  const [created] = await db.insert(scopeNodes).values(node).returning();
  return created;
}

export async function updateScopeNode(db: Db, id: string, userId: string, updates: Partial<InsertScopeNode>): Promise<ScopeNode | undefined> {
  const [updated] = await db.update(scopeNodes)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(scopeNodes.id, id), eq(scopeNodes.userId, userId)))
    .returning();
  return updated;
}

export async function moveScopeNode(db: Db, id: string, userId: string, newParentId: string | null, newSortOrder?: number): Promise<ScopeNode | undefined> {
  const updates: Record<string, unknown> = { 
    parentId: newParentId, 
    updatedAt: new Date() 
  };
  if (newSortOrder !== undefined) {
    updates.sortOrder = newSortOrder;
  }
  const [updated] = await db.update(scopeNodes)
    .set(updates)
    .where(and(eq(scopeNodes.id, id), eq(scopeNodes.userId, userId)))
    .returning();
  return updated;
}

export async function reorderScopeNode(db: Db, id: string, userId: string, newSortOrder: number): Promise<ScopeNode | undefined> {
  const [updated] = await db.update(scopeNodes)
    .set({ sortOrder: newSortOrder, updatedAt: new Date() })
    .where(and(eq(scopeNodes.id, id), eq(scopeNodes.userId, userId)))
    .returning();
  return updated;
}

export async function batchReorderScopeNodes(db: Db, userId: string, updates: { nodeId: string; sortOrder: number }[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    for (const update of updates) {
      await tx.update(scopeNodes)
        .set({ sortOrder: update.sortOrder, updatedAt: new Date() })
        .where(and(eq(scopeNodes.id, update.nodeId), eq(scopeNodes.userId, userId)));
    }
    return true;
  });
}

export async function archiveScopeNode(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.update(scopeNodes)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(scopeNodes.id, id), eq(scopeNodes.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function deleteScopeNode(db: Db, id: string, userId: string): Promise<boolean> {
  const allNodes = await db.select().from(scopeNodes)
    .where(eq(scopeNodes.userId, userId));
  
  const getDescendantIds = (parentId: string): string[] => {
    const children = allNodes.filter(n => n.parentId === parentId);
    return children.flatMap(child => [child.id, ...getDescendantIds(child.id)]);
  };
  
  const allNodeIds = [id, ...getDescendantIds(id)];

  await db.update(executionTasks)
    .set({ scopeItemId: null })
    .where(inArray(executionTasks.scopeItemId, allNodeIds));

  await db.update(quotes)
    .set({ scopeId: null })
    .where(inArray(quotes.scopeId, allNodeIds));

  await db.update(invoices)
    .set({ scopeId: null })
    .where(inArray(invoices.scopeId, allNodeIds));

  for (let i = allNodeIds.length - 1; i >= 0; i--) {
    await db.delete(scopeNodes)
      .where(and(eq(scopeNodes.id, allNodeIds[i]), eq(scopeNodes.userId, userId)));
  }
  
  return true;
}

export interface ScopeNodeImpactHelpers {
  getBudgetByProject: (projectId: string, userId: string) => Promise<{ id: string; currency: string } | undefined>;
  getAllocationsByBudget: (budgetId: string, userId: string) => Promise<{ target: unknown; amount: number }[]>;
  getQuotesByProject: (projectId: string, userId: string) => Promise<{ id: string; vendorId: string | null }[]>;
  getVersionsByQuote: (quoteId: string, userId: string) => Promise<{ id: string }[]>;
  getTasksByProject: (projectId: string, userId: string) => Promise<unknown[]>;
}

export async function getScopeNodeImpact(
  db: Db, 
  nodeId: string, 
  projectId: string, 
  userId: string,
  helpers: ScopeNodeImpactHelpers
): Promise<ScopeNodeImpact | null> {
  const node = await getScopeNodeById(db, nodeId, userId);
  if (!node || node.projectId !== projectId) {
    return null;
  }

  const allNodes = await getScopeNodesByProject(db, projectId, userId);
  
  const getDescendants = (parentId: string): ScopeNode[] => {
    const children = allNodes.filter(n => n.parentId === parentId);
    return children.flatMap(child => [child, ...getDescendants(child.id)]);
  };
  
  const descendants = getDescendants(nodeId);
  const allNodeIds = [nodeId, ...descendants.map(d => d.id)];
  
  const budget = await helpers.getBudgetByProject(projectId, userId);
  let budgetCount = 0;
  let budgetTotal = 0;
  let currency = 'EUR';
  
  if (budget) {
    currency = budget.currency;
    const allocations = await helpers.getAllocationsByBudget(budget.id, userId);
    for (const alloc of allocations) {
      const target = alloc.target as { scopeNodeId?: string; type?: string };
      if (target.scopeNodeId && allNodeIds.includes(target.scopeNodeId)) {
        budgetCount++;
        budgetTotal += alloc.amount;
      }
    }
  }
  
  const tasks = await helpers.getTasksByProject(projectId, userId);
  let taskCount = 0;
  for (const task of tasks) {
    const taskData = task as { scopeNodeId?: string };
    if (taskData.scopeNodeId && allNodeIds.includes(taskData.scopeNodeId)) {
      taskCount++;
    }
  }
  
  const hasImpact = descendants.length > 0 || budgetCount > 0 || taskCount > 0;
  
  return {
    nodeId: node.id,
    nodeName: node.name,
    descendantCount: descendants.length,
    budgetAllocations: {
      count: budgetCount,
      totalAmount: budgetTotal,
      currency,
    },
    quoteReferences: {
      count: 0,
      vendorNames: [],
    },
    executionTasks: {
      count: taskCount,
    },
    hasImpact,
  };
}
