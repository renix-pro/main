/**
 * RENIX vNext — Budget Routes
 * 
 * Extracted from server/routes.ts to modularize route definitions.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertBudgetDataSchema,
  insertBudgetAllocationSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

function validateAllocationTarget(target: any): string | null {
  if (!target || typeof target !== 'object') return null;
  if (target.type === 'scope' && !target.scopeId) {
    return 'Allocation target of type "scope" must include a valid scopeId';
  }
  return null;
}

export function registerBudgetRoutes(app: Express): void {
  app.get('/api/projects/:projectId/budget', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const budget = await storage.getBudgetByProject(projectId, user.id);
      let allocations: any[] = [];
      if (budget) {
        allocations = await storage.getAllocationsByBudget(budget.id, user.id);
      }
      return res.json({ budget, allocations });
    } catch (error) {
      console.error('Error fetching budget:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/budget', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const existing = await storage.getBudgetByProject(projectId, user.id);
      if (existing) {
        const updated = await storage.updateBudget(existing.id, user.id, req.body);
        invalidateOverviewCache(projectId);
        return res.json(updated);
      }
      const parsed = insertBudgetDataSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const budget = await storage.createBudget(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(budget);
    } catch (error) {
      console.error('Error creating/updating budget:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/budget/allocations', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const budget = await storage.getBudgetByProject(projectId, user.id);
      if (!budget) {
        return res.status(400).json({ message: 'Budget not found. Create budget first.' });
      }
      const targetError = validateAllocationTarget(req.body.target);
      if (targetError) {
        return res.status(400).json({ message: targetError });
      }
      const parsed = insertBudgetAllocationSchema.safeParse({ ...req.body, projectId, budgetId: budget.id, userId: user.id, createdBy: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const allocation = await storage.createAllocation(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(allocation);
    } catch (error) {
      console.error('Error creating allocation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/budget/allocations/:allocId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { allocId } = req.params;
      if (req.body.target) {
        const targetError = validateAllocationTarget(req.body.target);
        if (targetError) {
          return res.status(400).json({ message: targetError });
        }
      }
      const allocation = await storage.updateAllocation(allocId, user.id, req.body);
      if (!allocation) {
        return res.status(404).json({ message: 'Allocation not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(allocation);
    } catch (error) {
      console.error('Error updating allocation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/budget/allocations/:allocId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { allocId } = req.params;
      const deleted = await storage.deleteAllocation(allocId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Allocation not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting allocation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
