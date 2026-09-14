/**
 * RENIX vNext — Project Routes
 * 
 * Handles all project-related API endpoints including CRUD operations
 * and lifecycle management (close, soft-delete).
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { insertProjectSchema } from "@shared/schema";
import * as schema from "@shared/schema";
import { invalidateOverviewCache } from './overview';
import { db } from "../db";
import { eq, and, inArray, sql, count, sum } from "drizzle-orm";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { ObjectStorageService } from "../replit_integrations/object_storage/objectStorage";
import { generateHeroSvg } from "../ai/heroIllustration";

const objectStorageService = new ObjectStorageService();

/**
 * Generate a Claude-authored SVG hero illustration for a project, store it in
 * object storage and record its path on the project. Returns the object path,
 * or null if generation failed (the project keeps its previous/default hero).
 */
async function generateAndStoreHeroImage(
  projectId: string,
  projectName: string,
  projectType?: string | null,
  projectDescription?: string | null,
  previousHeroPath?: string | null,
): Promise<string | null> {
  try {
    const svg = await generateHeroSvg({ projectName, projectType, projectDescription });

    const privateDir = objectStorageService.getPrivateObjectDir();
    // Unique name per generation so browsers never show a stale cached hero.
    const storagePath = `${privateDir}/projects/${projectId}/hero-${Date.now()}.svg`;
    const normalizedPath = await objectStorageService.uploadBuffer(Buffer.from(svg, 'utf8'), storagePath, 'image/svg+xml');

    await db.update(schema.projects)
      .set({ heroImagePath: normalizedPath, updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId));

    if (previousHeroPath && previousHeroPath !== normalizedPath && previousHeroPath.startsWith(`/objects/projects/${projectId}/hero`)) {
      objectStorageService.deleteObjectEntity(previousHeroPath).catch(() => {});
    }

    console.log(`[HeroImage] Generated SVG hero illustration for project ${projectId} (${svg.length} chars)`);
    return normalizedPath;
  } catch (error) {
    console.error(`[HeroImage] Failed to generate hero illustration for project ${projectId}:`, error);
    return null;
  }
}

export function registerProjectRoutes(app: Express): void {
  // ============================================
  // PROJECT ROUTES
  // ============================================

  app.get('/api/projects', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projects = await storage.getProjectsByUser(user.id);
      return res.json({ projects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // NOTE: /summaries must be registered BEFORE /:projectId to avoid Express matching "summaries" as a projectId
  app.get('/api/projects/summaries', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const projects = await storage.getProjectsByUser(user.id);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json({ summaries: {} });
      }

      const [budgetRows, scopeRows, taskRows, invoiceLineRows, paymentRows, quoteRows] = await Promise.all([
        db.select({
          projectId: schema.budgetData.projectId,
          totalBudget: schema.budgetData.totalBudget,
        }).from(schema.budgetData).where(inArray(schema.budgetData.projectId, projectIds)),

        db.select({
          projectId: schema.scopeNodes.projectId,
          count: count(),
        }).from(schema.scopeNodes).where(
          and(
            inArray(schema.scopeNodes.projectId, projectIds),
            eq(schema.scopeNodes.isArchived, false)
          )
        ).groupBy(schema.scopeNodes.projectId),

        db.select({
          projectId: schema.executionTasks.projectId,
          status: schema.executionTasks.status,
          count: count(),
        }).from(schema.executionTasks).where(
          inArray(schema.executionTasks.projectId, projectIds)
        ).groupBy(schema.executionTasks.projectId, schema.executionTasks.status),

        db.select({
          projectId: schema.invoiceLines.projectId,
          total: sum(schema.invoiceLines.amount),
        }).from(schema.invoiceLines).where(
          inArray(schema.invoiceLines.projectId, projectIds)
        ).groupBy(schema.invoiceLines.projectId),

        db.select({
          projectId: schema.invoicePayments.projectId,
          total: sum(schema.invoicePayments.amount),
        }).from(schema.invoicePayments).where(
          inArray(schema.invoicePayments.projectId, projectIds)
        ).groupBy(schema.invoicePayments.projectId),

        db.select({
          projectId: schema.quoteVersions.projectId,
          count: count(),
        }).from(schema.quoteVersions).where(
          inArray(schema.quoteVersions.projectId, projectIds)
        ).groupBy(schema.quoteVersions.projectId),
      ]);

      const heroImageMap: Record<string, string | null> = {};
      for (const p of projects) {
        heroImageMap[p.id] = p.heroImagePath ?? null;
      }

      const summaries: Record<string, {
        totalBudget: number;
        totalScopeNodes: number;
        totalTasks: number;
        doneTasks: number;
        totalInvoiced: number;
        totalPaid: number;
        totalQuotes: number;
        completeness: number;
        heroImagePath: string | null;
      }> = {};

      for (const pid of projectIds) {
        summaries[pid] = {
          totalBudget: 0,
          totalScopeNodes: 0,
          totalTasks: 0,
          doneTasks: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalQuotes: 0,
          completeness: 0,
          heroImagePath: heroImageMap[pid] ?? null,
        };
      }

      for (const row of budgetRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalBudget = row.totalBudget ?? 0;
        }
      }
      for (const row of scopeRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalScopeNodes = Number(row.count);
        }
      }
      for (const row of taskRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalTasks += Number(row.count);
          if (row.status === 'done') {
            summaries[row.projectId].doneTasks += Number(row.count);
          }
        }
      }
      for (const row of invoiceLineRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalInvoiced = Math.round(Number(row.total ?? 0) / 100);
        }
      }
      for (const row of paymentRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalPaid = Math.round(Number(row.total ?? 0) / 100);
        }
      }
      for (const row of quoteRows) {
        if (summaries[row.projectId]) {
          summaries[row.projectId].totalQuotes = Number(row.count);
        }
      }

      for (const pid of projectIds) {
        const s = summaries[pid];
        let completeness = 0;
        if (s.totalBudget > 0) completeness++;
        if (s.totalScopeNodes > 0) completeness++;
        if (s.totalQuotes > 0) completeness++;
        if (s.totalInvoiced > 0) completeness++;
        if (s.totalTasks > 0) completeness++;
        s.completeness = completeness;
      }

      return res.json({ summaries });
    } catch (error) {
      console.error('Error fetching project summaries:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const project = await storage.getProjectById(projectId, user.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      return res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const parsed = insertProjectSchema.safeParse({ ...req.body, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const project = await storage.createProject(parsed.data);

      // Fire-and-forget: Claude draws an SVG hero illustration in the background.
      generateAndStoreHeroImage(
        project.id,
        parsed.data.name,
        parsed.data.type,
        parsed.data.description,
      ).catch(err => console.error('[HeroImage] Background generation failed:', err));

      return res.status(201).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const project = await storage.updateProject(projectId, user.id, req.body);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      invalidateOverviewCache(projectId);
      return res.json(project);
    } catch (error) {
      console.error('Error updating project:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const deleted = await storage.deleteProject(projectId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Project not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting project:', msg, error);
      return res.status(500).json({ message: `Failed to delete project: ${msg}` });
    }
  });

  // ============================================
  // HERO IMAGE MANAGEMENT
  // ============================================

  app.post('/api/projects/:projectId/hero-image/generate', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;

      const project = await storage.getProjectById(projectId, user.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const heroImagePath = await generateAndStoreHeroImage(
        projectId,
        project.name,
        project.type,
        project.description,
        project.heroImagePath,
      );

      if (!heroImagePath) {
        return res.status(502).json({ message: 'Failed to generate hero illustration' });
      }

      return res.json({ heroImagePath });
    } catch (error) {
      console.error('Error generating hero image:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/hero-image/upload', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { objectPath } = req.body;

      if (!objectPath) {
        return res.status(400).json({ message: 'objectPath is required' });
      }

      const expectedPrefix = `/objects/projects/${projectId}/`;
      if (!objectPath.startsWith(expectedPrefix)) {
        return res.status(403).json({ message: 'Invalid object path for this project' });
      }

      await db.update(schema.projects)
        .set({ heroImagePath: objectPath, updatedAt: new Date() })
        .where(eq(schema.projects.id, projectId));

      return res.json({ heroImagePath: objectPath });
    } catch (error) {
      console.error('Error uploading hero image:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // PROJECT LIFECYCLE MANAGEMENT (Phase 3.5)
  // ============================================

  /**
   * GET /api/projects/:projectId/lifecycle
   * Get the current lifecycle state of a project
   */
  app.get('/api/projects/:projectId/lifecycle', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
      if (!lifecycleState) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      return res.json({ 
        projectId,
        lifecycleState,
        allowsWrites: lifecycleState === 'active',
        allowsAIProposals: lifecycleState === 'active',
      });
    } catch (error) {
      console.error('Error fetching project lifecycle:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/projects/:projectId/close
   * Close a project (active → closed)
   * Makes project read-only and disables AI proposals
   */
  app.post('/api/projects/:projectId/close', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      const result = await storage.closeProject(projectId, user.id);
      invalidateOverviewCache(projectId);
      
      console.log(`[API] Project '${projectId}' closed by user '${user.id}'`);
      return res.json({ 
        success: true,
        previousState: result.previousState,
        newState: result.newState,
        message: 'Project closed successfully. It is now read-only.',
      });
    } catch (error: any) {
      console.error('Error closing project:', error);
      if (error.message?.includes('Cannot close')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/projects/:projectId/soft-delete
   * Soft delete a project (closed → deleted)
   * Only closed projects can be soft-deleted
   * Data is retained but hidden from queries
   */
  app.post('/api/projects/:projectId/soft-delete', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      const result = await storage.softDeleteProject(projectId, user.id);
      
      console.log(`[API] Project '${projectId}' soft-deleted by user '${user.id}'`);
      return res.json({ 
        success: true,
        previousState: result.previousState,
        newState: result.newState,
        message: 'Project deleted successfully. Data is retained but hidden.',
      });
    } catch (error: any) {
      console.error('Error soft-deleting project:', error);
      if (error.message?.includes('Cannot delete')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}
