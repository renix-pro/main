import {
  type VisionBoard,
  type InsertVisionBoard,
  visionBoards,
  type VisionInspiration,
  type InsertVisionInspiration,
  visionInspirations,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getBoardsByProject(db: Db, projectId: string, userId: string): Promise<VisionBoard[]> {
  return await db.select().from(visionBoards)
    .where(and(eq(visionBoards.projectId, projectId), eq(visionBoards.userId, userId)))
    .orderBy(desc(visionBoards.createdAt));
}

export async function getBoardById(db: Db, id: string, projectId: string, userId: string): Promise<VisionBoard | undefined> {
  const [board] = await db.select().from(visionBoards)
    .where(and(eq(visionBoards.id, id), eq(visionBoards.projectId, projectId), eq(visionBoards.userId, userId)));
  return board;
}

export async function createBoard(db: Db, board: InsertVisionBoard): Promise<VisionBoard> {
  const [created] = await db.insert(visionBoards).values(board).returning();
  return created;
}

export async function updateBoard(db: Db, id: string, projectId: string, userId: string, updates: Partial<InsertVisionBoard>): Promise<VisionBoard | undefined> {
  const [updated] = await db.update(visionBoards)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(visionBoards.id, id), eq(visionBoards.projectId, projectId), eq(visionBoards.userId, userId)))
    .returning();
  return updated;
}

export async function deleteBoard(db: Db, id: string, projectId: string, userId: string): Promise<boolean> {
  await db.delete(visionInspirations)
    .where(and(eq(visionInspirations.boardId, id), eq(visionInspirations.userId, userId)));
  const result = await db.delete(visionBoards)
    .where(and(eq(visionBoards.id, id), eq(visionBoards.projectId, projectId), eq(visionBoards.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getInspirationsByProject(db: Db, projectId: string, userId: string): Promise<VisionInspiration[]> {
  return await db.select().from(visionInspirations)
    .where(and(eq(visionInspirations.projectId, projectId), eq(visionInspirations.userId, userId)))
    .orderBy(desc(visionInspirations.createdAt));
}

export async function getInspirationsByBoard(db: Db, boardId: string, userId: string): Promise<VisionInspiration[]> {
  return await db.select().from(visionInspirations)
    .where(and(eq(visionInspirations.boardId, boardId), eq(visionInspirations.userId, userId)))
    .orderBy(desc(visionInspirations.createdAt));
}

export async function getInspirationById(db: Db, id: string, projectId: string, userId: string): Promise<VisionInspiration | undefined> {
  const [insp] = await db.select().from(visionInspirations)
    .where(and(eq(visionInspirations.id, id), eq(visionInspirations.projectId, projectId), eq(visionInspirations.userId, userId)));
  return insp;
}

export async function createInspiration(db: Db, insp: InsertVisionInspiration): Promise<VisionInspiration> {
  const [created] = await db.insert(visionInspirations).values(insp).returning();
  return created;
}

export async function updateInspiration(db: Db, id: string, projectId: string, userId: string, updates: Partial<InsertVisionInspiration>): Promise<VisionInspiration | undefined> {
  // visionInspirations has no updatedAt column.
  const [updated] = await db.update(visionInspirations)
    .set({ ...updates })
    .where(and(eq(visionInspirations.id, id), eq(visionInspirations.projectId, projectId), eq(visionInspirations.userId, userId)))
    .returning();
  return updated;
}

export async function deleteInspiration(db: Db, id: string, projectId: string, userId: string): Promise<boolean> {
  const result = await db.delete(visionInspirations)
    .where(and(eq(visionInspirations.id, id), eq(visionInspirations.projectId, projectId), eq(visionInspirations.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}
