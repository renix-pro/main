/**
 * RENIX vNext — Execution Routes
 * 
 * Extracted from server/routes.ts to modularize route definitions.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertExecutionTaskSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

function coerceDates(body: Record<string, any>): Record<string, any> {
  const dateFields = ['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd', 'completedAt'];
  const result = { ...body };
  for (const field of dateFields) {
    if (typeof result[field] === 'string') {
      const d = new Date(result[field]);
      result[field] = isNaN(d.getTime()) ? result[field] : d;
    }
  }
  return result;
}

export function registerExecutionRoutes(app: Express): void {
  app.get('/api/projects/:projectId/execution', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const tasks = await storage.getTasksByProject(projectId, user.id);
      const now = new Date();
      const enrichedTasks = tasks.map(task => ({
        ...task,
        overdue: !!(task.plannedEnd && task.status !== 'done' && now > task.plannedEnd),
        notStarted: !!(task.plannedStart && task.status === 'to_do' && now >= task.plannedStart),
      }));
      return res.json({ tasks: enrichedTasks });
    } catch (error) {
      console.error('Error fetching execution:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId/execution/tasks/aggregates', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const aggregates = await storage.getTaskAggregates(projectId, user.id);
      return res.json(aggregates);
    } catch (error) {
      console.error('Error fetching task aggregates:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/execution/tasks', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertExecutionTaskSchema.safeParse({ ...coerceDates(req.body), projectId, userId: user.id, createdBy: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const task = await storage.createTask(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/execution/tasks/:taskId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { taskId } = req.params;
      const task = await storage.updateTask(taskId, user.id, coerceDates(req.body));
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/execution/tasks/:taskId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { taskId } = req.params;
      const deleted = await storage.deleteTask(taskId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Task not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

}
