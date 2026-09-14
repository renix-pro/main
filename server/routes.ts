/**
 * RENIX vNext — Server Routes
 * 
 * Canon v1.4 Compliant — Phase 12 Auth Addendum
 * 
 * Includes auth routes and full API for all domain entities.
 * Authorization must be enforced SERVER-SIDE.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { AUTH_ENABLED, TEST_USER } from "@shared/authConfig";
import { createUser, verifyCredentials, verifyGoogleToken, updateUserName, changePassword, hashPassword } from "./auth";
import { sendPasswordResetEmail, isEmailConfigured } from "./email";
import * as cheerio from "cheerio";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { registerDocumentRoutes, extractFromObjectPath, type ExtractedQuote } from "./replit_integrations/document";
import { registerDocumentExtractionRoutes } from "./routes/documentExtraction";
import { registerProjectRoutes } from "./routes/projects";
import { registerScopeRoutes } from "./routes/scope";
import { registerBudgetRoutes } from "./routes/budget";
import { registerQuotesRoutes } from "./routes/quotes";
import { registerInvoicesRoutes } from "./routes/invoices";
import { registerFinancingRoutes } from "./routes/financing";
import { registerExecutionRoutes } from "./routes/execution";
import { registerDocumentsRoutes } from "./routes/documents";
import { registerAiRoutes } from "./routes/ai";
import { registerOverviewRoutes } from "./routes/overview";
import { registerImportSessionRoutes } from "./routes/importSessions";
import {
  insertProjectSchema,
  insertScopeSchema,
  insertBudgetDataSchema,
  insertBudgetAllocationSchema,
  insertVendorSchema,
  insertQuoteSchema,
  insertQuoteVersionSchema,
  insertInvoiceSchema,
  insertInvoiceLineSchema,
  insertFinancingDataSchema,
  insertFinancingSourceSchema,
  insertVisionBoardSchema,
  insertVisionInspirationSchema,
  insertSourceDocumentSchema,
  insertVendorSnapshotSchema,
  insertQuoteMetadataSchema,
  insertQuoteLineItemSchema,
  insertQuoteTotalSchema,
} from "@shared/schema";
import {
  linkPreviewCache,
  CACHE_TTL,
  MAX_CACHE_SIZE,
  type LinkPreview,
  isPrivateOrReservedIP,
  ALLOWED_DOMAINS,
  isAllowedDomain,
  evictExpiredCache,
  getTokenFromDB,
  setTokenInDB,
  deleteTokenFromDB,
  requireAuth,
  requireProjectAccess,
  requireWriteAccess,
  requireAIProposalAccess,
} from "./routes/shared/middleware";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============================================
  // OBJECT STORAGE ROUTES
  // ============================================
  registerObjectStorageRoutes(app, requireAuth);

  // ============================================
  // DOCUMENT EXTRACTION ROUTES
  // ============================================
  registerDocumentRoutes(app, requireAuth);
  registerDocumentExtractionRoutes(app);

  // ============================================
  // AUTH ROUTES
  // ============================================

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    if (!AUTH_ENABLED) {
      return res.json({ user: TEST_USER });
    }

    let userId: string | null = null;

    if (req.session?.user) {
      userId = req.session.user.id;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const sessionData = await getTokenFromDB(token);
        if (sessionData && sessionData.expires > Date.now()) {
          userId = sessionData.user.id;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const freshUser = await storage.getUser(userId);
    if (!freshUser) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userData = { id: freshUser.id, email: freshUser.email, name: freshUser.name };

    if (req.session?.user) {
      req.session.user = userData;
    }

    return res.json({ user: userData });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password, remember } = req.body;

    if (!AUTH_ENABLED) {
      return res.json({ user: TEST_USER });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const result = await verifyCredentials(email, password);

    if (!result.user) {
      return res.status(401).json({ message: result.error || 'Invalid credentials' });
    }

    req.session.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };

    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    // Generate a fallback token for browsers that block cookies
    const token = randomUUID();
    const tokenExpiry = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + tokenExpiry);
    await setTokenInDB(token, req.session.user!, expiresAt);

    // Explicitly save session to database before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session error' });
      }
      // Return both user and token (client can use token if cookies don't work)
      return res.json({ user: req.session.user, token });
    });
  });

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    if (!AUTH_ENABLED) {
      return res.json({ user: TEST_USER });
    }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const result = await createUser(email, password, name);

    if (!result.user) {
      return res.status(400).json({ message: result.error || 'Signup failed' });
    }

    req.session.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };

    // Generate a fallback token for browsers that block cookies
    const token = randomUUID();
    const tokenExpiry = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + tokenExpiry);
    await setTokenInDB(token, req.session.user!, expiresAt);

    // Explicitly save session to database before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session error' });
      }
      // Return both user and token (client can use token if cookies don't work)
      return res.json({ user: req.session.user, token });
    });
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    if (AUTH_ENABLED) {
      // Clear token-based session if present
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await deleteTokenFromDB(token);
      }

      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ message: 'Logout failed' });
          }
          res.clearCookie('connect.sid');
          return res.json({ success: true });
        });
      } else {
        return res.json({ success: true });
      }
    } else {
      return res.json({ success: true });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const genericMessage = 'If an account exists with that email, we\'ve sent a password reset link. Check your inbox.';

    try {
      const user = await storage.getUserByEmail(email.toLowerCase());

      // Whether mail can be sent at all does not depend on the account, so
      // reporting it cannot be used to discover which emails are registered.
      if (!isEmailConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Password reset email is not configured on this server. Contact support to reset your password.',
        });
      }

      if (user) {
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, token, expiresAt);

        const forwardedHost = req.headers['x-forwarded-host'];
        const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
          || req.headers.host
          || `localhost:${process.env.PORT || '5000'}`;
        const forwardedProto = req.headers['x-forwarded-proto'];
        const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
          || (req.secure || process.env.NODE_ENV === 'production' ? 'https' : 'http');
        const resetLink = `${protocol}://${host}/set-new-password?token=${token}`;

        const sent = await sendPasswordResetEmail(user.email, resetLink);
        if (!sent) {
          console.error('[Auth] Password reset email failed to send for an existing account');
        }
      }
    } catch (error) {
      console.error('[Auth] Password reset request error:', error);
    }

    return res.json({ success: true, message: genericMessage });
  });

  app.post('/api/auth/reset-password/confirm', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    try {
      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' });
      }

      const { passwordHash, salt } = hashPassword(newPassword);
      await storage.updateUser(resetToken.userId, { passwordHash, salt });
      await storage.markTokenUsed(resetToken.id);

      return res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (error) {
      console.error('[Auth] Password reset confirm error:', error);
      return res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    if (!AUTH_ENABLED) {
      return res.json({ user: TEST_USER });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential required' });
    }

    const result = await verifyGoogleToken(credential);

    if (!result.user) {
      return res.status(401).json({ message: result.error || 'Google authentication failed' });
    }

    req.session.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };

    const token = randomUUID();
    const tokenExpiry = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + tokenExpiry);
    await setTokenInDB(token, req.session.user!, expiresAt);

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session error' });
      }
      return res.json({ user: req.session.user, token });
    });
  });

  // ============================================
  // PROFILE ROUTES
  // ============================================

  app.get('/api/profile', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const projects = await storage.getProjectsByUser(user.id);
    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        lifecycleState: p.lifecycleState,
        createdAt: p.createdAt,
      })),
    });
  });

  app.patch('/api/profile/name', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Name is required' });
    }

    const result = await updateUserName(user.id, name);
    if (!result.user) {
      return res.status(400).json({ message: result.error || 'Update failed' });
    }

    if (req.session?.user) {
      req.session.user.name = result.user.name;
    }

    return res.json({ user: result.user });
  });

  app.post('/api/profile/change-password', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const dbUser = await storage.getUser(user.id);
    if (!dbUser) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (dbUser.passwordHash && !currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    const result = await changePassword(user.id, currentPassword || '', newPassword);
    if (!result.success) {
      return res.status(400).json({ message: result.error || 'Password change failed' });
    }

    return res.json({ success: true });
  });

  // ============================================
  // LINK PREVIEW ENDPOINT
  // ============================================

  app.post('/api/link-preview', requireAuth, async (req: Request, res: Response) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Invalid URL protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!isAllowedDomain(parsedUrl.hostname)) {
      return res.status(400).json({ error: 'Domain not supported. Supported sites include Pinterest, Unsplash, Houzz, ArchDaily, and other design/architecture platforms.' });
    }
    
    if (isPrivateOrReservedIP(parsedUrl.hostname)) {
      return res.status(400).json({ error: 'URL not allowed' });
    }

    evictExpiredCache();

    const cached = linkPreviewCache.get(url);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    // Special handling for Pinterest using their native oEmbed endpoint
    const isPinterest = ['pinterest.com', 'www.pinterest.com', 'pin.it'].includes(parsedUrl.hostname);
    if (isPinterest) {
      try {
        let resolvedUrl = url;
        
        // Expand pin.it short URLs first
        if (parsedUrl.hostname === 'pin.it') {
          const expandController = new AbortController();
          const expandTimeout = setTimeout(() => expandController.abort(), 5000);
          const expandResponse = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: expandController.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          clearTimeout(expandTimeout);
          resolvedUrl = expandResponse.url;
        }
        
        // Call Pinterest oEmbed endpoint
        const oEmbedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(resolvedUrl)}`;
        const oEmbedResponse = await fetch(oEmbedUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        
        if (oEmbedResponse.ok) {
          const oEmbed = await oEmbedResponse.json();
          const preview: LinkPreview = {
            url,
            title: oEmbed.title || (oEmbed.author_name ? `Pin by ${oEmbed.author_name}` : 'Pinterest Pin'),
            description: oEmbed.description || null,
            image: oEmbed.thumbnail_url || null,
            siteName: oEmbed.provider_name || 'Pinterest',
          };
          linkPreviewCache.set(url, { data: preview, expires: Date.now() + CACHE_TTL });
          return res.json(preview);
        } else {
          console.warn('[Link Preview] Pinterest oEmbed failed:', oEmbedResponse.status);
        }
      } catch (oEmbedError: any) {
        console.warn('[Link Preview] Pinterest oEmbed error:', oEmbedError.message);
      }
    }

    // Special handling for Unsplash using Iframely's open oEmbed proxy
    if (parsedUrl.hostname === 'unsplash.com' || parsedUrl.hostname === 'www.unsplash.com') {
      try {
        const oEmbedUrl = `https://open.iframe.ly/api/oembed?url=${encodeURIComponent(url)}&origin=renix`;
        const oEmbedResponse = await fetch(oEmbedUrl, {
          headers: { 'Accept': 'application/json' },
        });
        if (oEmbedResponse.ok) {
          const oEmbed = await oEmbedResponse.json();
          const preview: LinkPreview = {
            url,
            title: oEmbed.title || (oEmbed.author_name ? `Photo by ${oEmbed.author_name}` : 'Unsplash Photo'),
            description: oEmbed.description || null,
            image: oEmbed.thumbnail_url || null,
            siteName: oEmbed.provider_name || 'Unsplash',
          };
          linkPreviewCache.set(url, { data: preview, expires: Date.now() + CACHE_TTL });
          return res.json(preview);
        }
      } catch (oEmbedError) {
        console.warn('[Link Preview] Unsplash oEmbed failed:', oEmbedError);
      }
    }

    // Special handling for Houzz - use Iframely as well since their pages are large
    if (parsedUrl.hostname === 'houzz.com' || parsedUrl.hostname === 'www.houzz.com') {
      try {
        const oEmbedUrl = `https://open.iframe.ly/api/oembed?url=${encodeURIComponent(url)}&origin=renix`;
        const oEmbedResponse = await fetch(oEmbedUrl, {
          headers: { 'Accept': 'application/json' },
        });
        if (oEmbedResponse.ok) {
          const oEmbed = await oEmbedResponse.json();
          const preview: LinkPreview = {
            url,
            title: oEmbed.title || 'Houzz',
            description: oEmbed.description || null,
            image: oEmbed.thumbnail_url || null,
            siteName: oEmbed.provider_name || 'Houzz',
          };
          linkPreviewCache.set(url, { data: preview, expires: Date.now() + CACHE_TTL });
          return res.json(preview);
        }
      } catch (oEmbedError) {
        console.warn('[Link Preview] Houzz oEmbed failed:', oEmbedError);
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      clearTimeout(timeout);
      
      const finalUrl = response.url;
      if (finalUrl !== url) {
        try {
          const finalParsedUrl = new URL(finalUrl);
          if (isPrivateOrReservedIP(finalParsedUrl.hostname)) {
            return res.status(400).json({ error: 'URL not allowed' });
          }
        } catch {
          return res.status(400).json({ error: 'Invalid redirect URL' });
        }
      }

      if (!response.ok) {
        console.warn(`[Link Preview] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        return res.status(400).json({ error: `Failed to fetch URL (${response.status})` });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        if (contentType.startsWith('image/')) {
          const preview: LinkPreview = {
            url,
            title: null,
            description: null,
            image: url,
            siteName: parsedUrl.hostname,
          };
          linkPreviewCache.set(url, { data: preview, expires: Date.now() + CACHE_TTL });
          return res.json(preview);
        }
        return res.status(400).json({ error: 'URL is not an HTML page' });
      }

      const text = await response.text();
      if (text.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Page too large' });
      }

      const $ = cheerio.load(text);

      const getMetaContent = (property: string): string | null => {
        return (
          $(`meta[property="${property}"]`).attr('content') ||
          $(`meta[name="${property}"]`).attr('content') ||
          null
        );
      };

      const preview: LinkPreview = {
        url,
        title: getMetaContent('og:title') || $('title').text() || null,
        description: getMetaContent('og:description') || getMetaContent('description') || null,
        image: getMetaContent('og:image') || getMetaContent('twitter:image') || null,
        siteName: getMetaContent('og:site_name') || parsedUrl.hostname,
      };

      if (preview.image && !preview.image.startsWith('http')) {
        try {
          preview.image = new URL(preview.image, url).href;
        } catch {
          preview.image = null;
        }
      }

      linkPreviewCache.set(url, { data: preview, expires: Date.now() + CACHE_TTL });

      return res.json(preview);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(408).json({ error: 'Request timeout' });
      }
      console.error('Link preview error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch link preview' });
    }
  });

  // ============================================
  // PROJECT ROUTES
  // ============================================
  registerProjectRoutes(app);

  // ============================================
  // SCOPE ROUTES
  // ============================================
  registerScopeRoutes(app);

  // ============================================
  // BUDGET ROUTES
  // ============================================
  registerBudgetRoutes(app);


  // ============================================
  // QUOTES ROUTES
  // ============================================
  registerQuotesRoutes(app);


  // ============================================
  // INVOICES ROUTES
  // ============================================
  registerInvoicesRoutes(app);


  // ============================================
  // FINANCING ROUTES
  // ============================================
  registerFinancingRoutes(app);


  // ============================================
  // EXECUTION ROUTES
  // ============================================
  registerExecutionRoutes(app);

  // ============================================
  // OVERVIEW ROUTES
  // ============================================
  registerOverviewRoutes(app);

  // ============================================
  // VISION ROUTES
  // ============================================

  app.get('/api/projects/:projectId/vision', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const [boards, allInspirations] = await Promise.all([
        storage.getBoardsByProject(projectId, user.id),
        storage.getInspirationsByProject(projectId, user.id),
      ]);
      return res.json({ boards, inspirations: allInspirations });
    } catch (error) {
      console.error('Error fetching vision:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vision/boards', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId } = req.params;
      const parsed = insertVisionBoardSchema.safeParse({ ...req.body, projectId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const board = await storage.createBoard(parsed.data);
      return res.status(201).json(board);
    } catch (error) {
      console.error('Error creating board:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/vision/boards/:boardId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      const board = await storage.updateBoard(boardId, projectId, user.id, req.body);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      return res.json(board);
    } catch (error) {
      console.error('Error updating board:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/vision/boards/:boardId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      console.log('[Vision] DELETE board request:', { projectId, boardId, userId: user.id });
      const deleted = await storage.deleteBoard(boardId, projectId, user.id);
      console.log('[Vision] Board delete result:', deleted);
      if (!deleted) {
        return res.status(404).json({ message: 'Board not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting board:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vision/boards/:boardId/inspirations', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      const board = await storage.getBoardById(boardId, projectId, user.id);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      const parsed = insertVisionInspirationSchema.safeParse({ ...req.body, projectId, boardId, userId: user.id });
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const inspiration = await storage.createInspiration(parsed.data);
      return res.status(201).json(inspiration);
    } catch (error) {
      console.error('Error creating inspiration:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:projectId/vision/inspirations/:inspId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, inspId } = req.params;
      const inspiration = await storage.updateInspiration(inspId, projectId, user.id, req.body);
      if (!inspiration) {
        return res.status(404).json({ message: 'Inspiration not found' });
      }
      return res.json(inspiration);
    } catch (error) {
      console.error('Error updating inspiration:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/vision/inspirations/:inspId', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, inspId } = req.params;
      const deleted = await storage.deleteInspiration(inspId, projectId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Inspiration not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting inspiration:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vision/boards/:boardId/tags', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      const { tag } = req.body;
      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ message: 'Tag is required' });
      }
      const board = await storage.getBoardById(boardId, projectId, user.id);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      const currentTags = (board.tags || []) as string[];
      if (!currentTags.includes(tag)) {
        const updatedBoard = await storage.updateBoard(boardId, projectId, user.id, { tags: [...currentTags, tag] });
        return res.json(updatedBoard);
      }
      return res.json(board);
    } catch (error) {
      console.error('Error adding board tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/vision/boards/:boardId/tags/:tag', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId, tag } = req.params;
      const decodedTag = decodeURIComponent(tag);
      const board = await storage.getBoardById(boardId, projectId, user.id);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      const currentTags = (board.tags || []) as string[];
      const updatedBoard = await storage.updateBoard(boardId, projectId, user.id, { tags: currentTags.filter((t: string) => t !== decodedTag) });
      return res.json(updatedBoard);
    } catch (error) {
      console.error('Error removing board tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vision/inspirations/:inspId/tags', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, inspId } = req.params;
      const { tag } = req.body;
      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ message: 'Tag is required' });
      }
      const inspiration = await storage.getInspirationById(inspId, projectId, user.id);
      if (!inspiration) {
        return res.status(404).json({ message: 'Inspiration not found' });
      }
      const currentTags = (inspiration.tags || []) as string[];
      if (!currentTags.includes(tag)) {
        const updated = await storage.updateInspiration(inspId, projectId, user.id, { tags: [...currentTags, tag] });
        return res.json(updated);
      }
      return res.json(inspiration);
    } catch (error) {
      console.error('Error adding inspiration tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:projectId/vision/inspirations/:inspId/tags/:tag', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, inspId, tag } = req.params;
      const decodedTag = decodeURIComponent(tag);
      const inspiration = await storage.getInspirationById(inspId, projectId, user.id);
      if (!inspiration) {
        return res.status(404).json({ message: 'Inspiration not found' });
      }
      const currentTags = (inspiration.tags || []) as string[];
      const updated = await storage.updateInspiration(inspId, projectId, user.id, { tags: currentTags.filter((t: string) => t !== decodedTag) });
      return res.json(updated);
    } catch (error) {
      console.error('Error removing inspiration tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:projectId/vision/boards/:boardId/generate-themes', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      const board = await storage.getBoardById(boardId, projectId, user.id);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      const inspirations = await storage.getInspirationsByBoard(boardId, user.id);
      const activeInspirations = inspirations.filter((i: any) => !i.archived);

      if (activeInspirations.length === 0) {
        await storage.updateBoard(boardId, projectId, user.id, { themes: [] });
        return res.json({ themes: [] });
      }

      const summaries = activeInspirations.map((insp: any, idx: number) => {
        const parts: string[] = [];
        if (insp.caption) parts.push(`Caption: ${insp.caption}`);
        const tags = (insp.tags || []) as string[];
        if (tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`);
        const preview = insp.preview as Record<string, unknown> | null;
        if (preview) {
          if (preview.title) parts.push(`Link title: ${preview.title}`);
          if (preview.description) parts.push(`Link description: ${preview.description}`);
          if (preview.siteName) parts.push(`Source: ${preview.siteName}`);
        }
        if (parts.length === 0) parts.push('(image only, no metadata)');
        return `Inspiration ${idx + 1}: ${parts.join(' | ')}`;
      }).join('\n');

      const { completeText } = await import('./ai/openai');
      const raw = (await completeText({
        system: `You are a design analyst for a home renovation project. Given a collection of moodboard inspirations (captions, tags, link previews), identify 3-7 short emerging design themes that capture the overall aesthetic direction. Each theme should be 2-4 words (e.g., "Natural Materials", "Warm Minimalism", "Industrial Accents"). Return ONLY a JSON array of strings, no explanation.`,
        messages: [{ role: 'user', content: `Analyze these ${activeInspirations.length} moodboard inspirations and identify the emerging design themes:\n\n${summaries}` }],
        effort: 'low',
      })).trim() || '[]';
      const existingThemes = (board.themes || []) as string[];
      let themes: string[];
      try {
        const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed) || !parsed.every((t: unknown) => typeof t === 'string')) {
          themes = existingThemes;
        } else {
          themes = parsed;
        }
      } catch {
        themes = existingThemes;
      }

      await storage.updateBoard(boardId, projectId, user.id, { themes });
      return res.json({ themes });
    } catch (error) {
      console.error('Error generating themes:', error);
      return res.status(500).json({ message: 'Failed to generate themes' });
    }
  });

  app.post('/api/projects/:projectId/vision/boards/:boardId/duplicate', requireAuth, requireProjectAccess, requireWriteAccess, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { projectId, boardId } = req.params;
      const board = await storage.getBoardById(boardId, projectId, user.id);
      if (!board) {
        return res.status(404).json({ message: 'Board not found' });
      }
      const boardTags = (board.tags || []) as string[];
      const boardThemes = (board.themes || []) as string[];
      const newBoard = await storage.createBoard({
        projectId,
        userId: user.id,
        title: `${board.title} (copy)`,
        desireStatement: board.desireStatement,
        tags: [...boardTags],
        themes: [...boardThemes],
        archived: false,
      });
      const inspirations = await storage.getInspirationsByBoard(boardId, user.id);
      for (const insp of inspirations) {
        const inspTags = (insp.tags || []) as string[];
        await storage.createInspiration({
          projectId,
          boardId: newBoard.id,
          userId: user.id,
          imageUrl: insp.imageUrl,
          caption: insp.caption,
          tags: [...inspTags],
          preview: insp.preview as Record<string, unknown> | null,
          archived: false,
        });
      }
      return res.status(201).json(newBoard);
    } catch (error) {
      console.error('Error duplicating board:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================
  // DOCUMENTS ROUTES
  // ============================================
  registerDocumentsRoutes(app);

  // ============================================
  // IMPORT SESSION ROUTES (quote import pipeline)
  // ============================================
  registerImportSessionRoutes(app);

  // ============================================
  // AI ROUTES (extracted to server/routes/ai.ts)
  // ============================================
  registerAiRoutes(app);

  // NOTE: AI SERVICE ROUTES and PROPOSALS routes have been moved to server/routes/ai.ts
  // and are registered via registerAiRoutes(app) above


  /**
   * GET /api/projects/:id/context - Get project context for AI
   */
  app.get('/api/projects/:id/context', async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = req.session.user;
    const projectId = req.params.id;
    
    try {
      const project = await storage.getProjectById(projectId, user.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Use scopeNodes (tree-based) instead of legacy scopes
      const scopeNodes = await storage.getScopeNodesByProject(projectId, user.id);
      const budget = await storage.getBudgetByProject(projectId, user.id);
      
      const context = {
        projectId: project.id,
        projectName: project.name,
        projectType: project.type,
        projectStatus: project.status,
        currency: (project.regionalContext as any)?.currency || 'USD',
        scopes: scopeNodes.map(s => ({ id: s.id, name: s.name, parentId: s.parentId, isArchived: s.isArchived })),
        budgetIntent: budget?.totalBudget,
        budgetCurrency: budget?.currency || (project.regionalContext as any)?.currency,
      };
      
      return res.json(context);
    } catch (error) {
      console.error('Error fetching project context:', error);
      return res.status(500).json({ message: 'Failed to fetch project context' });
    }
  });

  /**
   * GET /api/projects/:id/audit - Get audit log for project
   */
  app.get('/api/projects/:id/audit', async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = req.session.user;
    const projectId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    try {
      const project = await storage.getProjectById(projectId, user.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get AI call logs for this project
      const { getAICallLogs } = await import('./renixAiService');
      const logs = getAICallLogs(limit);
      
      // Get proposals for this project
      const proposals = await storage.getProposalsByUser(user.id, projectId);
      
      return res.json({ 
        aiCallLogs: logs,
        proposals: proposals.slice(0, limit),
      });
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return res.status(500).json({ message: 'Failed to fetch audit log' });
    }
  });

  return httpServer;
}
