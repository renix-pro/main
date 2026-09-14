import "./env";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runBackgroundJobRecovery } from "./backgroundJobRecovery";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import { isProduction } from "./env";

const app = express();
const httpServer = createServer(app);

if (process.env.NODE_ENV !== "production") {
  process.on('SIGHUP', () => {});

  let esbuildServiceDead = false;
  let esbuildErrorCount = 0;
  const ESBUILD_ERROR_THRESHOLD = 3;

  const originalProcessExit = process.exit;
  (process as any).exit = function(code?: number) {
    if (code === 1) {
      const stack = new Error().stack || '';
      const isViteError = stack.includes('vite.ts') || stack.includes('vite.js');
      if (isViteError) {
        esbuildErrorCount++;
        if (esbuildServiceDead || esbuildErrorCount >= ESBUILD_ERROR_THRESHOLD) {
          console.error(`[crash-guard] esbuild service is dead (errors: ${esbuildErrorCount}) — exiting for clean restart`);
          return originalProcessExit.call(process, code as any);
        }
        console.error(`[crash-guard] Suppressed Vite error #${esbuildErrorCount} — server stays alive`);
        return undefined as never;
      }
    }
    return originalProcessExit.call(process, code as any);
  };

  process.on('uncaughtException', (err) => {
    if (err?.message?.includes('The service is no longer running')) {
      esbuildServiceDead = true;
      console.error('[crash-guard] Detected esbuild service death via uncaught exception');
      originalProcessExit.call(process, 1);
    }
  });
}

// PostgreSQL connection pool for session store
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Session configuration - Phase 12 Auth Addendum
// Uses PostgreSQL for persistent session storage
const PgSession = connectPgSimple(session);

// Trust first proxy (reverse proxy / platform load balancer in production)
app.set('trust proxy', 1);

app.use(compression());

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/auth/login' || req.path === '/api/auth/register',
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api', apiLimiter);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "development-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      // Production runs behind an HTTPS proxy and may be embedded, so cookies
      // must be Secure + SameSite=None. Local development is plain http://localhost,
      // where a Secure cookie would never be stored by the browser.
      secure: isProduction,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: isProduction ? 'none' : 'lax',
    },
  })
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Object storage health check on startup
  try {
    const oss = new ObjectStorageService();
    const health = await oss.healthCheck();
    if (health.ok) {
      log("Object storage health check passed", "storage");
    } else {
      log(`⚠ OBJECT STORAGE HEALTH CHECK FAILED: ${health.error}`, "storage");
      log("File uploads and document retrieval will not work until this is resolved.", "storage");
    }
  } catch (error) {
    log(`⚠ Object storage health check error: ${error instanceof Error ? error.message : 'Unknown error'}`, "storage");
  }

  // Phase 5A: Run background job recovery on startup
  // Resets stale jobs and logs pending jobs for observability
  try {
    const recoveryResult = await runBackgroundJobRecovery();
    if (recoveryResult.errors.length > 0) {
      log(`Background job recovery completed with ${recoveryResult.errors.length} error(s)`);
    }
  } catch (error) {
    log(`Background job recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log(`port ${port} is already in use — set PORT in .env to a free port`, "error");
    } else {
      log(`failed to start server: ${err.message}`, "error");
    }
    process.exit(1);
  });
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // SO_REUSEPORT is only supported on Linux; macOS rejects it with ENOTSUP.
      reusePort: process.platform === "linux",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
