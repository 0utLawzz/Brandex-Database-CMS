# Brandex Datasheet Progress

**Last updated: 22 September 2026 (Audit + Security Fixes)**

This file is the single source of truth for project status.  
**Any AI agent or contributor must read this file first** before making changes, suggesting work, or starting a new task.

---

## Production foundation (Complete)

- [x] React/Vite web application (`artifacts/tm-tracker`)
- [x] Supabase Postgres primary database
- [x] Supabase staff authentication and RLS (viewer / editor / admin)
- [x] Private Storage for trademark images (signed URLs)
- [x] Audit log and asynchronous Google Sheet outbox
- [x] One-time import of 1,671 Sheet records
- [x] Vercel production deployment (https://brandexsheet.vercel.app)
- [x] Restored PR #1 optimized production baseline

## Phase 1 (Complete)

- [x] Transparent lightweight Brandex wordmark and compact mark
- [x] Maroon, gold and cream brand system
- [x] Compact verified contact footer
- [x] Canonical Type / Client Code / Case Number ordering
- [x] Server-side 50-record pagination
- [x] Universal search and operational filters
- [x] TM5, TM6, TM11, TM16 and TM56 controls
- [x] Count-only dashboard metrics
- [x] Filtered CSV export
- [x] Full Record View with prominent uploaded image
- [x] Branded A4 print record with manual notes
- [x] Supabase / Vercel setup and security documentation

## Documentation consistency (Completed 10 September 2026)

- [x] CONTRIBUTING.md rewritten to match current web-only architecture
- [x] Clone URLs corrected in README.md and INSTALL.md (now Brandex-Database-CMS)
- [x] Project structure, commands, and security rules aligned with AGENTS.md and DEV_NOTES.md

## Reliability fixes (Completed 10 September 2026)

- [x] Sheet sync outbox: reclaim stale `processing` rows + `MAX_ATTEMPTS=10` dead-letter
- [x] Optimistic concurrency: `version` column + `ConflictError` in `updateTrademark`
- [x] RecordModal passes `expectedVersion` and surfaces conflict toast to the editor

## UI layout pass (Completed 11–12 September 2026)

- [x] **Add Record**: removed Client Name field; regrouped DATE/TYPE/CLIENT CODE/CASE NO → Case Info (Case Type, App Name, Class, TM No) → Stage/Sub-stage → Agent + Agent City → Notes & Image
- [x] **Dashboard**: Filter by Agent + Class boxes; Recent Activity shows 10 entries
- [x] **Assigned**: only Stage 2 + Sub-status Assigned
- [x] **Database**: column order DATE / MODIFIED / TYPE / CLIENT CODE / CASE NO / TM/CPR / CLASS / APPLICATION / STATUS / SUB-STATUS / CLIENT / CITY / TM FORMS / JOURNAL; default sort by filing date newest first; IMPORT button (admin)
- [x] **Audit Logs**: user shown short (not full UUID); old/new values summarized (not full JSON blobs)
- [x] **api.ts**: `listTrademarkPage` sorts by `filing_date` desc, then `updated_at` desc
- [x] **RecordModal.tsx**: restored full regrouped form + AGENT CITY + ConflictError handling
- [x] **Search result cards**: thumbnail, large application name, Class, TM No, Type on right, Case/Client below, large Stage / small Sub-stage
- [x] **Record View**: image priority, Application Details emphasis, Status + Sub-status, Agent/City prominence, Stage 1–4 payment tick+date boxes under Office Notes, “CEO BRANDEX SIGNATURE/STAMP”
- [x] **Print Record A4**: `id=record-view-body`, `print:hidden` chrome, `print-avoid-break` sections, compact print spacing, print header/footer, richer journal print block

## Admin CSV import + registry tables (Completed 12 September 2026)

- [x] Migration `202609120001_form_journal_registry.sql` — `form_registry` + `journal_registry` with RLS (staff read / admin write)
- [x] `registryImport.ts` — parseFormCsv / parseJournalCsv, normalizeTmNumber, dryRun + commit (dedupe by TM+type+date)
- [x] `RegistryImportModal.tsx` — kind toggle (Form / Journal), Choose CSV → Dry-run preview → Commit inserts
- [x] Database page IMPORT button: admin-only opens modal; non-admin sees disabled/alert

## Match Engine + Publication Pipeline + Agent Management (Completed 21 September 2026)

- [x] Migration `202609200001_match_engine_publication.sql` — Added publication workflow fields to trademarks table (publication_date, opposition_deadline, demand_note_received, demand_note_date)
- [x] Migration `202609200001_match_engine_publication.sql` — Created RPC functions `run_journal_match()` and `run_form_match()` for automatic registry matching
- [x] Migration `202609200002_agents_fees.sql` — Created `agents` master table and `agent_fees` table for per-case fee tracking
- [x] Migration `202609200002_agents_fees.sql` — Created `agent_summary` view with computed fee statistics
- [x] `api.ts` — Added publication pipeline functions (listPublicationPipeline, markDemandNoteReceived, clearDemandNoteReceived)
- [x] `api.ts` — Added match engine functions (runJournalMatch, runFormMatch)
- [x] `api.ts` — Added agent management functions (listAgentProfiles, createAgentProfile, updateAgentProfile)
- [x] `api.ts` — Added agent fee functions (listFeesForTrademark, listFeesForAgent, addAgentFee, updateAgentFee, deleteAgentFee)
- [x] `AgentsPage.tsx` — Full agent management UI with create/edit/delete, fee tracking, and summary statistics
- [x] `PublicationPipelinePage.tsx` — Publication workflow UI with opposition deadline tracking, demand note management, and match engine controls
- [x] `App.tsx` — Added routes for `/agents` and `/publication` pages
- [x] `Navbar.tsx` — Added navigation items for AGENTS and PUBLICATION pages

**Still needed for full deployment**

- [x] Apply migrations `202609200001_match_engine_publication.sql` and `202609200002_agents_fees.sql` on Supabase production
- [x] Run typecheck and build to verify no TypeScript errors
- [x] Test new pages in development environment

## Required release checks

- [x] Automated tests
- [x] TypeScript typecheck
- [x] Production build
- [ ] Authenticated browser smoke test (viewer / editor / admin flows) → see SMOKE_TEST_CHECKLIST.md
- [ ] Vercel production verification (deployment and runtime entry point verified; dashboard environment-variable inventory not exposed in the available project API) → see SMOKE_TEST_CHECKLIST.md

## Medium-priority improvements

- [ ] Expand unit and integration tests around the outbox processor and role gates (API boundary coverage expanded; Edge Function/RLS integration coverage still pending)
- [x] Add structured logging / observability to the Edge Function (`supabase/functions/sync-google-sheet`)
- [x] Document backup and restore procedures for the private storage bucket (`trademark-files`) → see STORAGE_BACKUP.md

## Additional recommendations (Pending – evaluate before implementing)

- [ ] Soft-delete / archive table inside Supabase (if legal retention of deleted records is required)
- [ ] Foreign-key or documented validation between `trademarks.client_code` and `clients.code`
- [ ] Simple health-check or status view for the sync outbox
- [ ] Rate-limiting / monitoring on Auth endpoints (low priority while staff-only)
- [ ] Persist Stage 1–4 payment ticks + dates as structured fields (currently UI-only pending schema approval)

## Held for a separately approved phase

- [ ] Registry → trademark match-on-save / batch apply
- [ ] Agent assignment timeline and workflow flags
- [ ] Public trademark search endpoint

---

## How to use this file

1. Read this file completely before any work.
2. Update the checkboxes and “Last updated” date when a task is finished.
3. Keep the “Pending” sections accurate so the next agent or developer knows the exact state.
4. Do not start work on items marked “Held for a separately approved phase” without explicit approval.

## Verification run (12 September 2026)

- [x] `pnpm test` → 1 file, 8 tests passed
- [x] `pnpm typecheck` → passed
- [x] `pnpm build` → passed; Vite production bundle generated successfully
- [x] Production URL reachable → login/AuthGate rendered at https://brandexsheet.vercel.app with no browser console errors observed
- [x] Latest Vercel production deployment → READY on `main`, commit `45c7c046dd7b65b4f7a02bcf8790d42c044e7921`
- [ ] Authenticated viewer/editor/admin flows → blocked because no test credentials were supplied and no authenticated browser session was available
- [ ] Supabase/Vercel dashboard secret inventory → not independently confirmed through the available project APIs; no local `.env` file was present in the checkout

## Work log (12 September 2026)

- [x] Kept the application staff-only and admin-controlled; no public view was added.
- [x] Fixed form-registry CSV parsing for descriptive headers such as `type (tm5/tm6/tm11/tm16/tm56)`.
- [x] Improved blank form-type errors so invalid rows identify the missing value and accepted options.
- [x] Added sample imports under `samples/`: valid form registry, invalid-row form registry, and journal registry.
- [x] Refreshed Record View Application Details and Document Status with light cream panels, larger values, bold hierarchy, and responsive grids.
- [x] Database list now shows a signed thumbnail between DATE and MODIFIED and removes the CLIENT column.
- [x] Imported form registry rows now merge into `TM5/TM6/TM11/TM16/TM56` status badges by normalized TM number.
- [x] Assigned view now offers separate RECORD and ASSIGNMENT actions with queue/completed/pending summary from existing status fields.
- [x] Audit log summaries now label CASE NO, CLIENT CODE, TM/CPR, TYPE, and related context explicitly.

## Current active focus

1. Application is currently in production maintenance phase.
2. Monitor Edge Function logs and Supabase metrics.
3. Review any newly requested features before implementation.

## 2026-09-21 — Match Engine + Publication Pipeline + Agent Management

- [x] Created migration `202609200001_match_engine_publication.sql` with publication workflow fields and RPC match functions
- [x] Created migration `202609200002_agents_fees.sql` with agents master table and per-case fee tracking
- [x] Updated `api.ts` with publication pipeline, match engine, and agent management functions
- [x] Created `AgentsPage.tsx` with full agent management UI and fee tracking
- [x] Created `PublicationPipelinePage.tsx` with opposition deadline tracking and match engine controls
- [x] Updated `App.tsx` routing to include `/agents` and `/publication` routes
- [x] Updated `Navbar.tsx` navigation to include AGENTS and PUBLICATION menu items

## 2026-09-22 — Practical System Audit + Security & Logic Corrective Migration

- [x] Executed complete 14-phase practical audit across frontend, backend, database schema, RLS, RPCs, and migrations
- [x] Created migration `202609220001_fix_match_engine_security_and_logic.sql` enforcing `current_brandex_role() IN ('editor', 'admin')` checks inside `run_journal_match()` and `run_form_match()`
- [x] Removed destructive global reset `SET tm5=false...` from `run_form_match()` to protect legacy and manually entered TM form flags
- [x] Updated `api.ts` `addAgentFee` to automatically compute `paid` boolean status when `amountPaid >= amountBilled`
- [x] Verified `pnpm test` (10/10 passed), `pnpm typecheck` (0 errors), and `pnpm build` (bundle successfully generated)
- [x] Created migration `202609220002_trademark_workflow_history.sql` to track full status workflow history via postgres trigger
- [x] Updated `RecordView.tsx` to display full Acceptance and workflow history


