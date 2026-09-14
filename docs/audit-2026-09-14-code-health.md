# RENIX code-health audit

Repo: `/Users/stuttgart/ClaudeWork/Renix/Renix-1` (read-only audit, 2026-09-14).
`npx tsc --noEmit -p tsconfig.json` -> **73 errors** (raw list saved at `scratchpad/tsc-errors.txt`).

Legend for triage: **A** = runtime crash or wrong behaviour when the path executes, **B** = type-only, no runtime effect, **C** = dead code, never reached.

Headline counts: A = 12 errors (6 distinct defects), B = 27, C = 34.

---

## 1. Type error triage

### 1.1 `server/documentProcessor.ts` — 23 errors

Facts established:
- `PgStorage` (`server/storage.ts:296`) exposes none of the 17 methods this file calls; none of them exist as free functions in `server/storage/*.ts` either.
- The tables the file needs (`document_interpretations`, `extracted_claims`, `document_links`, `document_processing_queue`) do **not** exist in `shared/schema.ts` (grep returns nothing).
- The only import of the module anywhere is a dynamic import of `getProjectDocumentInsights` at `server/ai/contextAssembly.ts:657`, executed inside `assembleAuthoritativeState` (called from `server/ai/service.ts:167` for every AI companion request) and wrapped in `try/catch` (`contextAssembly.ts:666-718`).

| Lines | Missing member | Enclosing function | Class | Reasoning |
|---|---|---|---|---|
| 178, 182, 232, 245 | `updateProcessingStatus`, `createDocumentInterpretation`, `createExtractedClaims`, `createDocumentLink` | `processDocument` | **C** | `processDocument` is exported but never imported (only called by `processNextQueuedDocument`, itself unreferenced). |
| 369, 378, 384, 387, 393, 438 | `getNextPendingDocument`, `updateProcessingStatus` x4 | `processNextQueuedDocument`, `processAllPendingDocuments` | **C** | Not imported anywhere in `server/`, `script/`, `scripts/`. |
| 403, 405, 412, 414 | `getUnprocessedDocuments`, `getAllUnprocessedDocuments`, `getDocumentProcessingStatus`, `queueDocumentForProcessing` | `queueUnprocessedDocuments` | **C** | Not imported anywhere. |
| 456, 457, 458 | `getLatestDocumentInterpretation`, `getDocumentClaims`, `getDocumentLinks` | `getDocumentInsights` | **C** | Not imported anywhere. |
| 473, 474, 475 | `getProjectInterpretations`, `getProjectClaims`, `getProjectDocumentLinks` | `getProjectDocumentInsights` | **A** (swallowed) | Executes on **every** AI companion request via `contextAssembly.ts:666`. Throws `TypeError: storage.getProjectInterpretations is not a function`, caught at `contextAssembly.ts:717` and logged as `[AIContextAssembly] Error fetching document intelligence:`. Net effect: `documentIntelligence` is always the empty default, an error line is logged per AI call, and one wasted dynamic import per request. Not a crash, but the "Document Intelligence System / claims extraction" feature described in CLAUDE.md is non-functional. |
| 494, 495 (x2) | implicit `any` on `c`, `a`, `b` | `getProjectDocumentInsights` | **B** | Follow-on from the `any`-typed results above. |

**Fix (one line each):**
- Delete `server/documentProcessor.ts` entirely (its tables are gone from the schema; nothing else imports it).
- In `server/ai/contextAssembly.ts` remove lines 657 and 666-718 (the dynamic import and the `try { ... } catch` block), keeping the `documentIntelligence` default declared at 658-665.
- Alternative if the feature is wanted: recreate the four tables in `shared/schema.ts` and add the 17 methods to `IStorage`/`PgStorage` — much larger job; nothing in the repo indicates this was in progress.

### 1.2 `server/routes/ai.ts` — 4 errors

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 266 | `storage.createQuoteCoverageNote` does not exist | **A** | Route `POST /api/projects/:projectId/ai/confirm-quote` (`ai.ts:29`), called by `client/src/shell/AIConversationPane.tsx:516`. Executes when `extraction?.coverageSummary \|\| scopeComment` is truthy. `coverageSummary` is populated by the classifier for quotes (`server/replit_integrations/document/index.ts:100,390,418`). No such method exists anywhere in `server/` and there is no coverage-note table. Throws `TypeError` -> caught at `ai.ts:319` -> 500 to the client — **after** the quote, version, financials and line items were already inserted (lines ~200-262, no transaction), so the quote is half-committed and the user sees an error. Frequency depends on how often the classifier returns a coverage summary: unverified without a live run. | Delete the `if (coverageSummary) { await storage.createQuoteCoverageNote({...}) }` block at `ai.ts:264-272`, or persist `coverageSummary` into an existing column (e.g. `quotes.notes`). |
| 535 | same | **A** | Route `POST .../ai/confirm-quote-version` (`ai.ts:334`), caller `AIConversationPane.tsx:650`; same partial-write-then-500 behaviour, caught at `ai.ts:587`. | Delete `ai.ts:533-541`. |
| 1539 | `metadata?.reference` — `quoteMetadata` has no `reference` column (`shared/schema.ts:822-836`; seed SQL `scripts/seed-data.sql:6953` confirms the DB has none) | **A** (wrong data, no crash) | Always `undefined` -> `existingQuoteCandidates[].reference === ''`. | Use `metadata?.quoteNumber \|\| ''`. |
| 2537 | `'execution_tasks_created'` not in `CanonicalMemoryType` | **B** | Column `canonical_memory.type` is `text` (`shared/schema.ts:1015`); insert succeeds. | Add `\| 'execution_tasks_created'` to `CanonicalMemoryType` at `shared/schema.ts:1033-1042`. |

### 1.3 `server/routes/documents.ts` — 1 error

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 270 | `storage.getQuotesLinkedViaSourceDocuments` does not exist on `PgStorage` | **A** | The function exists as a free function at `server/storage/documents.ts:166` but was never wired into `PgStorage`. Route `GET /api/projects/:projectId/documents/:docId/all-links` (`documents.ts:263`) is fetched by `DeleteConfirmDialog` at `client/src/frames/documents/DocumentDialogs.tsx:1190` on every document-delete attempt. Throws `TypeError` -> caught at `documents.ts:300` -> `500 {message}`. The client then does `res.json()` successfully, reads `data.hasLinks` (undefined) and jumps straight to `'confirm-delete'` (`DocumentDialogs.tsx:1196`). **Step 1 of the "2-step deletion" is silently bypassed for every document**; linked quotes/invoices are never shown before the cascade delete. | Add to `IStorage` and `PgStorage` in `server/storage.ts`: `async getQuotesLinkedViaSourceDocuments(documentId: string, userId: string) { return documentsStorage.getQuotesLinkedViaSourceDocuments(db, documentId, userId); }`. |

### 1.4 `server/storage/documents.ts` — 1 error

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 203 | `m.reference` on `quoteMetadata` row | **B** today, becomes **A** (empty labels) once 1.3 is fixed | Function is unreachable until wired into `PgStorage`; afterwards `quoteReference` will always be `''`. | Use `m.quoteNumber \|\| ''`. |

### 1.5 `server/ai/contextAssembly.ts` — 3 errors

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 507 | `metadata?.reference` (no such column) | **A** (wrong data) | Every quote in the AI context gets `reference: '' + lineageInfo`; the AI never sees quote references/numbers. | `metadata?.quoteNumber \|\| ''`. |
| 648 | `meta?.reference` | **A** (wrong data) | `documentQuoteMap` labels every quote `'Untitled Quote'`. | `meta?.quoteNumber \|\| 'Untitled Quote'`. |
| 921 | `quotesState` has 4 extra item fields + required `loadingMode` vs `AIContext['quotes']` | **B** | Extra properties only; runtime object is a superset. | Extend the `quotes.items` element type in `server/ai/types.ts` (around line 219) with the extra fields, or cast. |

### 1.6 `server/ai/observability.ts` — 2 errors

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 315 | `entities_retrieved` missing `interpretations`, `claims`, `semantic_matches` | **B** | Structured-log payload only. | Make the three fields optional in the `RetrievalLogEntry` data type, or add `interpretations: 0, claims: 0, semantic_matches: 0`. |
| 345 | `constraint_set_summary` missing `interpretation_count`, `claim_count` | **B** | Same. | Make optional or add `interpretation_count: null, claim_count: null`. |

### 1.7 `server/storage/vision.ts` — 1 error

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 72 | `.set({ ...updates, updatedAt })` — `visionInspirations` has no `updatedAt` (`shared/schema.ts:663-682`, only `createdAt`) | **B** | Drizzle's `buildUpdateSet` iterates **table columns** and ignores unknown keys (`node_modules/drizzle-orm/pg-core/dialect.js:101-105`), so the extra key is dropped silently. | Remove `updatedAt: new Date()` from `vision.ts:72` (or add an `updated_at` column). |

### 1.8 `server/routes/importSessions.ts` — 1 error

| Line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 36 | `MapIterator` needs `--downlevelIteration` / target >= ES2015 | **B** | `tsconfig.json` has no `target`, so tsc type-checks as ES5; tsx/esbuild emit modern JS, so `for..of` over `Map.values()` works. | Add `"target": "ES2022"` to `compilerOptions` in `tsconfig.json`. |

### 1.9 `client/src/frames/quotes/useQuotesModeState.ts` — 21 errors

| Lines | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 10-15 | imports `QuotesMode`, `QuotesModeState`, `QuotesLibraryFilters`, `QuoteWorkspaceState`, `ComparisonSelection`, `initialModeState` — none exported by `./types` (which now exports `QuotesViewState`/`initialViewState`) | **C** | `useQuotesModeState` is imported by **no** file (`grep -rn useQuotesModeState client/src` -> only itself). The four-mode navigation it implemented was replaced by `QuotesViewState`. | Delete `client/src/frames/quotes/useQuotesModeState.ts`. |
| 23-139 (15 x TS7006) | implicit `any` on `prev`/`id` | **C** | Cascade from the missing types above. | Same deletion. |

### 1.10 `client/src/cfi/patterns.ts` — 6 errors

| Lines | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| 36, 63, 88, 111, 135, 168 | `emit()` result lacks `inspectable`, required by `Omit<CFISignal, 'class' \| 'patternId'>` | **C** (and type-only) | `cfi/engine.ts:38-49` fills `inspectable` itself after calling `emit`, so the type is simply wrong. Moreover the whole `client/src/cfi/` module is unreachable: `cfi/index.ts` is imported by nothing (`grep -rn "cfi" client/src` outside `cfi/` -> no hits). | Change `CFIPattern.emit` return type at `client/src/cfi/types.ts:48` to `Omit<CFISignal, 'patternId' \| 'class' \| 'inspectable'>` — or delete `client/src/cfi/` (see section 3). |

### 1.11 Remaining client errors (one-offs)

| File:line | Error | Class | Reasoning | Fix |
|---|---|---|---|---|
| `client/src/components/OnboardingTour.tsx:156` | effect returns `() => () => boolean` | **B** | `tryStartTour` (127-147) returns a cleanup that returns `void`; TS infers the boolean from an earlier branch. React ignores a cleanup's return value anyway. | `useEffect(() => { ...; const cleanup = tryStartTour(); return () => { cleanup(); }; }, ...)`, or annotate `tryStartTour` as `(): (() => void)`. |
| `client/src/frames/budget/components/AllocationMap.tsx:62,63` | compares `target.type` to `'area'` / `'item'`, not in `'scope' \| 'unassigned' \| 'contingency'` | **C** | Legacy target kinds that the type no longer produces; branches never true. | Delete the two `a.target.type === 'area' / 'item'` disjuncts. |
| `client/src/frames/budget/components/ScopeWorkSurface.tsx:64,66` | `case 'area'`, `case 'item'` | **C** | Same legacy branches. | Delete the two cases (default already returns a label). |
| `client/src/frames/execution/useExecutionData.ts:11` | `ExecutionLog` not exported from `@/lib/api` | **B** | Type import only. | Add `export interface ExecutionLog { id: string; taskId: string; ... }` to `client/src/lib/api.ts`. |
| `client/src/frames/execution/useExecutionData.ts:129` | `ExecutionResponse` has no `log` | **B** (feature stub) | Server returns `{ tasks }` only (`server/routes/execution.ts:43`), so `executionResponse?.log ?? []` is always `[]`; the "Activity log" section in `TaskDetailsDrawer.tsx:243` is permanently empty. | Add `log?: ExecutionLog[]` to `ExecutionResponse` (`lib/api.ts:657`) and either serve it or remove the drawer section. |
| `client/src/frames/invoices/useInvoicesData.ts:521` | `deletePaymentMutation` proposalConfig lacks required `getTitle` | **A** (conditional) | `useMutationWithProposal.ts:74` calls `proposalConfig.getTitle(variables)` when `isProposalModeActive` is true -> `TypeError` -> deleting a payment in proposal mode crashes the handler. Direct (non-proposal) path at line 64 is unaffected. | Add `getTitle: () => 'Delete payment',` to the config at `useInvoicesData.ts:521-527`. |
| `client/src/pages/ProjectsPage.tsx:554` | `r.label === project.regionalContext?.region` — label union vs id union | **B** | Defensive fallback for legacy projects that stored the country name instead of the code; harmless. | `(project.regionalContext?.region as string)` or drop the label fallback. |
| `client/src/shell/AIConversationPane.tsx:877` | `objectPath: undefined` where `PendingQuoteContext.objectPath: string` | **B** (latent) | Only for a retry on a document with no prior pending context; downstream consumers of `objectPath` would receive `undefined` (unverified whether any run in that state). | Make `objectPath?: string` at `client/src/shell/ai/types.ts:221`, or pass `objectPath: ''`. |

### 1.12 Triage summary

| Class | Count | Distinct real defects |
|---|---|---|
| A — runtime crash / wrong behaviour | 12 | (1) `documentProcessor` call on every AI request (swallowed, logs an error); (2) `createQuoteCoverageNote` x2 -> half-committed quote + 500; (3) `all-links` route 500 -> 2-step deletion bypassed; (4) `quoteMetadata.reference` x3 -> empty quote references in AI context / candidates; (5) payment-delete in proposal mode crashes (`getTitle`). |
| B — type-only | 27 | Fixable with ~10 one-line edits (incl. `"target": "ES2022"` in tsconfig). |
| C — dead code | 34 | Delete `server/documentProcessor.ts` (20), `client/src/frames/quotes/useQuotesModeState.ts` (21 errors), `client/src/cfi/` (6), 4 legacy `'area'/'item'` branches. |

Deleting the three dead files alone removes 47 of 73 errors.

---

## 2. Client structure

### 2.1 Entry and routing

| Piece | File | Notes |
|---|---|---|
| Bootstrap | `client/src/main.tsx` | `createRoot(#root).render(<App/>)`; global `onerror`/`onunhandledrejection` write an inline error page. |
| Providers | `client/src/App.tsx:171-188` | `QueryClientProvider > ThemeProvider > TooltipProvider > AuthProvider > Router`, plus `Toaster`, `CookieConsent`. |
| Router | `client/src/App.tsx:73-169` | wouter `Switch`, all pages `React.lazy`. |

Routes (`App.tsx`):

| Path | Component | Guard |
|---|---|---|
| `/login` | `pages/LoginPage` | `AuthRoute` (redirects away when logged in) |
| `/signup` | `pages/SignupPage` | `AuthRoute` |
| `/set-new-password` | `pages/SetNewPasswordPage` | none |
| `/reset-password` | `pages/ResetPasswordPage` | `AuthRoute` |
| `/ui-catalog` | `pages/UICatalogPage` | none (dev page, public) |
| `/design-preview` | `pages/DesignPreviewPage` | none (dev page, public) |
| `/privacy`, `/terms` | `PrivacyPolicyPage`, `TermsOfServicePage` | none |
| `/` | `pages/landing/index.tsx` | none |
| `/profile` | `pages/ProfilePage` | `ProtectedRoute` |
| `/projects` | `WorkspaceProviders > SessionRestoreRedirect + ProjectsAreaLayout > ProjectsPage` | `ProtectedRoute` |
| `/project/:id` | `Redirect` -> `/project/:id/overview` | — |
| `/project/:id/:frame` | `WorkspaceProviders > ProjectRoute` (`WorkspaceShell.tsx:151`) -> `FrameRouter` | `ProtectedRoute` |
| fallback | `ProjectsPage` | `ProtectedRoute` |

`client/src/navigation/routes.ts` is a declarative mirror of the same structure (not used to drive wouter). `pages/not-found.tsx` exists but is not routed (fallback goes to `ProjectsPage`).

### 2.2 Workspace shell

- `client/src/WorkspaceShell.tsx`: `WorkspaceProviders` (172), `ProjectsAreaLayout` (89), `SessionRestoreRedirect` (111), `ProjectRoute` (151) which validates the frame and renders `FrameRouter`.
- `client/src/spine/FrameRouter.tsx`: maps `CanonicalFrame` -> lazy frame component (27-47), background-preloads all frames on idle (76-95), prefetches adjacent frames (97-106), wraps each frame in `ErrorBoundary` + `Suspense` (142-148). Falls back to Overview for unknown frames (140).
- Layout components in `client/src/shell/`: `ResponsiveWorkspaceLayout` -> `DesktopWorkspaceLayout` / `MobileWorkspaceLayout`, `GlobalShellBar`, `ProjectContextBar`, `FrameContainer`, `FrameNavigation`(+`Content`), `MobileBottomDock`, `AIConversationPane` (AI pane), `proposals/` (proposal-mode mutation wrapper).
- `client/src/navigation/visibility.ts:25-45`: `isFrameVisible` always `true`, `hasConditionalVisibility` always `false` — a no-op gating layer; `FrameNavigation.tsx:175` and `FrameNavigationContent.tsx:138` additionally hard-code `const isDisabled = false`.

### 2.3 The 10 frames

Projects is a page, not a frame; the other nine live under `client/src/frames/<name>/index.tsx` and are loaded by `FrameRouter`.

| Frame | Main component | Data hooks (queries) | Mutations (file:line of `mutationFn`) | Stubs / notes |
|---|---|---|---|---|
| Projects | `client/src/pages/ProjectsPage.tsx` | `useQuery` (16) + `persistence/useProjectsData.ts` (`queryKeys.projects`) | create 117, update 125, delete 134 (`projectsApi.*`) | Settings dialog is the inline `SettingsDialog` in ProjectsPage (362); `components/ProjectSettings.tsx` is unimported (dead). |
| Overview | `frames/overview/index.tsx` | `useOverviewAI.ts:15` (`['api','projects',id,'overview']`), refresh via `apiRequest GET ...?refresh=true` (28) | none | `TraceDrawer.tsx` is unimported (dead). "Not yet quoted" (index.tsx:266-278) is a legitimate KPI label, not a stub. |
| Vision | `frames/vision/index.tsx` | `useVisionData.ts` (`queryKeys.vision`) | 16 mutations `useVisionData.ts:168-429` (boards create/rename/delete/select, desire statement, inspirations add/remove/caption/tags/move/preview, board tags) | none found |
| Scope | `frames/scope/index.tsx` | `useScopeTreeData.ts` (`queryKeys.scopeNodes`), `useScopeData.ts` (`queryKeys.scope`, used by Budget too) | tree: migrate 194, create 224, update 229, move 235, reorder 241, batchReorder 247, delete 253; flat: create 105, update 126, delete 145 | `ScopeDialogs.tsx` is unimported (dead). |
| Budget | `frames/budget/index.tsx` | `useBudgetData.ts` (`queryKeys.budget`), `useScopeData`, `useScopeTreeData` | budget upsert 109, allocation create 138 / update 156 / delete 174; costType change `components/BudgetScopeTree.tsx:279` | `AllocationRow.tsx`, `styles.ts` unimported (dead). Legacy `'area'/'item'` branches in `AllocationMap.tsx:62-63`, `ScopeWorkSurface.tsx:64-66`. |
| Quotes | `frames/quotes/index.tsx` | `useQuotesData.ts` (`queryKeys.quotes`, `budget`, `documents`), `useScopeTileData.ts`, `useImportSessionChecker.ts`; ad-hoc keys `compare-insight`, `native-rows`, `extraction`, `assessment`, `scope-references`, `extraction-status` | vendors create/update/delete 270/293/316; quotes create/update/delete 335/358/380; version create 406, status 444, accept 480; import session `QuoteImportPipeline.tsx:128,140`; scope-reference allocation `ScopeQuotesView.tsx:603,610`, `QuoteDetailPanel.tsx:635,659,676` | Dead: `useQuotesModeState.ts`, `QuotesLibrary.tsx`, `QuoteCard.tsx`, `QuoteFocusPanel.tsx`, `QuoteAISummary.tsx`, `QuoteDocumentViewer.tsx`. |
| Invoices | `frames/invoices/index.tsx` | `useInvoicesData.ts` (`queryKeys.invoices`), `useScopeTreeData` | create 299, update 348, delete 401, send 420, void 446, record payment 472, delete payment 518 (**missing `getTitle`**), line create 537 / update 587 / delete 629; manual dialog `ManualInvoiceDialog.tsx:77` | — |
| Financing | `frames/financing/index.tsx` | `useFinancingData.ts` (`queryKeys.financing`, `resolved-cost-demand`) | source create 179 / update 199 / delete 222, notes 239 | — |
| Execution | `frames/execution/index.tsx` | `useExecutionData.ts` (`queryKeys.execution`, `scopeNodes`) | task create 159, update 176, delete 196 | Activity log (`TaskDetailsDrawer.tsx:243`) is always empty — server never returns `log`. |
| Documents | `frames/documents/index.tsx` | `useDocumentsData.ts` (`queryKeys.documents`), plus `useQuery` for scope nodes (index.tsx:96), invoices/quotes/financing keys for link labels | upload 228, metadata 267, type 289, tag add/remove 305/321, annotation 336, association add/remove 352/368, delete 385; 2-step delete dialog fetches `all-links` (`DocumentDialogs.tsx:1190`, **broken server-side, see 1.3**) | `DocumentCard.tsx` unimported (dead). |

### 2.4 TODO / stub grep

`grep -rnEi "TODO|FIXME|not yet|coming soon|Not implemented"` over `client/src` finds **no** TODO/FIXME markers. Hits worth noting:

| File:line | Text | Assessment |
|---|---|---|
| `client/src/auth/AuthContext.tsx:341` | `'Password reset is not yet available. Please contact support.'` | Only returned when `AUTH_ENABLED === false`; `AUTH_ENABLED` is hard-coded `true` (`shared/authConfig.ts:21`), so unreachable today. |
| `client/src/shell/FrameNavigation.tsx:175`, `FrameNavigationContent.tsx:138`, `MobileBottomDock.tsx:137` | `const isDisabled = false;` | Disabled-state plumbing with no producer. |
| `client/src/navigation/visibility.ts:25-45` | `isFrameVisible` returns `true`, `hasConditionalVisibility` returns `false` | Frame gating is a no-op. |

---

## 3. Feature flags and dead code

### 3.1 Flags / env-gated behaviour

| Flag | Where | Effect |
|---|---|---|
| `AUTH_ENABLED = true` (const) | `shared/authConfig.ts:21`, consumed at `client/src/auth/AuthContext.tsx:84,130,175,216,257,287,340`, `server/routes.ts:88,128,172,210,298`, `server/routes/shared/middleware.ts:138,183` | When `false`: client auto-authenticates `TEST_USER`, server bypasses auth and project-ownership checks. Compile-time only; no env var. |
| `import.meta.env.VITE_GOOGLE_CLIENT_ID` | `client/src/components/GoogleSignInButton.tsx:3,29,50,71` | Button renders `null` when unset. **Only** `import.meta.env` read in the client; no `process.env` in `client/`. |
| `process.env.NODE_ENV` | `server/index.ts:18,187`, `server/env.ts:12`, `server/legacyGuards.ts:24`, `server/lifecycleGuards.ts:121`, `script/build.ts:56` | Production: static serving, secure cookies; dev: Vite middleware, guard violations logged not thrown (`lifecycleGuards.ts:123`). |
| `process.env.GCS_EMULATOR_URL` | `server/replit_integrations/object_storage/objectStorage.ts:26-27` (`isLocalStorageMode`) | Switches between fake-gcs-server + local PUT uploads and the Replit sidecar path. |
| `AI_MAX_TOKEN_BUDGET`, `AI_STRUCTURED_LOGS`, `AI_TOKEN_SAFETY`, `AI_LOG_LEVEL` | `server/ai/observability.ts:33-36` | AI observability tuning. |
| `CLAUDE_MODEL` | `server/ai/claude.ts:15` | Defaults to `claude-opus-5`. |

No runtime feature-flag system (`FEATURE_*`, `featureFlag`, `useFeature`) exists in the client.

### 3.2 Unreachable client files (module never imported; `components/ui/*` excluded)

Computed by resolving every static/dynamic import under `client/src` (script: `scratchpad/deadfiles.cjs`).

| File | Note |
|---|---|
| `client/src/cfi/index.ts` (+ transitively `engine.ts`, `patterns.ts`, `types.ts`) | Cross-Frame Intelligence pattern library; 6 tsc errors; nothing imports it. |
| `client/src/frames/quotes/useQuotesModeState.ts` | 21 tsc errors. |
| `client/src/frames/quotes/QuotesLibrary.tsx`, `QuoteCard.tsx`, `QuoteFocusPanel.tsx`, `QuoteAISummary.tsx`, `QuoteDocumentViewer.tsx` | Old quotes UI. |
| `client/src/frames/scope/ScopeDialogs.tsx` | |
| `client/src/frames/budget/AllocationRow.tsx`, `styles.ts` | |
| `client/src/frames/documents/DocumentCard.tsx` | |
| `client/src/frames/overview/TraceDrawer.tsx` | |
| `client/src/components/ProjectSettings.tsx`, `components/FrameNavigation.tsx` | Superseded by `ProjectsPage`'s inline `SettingsDialog` and `shell/FrameNavigation.tsx`. |
| `client/src/shell/AICompanionPanel.tsx`, `shell/ai/ProjectHealthStrip.tsx`, `shell/ai/index.ts` | `AIConversationPane` is the live pane. `ProjectHealthStrip` is described in CLAUDE.md as part of the AI pane but is not mounted. |
| `client/src/pages/not-found.tsx` | Not routed. |
| `client/src/persistence/projectStore.ts`, `client/src/domain/relations.ts`, `client/src/domain/contracts/index.ts`, `client/src/layout/index.ts`, `client/src/navigation/index.ts`, `client/src/spine/authority.ts` | Barrels / legacy modules with no importers (individual files inside `domain/contracts`, `layout` may still be imported directly — unverified per file). |

Routed but effectively dev-only pages: `/ui-catalog` (`pages/UICatalogPage.tsx`) and `/design-preview` (`pages/DesignPreviewPage.tsx`) are public routes with no guard.

Server-side dead shim: `server/aiContextAssembly.ts` (re-exports from `server/ai/contextAssembly.ts`) is imported by nothing.

### 3.3 Replit remnants

- `client/replit_integrations/` and `client/src/replit_integrations/` do **not** exist; `grep -rn replit client/src client/index.html` returns nothing.
- Server keeps `server/replit_integrations/object_storage/` and `server/replit_integrations/document/` (intentional per CLAUDE.md). The sidecar credential path in `objectStorage.ts` (~line 38 onward) is still the non-emulator default.
- On-disk leftovers (gitignored per CLAUDE.md): `replit.md`, `Renix-1.zip` present at repo root (`ls` confirms).

---

## 4. Auth flow

### 4.1 Email/password (works with only `DATABASE_URL` + `SESSION_SECRET`)

| Step | Client | Server |
|---|---|---|
| Session probe | `AuthContext.tsx:96` `GET /api/auth/me` | `server/routes.ts:87` |
| Login | `AuthContext.tsx:129-168` `POST /api/auth/login` (`remember` flag) | `routes.ts:125` -> `verifyCredentials` (`server/auth.ts:94`; bcrypt or legacy SHA-256), sets `req.session.user`, issues bearer token stored in DB (`setTokenInDB`) |
| Signup | `AuthContext.tsx:170-213` `POST /api/auth/signup` | `routes.ts:169` -> `createUser` (`auth.ts:54`, `hashPassword` at 45) |
| Logout | `AuthContext.tsx:254` `POST /api/auth/logout` | `routes.ts:209` |
| Profile | `AuthContext.tsx:295,320` `/api/profile/name`, `/api/profile/change-password` | `updateUserName` (`auth.ts:155`), `changePassword` (`auth.ts:179`) |
| Guard | `ProtectedRoute` / `AuthRoute` (`client/src/auth`) | `requireAuth` (`server/routes/shared/middleware.ts:137-166`): session cookie **or** `Authorization: Bearer <token>` looked up in DB; `requireProjectAccess` (168-200) enforces `projects.userId === user.id` |

Session store: PostgreSQL `session` table via `connect-pg-simple` (`server/index.ts:100-106`), secret defaults to `"development-secret-change-in-production"` if `SESSION_SECRET` unset (`index.ts:103`).

### 4.2 Google Sign-In (needs `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`)

1. `GoogleSignInButton.tsx` (mounted at `LoginPage.tsx:91`, `SignupPage.tsx:148`) loads `https://accounts.google.com/gsi/client` and renders the GIS button **only if** `VITE_GOOGLE_CLIENT_ID` is set (`GoogleSignInButton.tsx:50,71`); otherwise the button and the "or" divider are omitted — email/password UI still works.
2. Credential -> `AuthContext.googleLogin` (`AuthContext.tsx:215-252`) -> `POST /api/auth/google` (`routes.ts:297`).
3. `verifyGoogleToken` (`server/auth.ts:217`) verifies the ID token with `OAuth2Client(process.env.GOOGLE_CLIENT_ID)` (`auth.ts:19,221`); links `googleId` to an existing email user (238-240) or creates a Google-only user (null `passwordHash`/`salt`).
4. Without `GOOGLE_CLIENT_ID` on the server: `verifyIdToken` with `audience: undefined` — the client would never send a credential anyway because the button is hidden; behaviour of a forged POST is unverified.
5. `.env.example:33-34` ships a real-looking client id for both variables — verify it is meant to be public before publishing.

### 4.3 Password reset (needs SMTP; degrades silently without)

1. `/reset-password` -> `ResetPasswordPage.tsx:26` -> `AuthContext.requestPasswordReset` (`AuthContext.tsx:339`) -> `POST /api/auth/reset-password` (`routes.ts:234`).
2. Server always answers the generic success message (`routes.ts:241,261`). If the user exists it stores a 1-hour token (`createPasswordResetToken`, `routes.ts:249`) and calls `sendPasswordResetEmail` (`server/email.ts:21`).
3. `email.ts:7-10,24-27`: with `SMTP_USER`/`SMTP_APP_PASSWORD` unset the transport is `null`, an error is logged and **no mail is sent, but the UI still shows "we've sent a link"** — misleading locally. (CLAUDE.md OPP-101 "honest not-yet-available message" refers to the `AUTH_ENABLED=false` branch at `AuthContext.tsx:341`, which is unreachable; the SMTP-missing case is not surfaced.)
4. Reset link is built at `routes.ts:252-254` as `${x-forwarded-proto || 'https'}://${host}/set-new-password?token=...` — on plain-http local dev without a proxy the link will be **`https://localhost:4000/...`** (wrong scheme), and if `host` is missing it falls back to `localhost:5000` (pre-migration port).
5. `/set-new-password?token=` -> `SetNewPasswordPage.tsx:59` -> `POST /api/auth/reset-password/confirm` (`routes.ts:264`): checks token + expiry, `hashPassword`, `updateUser`, `markTokenUsed`. Single-use enforcement relies on `getPasswordResetToken` filtering used tokens (unverified in `server/storage/users.ts`).

---

## 5. Environment and config

All `process.env` / `import.meta.env` reads (grep over `server/`, `shared/`, `client/`, `script/`, `scripts/`, root configs). `shared/` reads none.

| Variable | Read at | In `.env.example`? | Default / behaviour when unset |
|---|---|---|---|
| `PORT` | `server/index.ts:223` | yes (4000) | `5000` |
| `DATABASE_URL` | `server/db.ts:6`, `server/index.ts:54`, `drizzle.config.ts:4,13` | yes | required (pool/driver fails) |
| `SESSION_SECRET` | `server/index.ts:103` | yes | `"development-secret-change-in-production"` |
| `NODE_ENV` | `server/index.ts:18,187`, `server/env.ts:12`, `server/legacyGuards.ts:24`, `server/lifecycleGuards.ts:121`, `script/build.ts:56` | no (set by npm scripts) | non-production |
| `GCS_EMULATOR_URL` | `server/replit_integrations/object_storage/objectStorage.ts:26`, `scripts/seed-storage.cjs:29` | yes | empty -> Replit sidecar code path |
| `PRIVATE_OBJECT_DIR` | `objectStorage.ts:129`, `scripts/seed-storage.cjs:30`, `scripts/upload-files.cjs:42`, `scripts/download-files.cjs:27` | yes | required for uploads |
| `PUBLIC_OBJECT_SEARCH_PATHS` | `objectStorage.ts:109` | yes | — |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` | not read by app code; resolved inside `@anthropic-ai/sdk` (documented at `server/env.ts:7-8`, `server/ai/claude.ts:9-10`) | yes (`ANTHROPIC_API_KEY`) | AI features error on use |
| `CLAUDE_MODEL` | `server/ai/claude.ts:15` | yes (commented) | `claude-opus-5` |
| `GOOGLE_CLIENT_ID` | `server/auth.ts:19,221` | yes | Google login unverifiable |
| `VITE_GOOGLE_CLIENT_ID` | `client/src/components/GoogleSignInButton.tsx:3` | yes | Google button hidden |
| `SMTP_USER`, `SMTP_APP_PASSWORD` | `server/email.ts:3-4` | yes (empty) | no reset mail, silent success to user |
| `SMTP_FROM_NAME` | `server/email.ts:5` | yes | `RENIX` |
| `AI_MAX_TOKEN_BUDGET`, `AI_STRUCTURED_LOGS`, `AI_TOKEN_SAFETY`, `AI_LOG_LEVEL` | `server/ai/observability.ts:33-36` | yes (commented) | observability defaults |
| `GOOGLE_APPLICATION_CREDENTIALS` | not read in code (CLAUDE.md mentions it for real GCS) | no | n/a |

`.env` is loaded by `server/env.ts` (`dotenv/config`), first import of `server/index.ts`; `drizzle.config.ts` loads dotenv itself. Every variable the code reads is documented in `.env.example` except `NODE_ENV` (set by scripts) — no undocumented reads found.

---

## 6. Recommended order of fixes

1. **Wire `getQuotesLinkedViaSourceDocuments` into `PgStorage`** (`server/storage.ts`) — restores the document 2-step deletion safety check (A).
2. **Remove the two `createQuoteCoverageNote` blocks** in `server/routes/ai.ts:264-272, 533-541` — stops half-committed quotes + 500 on confirm (A).
3. **Replace `.reference` with `.quoteNumber`** at `contextAssembly.ts:507,648`, `routes/ai.ts:1539`, `storage/documents.ts:203` (A, data quality).
4. **Add `getTitle`** to the delete-payment proposal config (`useInvoicesData.ts:521`) (A in proposal mode).
5. **Delete dead files**: `server/documentProcessor.ts` (+ its import block in `contextAssembly.ts:657-718`), `client/src/frames/quotes/useQuotesModeState.ts`, `client/src/cfi/` and the other unimported files in section 3.2 — removes 47+ errors and the per-request swallowed exception.
6. `tsconfig.json`: add `"target": "ES2022"`; then the remaining B items (types in `schema.ts:1033`, `observability.ts`, `lib/api.ts`, `shell/ai/types.ts:221`, `vision.ts:72`, budget legacy branches).
7. Auth polish: surface "SMTP not configured" instead of generic success (`routes.ts:255-261` / `email.ts:24-27`); derive the reset-link scheme from `req.protocol` and drop the `localhost:5000` fallback (`routes.ts:252-253`).
