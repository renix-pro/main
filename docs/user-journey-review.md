# RENIX Platform — Council Review & Roadmap

**Council convened: March 2026**

RENIX is an AI-powered renovation management platform for homeowners managing €200K+ projects. 10 purpose-built pages, AI companion, document intelligence, financial tracking. 61 improvement opportunities completed (50 prior + 11 this session). Single-user, functionally complete.

This document contains the forward-looking roadmap: polish to apply and features to build. Resolved items are marked ✅. Organized by priority and grounded in specific code-level findings.

---

## Council Members

| Role | Focus |
|------|-------|
| **Product Strategist** | User journeys, value delivery, competitive gaps |
| **Design Director** | Visual polish, consistency, responsive fidelity |
| **Performance Engineer** | Speed, reliability, error handling |
| **AI/ML Lead** | AI companion quality, document intelligence, RAG |
| **Growth Expert** | Conversion, retention, shareability |

---

## Council Findings by Member

### Product Strategist — Top Priorities

| # | Finding | Impact | Effort | Rationale |
|---|---------|--------|--------|-----------|
| 1 | **No export capability** — users cannot produce a PDF budget summary, scope of work, or quote comparison to share with a partner, bank, or architect. For a tool managing €200K, this is a critical gap. Linear, Ramp, and every construction tool (Procore, CoConstruct) treats export as table-stakes. | 5 | L | Without export, RENIX is a walled garden. Users managing real renovations need to hand physical documents to banks for financing, to architects for approval, and to partners for alignment. |
| 2 | **No read-only share links** — the app is entirely single-player. A user cannot share their Budget or Scope with an architect or spouse without handing over login credentials. | 5 | L | Every competing tool — Notion, Linear, Figma — allows sharing a view without requiring the recipient to create an account. This is the #1 growth enabler. |
| 3 | **Quote-to-invoice traceability missing** — when a quote is accepted and the corresponding invoice arrives, there is no automatic or manual link between them. The user must mentally track which invoice corresponds to which quote. Ramp's receipt-matching is the gold standard here. | 4 | M | This is core to the "financial reality" promise. Without it, the user is doing the reconciliation work themselves. |
| 4 | **No vendor entity management** — vendors exist only as text fields on quotes and invoices. There is no vendor profile, no aggregate view ("How much have I paid Vendor X across all scopes?"), no contact info storage. | 4 | L | A renovation involves 5-15 vendors. Making them first-class entities unlocks vendor comparison, payment history, and communication tracking. |
| 5 | **No proactive AI micro-observations** — the AI only speaks when spoken to. It should surface insights automatically: "Your plumbing quotes vary by 34%", "3 scopes still have no quotes", "Kitchen invoices exceed the budget allocation by €2,400". Push, don't wait. | 4 | M | Superhuman and Ramp both use proactive intelligence. This is what transforms a tool into a copilot. |

### Design Director — Top Priorities

| # | Finding | Impact | Effort | Rationale |
|---|---------|--------|--------|-----------|
| 1 | **AI pane logo invisible in dark mode** — `AIAvatar.tsx` renders the RENIX logo PNG without `dark:invert`. Every other logo usage (GlobalShellBar, MobileWorkspaceLayout, LandingHeader, LoginPage, etc.) has `dark:invert`. The AI avatar does not. Result: invisible logo on dark backgrounds. | 5 | S | File: `client/src/shell/ai/AIAvatar.tsx` line 24. Every dark mode user sees a blank circle where the AI avatar should be. |
| 2 | **Invoice KPI tiles layout broken on large screens** — `Zone1Posture` wraps content in a `renix-grid` (CSS: `grid-template-columns: 4fr 8fr`). The invoice frame only places `Zone1ATiles` (in the 4fr column) with no content in the 8fr column. Result: KPI tiles are crammed into 1/3 of the screen width with 2/3 empty space on desktop. Budget frame correctly fills both columns (tiles + donut chart). | 5 | M | File: `client/src/frames/invoices/index.tsx` lines 184-221. Compare with `client/src/frames/budget/index.tsx` lines 189-215 which correctly uses both grid columns. |
| 3 | **Budget intent inline input doesn't format while typing** — `TotalBudgetTile` uses a raw `<input type="text">` with `setEditValue(String(totalBudget))`. User sees "200000" instead of "200,000" while editing. The `CurrencyInput` component exists and is used in dialogs (AllocationDialog, ContingencyDialog) but NOT in the inline budget tile. | 4 | S | File: `client/src/frames/budget/components/OrientationTiles.tsx` lines 104-114. Should use `CurrencyInput` component from `client/src/components/CurrencyInput.tsx`. |
| 4 | **Native HTML date pickers throughout** — all date inputs use `<Input type="date">` which renders the browser's default date picker (Chrome's grey calendar, Safari's scroll wheels). This breaks the RENIX design language entirely. Used in: TaskDialog (2 fields), TaskDetailsDrawer (2 fields), ManualInvoiceDialog, InvoiceDialogs. Should use a styled RENIX calendar component (Shadcn's Calendar + Popover). | 4 | M | Files: `ExecutionDialogs.tsx` lines 143-158, `TaskDetailsDrawer.tsx` lines 147-169, `ManualInvoiceDialog.tsx`, `InvoiceDialogs.tsx`. 8 date inputs total. |
| 5 | **Task creation form date fields overlap on mobile** — `grid grid-cols-2 gap-4` for start/end dates doesn't collapse on mobile. Inside a dialog on a 375px screen, each column is ~145px. Native date inputs need ~170px minimum to display the date + calendar icon without truncation. Result: fields overlap or text is cut off. | 4 | S | File: `ExecutionDialogs.tsx` line 140. Should be `grid grid-cols-1 sm:grid-cols-2 gap-4`. Same issue in TaskDetailsDrawer line 147. |

### Design Director — Additional Visual Polish Findings

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| 6 | **PostureTile component duplication** — two different `PostureTile` implementations exist: one in `components/tiles/PostureTile.tsx` (uses rounded `Card/CardContent`) and one in `layout/CFSLayout.tsx` (uses flat `renix-surface`). Invoices uses the rounded version, Budget uses the flat version. Different frames look like different apps. | 3 | S |
| 7 | **Canon v1.4 inconsistency** — Budget and Scope enforce "no rounded corners, pure black/white" while Overview, Financing, and Invoices use rounded Card components with colored tints. The design language is split between "data frames" and "narrative frames" with no documented rationale. | 3 | M |
| 8 | **Budget AllocationRow actions hidden on touch devices** — `visibility-hidden group-hover:visibility-visible` CSS pattern on the edit/delete menu. Touch devices have no hover state. Users on iPad or mobile cannot discover the edit/delete actions at all. Same pattern in `AllocationMap.tsx` and `ScopeWorkSurface.tsx`. | 4 | S |
| 9 | **Gantt timeline label column wastes 40% of mobile viewport** — hardcoded `w-[140px]` label column. On a 375px screen, only ~200px remains for the actual timeline bars. Task names are severely truncated. Should use a responsive approach (smaller on mobile, or collapsible labels). | 3 | S |
| 10 | **Deep scope tree nesting causes truncation on mobile** — `INDENTATION_WIDTH = 24px` per level. At depth 4 (common for room > area > item > sub-item), that's 96px of indentation on a 375px screen, leaving ~250px for the node label. At depth 6, only ~200px remains. | 3 | S |
| 11 | **Hardcoded 'en-AU' locale across date formatting** — 7 files use `Intl.DateTimeFormat('en-AU', ...)` or `Intl.NumberFormat('en-AU', ...)` instead of the project's regional locale. Files: `MessageCards.tsx`, `QuoteDetailPanel.tsx`, `QuoteWorkspaceTypes.ts`, `QuoteCard.tsx`, `QuoteFocusPanel.tsx`, `QuotesDialogs.tsx`, `TaskDetailsDrawer.tsx`. A German user managing a Berlin renovation sees Australian date formats. | 3 | S |
| 12 | **Empty states inconsistent across frames** — Overview has a dedicated `EmptyOverviewActionSurface`, Vision uses `<div className="italic">`, Execution uses a custom `div` in Kanban columns, Quotes/Budget show guidance text. No unified empty state component. | 2 | M |
| 13 | **Error states inconsistent** — Overview has a robust error UI with AlertCircle + Retry button. Other frames (Scope, Budget, Financing) do not explicitly handle `isError` in their main index — they rely on parent error boundaries or show nothing. | 2 | M |
| 14 | **Gantt month labels hardcoded to 'en-US'** — `GanttTimeline.tsx` line 55: `current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })`. Should use project locale. | 2 | S |
| 15 | **RichTextContent font size inconsistency** — wrapper has `text-[13px]` but regular paragraphs at line 131 add `text-xs` (12px). Headings and list items inherit 13px. Mixed sizes within the same AI message. | 2 | S |

### Performance Engineer — Top Priorities

| # | Finding | Impact | Effort | Rationale |
|---|---------|--------|--------|-----------|
| 1 | **AI empty bubbles bug** — when the AI returns a response with `structuredData` or `proposals` but empty `content` string, `RichTextContent` renders an empty div. The empty content bubble still takes visual space with its avatar and layout, creating a "blank message" appearance. Root cause: `server/routes/ai.ts` returns `response.content \|\| ''` — the fallback empty string passes through to the UI. | 5 | S | The client guards against user-sent empty messages, but assistant messages with empty content are rendered. Fix: either ensure server always returns non-empty content, or have `MessageBubble` skip the `RichTextContent` when content is empty but other data (proposals, structuredData) exists. |
| 2 | **AI code blocks silently stripped** — `RichTextContent.tsx` line 82: `safeContent.replace(/```[\s\S]*?```/g, '')` deletes all fenced code blocks. If the AI provides a JSON snippet, budget calculation, or structured data block, it vanishes. | 4 | S | Should render code blocks in a styled `<pre>` element instead of removing them. |
| 3 | **No URL/link rendering in AI messages** — `RichTextContent.tsx` has no URL detection or link rendering. Raw URLs appear as plain text. Markdown links `[text](url)` are also not parsed. | 3 | S | Users asking the AI about reference materials, vendor websites, or product links get non-clickable text. |
| 4 | **No retry mechanism for failed API calls** — `queryClient.ts` has `retry: false` globally. A single network hiccup causes a permanent error state until the user manually refreshes. | 3 | S | Should use `retry: 2` with exponential backoff, at minimum for GET requests. |
| 5 | **Password reset backend is a stub** — `server/routes.ts` line 233: `/api/auth/reset-password` returns `{ success: true }` without doing anything. Frontend `ResetPasswordPage.tsx` exists and lets users submit the form, but no email is sent, no token is generated. The user gets a "success" message and nothing happens. | 3 | M | This is a trust violation. Either implement the full flow or remove the UI to avoid confusion. |

### Performance Engineer — Additional Technical Findings

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| 6 | **scope.ts migration endpoint crashes** — `POST /migrate` in `server/routes/scope.ts` references variables `areas` and `items` that are never defined. This endpoint will throw a ReferenceError on execution. | 4 | S |
| 7 | **Invoice deletion not transaction-safe** — `server/routes/invoices.ts` deletes lines, payments, and the invoice record in separate queries without a database transaction. A failure mid-way leaves orphaned records. | 3 | S |
| 8 | **Inconsistent financial unit handling** — `budget_data.total_budget` and `financing_sources.amount` stored in whole units, while `budget_allocations.amount`, `invoice_lines.amount`, `quoteFinancials.*_amount` stored in cents. Code paths must convert correctly or introduce magnitude errors. | 4 | M |
| 9 | **PATCH endpoints lack Zod validation** — `projects.ts` and `invoices.ts` PATCH routes use `req.body` directly without schema validation. Allows invalid field types or unexpected properties. | 3 | S |
| 10 | **Orphaned model file** — `shared/models/chat.ts` defines `conversations` and `messages` tables that conflict with `shared/schema.ts`. `server/db.ts` only imports from `schema.ts`, making `chat.ts` dead code that could confuse contributors. | 2 | S |
| 11 | **Missing foreign key constraints** — `quotes.lineageId` and `quotes.previousQuoteId` self-reference `quotes.id` without `.references()`. `invoice_lines.scopeItemId` references `scopeNodes.id` without a constraint. | 2 | S |
| 12 | **Legacy tables still in schema** — `scopes` and `quote_line_items` tables marked `@legacy_read_only` are still defined in `shared/schema.ts`. Should be documented for removal timeline. | 1 | S |
| 13 | **Conversation history not lazy-loaded** — entire AI conversation history is held in React state. For long-running projects with 100+ messages, this grows memory without bound and degrades scroll performance. | 2 | M |
| 14 | **No offline detection** — no `navigator.onLine` listeners or "you're offline" UI. Network failures result in permanent loading/error states with no user feedback. | 2 | S |

### AI/ML Lead — Top Priorities

| # | Finding | Impact | Effort | Rationale |
|---|---------|--------|--------|-----------|
| 1 | **Proactive intelligence** — AI only responds to user messages. It should push micro-observations when the user opens the AI pane or navigates to a new frame: "I noticed 3 scopes have no quotes yet", "Your kitchen quotes vary by 34% — here's the breakdown", "Budget allocation exceeds total by €4,200". This is the Superhuman "Insights" model. | 5 | L | This transforms the AI from a chatbot into a copilot. It should feel like opening a project and immediately seeing what your AI analyst found since your last visit. |
| 2 | **Cross-frame financial drill-down** — clicking a number in the Overview (e.g., "Total Committed: €85,000") should navigate the user to the exact source: which quotes, which invoices, which allocations compose that number. The `resolvedCostDemand.ts` engine calculates this; the UI doesn't expose the breakdown interactively. | 4 | M | The Overview computes impressive metrics but presents them as terminal numbers. Making them interactive turns the Overview into a navigation hub. |
| 3 | **Document-to-entity confidence scoring** — when the AI extracts data from a PDF (vendor name, line items, totals), it should show confidence levels per field. Currently, extraction results are presented as binary (found or not). Low-confidence extractions for ambiguous PDFs should be flagged visually. | 3 | M | German renovation quotes come in wildly varying formats. A "Confidence: 72%" indicator on an extracted total lets the user know to double-check. |
| 4 | **RAG improvements** — current retrieval uses PostgreSQL full-text search (`tsvector`). This misses semantic matches (e.g., searching "bathroom costs" won't find a document that says "Sanitärbereich Kosten"). Vector embeddings would significantly improve retrieval quality for multilingual projects. | 3 | XL | Stage E infrastructure. Important for German-language document handling where translated terms don't match keyword search. |
| 5 | **AI context staleness** — if a user modifies data in a frame while the AI pane is open, the AI doesn't see the change until the next message triggers a context refresh. For example: user adds a budget allocation, then asks "What's my remaining budget?" — the AI may give the old answer. | 3 | M | Layer 1 (authoritative state) is rebuilt per-turn, but the rebuild happens only on message send, not on frame mutation events. |

### Growth Expert — Top Priorities

| # | Finding | Impact | Effort | Rationale |
|---|---------|--------|--------|-----------|
| 1 | **Command palette (Cmd+K)** — `cmdk` library is installed and the `Command` component exists in `components/ui/command.tsx`, but there is no global `Cmd+K` handler registered. No keyboard-driven navigation between frames, no quick search, no action dispatch. Linear and Superhuman users expect this. | 4 | M | Power users navigate by keyboard. Without Cmd+K, every frame switch requires a mouse click on the sidebar. This is the #1 "speed" feature. |
| 2 | **Keyboard shortcuts system** — only `Ctrl+B` (sidebar toggle) and `Enter` (chat submit) exist. No `G then B` for "Go to Budget", no `G then S` for "Go to Scope", no `?` to show shortcuts. Linear's keyboard-driven UX is a major retention driver. | 3 | M | Should include: frame navigation, AI toggle, quick add (scope, task, allocation), and a discoverable shortcuts overlay. |
| 3 | **Landing page copy repetition** — "Purpose-built" appears in StatsStrip, PagesGrid, and Differentiators section. The Free plan description ("Perfect for exploring RENIX on a single project") reads template-y compared to the Pro plan's stronger copy. | 2 | S | Varying vocabulary (tailored, specialized, domain-specific) and sharpening the Free plan pitch would improve conversion. |
| 4 | **No project summary digest** — users managing multi-month renovations need a "What changed this week?" summary. A periodic digest (email or in-app) with key changes, attention signals, and financial snapshot would drive return visits. | 4 | L | Construction management tools like CoConstruct and Buildertrend send weekly owner updates. This is expected in the category. |
| 5 | **Form validation is silent** — across all forms (project creation, task creation, budget allocation), validation works by disabling the submit button when inputs are invalid. There are no inline error messages explaining WHY the button is disabled. Users wonder what's wrong. | 3 | M | Every premium app (Linear, Stripe, Clerk) shows inline validation errors. "Title is required", "Amount must be greater than 0". This is accessibility 101. |

---

## Unified Roadmap

### BUGS — Fix Immediately

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-095 | ✅ AI pane logo invisible in dark mode — added `dark:invert` to AIAvatar.tsx | 5 | S | Design |
| OPP-096 | ✅ AI empty bubbles — RichTextContent skipped when content is empty | 5 | S | Perf |
| OPP-097 | ✅ AI code blocks stripped — now rendered in styled `<pre><code>` | 4 | S | Perf |
| OPP-098 | ✅ Budget inline input doesn't format — replaced with CurrencyInput | 4 | S | Design |
| OPP-099 | ✅ Task form date fields overlap on mobile — added `grid-cols-1 sm:grid-cols-2` | 4 | S | Design |
| OPP-100 | ✅ scope.ts migration endpoint crashes — removed dead areas/items code | 4 | S | Perf |
| OPP-101 | ✅ Password reset stub — now returns honest "not yet available" message | 3 | M | Perf |
| OPP-102 | ✅ Invoice deletion not transaction-safe — wrapped in db.transaction | 3 | S | Perf |
| OPP-103 | ✅ AllocationRow/Map/ScopeWorkSurface actions hidden on touch — visible on mobile, hover-reveal on desktop | 4 | S | Design |
| OPP-104 | ✅ Hardcoded 'en-AU' locale in 8 files — replaced with project regional locale | 3 | S | Design |

### STAGE A — Visual Polish & Consistency

Making what we have world-class before adding features. Inspired by Linear's obsessive attention to detail.

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-105 | Replace native date pickers with styled RENIX calendar — Shadcn Calendar+Popover for all 8 date inputs | 4 | M | Design |
| OPP-106 | ✅ Invoice KPI tiles layout fix — moved KPIRing payment progress into the 8fr column, matching Budget frame's two-column layout | 5 | M | Design |
| OPP-107 | Unify PostureTile implementations — single source of truth component that respects frame context (rounded for Overview/Financing, flat for Budget/Scope) or pick one style for all | 3 | S | Design |
| OPP-108 | Unified empty state component — create a single `EmptyStateSurface` used by all frames with frame-specific messaging | 2 | M | Design |
| OPP-109 | Unified error state per frame — each frame should handle `isError` with retry button, not just rely on boundary | 2 | M | Perf |
| OPP-110 | Gantt timeline responsive label column — reduce to ~90px on mobile, truncate with tooltip, or collapse to icons | 3 | S | Design |
| OPP-111 | Scope tree mobile depth handling — collapse deep nesting with breadcrumb trail or reduce indent width on mobile | 3 | S | Design |
| OPP-112 | AI link rendering — detect URLs in AI messages and render as clickable links | 3 | S | Perf |
| OPP-113 | RichTextContent font size consistency — unify to 13px base, remove `text-xs` override on paragraphs | 2 | S | Design |
| OPP-114 | Gantt month labels use project locale instead of hardcoded 'en-US' | 2 | S | Design |
| OPP-115 | Inline validation error messages on forms — "Title is required", "Amount must be positive" below inputs | 3 | M | Growth |
| OPP-116 | Landing page copy polish — vary "purpose-built" synonym, sharpen Free plan description | 2 | S | Growth |
| OPP-117 | Add retry logic for GET queries — `retry: 2` with exponential backoff in queryClient | 3 | S | Perf |
| OPP-118 | Offline detection banner — listen for `navigator.onLine` changes, show non-intrusive "You're offline" bar | 2 | S | Perf |

### STAGE B — Power User & Speed

Inspired by Linear (keyboard-driven), Superhuman (speed), Ramp (financial clarity).

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-119 | Global command palette (Cmd+K) — wire up existing cmdk infrastructure with frame navigation, entity search, quick actions | 4 | M | Growth |
| OPP-120 | Keyboard shortcuts system — G+B (Budget), G+S (Scope), G+Q (Quotes), G+O (Overview), / (AI focus), ? (shortcuts overlay) | 3 | M | Growth |
| OPP-121 | Cross-frame financial drill-down — click any Overview KPI number to see its composition (which quotes, invoices, allocations) with navigation to source | 4 | M | AI/ML |
| OPP-122 | Proactive AI micro-observations — surface insights on pane open and frame navigation, not just in response to messages | 5 | L | AI/ML |
| OPP-123 | Quick-entry patterns — inline scope creation from Budget, inline task creation from Overview attention signals, inline allocation from Scope | 3 | M | Product |
| OPP-124 | Batch document upload with progress queue — upload multiple PDFs, show extraction progress per document | 4 | M | Product |
| OPP-125 | Quote-to-invoice traceability — link accepted quotes to their corresponding invoices, show reconciliation status | 4 | M | Product |

### STAGE C — Shareability & Growth

Unlocking multi-player value. The gap between "personal tool" and "indispensable platform."

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-126 | PDF/Report export — budget summary, scope of work, quote comparison as downloadable PDFs | 5 | L | Product |
| OPP-127 | Read-only share links — generate a unique URL for a specific frame, no login required, time-limited | 5 | L | Product |
| OPP-128 | Vendor entity management — vendors as first-class entities with profiles, aggregate spend, linked quotes/invoices | 4 | L | Product |
| OPP-129 | Project summary email digest — weekly auto-generated summary of changes, attention signals, financial snapshot | 4 | L | Growth |
| OPP-130 | AI document confidence scoring — show per-field confidence on extracted data, flag low-confidence items | 3 | M | AI/ML |
| OPP-131 | AI context freshness — trigger Layer 1 rebuild on frame mutation events, not just on message send | 3 | M | AI/ML |

### STAGE D — Execution Depth & Intelligence

Building deeper capability within existing frames.

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-132 | Task dependency modeling — predecessor/successor links with critical path highlighting in Gantt | 4 | L | Product |
| OPP-133 | Budget what-if scenarios — "What if the roof quote comes in 20% higher?" with side-by-side comparison | 3 | L | Product |
| OPP-134 | Scope change versioning — snapshot scope tree, show diff when structure changes | 3 | L | Product |
| OPP-135 | Payment timeline — chronological cross-invoice view of all money movement with project milestone overlay | 3 | M | Product |
| OPP-136 | KPI historical trending — track key metrics over time, show improvement/deterioration curves | 3 | L | Product |

### STAGE E — Platform Maturity

Long-term infrastructure for scale and market expansion.

| ID | Title | Impact | Effort | Owner |
|----|-------|--------|--------|-------|
| OPP-137 | Vector embeddings for RAG — replace PostgreSQL full-text search with semantic vector search for multilingual document retrieval | 3 | XL | AI/ML |
| OPP-138 | Multi-currency support — projects with vendors in different currencies, with conversion tracking | 3 | L | Product |
| OPP-139 | Calendar integration — sync execution tasks with Google Calendar / Outlook | 3 | L | Product |
| OPP-140 | German language localization — full i18n of UI labels, AI prompts in German, locale-aware date/number formatting | 3 | XL | Growth |
| OPP-141 | Offline support / PWA — service worker caching, offline-first data mutations with sync | 3 | XL | Perf |
| OPP-142 | Conversation lazy loading — paginate AI history, load older messages on scroll-up | 2 | M | Perf |
| OPP-143 | Clean up orphaned model file — delete `shared/models/chat.ts`, add missing FK constraints, document legacy table removal timeline | 2 | S | Perf |
| OPP-144 | Standardize PATCH validation — add Zod safeParse to all PATCH endpoints | 3 | S | Perf |
| OPP-145 | Financial unit consistency audit — ensure all amount fields use minor units (cents) throughout the stack | 4 | M | Perf |

---

## Summary

| Tier | Items | Theme |
|------|-------|-------|
| **Bugs** | 10 (all ✅ resolved) | Critical fixes — dark mode logo, empty bubbles, crash prevention, touch accessibility |
| **Stage A** | 14 (1 ✅ resolved, 13 remaining) | Visual polish & consistency — make what exists world-class |
| **Stage B** | 7 | Power user & speed — keyboard navigation, proactive AI, quick entry |
| **Stage C** | 6 | Shareability & growth — export, sharing, vendor management, digests |
| **Stage D** | 5 | Execution depth — dependencies, what-if, versioning, timeline |
| **Stage E** | 9 | Platform maturity — i18n, offline, vector search, infrastructure |
| **Total** | **51** | |

Next OPP number: **OPP-146**
