import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * Storage backends
 *
 * - Local development: set GCS_EMULATOR_URL (e.g. http://localhost:4443) and
 *   the client talks to a GCS emulator (fake-gcs-server, see docker-compose.yml).
 *   Uploads go through PUT /api/uploads/local/... on this server instead of a
 *   signed URL (see routes.ts).
 * - Replit: no emulator host set; credentials come from the Replit sidecar and
 *   upload URLs are signed by it.
 * - Any other host with real GCS: set GOOGLE_APPLICATION_CREDENTIALS and remove
 *   the sidecar block below (signed URLs would then use file.getSignedUrl()).
 */
const GCS_EMULATOR_URL = process.env.GCS_EMULATOR_URL || "";
export const isLocalStorageMode = GCS_EMULATOR_URL.length > 0;

/** Path prefix of the local (emulator) upload endpoint: /api/uploads/local/<bucket>/<object> */
export const LOCAL_UPLOAD_PREFIX = "/api/uploads/local/";

function createStorageClient(): Storage {
  if (isLocalStorageMode) {
    const apiEndpoint = GCS_EMULATOR_URL.startsWith("http")
      ? GCS_EMULATOR_URL
      : `http://${GCS_EMULATOR_URL}`;
    return new Storage({ apiEndpoint, projectId: "local-dev" });
  }
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: {
          type: "json",
          subject_token_field_name: "access_token",
        },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = createStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class StorageUnavailableError extends Error {
  constructor(message = "Object storage is currently unavailable") {
    super(message);
    this.name = "StorageUnavailableError";
    Object.setPrototypeOf(this, StorageUnavailableError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const privateObjectDir = this.getPrivateObjectDir();
      const { bucketName } = parseObjectPath(privateObjectDir);
      const bucket = objectStorageClient.bucket(bucketName);
      if (isLocalStorageMode) {
        // The emulator starts empty; create the bucket on first run.
        const [bucketExists] = await bucket.exists();
        if (!bucketExists) {
          await bucket.create();
        }
      }
      const probePath = `${privateObjectDir}/.health-probe`;
      const { bucketName: _, objectName } = parseObjectPath(probePath);
      const file = bucket.file(objectName);
      await file.exists();
      return { ok: true };
    } catch (error: any) {
      const message = error?.message || "Unknown error";
      if (message.includes("401") || message.includes("Unauthorized") || message.includes("403") || message.includes("Forbidden")) {
        return { ok: false, error: `Authorization failure: ${message}` };
      }
      return { ok: false, error: message };
    }
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  // If projectId is provided, files are stored under project-specific prefix for isolation.
  async getObjectEntityUploadURL(projectId?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    // Project-scoped path for data isolation; falls back to shared uploads if no projectId
    const fullPath = projectId 
      ? `${privateObjectDir}/projects/${projectId}/uploads/${objectId}`
      : `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    if (isLocalStorageMode) {
      // No signing service locally: the client PUTs to this server, which
      // writes into the emulator (see registerObjectStorageRoutes).
      return `${LOCAL_UPLOAD_PREFIX}${bucketName}/${objectName}`;
    }

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    try {
      const [exists] = await objectFile.exists();
      if (!exists) {
        throw new ObjectNotFoundError();
      }
    } catch (error: any) {
      if (error instanceof ObjectNotFoundError) throw error;
      const msg = error?.message || "";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("403") || msg.includes("Forbidden")) {
        throw new StorageUnavailableError(`Storage authorization failed: ${msg}`);
      }
      throw error;
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    let rawObjectPath: string;
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      // Extract the path from the URL by removing query parameters and domain
      rawObjectPath = new URL(rawPath).pathname;
    } else if (rawPath.startsWith(LOCAL_UPLOAD_PREFIX)) {
      // Local upload endpoint: /api/uploads/local/<bucket>/<object> -> /<bucket>/<object>
      rawObjectPath = rawPath.slice(LOCAL_UPLOAD_PREFIX.length - 1).split("?")[0];
    } else {
      return rawPath;
    }
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async uploadBuffer(buffer: Buffer, storagePath: string, contentType: string = 'image/png'): Promise<string> {
    const { bucketName, objectName } = parseObjectPath(storagePath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType, resumable: false });

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    if (storagePath.startsWith(entityDir)) {
      const entityId = storagePath.slice(entityDir.length);
      return `/objects/${entityId}`;
    }
    return storagePath;
  }

  async deleteObjectEntity(objectPath: string): Promise<boolean> {
    try {
      const file = await this.getObjectEntityFile(objectPath);
      await file.delete();
      return true;
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        // File already doesn't exist, consider it deleted
        return true;
      }
      console.error('Error deleting object:', objectPath, error);
      return false;
    }
  }

  // Deletes multiple object entities from storage.
  async deleteObjectEntities(objectPaths: string[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    
    for (const path of objectPaths) {
      if (path) {
        const success = await this.deleteObjectEntity(path);
        if (success) {
          deleted++;
        } else {
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

