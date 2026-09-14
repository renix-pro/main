/**
 * RENIX vNext — Scope Routes
 * 
 * Handles all scope-related routes including:
 * - GET /api/projects/:projectId/scope
 * - POST/PATCH/DELETE routes for /scopes and /scope-nodes
 * - GET/POST/PATCH/DELETE routes for /scope-nodes
 * - POST /scope-nodes/:nodeId/move
 * - POST /scope-nodes/:nodeId/reorder
 * - POST /scope-nodes/:nodeId/archive
 * - GET /scope-nodes/:nodeId/impact
 * - POST /scope-nodes/migrate
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertScopeSchema,
} from "@shared/schema";
import {
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
} from "./shared/middleware";
import { invalidateOverviewCache } from './overview';

export function registerScopeRoutes(app: Express): void {
  // ============================================
  // SCOPE ROUTES
  // ============================================

  app.get('/api/projects/:projectId/scope', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const scopes = await storage.getScopesByProject(projectId, user.id);
      return res.json({ scopes });
    } catch (error) {
      console.error('Error fetching scope:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scopes', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertScopeSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const scope = await storage.createScope(parsed.data);
      invalidateOverviewCache(projectId);
      return res.status(201).json(scope);
    } catch (error) {
      console.error('Error creating scope:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/scopes/:scopeId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { scopeId } = req.params;
      const scope = await storage.updateScope(scopeId, user.id, req.body);
      if (!scope) {
        return res.status(404).json({ message: 'Scope not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(scope);
    } catch (error) {
      console.error('Error updating scope:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/scopes/:scopeId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { scopeId } = req.params;
      await storage.cleanupScopeAssociations(scopeId, user.id);
      const deleted = await storage.deleteScope(scopeId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Scope not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting scope:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // SCOPE NODE ROUTES (Tree-based structure)
  // ============================================

  app.get('/api/projects/:projectId/scope-nodes', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const nodes = await storage.getScopeNodesByProject(projectId, user.id);
      return res.json({ nodes });
    } catch (error) {
      console.error('Error fetching scope nodes:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes/batch', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { groups } = req.body;

      if (!Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({ message: 'groups array is required and must not be empty' });
      }

      const createdNodes: any[] = [];

      for (const group of groups) {
        if (!group.name || typeof group.name !== 'string') {
          return res.status(400).json({ message: 'Each group must have a name' });
        }

        const parentNode = await storage.createScopeNode({
          projectId,
          userId: user.id,
          parentId: null,
          name: group.name,
          description: group.description || null,
          tags: group.tags || [],
          isArchived: false,
          isExpanded: true,
          costType: 'standard',
          createdBy: user.name || user.email,
        });
        createdNodes.push(parentNode);

        if (Array.isArray(group.items)) {
          for (const item of group.items) {
            const itemName = typeof item === 'string' ? item : item?.name;
            const itemDesc = typeof item === 'string' ? null : (item?.description || null);
            if (!itemName) continue;

            const childNode = await storage.createScopeNode({
              projectId,
              userId: user.id,
              parentId: parentNode.id,
              name: itemName,
              description: itemDesc,
              tags: [],
              isArchived: false,
              isExpanded: true,
              costType: 'standard',
              createdBy: user.name || user.email,
            });
            createdNodes.push(childNode);
          }
        }
      }

      invalidateOverviewCache(projectId);
      return res.status(201).json({ nodes: createdNodes, count: createdNodes.length });
    } catch (error) {
      console.error('Error batch creating scope nodes:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const { name, description, parentId, tags, costType } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Name is required' });
      }
      
      if (costType !== undefined && costType !== 'standard' && costType !== 'direct') {
        return res.status(400).json({ message: 'costType must be "standard" or "direct"' });
      }
      
      const node = await storage.createScopeNode({
        projectId,
        userId: user.id,
        parentId: parentId || null,
        name,
        description: description || null,
        tags: tags || [],
        isArchived: false,
        isExpanded: true,
        costType: costType || 'standard',
        createdBy: user.name || user.email,
      });
      
      invalidateOverviewCache(projectId);
      return res.status(201).json(node);
    } catch (error) {
      console.error('Error creating scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/scope-nodes/:nodeId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      const { name, description, tags, isExpanded, costType } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (tags !== undefined) updates.tags = tags;
      if (isExpanded !== undefined) updates.isExpanded = isExpanded;
      if (costType !== undefined) {
        if (costType !== 'standard' && costType !== 'direct') {
          return res.status(400).json({ message: 'costType must be "standard" or "direct"' });
        }
        updates.costType = costType;
      }
      
      const updated = await storage.updateScopeNode(nodeId, user.id, updates);
      if (!updated) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(updated);
    } catch (error) {
      console.error('Error updating scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes/:nodeId/move', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      const { newParentId, sortOrder } = req.body;
      
      const updated = await storage.moveScopeNode(nodeId, user.id, newParentId || null, sortOrder);
      if (!updated) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(updated);
    } catch (error) {
      console.error('Error moving scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes/:nodeId/reorder', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      const { sortOrder } = req.body;
      
      if (typeof sortOrder !== 'number') {
        return res.status(400).json({ message: 'sortOrder is required' });
      }
      
      const updated = await storage.reorderScopeNode(nodeId, user.id, sortOrder);
      if (!updated) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json(updated);
    } catch (error) {
      console.error('Error reordering scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes/batch-reorder', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: 'updates array is required' });
      }
      
      for (const u of updates) {
        if (!u.nodeId || typeof u.sortOrder !== 'number') {
          return res.status(400).json({ message: 'Each update must have nodeId and sortOrder' });
        }
      }
      
      await storage.batchReorderScopeNodes(user.id, updates);
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error batch reordering scope nodes:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/scope-nodes/:nodeId/archive', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      
      const archived = await storage.archiveScopeNode(nodeId, user.id);
      if (!archived) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error archiving scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/scope-nodes/:nodeId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { nodeId } = req.params;
      
      await storage.cleanupScopeAssociations(nodeId, user.id);
      const deleted = await storage.deleteScopeNode(nodeId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      const { projectId } = req.params;
      invalidateOverviewCache(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting scope node:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/projects/:projectId/scope-nodes/:nodeId/impact', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, nodeId } = req.params;
      
      const impact = await storage.getScopeNodeImpact(nodeId, projectId, user.id);
      if (!impact) {
        return res.status(404).json({ message: 'Scope node not found' });
      }
      return res.json(impact);
    } catch (error) {
      console.error('Error getting scope node impact:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/projects/:projectId/scope-nodes/migrate
   * Migrates existing scopes/areas/items to the new scopeNodes tree structure.
   * This is a one-time migration that preserves all data.
   * 
   * Migration mapping:
   * - Scope → Root ScopeNode (parentId = null)
   * - Area → Child ScopeNode (parentId = scope's nodeId)
   * - Item under Area → Child ScopeNode (parentId = area's nodeId)
   * - Item under Scope → Child ScopeNode (parentId = scope's nodeId)
   */
  app.post('/api/projects/:projectId/scope-nodes/migrate', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      
      // Check if migration already done (nodes exist)
      const existingNodes = await storage.getScopeNodesByProject(projectId, user.id);
      if (existingNodes.length > 0) {
        return res.json({ 
          message: 'Migration already completed', 
          migrated: false,
          nodeCount: existingNodes.length 
        });
      }
      
      // Get existing scope data (nodes only, no legacy areas/items)
      const scopes = await storage.getScopesByProject(projectId, user.id);
      
      if (scopes.length === 0) {
        return res.json({ 
          message: 'No scopes to migrate', 
          migrated: false,
          nodeCount: 0 
        });
      }
      
      const createdNodes: any[] = [];
      
      for (const scope of scopes) {
        const node = await storage.createScopeNode({
          projectId,
          userId: user.id,
          parentId: null,
          name: scope.name,
          description: scope.description,
          tags: [],
          isArchived: false,
          isExpanded: true,
          createdBy: scope.createdBy,
        });
        createdNodes.push(node);
      }
      
      invalidateOverviewCache(projectId);
      return res.json({ 
        message: 'Migration completed successfully',
        migrated: true,
        nodeCount: createdNodes.length,
      });
    } catch (error) {
      console.error('Error migrating scope data:', error);
      return res.status(500).json({ message: 'Migration failed', error: String(error) });
    }
  });
}
