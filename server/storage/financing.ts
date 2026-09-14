import {
  type FinancingData,
  type InsertFinancingData,
  financingData,
  type FinancingSource,
  type InsertFinancingSource,
  financingSources,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getFinancingByProject(db: Db, projectId: string, userId: string): Promise<FinancingData | undefined> {
  const [financing] = await db.select().from(financingData)
    .where(and(eq(financingData.projectId, projectId), eq(financingData.userId, userId)));
  return financing;
}

export async function createFinancingData(db: Db, data: InsertFinancingData): Promise<FinancingData> {
  const [created] = await db.insert(financingData).values(data).returning();
  return created;
}

export async function updateFinancingData(db: Db, id: string, userId: string, updates: Partial<InsertFinancingData>): Promise<FinancingData | undefined> {
  const [updated] = await db.update(financingData)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(financingData.id, id), eq(financingData.userId, userId)))
    .returning();
  return updated;
}

export async function getSourcesByProject(db: Db, projectId: string, userId: string): Promise<FinancingSource[]> {
  return await db.select().from(financingSources)
    .where(and(eq(financingSources.projectId, projectId), eq(financingSources.userId, userId)))
    .orderBy(desc(financingSources.createdAt));
}

export async function createSource(db: Db, source: InsertFinancingSource): Promise<FinancingSource> {
  const [created] = await db.insert(financingSources).values(source).returning();
  return created;
}

export async function updateSource(db: Db, id: string, userId: string, updates: Partial<InsertFinancingSource>): Promise<FinancingSource | undefined> {
  const [updated] = await db.update(financingSources)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(financingSources.id, id), eq(financingSources.userId, userId)))
    .returning();
  return updated;
}

export async function deleteSource(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(financingSources)
    .where(and(eq(financingSources.id, id), eq(financingSources.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}
