/**
 * RENIX vNext — Financing Routes
 * 
 * Extracted from server/routes.ts to modularize route definitions.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertFinancingDataSchema,
  insertFinancingSourceSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

export function registerFinancingRoutes(app: Express): void {
  app.get('/api/projects/:projectId/financing', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const financing = await storage.getFinancingByProject(projectId, user.id);
      const sources = await storage.getSourcesByProject(projectId, user.id);
      return res.json({ financing, sources });
    } catch (error) {
      console.error('Error fetching financing:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/financing', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const existing = await storage.getFinancingByProject(projectId, user.id);
      if (existing) {
        const updated = await storage.updateFinancingData(existing.id, user.id, req.body);
        invalidateOverviewCache(projectId);
        return res.json(updated);
      }
      const parsed = insertFinancingDataSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const financing = await storage.createFinancingData(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(financing);
    } catch (error) {
      console.error('Error creating/updating financing:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/financing/sources', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertFinancingSourceSchema.safeParse({ 
        ...req.body, 
        projectId, 
        userId: user.id,
        createdBy: 'user'  // Required field - mark as user-created
      });
      if (!parsed.success) {
        console.error('Financing source validation error:', parsed.error.errors);
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const source = await storage.createSource(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(source);
    } catch (error) {
      console.error('Error creating financing source:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/financing/sources/:sourceId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { sourceId } = req.params;
      const source = await storage.updateSource(sourceId, user.id, req.body);
      if (!source) {
        return res.status(404).json({ message: 'Financing source not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(source);
    } catch (error) {
      console.error('Error updating financing source:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/financing/sources/:sourceId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { sourceId } = req.params;
      const deleted = await storage.deleteSource(sourceId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Financing source not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting financing source:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * GET /api/projects/:projectId/resolved-cost-demand
   * Returns the computed resolved cost demand with breakdown and coverage delta
   */
  app.get('/api/projects/:projectId/resolved-cost-demand', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { computeResolvedCostDemand } = await import('../resolvedCostDemand');
      const result = await computeResolvedCostDemand(projectId, user.id);
      // Disable caching to ensure fresh KPI data on each request
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json(result);
    } catch (error) {
      console.error('Error computing resolved cost demand:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
