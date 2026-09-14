import {
  type ExecutionTask,
  type InsertExecutionTask,
  executionTasks,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getTasksByProject(db: Db, projectId: string, userId: string): Promise<ExecutionTask[]> {
  return await db.select().from(executionTasks)
    .where(and(eq(executionTasks.projectId, projectId), eq(executionTasks.userId, userId)))
    .orderBy(desc(executionTasks.createdAt));
}

export async function createTask(db: Db, task: InsertExecutionTask): Promise<ExecutionTask> {
  const [created] = await db.insert(executionTasks).values(task).returning();
  return created;
}

export async function updateTask(db: Db, id: string, userId: string, updates: Partial<InsertExecutionTask>): Promise<ExecutionTask | undefined> {
  const setValues: any = { ...updates, updatedAt: new Date() };
  if (updates.status === 'done') {
    setValues.completedAt = new Date();
  } else if (updates.status && updates.status !== 'done') {
    setValues.completedAt = null;
  }
  const [updated] = await db.update(executionTasks)
    .set(setValues)
    .where(and(eq(executionTasks.id, id), eq(executionTasks.userId, userId)))
    .returning();
  return updated;
}

export async function deleteTask(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(executionTasks)
    .where(and(eq(executionTasks.id, id), eq(executionTasks.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export interface TaskAggregates {
  counts: { to_do: number; in_progress: number; done: number };
  overdue: { count: number; taskIds: string[] };
  notStarted: { count: number; taskIds: string[] };
}

export async function getTaskAggregates(db: Db, projectId: string, userId: string): Promise<TaskAggregates> {
  const tasks = await db.select().from(executionTasks)
    .where(and(eq(executionTasks.projectId, projectId), eq(executionTasks.userId, userId)));

  const now = new Date();
  const counts = { to_do: 0, in_progress: 0, done: 0 };
  const overdue: { count: number; taskIds: string[] } = { count: 0, taskIds: [] };
  const notStarted: { count: number; taskIds: string[] } = { count: 0, taskIds: [] };

  for (const task of tasks) {
    if (task.status === 'to_do') counts.to_do++;
    else if (task.status === 'in_progress') counts.in_progress++;
    else if (task.status === 'done') counts.done++;

    if (task.plannedEnd && task.status !== 'done' && now > task.plannedEnd) {
      overdue.count++;
      overdue.taskIds.push(task.id);
    }

    if (task.plannedStart && task.status === 'to_do' && now >= task.plannedStart) {
      notStarted.count++;
      notStarted.taskIds.push(task.id);
    }
  }

  return { counts, overdue, notStarted };
}
