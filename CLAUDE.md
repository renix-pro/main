# RENIX vNext

AI-powered construction and renovation management platform (Express + React + PostgreSQL).
Originally built on Replit; migrated to local development on 2026-09-14. This file replaces
the old `replit.md` (kept until you delete it; its content lives here now).

## Local development

### Prerequisites
- Node.js 20+ (tested with 26), npm
- Docker Desktop (for PostgreSQL 16 and the object-storage emulator)

### First-time setup
```bash
cp .env.example .env        # already done once; fill in OPENAI_API_KEY etc.
npm install
npm run setup               # docker compose up, drizzle push, load seed SQL, seed storage
npm run dev                 # http://localhost:4000
```
`npm run setup` is idempotent apart from `db:seed`, which re-inserts the migrated rows;
run the individual steps if you only need one.

### Commands
| Command | What it does |
|---|---|
| `npm run dev` | Express + Vite dev server with HMR on `PORT` (default 4000) |
| `npm run check` | `tsc` type check (see "Known issues") |
| `npm run build` / `npm start` | Production bundle to `dist/` and run it |
| `npm run infra:up` / `infra:down` | Start / stop Postgres + storage emulator (`docker-compose.yml`) |
| `npm run db:push` | Sync `shared/schema.ts` to the database (drizzle-kit, no migration files) |
| `npm run db:studio` | Drizzle Studio GUI for the database |
| `npm run db:seed` | Load `scripts/seed-data.sql` (31 tables / 1,887 rows exported from Replit; **not in git**, see below) |
| `npm run db:seed-demo` | Programmatic demo data (`server/seedDemo.ts`) |
| `npm run storage:seed` | Upload `scripts/storage-backup` (165 files; **not in git**) into the emulator bucket |

### Environment (`.env`, see `.env.example`)
- `PORT` — 4000. macOS reserves 5000 (AirPlay) and 3000 was in use.
- `DATABASE_URL` — `postgresql://renix:renix@localhost:5432/renix` (docker container `renix-postgres`).
- `SESSION_SECRET` — random; sessions are stored in the `session` table.
- `GCS_EMULATOR_URL`, `PRIVATE_OBJECT_DIR=/renix-local/.private`, `PUBLIC_OBJECT_SEARCH_PATHS` — object storage.
  Do NOT rename `GCS_EMULATOR_URL` to `STORAGE_EMULATOR_HOST`: the Google client library
  special-cases that name and breaks the URL.
- `OPENAI_API_KEY` — required for every AI feature. Optional overrides: `OPENAI_MODEL` (default `gpt-4o`),
  `OPENAI_MODEL_FAST` (default `gpt-4o-mini`), `OPENAI_WEB_SEARCH_MODEL`, `OPENAI_IMAGE_MODEL`
  (default `gpt-image-1`), `OPENAI_BASE_URL` (only for a proxy). Without a key the app runs but every AI
  feature errors on use; the server logs a warning at boot.
- `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` — Google Sign-In. Add `http://localhost:4000`
  to the OAuth client's authorized JavaScript origins in Google Cloud Console.
- `SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM_NAME` — password-reset mail (optional).

### What changed in the Replit → local migration
- `server/env.ts` loads `.env` (dotenv). It is the first import in `server/index.ts`, `script/runSeed.ts`; `drizzle.config.ts` loads dotenv itself.
- Session cookie is `secure`/`SameSite=None` only in production; local http uses `SameSite=Lax` (`server/index.ts`).
- Object storage (`server/replit_integrations/object_storage/`): when `GCS_EMULATOR_URL` is set the `@google-cloud/storage` client points at fake-gcs-server, the bucket is auto-created, upload URLs become `PUT /api/uploads/local/<bucket>/<object>` served by this app (no signing sidecar). Without the variable the original Replit sidecar code path is used unchanged.
- Vite config no longer loads the `@replit/*` plugins (removed from devDependencies).
- Added `dotenv` and `nanoid` (was an undeclared transitive dependency used by `server/vite.ts`).
- `docker-compose.yml`, `.env.example`, `scripts/seed-storage.cjs`, `.claude/launch.json` are new.
- The `server/replit_integrations/` folder name was kept to avoid touching ~15 import sites; only `object_storage/` and `document/` remain (the Replit voice, chat, image and batch helpers were deleted).

### AI provider: OpenAI
- All LLM calls go through `server/ai/openai.ts`: `completeText`, `completeJson`, `streamText`,
  `streamJson`, `webResearch`, `generateImageBuffer`, plus `imageBlock` for vision input and
  `parseJsonLoose`. Do not instantiate the SDK anywhere else.
- Models: `gpt-4o` for extraction and the AI companion, `gpt-4o-mini` for classification, summaries,
  scope matching, overview text and quote insights. Call sites choose via `effort: "low"` rather than
  naming models. All overridable by env var.
- JSON responses use OpenAI's native JSON mode plus a lenient parser (`parseJsonLoose`) that tolerates
  code fences and surrounding prose. Zod validation of the parsed shape is unchanged.
- Web research for cost-validation questions uses the Responses API `web_search` tool.
- Project hero images are generated with `gpt-image-1` and stored as PNG at
  `projects/<id>/hero-<timestamp>.png`; generation runs in the background on project create and on
  `POST /api/projects/:id/hero-image/generate`.
- History: the project was briefly ported to Anthropic Claude on 2026-09-14 and reverted to OpenAI the
  same day. The Claude-only modules (`server/ai/claude.ts`, `server/ai/heroIllustration.ts`) were removed.

### Known issues / follow-ups
- `npm run check` is clean (0 errors). It was 84 at import from Replit; the 2026-09-14 audit fixed the
  real ones and removed three dead modules (`server/documentProcessor.ts`, `client/src/cfi/`,
  `client/src/frames/quotes/useQuotesModeState.ts`).
- Audit of 2026-09-14: `docs/audit-2026-09-14.md` (runtime + fixes) with appendices `docs/audit-2026-09-14-api-wiring.md`
  and `docs/audit-2026-09-14-code-health.md`. Open medium/low items are listed there (silent UI failures on closed
  projects, missing `scope-references`/`annotations` routes, proposals polling, etc.).
- Security-relevant behaviour after the audit: `GET /objects/*` requires login + ownership; unknown `/api/*` paths
  return JSON 404; project PATCH is whitelisted; document extraction routes require auth.
- Deploying anywhere other than Replit needs a real storage backend: set `GOOGLE_APPLICATION_CREDENTIALS`
  and replace the sidecar credential block + `signObjectURL` with `file.getSignedUrl()`.
- Leftover Replit files on disk, all gitignored and safe to delete: `replit.md`, `.replit`, `.local/`, `.agents/`,
  and `Renix-1.zip` (a duplicate export of this folder).
- **Private data is deliberately excluded from git** because the GitHub repo (`renix-pro/main`) is public:
  `scripts/seed-data.sql` (real users, password hashes, session tokens), `scripts/storage-backup/`
  (uploaded customer documents), `client/public/test-quote.pdf` (a real quote with personal data) and
  `attached_assets/` except the handful of images the client imports.
  Keep local copies of these outside git (e.g. the Replit export zip) — a fresh clone can only use `npm run db:seed-demo`.
- Git history was restarted on 2026-09-14 with a single clean commit for the same reason; the original Replit
  history was purged from this clone entirely (branches, Replit's `refs/replit/agent-ledger`, reflog, gc).
  The only remaining copy is the Replit export zip — keep it private.
- Seeded users have passwords from the old system (bcrypt or legacy SHA-256; both still work). Register a new account for local testing.

## User Preferences
User agency is absolute — AI proposes; users decide.
AI and manual paths always coexist.
Structure emerges, never forced.
Stages are descriptive only — only closed projects are read-only.
Financial truths remain distinct — Budget ≠ Quotes ≠ Invoices ≠ Financing.
A quote cannot exist without its source document — deleting a document must cascade-delete all linked quotes and invoices.

## System Architecture

### Core Architecture
The system is structured around 10 purpose-built pages: Projects, Overview, Vision, Scope, Budget, Quotes, Invoices, Financing, Execution, and Documents. It features an application spine that defines page metadata, authority channels (`read`, `propose`, `commit`), and project lifecycle management. Data is persisted in PostgreSQL using a domain entity model that supports multi-user isolation. Projects have a three-state lifecycle (ACTIVE, CLOSED, DELETED) with server-side enforced transition rules. Asynchronous tasks are persistent, restart-safe, idempotent, and observable. Security is managed via a dual authentication system with bcrypt password hashing, DB ownership checks, and rate limiting. Database indexes are applied on `projectId`, `userId`, and key FK columns.

### AI System
The AI system uses explicit memory tiering and frame-aware selective loading. It operates in `READ`, `PROPOSE`, and `COMMIT` modes, offering contextual suggestions that require user acceptance. A hybrid retrieval system combines structured and bounded semantic retrieval. AI behavior is observable, auditable, and safe through structured decision trace logging, token budget enforcement, and failure mode logging. It enhances explanations with canonical source attribution, entity counting, and cross-frame reconciliation. The AI acts as a thinking partner, guiding users through complex situations without executing actions, using `ReasoningPath`, `ClarifyingQuestion`, and `ScenarioFrame`. The AI pane includes a persistent ProjectHealthStrip, frame-aware suggested prompts, structured response cards, an animated AIAvatar, confidence badges, and a progressive ThinkingIndicator. Vision moodboard themes are AI-generated from inspiration metadata.

### Financial Unit Conventions
All financial calculations use consistent monetary unit handling: `cents` for quote and invoice line items, and `whole currency units` for budget allocations and financing sources. Each piece of quote data has exactly one canonical owner table. A type-safe `MoneyValue` type is used for explicit currency and minor units.

### Modular Architecture and UI/UX
The system employs a modular architecture for both backend and frontend. The UI follows a canonical sitemap, maintaining a consistent visual system with a calm, monochrome aesthetic using "Direction 3: Cool Neutrals + Copper Accent" as the locked palette. It features an AI-first, conversation-centric layout with a desktop-only three-column CSS Grid, using a centralized token system for design values. The `FrameRouter` uses `React.lazy()` for per-frame code splitting. All loading spinners use the branded `RenixSpinner` component. Live currency formatting with locale-aware separators is applied across financial inputs. The landing page is modularized into 18 files under `client/src/pages/landing/`, using CSS keyframes + IntersectionObserver for animations. The hero demo (`HeroDemo.tsx`) features a full app-window chrome (browser dots, sidebar navigation icons, content area) with a 3-scene rotating showcase (Upload & Extract, Budget at a Glance, Scope & Progress) on a 13s loop. Feature deep-dives use CSS-rendered interactive previews (`FeaturePreviews.tsx`) for Scope, Budget, and Quotes — no fake mockup images. The AI Companion feature uses a real screenshot (`image_1771747181688.png`). Cookie consent is managed globally via `CookieConsent.tsx`, and legal pages (Privacy Policy, Terms of Service) reflect updated content and EU jurisdiction. Pricing section includes ROI framing ("0.005% of your renovation cost") and "vs. alternatives" price anchoring. `MobileStickyCTA.tsx` provides a fixed-bottom sticky CTA on mobile (md:hidden) that appears after scrolling past the hero and hides when the bottom CTA enters the viewport, using IntersectionObserver + CSS keyframes with prefers-reduced-motion support. Mobile Safari viewport optimizations (`viewport-fit=cover`, `100dvh`, safe-area CSS) are implemented. Mobile layout uses solid backgrounds (no transparency/blur) for header, dock, and safe-area regions to prevent system UI bleed-through. The `FrameContainer` header is hidden on mobile (`hidden md:flex`) — the mobile shell header shows "Project · Frame" using `FRAME_METADATA` labels instead, eliminating double-header stacking. Dark mode flash prevention uses an inline `<script>` in `index.html` that reads `localStorage('renix-theme')` and applies the `.dark` class + background color before React mounts; a `<meta name="theme-color">` tag syncs with the active theme. The `.safe-area-top` class uses `max(env(safe-area-inset-top), 0.75rem)` with progressive fallbacks for cross-browser compatibility.

### Key Features
- **Authority Channels**: `read`, `propose`, `commit` for data access and changes.
- **Scope Frame**: Interactive recursive tree structure with batch node creation and an improved quote import pipeline.
- **Quotes Frame (Flat Version Model)**: Each quote version is a first-class row with detailed status tracking and lineage, including AI assessments and comparison tools.
- **Universal Document Ingestion (UDI)**: Authoritative document processing workflow with AI classification, explicit interpretation, and transactional ingestion with a 2-step deletion process. Documents are processed for data extraction immediately upon upload, with rich AI ingestion message cards for progress.
- **Document Intelligence System**: Full RAG with PostgreSQL full-text search and AI-powered claims extraction.
- **Budget and Financing Frames**: Manage budget intent, available funds, and provide key financial KPIs.
- **Invoices Frame**: Scope-backed 3-zone CFS layout with KPI strip, scope→invoice tree hierarchy, and detail view with payment recording. Invoice creation is AI-mediated or manual.
- **Direct Cost Scopes**: Scope nodes with a `costType` field ('standard' or 'direct') bypass the quote pipeline.
- **Project Lifecycle Management**: Projects have a three-state lifecycle (ACTIVE, CLOSED, DELETED) with server-side enforced transition rules and read-only toast feedback. Project deletion includes deep cleanup across all related tables and object storage.
- **Onboarding and User Experience**: Guided onboarding tour, welcome chooser, activation checklist with 5-milestone progressive reveal (scope → budget → quote → financing → execution, max 4 visible), dismissible optional hints (Vision/Documents), "Setup complete" card when all done, and action-oriented empty states provide a user-friendly start. Financial glossary tooltips and scope templates offer in-context support.
- **Project Card Enhancements**: AI-generated or user-uploaded hero images, enhanced project card statistics (2x2 stats grid), and a polished project settings dialog.
- **API Performance**: API response compression (gzip) is enabled. Vendor chunk splitting is used for better code splitting. Landing page image optimization includes `fetchPriority="high"` for LCP and `loading="lazy"` for below-fold images.
- **AI Execution Task Proposal Acceptance**: Accepting AI-generated execution proposals creates tasks in the database with server-side validation.

## Roadmap & Review
The forward-looking council review lives in `docs/user-journey-review.md`. It contains 51 opportunities (OPP-095 through OPP-145) organized into: Bugs (10, all resolved), Stage A Visual Polish (14), Stage B Power User (7), Stage C Shareability (6), Stage D Execution Depth (5), Stage E Platform Maturity (9). Next OPP number: **OPP-146**. All findings are code-grounded with specific file references and line numbers.

### Resolved Items (OPP-095 to OPP-106)
- OPP-095: AI pane logo dark:invert added to AIAvatar.tsx
- OPP-096: Empty AI bubbles — RichTextContent skipped when content is empty
- OPP-097: Code blocks rendered in styled pre/code instead of stripped
- OPP-098: Budget inline input uses CurrencyInput for live formatting
- OPP-099: Task date fields responsive grid-cols-1 sm:grid-cols-2
- OPP-100: Scope migration dead code removed (areas/items loops)
- OPP-101: Password reset returns honest "not yet available" message
- OPP-102: Invoice deletion wrapped in db.transaction for atomicity
- OPP-103: Touch-visible allocation/scope actions (visible md:invisible md:group-hover:visible)
- OPP-104: Hardcoded en-AU/en-US locales replaced with project regional locale in 8 files
- OPP-106: Invoice KPI tiles layout — added Zone1BVisual with KPIRing payment progress to fill the 8fr column

## Authentication
The app supports dual authentication: email/password and Google Sign-In. Google OAuth uses Google Identity Services (GIS) on the frontend with server-side ID token verification via `google-auth-library`. Google-only users have null `passwordHash`/`salt` in the `users` table. Existing email users who log in via Google get their `googleId` linked automatically. Environment variables: `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`. Key files: `server/auth.ts` (verifyGoogleToken), `client/src/components/GoogleSignInButton.tsx`, `client/src/auth/AuthContext.tsx` (googleLogin method).

## Password Reset
Forgot password flow: user enters email on `/reset-password` → backend generates a token (1-hour expiry, single-use) stored in `password_reset_tokens` table → email sent via Nodemailer/Gmail SMTP with reset link → user clicks link to `/set-new-password?token=...` → enters new password → backend validates token and updates password hash. Environment variables: `SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM_NAME` (defaults to "RENIX"). Key files: `server/email.ts`, `server/routes.ts` (reset-password routes), `client/src/pages/ResetPasswordPage.tsx`, `client/src/pages/SetNewPasswordPage.tsx`.

## External Dependencies
- **PostgreSQL**: Primary database for data persistence.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Framer Motion**: JavaScript animation library for React (workspace UI only; landing page and legal pages use CSS animations).
- **Zod**: TypeScript-first schema declaration and validation library.
- **Express**: Fast, unopinionated, minimalist web framework for Node.js.
- **OpenAI**: AI Companion, document classification/extraction, summaries, overview interpretations, quote insights, web research (`gpt-4o` / `gpt-4o-mini`) and project hero images (`gpt-image-1`).