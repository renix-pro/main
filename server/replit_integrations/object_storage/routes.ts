import express, { type Express, type Request, type Response, type NextFunction } from "express";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  StorageUnavailableError,
  objectStorageClient,
  isLocalStorageMode,
  LOCAL_UPLOAD_PREFIX,
} from "./objectStorage";
import { storage } from "../../storage";
import { randomUUID } from "crypto";

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Register object storage routes for file uploads.
 *
 * This provides routes for the presigned URL upload flow with ownership tokens:
 * 1. POST /api/uploads/request-url - Get a presigned URL and ownership token
 * 2. The client uploads directly to the presigned URL
 * 3. The client uses the token when creating quotes/documents (ownership verification)
 *
 * Security: Upload tokens bind object paths to project/user at presign time.
 * 
 * @param app Express application
 * @param requireAuth Optional auth middleware for project-bound uploads
 */
export function registerObjectStorageRoutes(app: Express, requireAuth?: AuthMiddleware): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg",
   *   "projectId": "optional-project-id",
   *   "purpose": "quote" | "document"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid",
   *   "uploadToken": "token-for-ownership-verification"
   * }
   *
   * When projectId is provided, an uploadToken is returned that binds
   * the object path to that project for ownership verification.
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  /**
   * Helper to handle the upload URL request logic
   */
  const handleUploadUrlRequest = async (req: Request, res: Response) => {
    try {
      const { name, size, contentType, projectId, purpose } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Pass projectId to generate project-scoped storage paths for data isolation
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(projectId);

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // If projectId is provided, create an ownership token
      let uploadToken: string | undefined;
      if (projectId) {
        // Get user from session or token auth
        const user = (req as any).user;
        if (!user) {
          return res.status(401).json({ error: "Authentication required for project-bound uploads" });
        }

        // Verify user has access to the specified project
        const project = await storage.getProjectByIdOnly(projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        
        // Check project ownership - user must be the project owner
        // For multi-user scenarios, also check membership array
        const isOwner = project.userId === user.id;
        
        // Safely check membership array if it exists
        let isMember = false;
        if (project.members && Array.isArray(project.members)) {
          try {
            isMember = (project.members as Array<unknown>).some((m: unknown) => {
              if (m && typeof m === 'object' && 'userId' in m) {
                return (m as { userId: string }).userId === user.id;
              }
              return false;
            });
          } catch {
            // Malformed members array, ignore
          }
        }
        
        if (!isOwner && !isMember) {
          return res.status(403).json({ error: "Access denied to this project" });
        }

        // Create a pending upload record to bind objectPath -> project/user
        uploadToken = randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry
        
        await storage.createPendingUpload({
          token: uploadToken,
          objectPath,
          projectId,
          userId: user.id,
          purpose: purpose || "quote",
          contentType: contentType || null,
          fileSize: typeof size === 'number' ? size : null,
          consumed: false,
          expiresAt,
        });
      }

      res.json({
        uploadURL,
        objectPath,
        uploadToken,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  };

  // Register the route with optional auth middleware
  // Auth is needed when projectId is provided to bind uploads to projects
  if (requireAuth) {
    app.post("/api/uploads/request-url", requireAuth, handleUploadUrlRequest);
  } else {
    app.post("/api/uploads/request-url", handleUploadUrlRequest);
  }

  /**
   * Local development only: accept the file PUT that would otherwise go to a
   * signed GCS URL, and write it into the storage emulator.
   *
   * PUT /api/uploads/local/<bucket>/<objectName>
   */
  if (isLocalStorageMode) {
    app.put(
      `${LOCAL_UPLOAD_PREFIX}*`,
      express.raw({ type: () => true, limit: "50mb" }),
      async (req: Request, res: Response) => {
        try {
          const rest = req.path.slice(LOCAL_UPLOAD_PREFIX.length);
          const slash = rest.indexOf("/");
          if (slash <= 0 || slash === rest.length - 1) {
            return res.status(400).json({ error: "Invalid upload path" });
          }
          const bucketName = rest.slice(0, slash);
          const objectName = decodeURIComponent(rest.slice(slash + 1));

          // Only allow writes inside the configured private directory.
          const privateDir = objectStorageService.getPrivateObjectDir().replace(/^\//, "");
          if (!`${bucketName}/${objectName}`.startsWith(`${privateDir}/`)) {
            return res.status(403).json({ error: "Upload path outside private object dir" });
          }

          const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
          const contentType = req.get("content-type") || "application/octet-stream";
          await objectStorageClient
            .bucket(bucketName)
            .file(objectName)
            .save(body, { contentType, resumable: false });
          res.status(200).end();
        } catch (error) {
          console.error("Error storing local upload:", error);
          res.status(500).json({ error: "Failed to store upload" });
        }
      },
    );
  }

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "This file is no longer available. It may need to be re-uploaded." });
      }
      if (error instanceof StorageUnavailableError) {
        return res.status(503).json({ error: "File storage is temporarily unavailable. Please try again later." });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

