/**
 * RENIX vNext — Shared Middleware and Utilities
 * 
 * Extracted from server/routes.ts for reuse across route modules.
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import { db } from "../../db";
import { projects } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { AUTH_ENABLED, TEST_USER } from "@shared/authConfig";

export const linkPreviewCache = new Map<string, { data: LinkPreview; expires: number }>();
export const CACHE_TTL = 24 * 60 * 60 * 1000;
export const MAX_CACHE_SIZE = 1000;

export interface DocumentExtractionJob {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
export const documentExtractionJobs = new Map<string, DocumentExtractionJob>();

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export function isPrivateOrReservedIP(hostname: string): boolean {
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^\[::1\]$/,
    /^\[fc/i,
    /^\[fd/i,
    /^\[fe80:/i,
    /^metadata\.google\.internal$/i,
    /^instance-data$/i,
  ];
  return blockedPatterns.some(pattern => pattern.test(hostname));
}

export const ALLOWED_DOMAINS = new Set([
  'pinterest.com', 'www.pinterest.com', 'pin.it', 'i.pinimg.com',
  'instagram.com', 'www.instagram.com', 'cdninstagram.com',
  'unsplash.com', 'images.unsplash.com',
  'pexels.com', 'www.pexels.com', 'images.pexels.com',
  'flickr.com', 'www.flickr.com', 'staticflickr.com', 'live.staticflickr.com',
  'houzz.com', 'www.houzz.com', 'st.hzcdn.com',
  'archdaily.com', 'www.archdaily.com', 'images.adsttc.com',
  'dezeen.com', 'www.dezeen.com',
  'dwell.com', 'www.dwell.com',
  'architecturaldigest.com', 'www.architecturaldigest.com',
  'imgur.com', 'i.imgur.com',
  'tumblr.com', 'media.tumblr.com',
  'behance.net', 'www.behance.net', 'mir-s3-cdn-cf.behance.net',
  'dribbble.com', 'cdn.dribbble.com',
]);

export function isAllowedDomain(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  if (ALLOWED_DOMAINS.has(lowerHost)) return true;
  const allowedArray = Array.from(ALLOWED_DOMAINS);
  return allowedArray.some(allowed => lowerHost.endsWith('.' + allowed));
}

export function evictExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  linkPreviewCache.forEach((value, key) => {
    if (value.expires < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => linkPreviewCache.delete(key));
  
  if (linkPreviewCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(linkPreviewCache.entries());
    entries.sort((a, b) => a[1].expires - b[1].expires);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => linkPreviewCache.delete(key));
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

export async function getTokenFromDB(token: string): Promise<{ user: { id: string; email: string; name: string }; expires: number } | null> {
  try {
    const result = await storage.getAuthToken(token);
    if (result && new Date(result.expiresAt).getTime() > Date.now()) {
      return {
        user: { id: result.userId, email: result.userEmail, name: result.userName },
        expires: new Date(result.expiresAt).getTime(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setTokenInDB(token: string, user: { id: string; email: string; name: string }, expiresAt: Date): Promise<void> {
  try {
    await storage.createAuthToken(token, user.id, user.email, user.name, expiresAt);
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
}

export async function deleteTokenFromDB(token: string): Promise<void> {
  try {
    await storage.deleteAuthToken(token);
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
}

async function requireAuthAsync(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_ENABLED) {
    (req as any).user = TEST_USER;
    return next();
  }

  if (req.session?.user) {
    (req as any).user = req.session.user;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const sessionData = await getTokenFromDB(token);
    if (sessionData && sessionData.expires > Date.now()) {
      (req as any).user = sessionData.user;
      return next();
    }
  }

  return res.status(401).json({ message: 'Unauthorized' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  requireAuthAsync(req, res, next).catch((err) => {
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Internal server error' });
  });
}

export function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  requireProjectAccessAsync(req, res, next).catch((err) => {
    console.error('Project access middleware error:', err);
    res.status(500).json({ message: 'Internal server error' });
  });
}

async function requireProjectAccessAsync(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const projectId = req.params.projectId;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!AUTH_ENABLED) {
    return next();
  }

  if (!projectId) {
    return next();
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  if (!project) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
}

/**
 * Phase 3.5: Lifecycle Guard Middleware
 * 
 * Centralized write guard that blocks modifications on non-active projects.
 * Use this middleware on all POST/PUT/PATCH/DELETE routes that modify project data.
 * 
 * Behavior:
 * - ACTIVE projects: Allow write
 * - CLOSED projects: Block with 403 and descriptive message
 * - DELETED projects: Block with 404 (project not accessible)
 */
export async function requireWriteAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const projectId = req.params.projectId;

  if (!user || !projectId) {
    return next();
  }

  try {
    const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
    
    if (!lifecycleState) {
      return next();
    }

    if (lifecycleState === 'deleted') {
      return res.status(404).json({ 
        message: 'Project not found',
        code: 'PROJECT_DELETED',
      });
    }

    if (lifecycleState === 'closed') {
      return res.status(403).json({ 
        message: 'This project is closed and read-only. No modifications are allowed.',
        code: 'PROJECT_CLOSED',
        lifecycleState: 'closed',
      });
    }

    return next();
  } catch (error) {
    console.error('[LIFECYCLE GUARD] Error checking project lifecycle:', error);
    return res.status(503).json({ 
      message: 'Unable to verify project write access. Please try again.',
      code: 'LIFECYCLE_CHECK_FAILED',
    });
  }
}

/**
 * Phase 3.5: AI Proposal Guard Middleware
 * 
 * Blocks AI proposal creation on non-active projects.
 */
export async function requireAIProposalAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const projectId = req.params.projectId;

  if (!user || !projectId) {
    return next();
  }

  try {
    const lifecycleState = await storage.getProjectLifecycleState(projectId, user.id);
    
    if (!lifecycleState) {
      return next();
    }

    if (lifecycleState === 'deleted') {
      return res.status(404).json({ 
        message: 'Project not found',
        code: 'PROJECT_DELETED',
      });
    }

    if (lifecycleState === 'closed') {
      return res.status(403).json({ 
        message: 'This project is closed. AI can only explain and explore, not propose changes.',
        code: 'AI_PROPOSALS_BLOCKED',
        lifecycleState: 'closed',
      });
    }

    return next();
  } catch (error) {
    console.error('[LIFECYCLE GUARD] Error checking AI proposal access:', error);
    return res.status(503).json({ 
      message: 'Unable to verify AI proposal access. Please try again.',
      code: 'LIFECYCLE_CHECK_FAILED',
    });
  }
}
