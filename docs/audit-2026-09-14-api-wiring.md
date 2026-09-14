# RENIX — API wiring audit (Express server ↔ React client)

Repo: `/Users/stuttgart/ClaudeWork/Renix/Renix-1` (read-only audit, 2026-09-14).
All paths below are relative to that root. Line numbers are exact as of this audit.

Middleware legend used throughout: **A** = `requireAuth`, **P** = `requireProjectAccess`, **W** = `requireWriteAccess`, **—** = none.
All three middlewares live in `server/routes/shared/middleware.ts` (`requireAuth` 161, `requireProjectAccess` 168, `requireWriteAccess` 215). `requireAIProposalAccess` (260) is exported and imported in `server/routes.ts:66` but never applied to any route.

Mount order (`server/routes.ts` → `registerRoutes`): object-storage (76) → document-extraction (81) → auth/profile/link-preview (87–621) → projects (626) → scope (631) → budget (636) → quotes (642) → invoices (648) → financing (654) → execution (660) → overview (665) → vision (671–961, inline) → documents (970) → import-sessions (975) → ai (980) → `/api/projects/:id/context` (989), `/api/projects/:id/audit` (1028). After that, `server/index.ts:176` adds the JSON error handler and then the SPA catch-all (`server/vite.ts:34` in dev, `server/static.ts:16` in prod). **The catch-all has no `/api` exclusion: any unmatched `/api/...` request returns `200 text/html` (index.html).** This matters for every "client call with no route" below — `fetch(...).ok` is `true` and `res.json()` throws a SyntaxError instead of a clean 404.

---

## 1. Server route inventory

### 1a. `server/replit_integrations/object_storage/routes.ts`

| Method | Path | MW | File:line | Purpose |
|---|---|---|---|---|
| POST | `/api/uploads/request-url` | A | routes.ts:146 | Presigned (or local) upload URL; when `projectId` given, verifies ownership/membership and creates a `pending_uploads` token (117) |
| PUT | `/api/uploads/local/*` (`LOCAL_UPLOAD_PREFIX*`) | — | routes.ts:158 | **Local emulator only** (`isLocalStorageMode`). Accepts raw body, writes to bucket; only guard is "path under private dir" (173) |
| GET | `/objects/:objectPath(*)` | — | routes.ts:200 | Streams any stored object. **No auth, no ACL check** — `canAccessObjectEntity` exists (`objectStorage.ts:309`) but this route never calls it. Serves uploaded customer documents and hero images by path. |

### 1b. `server/replit_integrations/document/index.ts`

| Method | Path | MW | File:line | Purpose |
|---|---|---|---|---|
| POST | `/api/documents/extract` | — | index.ts:638 | Claude quote extraction from `objectPath` / `base64Data` / `textContent` |
| POST | `/api/documents/extract-full` | — | index.ts:696 | Native + derived extraction (PDF only) |

Both are **unauthenticated** and accept an arbitrary `objectPath`, i.e. anyone can make the server download any stored object and spend LLM tokens on it.

### 1c. `server/routes.ts` (auth, profile, link-preview, vision, context/audit)

| Method | Path | MW | File:line | Purpose |
|---|---|---|---|---|
| GET | `/api/auth/me` | — (inline session/Bearer check) | 87 | Current user `{user}` |
| POST | `/api/auth/login` | — (+ `loginLimiter`, index.ts:92) | 125 | `{user, token}` |
| POST | `/api/auth/signup` | — | 169 | `{user, token}`. NOTE `registerLimiter` is mounted on `/api/auth/register` (index.ts:93), a path that does not exist → signup has only the generic 300/min limiter |
| POST | `/api/auth/logout` | — | 209 | Destroys session / token |
| POST | `/api/auth/reset-password` | — | 234 | Issues reset token + email |
| POST | `/api/auth/reset-password/confirm` | — | 264 | Consumes token, sets password |
| POST | `/api/auth/google` | — | 297 | Google ID-token login |
| GET | `/api/profile` | A | 337 | `{user, projects[{id,name,description,lifecycleState,createdAt}]}` |
| PATCH | `/api/profile/name` | A | 352 | Rename user |
| POST | `/api/profile/change-password` | A | 372 | Change password |
| POST | `/api/link-preview` | A | 401 | OG/oEmbed preview for allow-listed design sites; in-memory cache |
| GET | `/api/projects/:projectId/vision` | A,P | 671 | `{boards, inspirations}` |
| POST | `/api/projects/:projectId/vision/boards` | A,P,W | 686 | Create board |
| PATCH | `.../vision/boards/:boardId` | A,P,W | 702 | Update board (title/archived/desireStatement) |
| DELETE | `.../vision/boards/:boardId` | A,P,W | 717 | Delete board |
| POST | `.../vision/boards/:boardId/inspirations` | A,P,W | 734 | Add inspiration |
| PATCH | `.../vision/inspirations/:inspId` | A,P,W | 754 | Update inspiration (caption/boardId/preview) |
| DELETE | `.../vision/inspirations/:inspId` | A,P,W | 769 | Delete inspiration |
| POST | `.../vision/boards/:boardId/tags` | A,P,W | 784 | Add board tag |
| DELETE | `.../vision/boards/:boardId/tags/:tag` | A,P,W | 808 | Remove board tag |
| POST | `.../vision/inspirations/:inspId/tags` | A,P,W | 826 | Add inspiration tag |
| DELETE | `.../vision/inspirations/:inspId/tags/:tag` | A,P,W | 850 | Remove inspiration tag |
| POST | `.../vision/boards/:boardId/generate-themes` | A,P,W | 868 | Claude-generated themes `{themes}` |
| POST | `.../vision/boards/:boardId/duplicate` | A,P,W | 927 | Duplicate board + inspirations |
| GET | `/api/projects/:id/context` | — (inline `req.session.user` only; no Bearer support) | 989 | AI context summary |
| GET | `/api/projects/:id/audit` | — (inline `req.session.user` only) | 1028 | AI call logs + proposals |

### 1d. `server/routes/projects.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `/api/projects` | A | 66 | `{projects}` |
| GET | `/api/projects/summaries` | A | 78 | `{summaries: Record<id, ProjectSummary>}` (registered before `/:projectId`, see comment at 77) |
| GET | `/api/projects/:projectId` | A,P | 217 | Project row |
| POST | `/api/projects` | A | 232 | Create; fire-and-forget hero SVG (242–247) |
| PATCH | `/api/projects/:projectId` | A,P,W | 256 | **Passes `req.body` straight to `storage.updateProject` → `db.update(...).set({...updates})`** (`server/storage/projects.ts:74-79`). No Zod; any column (`userId`, `lifecycleState`, `heroImagePath`…) is client-settable. |
| DELETE | `/api/projects/:projectId` | A,P,W | 272 | Hard delete with storage cleanup |
| POST | `.../hero-image/generate` | A,P,W | 292 | `{heroImagePath}` |
| POST | `.../hero-image/upload` | A,P,W | 321 | Confirms uploaded `objectPath` (must start `/objects/projects/:id/`) |
| GET | `.../lifecycle` | A,P | 355 | Lifecycle state |
| POST | `.../close` | A,P | 382 | ACTIVE→CLOSED (sets `lifecycleState`) |
| POST | `.../soft-delete` | A,P | 415 | →DELETED |

### 1e. `server/routes/scope.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../scope` | A,P | 32 | Legacy `{scopes}` |
| POST | `.../scopes` | A,P,W | 44 | Create legacy scope |
| PATCH | `.../scopes/:scopeId` | A,P,W | 61 | Update |
| DELETE | `.../scopes/:scopeId` | A,P,W | 78 | Delete |
| GET | `.../scope-nodes` | A,P | 100 | `{nodes}` |
| POST | `.../scope-nodes/batch` | A,P,W | 112 | `{nodes, count}` |
| POST | `.../scope-nodes` | A,P,W | 174 | Create node |
| PATCH | `.../scope-nodes/:nodeId` | A,P,W | 209 | Update node (incl. `costType`) |
| POST | `.../scope-nodes/:nodeId/move` | A,P,W | 240 | Reparent |
| POST | `.../scope-nodes/:nodeId/reorder` | A,P,W | 259 | Reorder |
| POST | `.../scope-nodes/batch-reorder` | A,P,W | 282 | `{success}` |
| POST | `.../scope-nodes/:nodeId/archive` | A,P,W | 307 | Archive |
| DELETE | `.../scope-nodes/:nodeId` | A,P,W | 325 | Delete |
| GET | `.../scope-nodes/:nodeId/impact` | A,P | 344 | Impact summary |
| POST | `.../scope-nodes/migrate` | A,P,W | 371 | Legacy → tree migration |

### 1f. `server/routes/budget.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../budget` | A,P | 29 | `{budget, allocations}` |
| POST | `.../budget` | A,P,W | 45 | Upsert budget |
| POST | `.../budget/allocations` | A,P,W | 68 | Create allocation |
| PATCH | `.../budget/allocations/:allocId` | A,P,W | 93 | Update |
| DELETE | `.../budget/allocations/:allocId` | A,P,W | 116 | Delete |

### 1g. `server/routes/quotes.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../scopes/:scopeId/quotes-summary` | A,P | 53 | `{quotes}` per scope |
| GET | `.../quotes` | A,P | 90 | `{vendors, quotes, versions, lineItems, financials}` |
| POST | `.../vendors` | A,P,W | 173 | Create vendor |
| PATCH | `.../vendors/:vendorId` | A,P,W | 190 | Update |
| DELETE | `.../vendors/:vendorId` | A,P,W | 207 | Delete |
| POST | `.../quotes` | A,P,W | 224 | Create quote |
| POST | `.../quotes/from-upload` | A,P,W | 250 | Quote from upload token (AI extraction) |
| POST | `.../quotes/from-existing-document` | A,P,W | 450 | Quote from existing document |
| PATCH | `.../quotes/:quoteId` | A,P,W | 555 | Update quote |
| DELETE | `.../quotes/:quoteId` | A,P,W | 623 | Delete |
| POST | `.../quotes/:quoteId/versions` | A,P,W | 642 | New version |
| PATCH | `.../quote-versions/:versionId` | A,P,W | 659 | Update version |
| POST | `.../quote-versions/:versionId/commit` | A,P,W | 681 | Commit version |
| PATCH | `.../versions/:versionId/status` | A,P,W | 734 | `{success, version}` |
| GET | `.../quote-versions/:versionId/extraction` | A,P | 820 | Extraction payload |
| PUT | `.../quote-versions/:versionId/extracted-data` | A,P,W | 1060 | Save edited extraction |
| GET | `.../source-documents` | A,P | 1213 | **bare array** (`res.json(docs)`) |
| POST | `.../source-documents` | A,P,W | 1225 | Create |
| DELETE | `.../source-documents/:docId` | A,P,W | 1242 | Delete |
| GET/POST | `.../quote-versions/:versionId/vendor-snapshot` | A,P / A,P,W | 1263 / 1275 | Vendor snapshot |
| GET/POST | `.../quote-versions/:versionId/metadata` | A,P / A,P,W | 1296 / 1308 | Quote metadata |
| PATCH | `.../quote-metadata/:metaId` | A,P,W | 1325 | Update metadata |
| GET/POST | `.../quote-versions/:versionId/line-items` | A,P / A,P,W | 1346 / 1362 | Line items |
| PATCH/DELETE | `.../quote-line-items/:itemId` | A,P,W | 1379 / 1400 | Line item |
| GET/POST | `.../quote-versions/:versionId/totals` | A,P / A,P,W | 1421 / 1441 | Totals |
| PATCH | `.../quote-totals/:totalId` | A,P,W | 1458 | Update totals |
| GET | `.../quotes/:quoteId/assessment` | A,P | 1476 | AI assessment |
| POST | `.../quotes/compare-insight` | A,P | 1617 | `{insights}` |

### 1h. `server/routes/invoices.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../invoices` | A,P | 27 | `{invoices, lines, payments}` |
| POST | `.../invoices` | A,P,W | 57 | Create |
| PATCH | `.../invoices/:invoiceId` | A,P,W | 83 | Update |
| DELETE | `.../invoices/:invoiceId` | A,P,W | 100 | Delete (cascade) |
| POST | `.../invoices/:invoiceId/lines` | A,P,W | 117 | Add line |
| PATCH | `.../invoice-lines/:lineId` | A,P,W | 135 | Update line |
| DELETE | `.../invoice-lines/:lineId` | A,P,W | 156 | Delete line |
| GET | `.../invoices/:invoiceId/payments` | A,P | 177 | `{payments}` |
| POST | `.../invoices/:invoiceId/payments` | A,P,W | 192 | Record payment |
| DELETE | `.../invoices/:invoiceId/payments/:paymentId` | A,P,W | 259 | Delete payment |
| POST | `.../invoices/manual` | A,P,W | 295 | Manual invoice + lines |
| GET | `.../invoices-enhanced` | A,P | 370 | Enriched list |

### 1i. `server/routes/financing.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../financing` | A,P | 21 | `{financing, sources}` |
| POST | `.../financing` | A,P,W | 34 | Upsert |
| POST | `.../financing/sources` | A,P,W | 57 | Create source |
| PATCH | `.../financing/sources/:sourceId` | A,P,W | 80 | Update |
| DELETE | `.../financing/sources/:sourceId` | A,P,W | 97 | Delete |
| GET | `.../resolved-cost-demand` | A,P | 118 | Cost-demand computation |

### 1j. `server/routes/execution.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../execution` | A,P | 32 | `{tasks}` (no `log` key) |
| GET | `.../execution/tasks/aggregates` | A,P | 50 | Aggregates |
| POST | `.../execution/tasks` | A,P,W | 62 | Create task |
| PATCH | `.../execution/tasks/:taskId` | A,P,W | 79 | Update |
| DELETE | `.../execution/tasks/:taskId` | A,P,W | 96 | Delete |

### 1k. `server/routes/overview.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../overview` (`?refresh=true`) | A,P | 222 | AI overview contract, in-memory cached |

### 1l. `server/routes/documents.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../documents` | A,P | 27 | `{documents, associations}` |
| GET | `.../documents/:docId` | A,P | 61 | Single document |
| POST | `.../documents` | A,P,W | 76 | Create (Zod `insertDocumentSchema`); fire-and-forget text extraction (94–101) |
| PATCH | `.../documents/:docId` | A,P,W | 111 | Update |
| DELETE | `.../documents/:docId` | A,P,W | 128 | `unlinkAndDeleteDocument(..., true)` cascade |
| POST | `.../documents/check-duplicate` | A,P,W | 146 | `{isDuplicate, existingDocument?}` |
| POST | `.../documents/:docId/tags` | A,P,W | 177 | Add tag |
| DELETE | `.../documents/:docId/tags/:tag` | A,P,W | 207 | Remove tag |
| POST | `.../documents/:docId/associations` | A,P,W | 228 | Add association |
| DELETE | `.../document-associations/:assocId` | A,P,W | 244 | Remove association **by association id** |
| GET | `.../documents/:docId/all-links` | A,P | 263 | `{quoteLinks, invoiceLinks, hasLinks}` — **always 500, see §4** |
| POST | `.../documents/:docId/unlink` | A,P,W | 311 | 2-step deletion step 2 |
| POST | `.../documents/rag-backfill` | A,P | 328 | RAG backfill |

### 1m. `server/routes/importSessions.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| GET | `.../scopes/:scopeId/import-session` | A,P | 51 | `{session\|null}` |
| POST | `.../scopes/:scopeId/import-session` | A,P,W | 63 | Create (409 + `{session}` if one exists) |
| PATCH | `.../import-sessions/:sessionId` | A,P,W | 98 | Update state |
| DELETE | `.../import-sessions/:sessionId` | A,P,W | 132 | Delete |
| POST | `.../scopes/:scopeId/allocate-quote` | A,P,W | 150 | Finish import: create quote from session |

### 1n. `server/routes/ai.ts`

| Method | Path | MW | Line | Purpose |
|---|---|---|---|---|
| POST | `.../ai/confirm-quote` | A,P,W | 29 | Create quote from classified document |
| POST | `.../ai/confirm-quote-version` | A,P,W | 334 | New version on existing quote |
| POST | `.../ai/confirm-invoice` | A,P,W | 601 | Create invoice from document |
| POST | `.../ai/cancel-ingestion` | A,P | 899 | Delete unconfirmed doc |
| POST | `/api/ai/message` | A | 947 | Companion chat (`renixAiService.processUserMessage`, 1233) |
| GET | `.../ai/conversation` | A,P | 1566 | `{conversationId, messages}` |
| POST | `/api/ai/message/stream` | A | 1603 | Streaming variant |
| GET | `/api/proposals` | A | 1677 | `{proposals}` |
| POST | `/api/proposals` | A | 1690 | Create proposal |
| POST | `/api/proposals/:id/accept` | A | 1724 | Accept (many branches) |
| POST | `/api/proposals/:id/reject` | A | 2577 | `{success, proposal}` |

### 1o. Routes with NO auth middleware that touch user data

| Route | File:line | Exposure |
|---|---|---|
| GET `/objects/:objectPath(*)` | object_storage/routes.ts:200 | Any uploaded document/hero image retrievable by path; ACL helper exists but unused |
| POST `/api/documents/extract`, `/extract-full` | document/index.ts:638, 696 | Unauthenticated; downloads any `objectPath` from storage and runs Claude on it |
| PUT `/api/uploads/local/*` | object_storage/routes.ts:158 | Local mode only; unauthenticated write into the private bucket dir |
| GET `/api/projects/:id/context`, `/audit` | routes.ts:989, 1028 | Authenticated via `req.session.user` only (ignores Bearer tokens that `requireAuth` accepts); returns 401 for token clients. Not called by the client. |

---

## 2. Client call inventory

### 2a. How URLs are produced

- `client/src/lib/queryClient.ts:36` — default `queryFn` builds the URL as `"/" + queryKey.join("/")`. So `['api','projects',id,'scope']` → `/api/projects/:id/scope`; `['api/projects/summaries']` → `/api/projects/summaries`; `['api','profile']` → `/api/profile`.
- `apiRequest(method, url, data)` — `queryClient.ts:11`; `fetchJson/postJson/patchJson/deleteRequest` and typed `*Api` objects — `client/src/lib/api.ts:57-81, 131-776`.
- `getAuthHeaders()` from `client/src/auth/AuthContext.tsx` adds a Bearer token when present; cookies via `credentials: 'include'`.

### 2b. Read calls (GET)

| URL (normalized) | Source (file:line) | Via |
|---|---|---|
| `/api/auth/me` | auth/AuthContext.tsx:96 | fetch |
| `/api/profile` | pages/ProfilePage.tsx:64 | default queryFn `['api','profile']` |
| `/api/projects` | context/ProjectContext.tsx:115, persistence/useProjectsData.ts:105 | `projectsApi.list` |
| **`//api/projects`** (bug) | WorkspaceShell.tsx:116 | default queryFn with key `['/api/projects']` → `"/" + "/api/projects"` = scheme-relative URL to host `api`. Request fails; `isError` short-circuits the last-project redirect (140). Session restore never works. |
| `/api/projects/summaries` | pages/ProjectsPage.tsx:154 | default queryFn `['api/projects/summaries']` |
| `/api/projects/:p` | shell/AIConversationPane.tsx:283 | fetch |
| `/api/projects/:p/scope` | frames/scope/useScopeData.ts:79, useScopeTreeData.ts:160, frames/quotes/index.tsx:140, QuoteDetailPanel.tsx:582 | `scopeApi.get` / default / fetch |
| `/api/projects/:p/scope-nodes` | useScopeTreeData.ts:155, invoices/useInvoicesData.ts:214, documents/index.tsx:97, execution/useExecutionData.ts:119, AIConversationPane.tsx:238, QuoteDetailPanel.tsx:597 | `scopeNodesApi.get` / default / fetch |
| `/api/projects/:p/scope-nodes/:n/impact` | frames/scope/ScopeTreeView.tsx:474 | `scopeNodesApi.getImpact` |
| `/api/projects/:p/budget` | budget/useBudgetData.ts:87, quotes/QuotesOverview.tsx:139, quotes/BudgetTensionStrip.tsx:134, AIConversationPane.tsx:249 | `budgetApi.get` / fetch |
| `/api/projects/:p/quotes` | quotes/useQuotesData.ts:197, AIConversationPane.tsx:260, :626 | `quotesApi.get` / fetch |
| `/api/projects/:p/quotes/:q/assessment` | quotes/QuoteAIAssessment.tsx:17 | default queryFn |
| `/api/projects/:p/quote-versions/:v/extraction` | quotes/index.tsx:248, :286; QuoteDetailPanel.tsx:206, :447, :498 | fetch |
| `/api/projects/:p/source-documents` | quotes/ScopeQuotesView.tsx:523 (`quotesApi.getSourceDocuments`), QuoteDetailPanel.tsx:224 (default), :476 (fetch) | mixed |
| `/api/projects/:p/scopes/:s/import-session` | quotes/useImportSessionChecker.ts:37 | fetch |
| `/api/projects/:p/invoices` | invoices/useInvoicesData.ts:208, AIConversationPane.tsx:271 | `invoicesApi.get` / fetch |
| `/api/projects/:p/financing` | financing/useFinancingData.ts:148 | default queryFn |
| `/api/projects/:p/resolved-cost-demand` | useFinancingData.ts:154 | `fetchJson` |
| `/api/projects/:p/execution` | execution/useExecutionData.ts:110 | default queryFn |
| `/api/projects/:p/execution/tasks/aggregates` | useExecutionData.ts:116 | `executionApi.getAggregates` |
| `/api/projects/:p/vision` | vision/useVisionData.ts:98 | default queryFn |
| `/api/projects/:p/documents` | documents/useDocumentsData.ts:196, quotes/QuoteUploadDialog.tsx:87 | default queryFn |
| `/api/projects/:p/documents/:d` | quotes/QuoteImportPipeline.tsx:226 | fetch |
| `/api/projects/:p/documents/:d/all-links` | documents/DocumentDialogs.tsx:1190 | fetch |
| `/api/projects/:p/overview`, `?refresh=true` | overview/useOverviewAI.ts:16, :28 | default / `apiRequest('GET')` |
| `/api/projects/:p/ai/conversation` | AIConversationPane.tsx:902 | fetch |
| `/api/proposals` (poll 3 s) | AIConversationPane.tsx:400–412 | fetch |
| **`/api/projects/:p/documents/:d/extraction`** | AIConversationPane.tsx:1035; QuoteImportPipeline.tsx:154 (poll 2 s, enabled :161–162), :217 | fetch — **no server route** |
| **`/api/projects/:p/quote-versions/:v/scope-references`** | QuoteDetailPanel.tsx:615 (enabled in edit mode, :619) | fetch — **no server route** |

### 2c. Write calls

| Method | URL (normalized) | Source (file:line) |
|---|---|---|
| POST | `/api/auth/login` / `signup` / `google` / `logout` / `reset-password` | AuthContext.tsx:141 / 186 / 226 / 259 / 345 |
| POST | `/api/auth/reset-password/confirm` | pages/SetNewPasswordPage.tsx:59 |
| PATCH | `/api/profile/name` | AuthContext.tsx:295 |
| POST | `/api/profile/change-password` | AuthContext.tsx:320 |
| POST | `/api/link-preview` | frames/vision/utils.ts:66 |
| POST | `/api/uploads/request-url` | hooks/use-upload.ts:72, :176; pages/ProjectsPage.tsx:161, :579, :1212 |
| PUT | `<uploadURL>` (local mode → `/api/uploads/local/...`) | use-upload.ts:103; ProjectsPage.tsx:176 |
| POST / PATCH / DELETE | `/api/projects` / `/api/projects/:p` | useProjectsData.ts:117 / :125 / :134 (`projectsApi.*`) |
| POST | `/api/projects/:p/hero-image/upload` / `generate` | ProjectsPage.tsx:181, 601, 1232 / 621, 1252 |
| POST / PATCH / DELETE | `/api/projects/:p/scopes[/:s]` | useScopeData.ts:106 / :127 / :145 |
| POST / PATCH / POST move / POST reorder / POST batch-reorder / DELETE / POST migrate / POST batch | `/api/projects/:p/scope-nodes...` | useScopeTreeData.ts:224 / :230 / :236 / :242 / :248 / :253 / :194; scope/index.tsx:58; budget/components/BudgetScopeTree.tsx:280 (PATCH costType) |
| POST / POST / PATCH / DELETE | `/api/projects/:p/budget`, `/budget/allocations[/:a]` | useBudgetData.ts:110 / :139 / :157 / :175 |
| POST / PATCH / DELETE | `/api/projects/:p/vendors[/:v]` | useQuotesData.ts:271 / :294 / :316 |
| POST / PATCH / DELETE | `/api/projects/:p/quotes[/:q]` | useQuotesData.ts:336 / :359, quotes/index.tsx:480 / :380 |
| POST | `/api/projects/:p/quotes/:q/versions` | useQuotesData.ts:410 |
| PATCH | `/api/projects/:p/versions/:v/status` | ScopeDetailsPanel.tsx:412, :424; useQuotesData.ts:445, :481; QuoteDetailPanel.tsx:174, :185, :334 |
| PUT | `/api/projects/:p/quote-versions/:v/extracted-data` | quotes/index.tsx:350; QuoteDetailPanel.tsx:287 |
| POST | `/api/projects/:p/quotes/from-upload` / `from-existing-document` | QuoteUploadDialog.tsx:114 / :186 |
| POST | `/api/projects/:p/quotes/compare-insight` | QuoteCompareDrawer.tsx:59 |
| POST | `/api/documents/extract-full` | QuoteDetailPanel.tsx:538 |
| POST | `/api/projects/:p/scopes/:s/import-session` | quotes/index.tsx:205 |
| PATCH | `/api/projects/:p/import-sessions/:id` | QuoteImportPipeline.tsx:132 |
| POST | `/api/projects/:p/scopes/:s/allocate-quote` | QuoteImportPipeline.tsx:286 |
| POST / DELETE | `/api/projects/:p/documents[/:d]` | QuoteImportPipeline.tsx:102 / :321; useDocumentsData.ts:241 / :386 |
| **POST** | **`/api/projects/:p/documents/:d/extract`** | QuoteImportPipeline.tsx:143 (fired at :200, :253, :347); AIConversationPane.tsx:1027 — **no server route** |
| **POST / DELETE / PATCH** | **`/native-rows/:r/scope-references`, `/scope-references/:ref`** | QuoteDetailPanel.tsx:636 / :660 / :677 (fired at :712/:717/:722) — **no server route** |
| PATCH | `/api/projects/:p/documents/:d` | useDocumentsData.ts:268, :290 |
| POST / DELETE | `/api/projects/:p/documents/:d/tags[/:tag]` | useDocumentsData.ts:306 / :322 |
| **POST** | **`/api/projects/:p/documents/:d/annotations`** | useDocumentsData.ts:337 (UI: documents/index.tsx:281) — **no server route** |
| POST | `/api/projects/:p/documents/:d/associations` | useDocumentsData.ts:353 |
| **DELETE** | **`/api/projects/:p/documents/:d/associations/:type/:entityId`** | useDocumentsData.ts:369 — **server path is `/document-associations/:assocId`**; no UI caller found for `removeAssociation` |
| POST | `/api/projects/:p/documents/check-duplicate` | documents/index.tsx:177 |
| POST | `/api/projects/:p/documents/:d/unlink` | DocumentDialogs.tsx:1219 |
| POST / PATCH / DELETE | `/api/projects/:p/invoices[/:i]` | useInvoicesData.ts:306 / :356, :421, :447 / :401 |
| POST / PATCH / DELETE | `/invoices/:i/lines`, `/invoice-lines/:l` | useInvoicesData.ts:545 / :593 / :630 |
| POST / DELETE | `/invoices/:i/payments[/:pay]` | useInvoicesData.ts:479 / :519 |
| POST | `/api/projects/:p/invoices/manual` | invoices/ManualInvoiceDialog.tsx:86 |
| POST / POST / PATCH / DELETE | `/financing`, `/financing/sources[/:s]` | useFinancingData.ts:240 / :180 / :200 / :223 |
| POST / PATCH / DELETE | `/execution/tasks[/:t]` | useExecutionData.ts:160 / :177 / :197 |
| POST / PATCH / DELETE / POST dup / POST themes | `/vision/boards[/:b]`… | useVisionData.ts:169 / :189, :224, :263, :279 / :241 / :205 / :153 |
| POST / PATCH / DELETE | `/vision/boards/:b/inspirations`, `/vision/inspirations/:i` | useVisionData.ts:297 / :330, :380, :396 / :315 |
| POST / DELETE | board tags, inspiration tags | useVisionData.ts:415 / :430; :349 / :365 |
| POST | `/api/ai/message` | AIConversationPane.tsx:1145; quotes/QuoteAIPanel.tsx:84 |
| POST | `/api/proposals`, `/:id/accept`, `/:id/reject` | AIConversationPane.tsx:1301, :426, :485 |
| POST | `/ai/confirm-quote`, `/ai/confirm-quote-version`, `/ai/confirm-invoice`, `/ai/cancel-ingestion` | AIConversationPane.tsx:516, :650, :730, :833 |

Unused `lib/api.ts` helpers (defined, never referenced outside `api.ts`): `projectsApi.get`, `quotesApi.updateVersion`, `quotesApi.createSourceDocument`, `quotesApi.deleteSourceDocument`, all `quotesApi.*VendorSnapshot / *QuoteMetadata / *LineItem(s) / *Totals`, `documentsApi.*` (entire object), `visionApi.*` (entire object), `financingApi.get`, `executionApi.get`, `invoicesApi` none missing.

---

## 3. Cross-reference

### 3a. Client calls with NO matching server route (broken features)

| # | Client call | Server reality | User-visible effect |
|---|---|---|---|
| 1 | POST `/api/projects/:p/documents/:d/extract` — QuoteImportPipeline.tsx:143; AIConversationPane.tsx:1027 | No such route anywhere in `server/` (only `POST /api/documents/extract` and `GET .../quote-versions/:v/extraction` exist). SPA catch-all answers `200 text/html`. | **Quote import pipeline (Quotes frame → "add quote to scope") cannot progress past upload.** `apiRequest` resolves (200), `res.json()` throws → `startExtractionMutation` errors. |
| 2 | GET `/api/projects/:p/documents/:d/extraction` — QuoteImportPipeline.tsx:154 (poll every 2 s while `state==='extracting'`), :217; AIConversationPane.tsx:1035 (30 attempts) | No route. | Poll never sees `status:'completed'`; pipeline ends in "Extraction is taking longer than expected" (:205). In the AI pane the poll only starts if `/api/ai/message` returns `attachment.documentId` without `extractedData` (AIConversationPane.tsx:1262–1278, 989) — whether the server ever does that is **unverified**. |
| 3 | GET `.../quote-versions/:v/scope-references` — QuoteDetailPanel.tsx:615 | No route. | In quote edit mode (`editMode`, :619) the scope-row allocation panel receives HTML → JSON parse error → empty. |
| 4 | POST `.../native-rows/:r/scope-references` — QuoteDetailPanel.tsx:636 (:712) | No route. | Allocating a native row to a scope silently fails. |
| 5 | DELETE / PATCH `.../scope-references/:ref` — QuoteDetailPanel.tsx:660, :677 (:717, :722) | No route. | Removing / re-weighting an allocation silently fails. |
| 6 | POST `.../documents/:d/annotations` — useDocumentsData.ts:337 (UI: documents/index.tsx:281) | No route. | `handleAddAnnotation` shows the toast "Annotation added" synchronously (index.tsx:282) while the request returns HTML. Nothing is stored. |
| 7 | DELETE `.../documents/:d/associations/:type/:entityId` — useDocumentsData.ts:369 | Server route is DELETE `.../document-associations/:assocId` (documents.ts:244). | Path mismatch. Latent: `removeAssociation` (hook line 188) has no UI caller today. |
| 8 | GET `//api/projects` — WorkspaceShell.tsx:116 (`queryKey: ['/api/projects']`, no `queryFn`) | Default queryFn produces `"//api/projects"` → browser resolves to `http://api/projects`. | Network error; `isError` → `SessionRestoreRedirect` never redirects to the last project (140). Wrong key form; every other key uses `['api', ...]`. |
| 9 | `invalidateQueries({queryKey: ['/api/projects/summaries']})` — useProjectsData.ts:120, :129, :137 | Live cache key is `['api/projects/summaries']` (ProjectsPage.tsx:154). | Invalidation is a no-op; summaries stale after create/update/delete until ProjectsPage's own invalidations run. |
| 10 | Client "close project" = PATCH `/api/projects/:p` `{status:'closed'}` — ProjectsPage.tsx:252 → useProjectsData `updateProjectMetadata` (36–40); archive/restore use `status:'archived'/'open'` (43–48) | Server lifecycle lives in `lifecycleState`, changed only by POST `/close` / `/soft-delete` (projects.ts:382, 415) — **never called by the client**. `requireWriteAccess` checks `lifecycleState` (middleware.ts:224), which PATCH never touches. | Server-side read-only enforcement for closed projects never engages; `status` and `lifecycleState` diverge. Client read-only UI works off `status` only. |

### 3b. Server routes never called by the client (dead or API-only)

| Route | File:line | Notes |
|---|---|---|
| GET `.../lifecycle`, POST `.../close`, POST `.../soft-delete` | projects.ts:355, 382, 415 | See 3a #10 |
| GET `.../scopes/:s/quotes-summary` | quotes.ts:53 | |
| PATCH `.../quote-versions/:v` | quotes.ts:659 | `quotesApi.updateVersion` unused |
| POST `.../quote-versions/:v/commit` | quotes.ts:681 | Client commits via PATCH `/versions/:v/status` instead |
| POST / DELETE `.../source-documents[/:d]` | quotes.ts:1225, 1242 | |
| vendor-snapshot, metadata, quote-metadata, line-items, quote-line-items, totals, quote-totals (14 routes) | quotes.ts:1263–1468 | Entire canonical-quote CRUD surface; only reachable through unused `lib/api.ts` helpers |
| GET `.../invoices/:i/payments` | invoices.ts:177 | Client reads payments from `GET /invoices` map |
| GET `.../invoices-enhanced` | invoices.ts:370 | |
| POST `.../scope-nodes/:n/archive` | scope.ts:307 | |
| DELETE `.../document-associations/:assocId` | documents.ts:244 | Client uses a different path (3a #7) |
| POST `.../documents/rag-backfill` | documents.ts:328 | |
| DELETE `.../import-sessions/:id` | importSessions.ts:132 | |
| POST `/api/ai/message/stream` | ai.ts:1603 | |
| GET `/api/projects/:id/context`, `/audit` | routes.ts:989, 1028 | |
| POST `/api/documents/extract` | document/index.ts:638 | Only `extract-full` is called |

### 3c. Response-shape mismatches (cheaply verifiable)

| Endpoint | Server returns | Client expects | Effect |
|---|---|---|---|
| GET `.../source-documents` (quotes.ts:1218) | bare `SourceDocument[]` | `quotesApi.getSourceDocuments` typed `{sourceDocuments: SourceDocument[]}` (api.ts:387) → ScopeQuotesView.tsx:523/529 reads `sourceDocsData?.sourceDocuments` | Always `[]` in ScopeQuotesView. QuoteDetailPanel.tsx:224 (`useQuery<any[]>`, same key) reads it as an array and works. Same queryKey, two different queryFns/shapes. |
| GET `.../execution` (execution.ts:43) | `{tasks}` | useExecutionData.ts:128–129 reads `executionResponse.log` (TS2339); `ExecutionLog` import missing (TS2305, type-only) | `log` always `[]`; no crash. |
| GET `.../documents/:d/all-links` (documents.ts:299) | Always **500** `{message}` (see §4) | DocumentDialogs.tsx:1194–1197 `res.json()` then `data.hasLinks` | `hasLinks` undefined → jumps to `confirm-delete`; the "review linked quotes/invoices" step is silently skipped. Deletion still cascades server-side via `unlinkAndDeleteDocument(..., true)` (documents.ts:133). |
| GET `.../quotes` (quotes.ts:166) | `{vendors, quotes, versions, lineItems, financials}` | `QuotesResponse` lacks `lineItems` (api.ts:360) | Harmless extra key. |
| GET `/api/projects` (projects.ts:70) | `{projects}` | WorkspaceShell.tsx:119–128 `select` handles both array and object | Fine (but request URL is wrong, 3a #8). |
| Everything else checked (`/scope`, `/scope-nodes`, `/budget`, `/invoices`, `/financing`, `/vision`, `/documents`, `/summaries`, `/profile`, `/auth/me`, `/ai/conversation`, `/import-session`, `/proposals`) | matches | matches | OK |

---

## 4. Runtime-crash risks from missing storage methods (tsx does not type-check)

`npx tsc --noEmit -p tsconfig.json` → 89 lines / exit 1 (full output saved at `scratchpad/tsc-output.txt`). All `Property 'X' does not exist on type 'PgStorage'` (TS2339, plus one TS2551) errors traced:

| Missing `PgStorage` method | Call site | Route / entry point | Client trigger | Runtime behaviour |
|---|---|---|---|---|
| `createQuoteCoverageNote` | routes/ai.ts:266 | POST `.../ai/confirm-quote` (ai.ts:29) | AIConversationPane.tsx:516 (confirm-quote card after document classification) | Executes when `extraction?.coverageSummary \|\| scopeComment` is truthy (264) — i.e. **whenever the user typed a scope comment, or the AI produced a coverage summary**. `TypeError: storage.createQuoteCoverageNote is not a function` → caught at 319 → **500 "Failed to create quote"**. No `db.transaction` in ai.ts; by line 266 the vendor, quote and line items are already inserted and `confirmDocument` (296) has not run → orphan quote + unconfirmed document (which the 24 h startup cleanup will later delete, §5). |
| `createQuoteCoverageNote` | routes/ai.ts:535 | POST `.../ai/confirm-quote-version` (ai.ts:334) | AIConversationPane.tsx:650 | Fires when `extraction?.coverageSummary` present (533). Caught at 587 → 500 after `newQuote` + line items were written (partial write). |
| `getQuotesLinkedViaSourceDocuments` | routes/documents.ts:270 | GET `.../documents/:d/all-links` (documents.ts:263) | DocumentDialogs.tsx:1190 — opens on every document delete | **Always throws** (inside `Promise.all`) → caught at 300 → 500 on every call. The function exists as `server/storage/documents.ts:166` but was never delegated in `PgStorage` (`server/storage.ts:689–766` delegates the other 17 document functions). Client effect in §3c. |
| `getProjectInterpretations`, `getProjectClaims`, `getProjectDocumentLinks` | documentProcessor.ts:473–475 (`getProjectDocumentInsights`) | POST `/api/ai/message` (ai.ts:947) → `renixAiService.processUserMessage` (`server/ai/companion.ts:122`) → `buildAIContext` (`server/ai/service.ts:67`, call at companion.ts:251) → `assembleAuthoritativeState` (`server/ai/contextAssembly.ts:264`; call at service.ts:167) → dynamic import + call (contextAssembly.ts:657, 667). Also `/api/ai/message/stream` (unused). | Every AI companion message (AIConversationPane.tsx:1145, QuoteAIPanel.tsx:84) | TypeError caught at contextAssembly.ts:717 and logged (`[AIContextAssembly] Error fetching document intelligence`) on **every** message; `documentIntelligence` is always empty. Degraded, not a crash. |
| `updateProcessingStatus`, `createDocumentInterpretation`, `createExtractedClaims`, `createDocumentLink` (TS2551), `getNextPendingDocument`, `getUnprocessedDocuments`, `getAllUnprocessedDocuments`, `getDocumentProcessingStatus`, `queueDocumentForProcessing`, `getLatestDocumentInterpretation`, `getDocumentClaims`, `getDocumentLinks` | documentProcessor.ts:178–458 (`processDocument`, `processNextQueuedDocument`, `queueUnprocessedDocuments`, `processAllPendingDocuments`, `getDocumentInsights`) | **No caller** anywhere in `server/` (only `getProjectDocumentInsights` is imported, by contextAssembly.ts:657) | none | Dead code. No `document_interpretations` / `extracted_claims` / `document_links` / processing-queue tables exist in `shared/schema.ts`. |

Other TS2339s (not `PgStorage`, not crashes): `.reference` read on quote-metadata rows whose column is `quoteNumber` — contextAssembly.ts:507, :648; routes/ai.ts:1539; storage/documents.ts:203 → value is `undefined`, labels fall back to `'Untitled Quote'` / `''` (wrong display text). useExecutionData.ts:129 `.log` covered in §3c.

Remaining tsc errors (not wiring-related, listed for completeness): `client/src/cfi/patterns.ts` ×6 (missing `inspectable`), `OnboardingTour.tsx:156`, `AllocationMap.tsx:62-63`, `ScopeWorkSurface.tsx:64-66`, `useInvoicesData.ts:521` (missing `getTitle`), `useQuotesModeState.ts` ×21 (stale types), `ProjectsPage.tsx:554`, `AIConversationPane.tsx:877`, `server/ai/contextAssembly.ts:921`, `server/ai/observability.ts:315,345`, `server/routes/ai.ts:2537`, `server/routes/importSessions.ts:36` (MapIterator), `server/storage/vision.ts:72`.

---

## 5. Background / startup wiring (`server/index.ts`)

Sequence inside the IIFE (index.ts:173–243):

| Step | File:line | Dependency check |
|---|---|---|
| Dev-only crash guard: overrides `process.exit`, swallows first 2 Vite/esbuild exits | index.ts:18–50 | n/a |
| Session `Pool` (separate from `server/db.ts:5` pool → two pg pools) + `connect-pg-simple` `createTableIfMissing` | index.ts:53, 96–117 | OK |
| Rate limiters: login 10/15 min, "register" 5/h, api 300/min | index.ts:67–94 | **`/api/auth/register` route does not exist** (route is `/api/auth/signup`, routes.ts:169) → limiter and the `skip` at :89 are dead; signup only gets 300/min |
| `express.json` 50 MB with `rawBody` capture | index.ts:125–134 | OK |
| `registerRoutes` | index.ts:174 | see §1 |
| Error handler: responds `{message}` then **rethrows** (`throw err`, index.ts:181) | index.ts:176–183 | Rethrow inside an Express error middleware propagates to Express's default handler after headers are sent; mostly harmless noise. Unverified whether the dev crash-guard ever sees it. |
| Vite middleware / static + `app.use("*")` catch-all | vite.ts:32–57 / static.ts:13–18 | No `/api` guard (§ preamble) |
| Object-storage health check | index.ts:196–207 → `ObjectStorageService.healthCheck` (`objectStorage.ts:81`) | exists; failure only logs |
| `runBackgroundJobRecovery()` | index.ts:211 → `server/backgroundJobRecovery.ts:31` | see below |
| `listen` on `PORT` (default 5000; CLAUDE.md says `.env` sets 4000), `reusePort` only on Linux | index.ts:223–242 | OK |

`runBackgroundJobRecovery` (backgroundJobRecovery.ts:31–46) calls only `runPipelineCleanup` (48–100), three raw-SQL deletes, each in its own try/catch:

| SQL | Columns used | Exist in `shared/schema.ts`? |
|---|---|---|
| `DELETE FROM pending_uploads WHERE consumed OR expires_at < NOW()` (52) | `consumed`, `expires_at` | yes — 79, 80 |
| `DELETE FROM source_documents WHERE document_id IS NULL AND uploaded_at < NOW()-24h AND id NOT IN (SELECT source_document_id FROM quotes …)` (66) | `document_id` 774, `uploaded_at` 770, `quotes.source_document_id` 313 | yes |
| `DELETE FROM documents WHERE confirmed=false AND uploaded_at < NOW()-24h` (85) | `confirmed` 709, `uploaded_at` 707 | yes. FK behaviour from `document_associations.document_id` (733, no `onDelete` shown) is **unverified** — a stale unconfirmed doc with associations could make this DELETE fail (it is caught and logged). |

Observations:
- The `RecoveryResult` fields `staleJobsReset / pendingJobsFound / jobsResumed` are never set (always 0); the "reset stale processing jobs" described in the header comment (24–29) is not implemented — there is no job table.
- `logExtractionTransition` (backgroundJobRecovery.ts:106) is exported but never called. `storage.deleteExpiredPendingUploads` (`storage.ts:267`, impl `storage/quotes.ts:381`) exists but the cleanup uses raw SQL instead.
- **No `setInterval`, cron, or scheduler anywhere in `server/`** (grep: only two `setTimeout` abort timers in the link-preview handler, routes.ts:442, :533). Cleanup runs once per process start only.
- Fire-and-forget async work: hero SVG generation on project create (projects.ts:242–247, `.catch` logged), text extraction + summary on document create (documents.ts:94–101). Both are unawaited promises, no queue, lost on restart.
- Client-side timers doing the "polling": proposals every 3 s (AIConversationPane.tsx:412), import-pipeline extraction every 2 s (QuoteImportPipeline.tsx:162, against a non-existent route).
- Unused server plumbing: `documentExtractionJobs` map (middleware.ts:25, no references), `requireAIProposalAccess` (middleware.ts:260, imported routes.ts:66, never used), `linkPreviewCache` is process-memory only.
