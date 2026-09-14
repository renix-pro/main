import {
  type BudgetData,
  type InsertBudgetData,
  budgetData,
  type BudgetAllocation,
  type InsertBudgetAllocation,
  budgetAllocations,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getBudgetByProject(db: Db, projectId: string, userId: string): Promise<BudgetData | undefined> {
  const [budget] = await db.select().from(budgetData)
    .where(and(eq(budgetData.projectId, projectId), eq(budgetData.userId, userId)));
  return budget;
}

export async function createBudget(db: Db, budget: InsertBudgetData): Promise<BudgetData> {
  const [created] = await db.insert(budgetData).values(budget).returning();
  return created;
}

export async function updateBudget(db: Db, id: string, userId: string, updates: Partial<InsertBudgetData>): Promise<BudgetData | undefined> {
  const [updated] = await db.update(budgetData)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(budgetData.id, id), eq(budgetData.userId, userId)))
    .returning();
  return updated;
}

export async function getAllocationsByBudget(db: Db, budgetId: string, userId: string): Promise<BudgetAllocation[]> {
  return await db.select().from(budgetAllocations)
    .where(and(eq(budgetAllocations.budgetId, budgetId), eq(budgetAllocations.userId, userId)))
    .orderBy(desc(budgetAllocations.createdAt));
}

export async function createAllocation(db: Db, allocation: InsertBudgetAllocation): Promise<BudgetAllocation> {
  const [created] = await db.insert(budgetAllocations).values(allocation).returning();
  return created;
}

export async function updateAllocation(db: Db, id: string, userId: string, updates: Partial<InsertBudgetAllocation>): Promise<BudgetAllocation | undefined> {
  const [updated] = await db.update(budgetAllocations)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(budgetAllocations.id, id), eq(budgetAllocations.userId, userId)))
    .returning();
  return updated;
}

export async function deleteAllocation(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(budgetAllocations)
    .where(and(eq(budgetAllocations.id, id), eq(budgetAllocations.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}
