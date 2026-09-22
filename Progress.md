# Brandex Datasheet Progress

**Last updated: 22 September 2026 (Batch 16 — Final V2 Release Readiness & End-to-End Verification)**

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
- [x] Persist Stage 1–4 payment ticks + dates as structured fields (additive migration 202609220003_stage_payment_columns.sql)

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

## Verification run (22 September 2026)

- [x] `pnpm test` → 2 test files, 11 tests passed
- [x] `pnpm typecheck` → passed (0 errors)
- [x] `pnpm build` → passed; Vite production bundle generated successfully (13.7s)
- [x] Production URL reachable → login/AuthGate rendered at https://brandexsheet.vercel.app with no browser console errors observed
- [x] Latest Vercel production deployment → READY on `main`
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

## 2026-09-22 — Batch 1: Stage Payment Columns & Stage 1 Sub-stage Alignment

- [x] Created additive migration `202609220003_stage_payment_columns.sql` adding `stage1_paid`, `stage1_paid_date`, `stage2_paid`, `stage2_paid_date`, `stage3_paid`, `stage3_paid_date`, `stage4_paid`, `stage4_paid_date`, and `payment_reference` columns with safe defaults
- [x] Updated `STATUS_WORKFLOW` dictionary in `api.ts` to include `"Filing"` as the first sub-stage of `"STAGE 1"` (`["Filing", "Acknowledgment", "Examination"]`)
- [x] Added `updateStagePayment()` targeted mutation in `api.ts`
- [x] Updated `RecordView.tsx` to persist and display real Stage 1–4 manual payments with clear `MANUAL — NOT VERIFIED` status label
- [x] Verified `pnpm test` (11/11 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 13.7s bundle)

## 2026-09-22 — Batch 2 & 3: Stage 2 Payment Gate & Agent Assignment

- [x] Enforced Stage 2 payment gate (`isStage2PaymentRequired`, `validateStage2PaymentGate`, `assignStage2Agent` in `api.ts`)
- [x] Integrated Stage 2 payment requirement check into `AssignedPage.tsx` and `RecordModal.tsx`
- [x] Reused existing Agents master system (`listAgentProfiles()`) for agent assignment dropdowns
- [x] Preserved legacy agent names and data integrity without schema changes or fake data
- [x] Added unit tests in `api.test.ts` verifying payment gate blocking unpaid assignments and allowing cleared payments
- [x] Verified `pnpm test` (13/13 passed), `pnpm typecheck` (0 errors), and `pnpm build` (12.35s production bundle)


## 2026-09-22 — Batch 4: Assigned Operational Queue

- [x] Added TYPE column to AssignedPage table (canonical order: Type → Client Code → Case No)
- [x] Promoted CLIENT CODE to its own bold column (was secondary text under CLIENT NAME)
- [x] Added S2 PMT (Stage 2 Payment) status pill per row: ✓ PAID (green) / ⚠ UNPAID (amber) — no extra query, reuses existing `stage2Paid` field
- [x] Agents with no name now show italic "unassigned" placeholder instead of blank cell
- [x] Verified: `pnpm test` 13/13 passed, `pnpm typecheck` 0 errors, `pnpm build` passed (11.55s)

## 2026-09-22 — Batch 7: Stage 4 Workflow Alignment

- [x] Audited `STATUS_WORKFLOW["STAGE 4"]` in `api.ts` — already contains the exact required sequence: `CER Dispatch`, `CER Received`, `CER Acknowledge`
- [x] No code change required — specification was already met
- [x] Verified `pnpm test` (13/13 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 11.31s)

## 2026-09-22 — Batch 6: Stage 3 Workflow Alignment

- [x] Audited `STATUS_WORKFLOW["STAGE 3"]` in `api.ts` — already contains the exact required sequence: `D-Note Submitted`, `D-Note Received`, `OPPO: Filed`, `OPPO: Received`, `OPPO: Withdrawn`, `Published`
- [x] No code change required — specification was already met
- [x] Verified `pnpm test` (13/13 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 11.37s)

## 2026-09-22 — Batch 5: Agent Statistics Data

- [x] Added `getAgentCaseCounts(agentName)` to `api.ts` — three count-only HEAD queries against `trademarks.agent` text field (no FK, no migration): Assigned (Stage 2), Accepted (Stage 2), Total cases
- [x] Added `AgentCaseCounts` interface to `api.ts`
- [x] Updated `AgentsPage.tsx` detail modal: added "CASE ASSIGNMENT" section with Assigned/Accepted/Total case tiles; renamed "TOTAL PAID" to "TOTAL RECEIVED"; relabelled "BALANCE DUE" to "BALANCE"; added section headers distinguishing trademark-sourced stats from fee-sourced stats
- [x] Counts load on-demand when agent modal opens — not prefetched for every table row
- [x] Verified: `pnpm test` 13/13 passed, `pnpm typecheck` 0 errors, `pnpm build` passed (11.47s)

## 2026-09-22 — Batch 9: Stage-wise Documents - DB + API Foundation

- [x] Created additive migration `supabase/migrations/202609220004_trademark_files_stage_columns.sql` adding `stage`, `sub_stage`, and `title` to `public.trademark_files` table with index `trademark_files_stage_idx`
- [x] Implemented API foundation in `api.ts`:
  - `StageDocument` and `UploadStageDocumentInput` interfaces
  - `uploadStageDocument(file, input)`: strictly validates file size (≤10MB) and permitted MIME types; uploads to private `trademark-files` bucket under `{trademarkId}/{stage}/{uuid}.{ext}`; inserts DB metadata row with automatic orphan cleanup on failure; returns document with 1-hour signed URL
  - `listStageDocuments(trademarkId, stage?)`: retrieves rows for trademark (optionally filtered by stage), batch-generates 1-hour signed URLs for private storage access without exposing public URLs
- [x] Added unit tests in `api.test.ts` verifying MIME type validation, file size bounds, storage error handling/cleanup, and stage filtering
- [x] Verified: `pnpm test` (18/18 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 13.45s)

## 2026-09-22 — Batch 10: Replace Short Forms in User-Facing Workflow Labels

- [x] Implemented canonical user-facing terminology expansion architecture (`api.ts`):
  - `WORKFLOW_DISPLAY_LABELS`: maps `D-Note Submitted` → `Demand Note Submitted`, `D-Note Received` → `Demand Note Received`, `OPPO: Filed` → `Opposition: Filed`, `OPPO: Received` → `Opposition: Received`, `OPPO: Withdrawn` → `Opposition: Withdrawn`
  - `formatWorkflowLabel(label)`: expands workflow labels for display without mutating underlying database values
  - `normalizeWorkflowValue(val)`: transparently bridges full user-facing phrases back to internal database values
  - `listTrademarkPage`: bridges user searches for "Demand Note" or "Opposition" to matching database rows
  - `CER` status: audited repository for explicit full forms of `CER`; none found, so `CER` (`CER Dispatch`, `CER Received`, `CER Acknowledge`) is preserved unchanged and reported as a pending terminology decision
- [x] Updated all visible user-facing workflow touchpoints:
  - `RecordModal.tsx`: sub-stage dropdown displays full terminology (`formatWorkflowLabel`), form initialization and stage changes normalize seamlessly (`normalizeWorkflowValue`)
  - `RecordView.tsx`: sub-stage badges, sub-status cards, and workflow history event labels display full terminology
  - `SearchPage.tsx`: search result cards and search table rows display full terminology
  - `DatabasePage.tsx`: database table rows and CSV export use full terminology
  - `AssignedPage.tsx`: assigned queue table rows and assignment detail modal display full terminology
- [x] Added unit tests in `api.test.ts` verifying label formatting, value normalization, edge cases (null/undefined/empty), and `inputToRow` integration
- [x] Verified: `pnpm test --run` (23/23 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 18.45s)

## 2026-09-22 — Batch 11: Complete Stage-wise Document UI

- [x] Defined canonical `STAGE_DOCUMENT_WORKFLOW` in `api.ts` with all 4 stages and their available sub-stages using full user-facing terminology:
  - Stage 1: Filing, Acknowledgment, Examination
  - Stage 2: Assigned, Accepted, Hearing
  - Stage 3: Demand Note Submitted, Demand Note Received, Opposition: Filed, Opposition: Received, Opposition: Withdrawn, Published
  - Stage 4: CER Dispatch, CER Received, CER Acknowledge
- [x] Re-exported `getStaffRole` from `api.ts` for unified staff authentication & role querying
- [x] Integrated `normalizeWorkflowValue` into `uploadStageDocument` to ensure canonical database values while accepting full user-facing labels
- [x] Created `StageDocumentsSection.tsx` component in `artifacts/tm-tracker/src/components/`:
  - Clearly organized stage cards for Stages 1 through 4
  - Displays stage name, stage badge color, available sub-stages, and document count
  - Displays attached documents with title, original file name, MIME type badge, formatted size, and upload date
  - Secure "View" action opening signed URLs with 1-hour expiry (no public URLs exposed)
  - Role-gated controls: Editor/Admin users can open the Upload modal with stage/sub-stage selection, file validation (<=10MB, permitted MIME types), optional title, progress loader, and success/error notifications; Viewer users have strictly read-only access with all upload controls hidden
  - Separate from existing registry/form matching "Document Status" section
- [x] Embedded `<StageDocumentsSection trademarkId={record.id} currentStage={record.stage} />` into `RecordView.tsx` with print-safe styling
- [x] Added unit tests in `api.test.ts` verifying `STAGE_DOCUMENT_WORKFLOW` stages/sub-stages, terminology rules (no short forms, CER preserved), and upload sub-stage normalization
- [x] Verified: `pnpm test --run` (27/27 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 13.15s)

## 2026-09-22 — Batch 12: RecordView Workflow Consolidation

- [x] Implemented workflow/status management functions in `api.ts`:
  - `updateTrademarkStatus(id, stage, subStage)`: updates case stage and sub-stage directly, strictly enforcing the Stage 2 payment gate (`stage2_paid = true` required for STAGE 2) and normalizing sub-stage values via `normalizeWorkflowValue`
  - `updateTrademarkAgent(id, agentName, city)`: updates assigned agent and city, enforcing the Stage 2 payment gate if the record is currently in Stage 2
- [x] Created `CaseWorkflowSection.tsx` component in `artifacts/tm-tracker/src/components/`:
  - **Progression Stepper**: horizontal track visually tracing normal forward workflow (`Stage 1` → `Stage 2` → `Stage 3` → `Stage 4`) with completed checkmarks, bold active stage indicator, and distinct alert for `STOPPED` cases
  - **Current Status & Transition Control**: clear Stage and Sub-Stage display with complete canonical terminology (Demand Note, Opposition, CER); role-gated "Update Status" modal for Editor/Admin enforcing the Stage 2 payment gate
  - **Agent Details & Assignment Control**: displays assigned agent and city; role-gated "Assign / Change Agent" modal pulling from `listAgentProfiles()` master list and enforcing the Stage 2 payment gate
  - **Stage Payments**: compact 4-stage payment block (Stage 1 to 4) with real-time toggle, date recording, and prominent `MANUAL — NOT VERIFIED` indication
  - **Workflow History**: chronological event history with timestamp, changed by user, and full terminology transitions (preserving repeated status events intact)
- [x] Consolidated `RecordView.tsx`: replaced fragmented status, agent, history, and payment cards with unified `CaseWorkflowSection`; preserved registry-matching "Document Status" (TM forms) and Batch 11 `StageDocumentsSection` completely intact
- [x] Added unit tests in `api.test.ts` verifying `updateTrademarkStatus` and `updateTrademarkAgent` payment gate enforcement and sub-stage normalization
- [x] Verified: `pnpm test --run` (32/32 passed), `pnpm typecheck` (0 errors), `pnpm build` (passed, 11.44s)
## 2026-09-22 — Batch 13: Publication Workflow Integration

### What was integrated

- **Publication Pipeline V2 (`PublicationPipelinePage.tsx`)**:
  - Exclusively operates on journal-matched records (`publication_date IS NOT NULL`). Non-published trademarks do not clutter this pipeline.
  - Retains all existing Match Engine controls intact: "Run Journal Match" and "Run Form Match" RPC triggers remain fully accessible.
  - Added **Journal Number**, **Client Code**, and **Type** columns in the primary datasheet table, maintaining the canonical Brandex identifier hierarchy.
  - Replaced the inaccurate header metric count `${records.length} PUBLISHED` with `${records.length} MATCHED CASES` alongside a breakdown of `Pending Window`, `Overdue`, and `Completed (Demand Note Received)` counts.
  - Fixed date input state bug where changing the demand note received date previously ignored user input and defaulted to today's date. The date field is now fully controlled via React state.
  - Sub-stage values are formatted using `formatWorkflowLabel` so users see full canonical terminology (e.g. `Demand Note Submitted`, `Demand Note Received`, `Opposition: Filed`, `Opposition: Received`, `Opposition: Withdrawn`, `Published`) instead of internal shorthand (`D-Note Submitted`, `OPPO: Filed`).
  - Pipeline records display Publication Date, Opposition Deadline, Days Remaining, and color-coded status badges (`pending`, `overdue`, `done`).
  - Added direct navigation link from each pipeline record card and modal to `/record/:id` for full case view.

- **API Extensions (`api.ts`)**:
  - `PublicationRecord` interface extended with `journalNumber`, `clientCode`, and `type` fields.
  - `listPublicationPipeline()` updated to select `client_code`, `type`, and `journal_number`, and applies `formatWorkflowLabel(row.sub_status)` for client presentation.

- **Unit Tests (`api.test.ts`)**:
  - Added unit test suite for Batch 13 verifying `listPublicationPipeline` queries journal-matched cases, correctly maps `clientCode`, `type`, and `journalNumber`, applies `formatWorkflowLabel` to `subStage`, and computes days remaining and pipeline status badges (`pending`, `overdue`, `done`).

### Business / Legal Confirmation Item

- **Publication Opposition Deadline Calculation**:
  - Current implementation uses `run_journal_match()` which sets `opposition_deadline = publication_date + 60 days` (standard 2 months statutory opposition window).
  - *Business/Legal Confirmation Required*: In Pakistani trademark practice (Trade Marks Ordinance 2001), the initial opposition period is 2 months from the date of publication in the Trade Marks Journal, extendable by up to 2 additional months upon application (Form TM-44). Need practice-owner confirmation if automatic 60-day calendar calculation should account for statutory gazette publication notice rules or track TM-44 extensions.

### Verification

- [x] `pnpm test --run` → 33/33 tests passed
- [x] `pnpm typecheck` → 0 errors
- [x] `pnpm build` → production bundle compiled successfully

## 2026-09-22 — Batch 14: Operations Consolidation (Print, Reminders, Logs, Search, Database, Agents, Record UX)

### What was completed

1. **Reminder System (`api.ts` + `RecordView.tsx`)**:
   - Implemented `getWorkflowReminders(stage, subStage, context)` in `api.ts` returning exactly 4 informational reminders (1: Filing & Documentation, 2: Agent & Assignment, 3: Publication & Opposition, 4: Registration & Certificate).
   - Strict adherence to safety rules: exactly 4 reminders, never Reminder 5+, no invention of statutory deadlines, no mutation, purely informational.
   - Stage-adaptive descriptions highlight active stage while preserving awareness of adjacent workflow steps.
   - Displayed in `RecordView.tsx` with clean brand styling on screen and in A4 print layout.

2. **Print System (`RecordView.tsx` + `index.css`)**:
   - Clean black ink on white background for A4 portrait layout with standard 10mm 12mm page margins.
   - Completely purged legacy dark-blue tokens (`#0A1931`, `#1E3E62`, `#3A506B`) from print stylesheet and views.
   - Professional Brandex letterhead banner with brand wordmark and mark.
   - Formal CEO Signature / Official Stamp block (no fake signature, formal attestation space).
   - Reminders included in print layout with print-avoid-break protection.

3. **Logs / Audit UI (`api.ts` + `LogsPage.tsx`)**:
   - Extended `listAuditLogs` to extract `applicationNumber`, `applicationName`, `clientCode`, and `caseType` from `new_record` and `old_record` JSONB fields.
   - Rebuilt `LogsPage.tsx` with an 8-column layout: `DATE`, `TIME`, `USER`, `ACTION`, `RECORD` (clickable link navigating directly to `/record/:id`), `APP NUMBER`, `NAME`, and `CHANGES`.
   - Brand color-coded action badges (CREATE in green `#0A6B52`, UPDATE in gold `#B0740E`, DELETE in red `#CC0000`).

4. **Search TM (`SearchPage.tsx`)**:
   - Added canonical `TYPE` as the leading column in the search results datasheet table (`TYPE`, `CLIENT CODE`, `CLIENT NAME`, `CASE NUMBER`...).
   - Added `TYPE` (`VALID_TYPES`) and `AGENT` (`listAgents`) dropdown filter controls to search filters.
   - Aligned `STAGE_BADGE` tokens to brand palette (`STAGE 2`: `#B0740E`, `STAGE 3`: `#6C1C1F`).
   - Aligned action buttons and focus rings to brand maroon (`#6C1C1F`).

5. **Database Page Consistency (`DatabasePage.tsx`)**:
   - Added `AGENT` column to table headers and rows, ensuring datasheet consistency across Database and Search pages.
   - Updated table `colSpan` to 15 across loading, error, and empty states.
   - Verified `formatWorkflowLabel` usage on sub-status and in CSV export.

6. **Record UX Consolidation (`RecordModal.tsx` + `RecordView.tsx` + `StageDocumentsSection.tsx`)**:
   - Aligned `RecordModal.tsx` Stage 2 payment banner and warning borders to brand gold (`#B0740E`) and maroon (`#6C1C1F`).
   - Standardized distinct headers: `"Document Status (TM Forms)"` for registry-matching checks and `"Stage Documents"` for file attachments.
   - Aligned `STAGE_COLORS` in `StageDocumentsSection.tsx` to brand palette.

7. **Agents / Assigned Operations (`AgentsPage.tsx`)**:
   - Aligned financial table headers: `TOTAL PAID` → `TOTAL RECEIVED` and `BALANCE DUE` → `BALANCE`.
   - Made fee table case numbers clickable with direct link to `/record/:trademarkId`.

8. **Tests & Verification (`api.test.ts`)**:
   - Added comprehensive tests verifying `getWorkflowReminders` (hard-capped at 4, stage-specific activation, safe empty stage fallback).
   - Added tests verifying `listAuditLogs` extracts `applicationNumber`, `applicationName`, `clientCode`, and `caseType`.
   - `pnpm test --run` → 40/40 tests passed across all test files.
   - `pnpm typecheck` → 0 errors.
   - `pnpm build` → production bundle compiled successfully (Vite v7.3.6, dist generated).

## 2026-09-22 — Batch 15: Security, Documents, Data Integrity & Reliability

### What was completed

1. **API Validation & Data Integrity (`api.ts`)**:
   - Hardened `createTrademark` and `updateTrademark` with workflow stage and sub-stage validation against canonical `STAGES` and `STATUS_WORKFLOW`.
   - Enforced string trimming on agent names and cities in `assignStage2Agent` and `updateTrademarkAgent` with non-empty checks.
   - Preserved optimistic concurrency version control and Stage 2 payment gate checks intact.

2. **Role-Gating & UI Security (`DatabasePage.tsx`, `AgentsPage.tsx`, `PublicationPipelinePage.tsx`, `RecordModal.tsx`)**:
   - Added `getStaffRole()` role checks across all UI entry points.
   - Restricted write actions for `viewer` role users: disabled `ADD RECORD`, `NEW AGENT`, agent editing, fee deletion, and match engine execution, displaying role tooltips/messages.
   - Added read-only alert banner to `RecordModal.tsx` when viewed by `viewer` role users and disabled save/delete mutations.

3. **User Action Safety & Confirmations**:
   - Added confirmation dialogs before fee deletion in `AgentsPage.tsx`.

4. **Tests & Build Verification**:
   - Added focused unit tests in `api.test.ts` for Batch 15 stage/sub-stage validation and agent string trimming/validation.
   - `pnpm test` → 43/43 tests passed across all test files.
   - `pnpm typecheck` → passed (0 errors).
   - `pnpm build` → passed; production bundle compiled successfully in 25.16s.

## 2026-09-22 — Batch 16: Final V2 Release Readiness & End-to-End Verification

### Verification Summary

Distinction of verification levels across all subsystems:

#### 1. VERIFIED LOCALLY (Automated Testing & Builds)
- **Unit & Integration Tests**: `pnpm test --run` → 43/43 tests passing (2 test files: `api.test.ts`, `registryImport.test.ts`).
- **Static Type Safety**: `pnpm typecheck` (`tsc -p tsconfig.json --noEmit`) → 0 errors.
- **Production Bundle**: `pnpm build` (`vite build`) → compiled cleanly with Vite v7.3.6; dist assets generated.
- **Publication Pipeline Integration**: Added direct record links (`/record/:id`) to both the datasheet table actions and detail modal in `PublicationPipelinePage.tsx`.
- **Workflow State Machines**: Canonical mapping (`STATUS_WORKFLOW`, `WORKFLOW_DISPLAY_LABELS`, `STAGE_DOCUMENT_WORKFLOW`) verified for all 4 stages, sub-stages, and `STOPPED` state.
- **Payment Gate Enforcement**: Unit tested that Stage 2 cannot bypass `stage2_paid = true` constraint across `createTrademark`, `updateTrademark`, `updateTrademarkStatus`, `updateTrademarkAgent`, and `assignStage2Agent`.
- **Reminders Engine**: Verified hard-cap of 4 informational reminders (1: Filing & Documentation, 2: Agent & Assignment, 3: Publication & Opposition, 4: Registration & Certificate), stage-adaptive, no invented statutory deadlines.
- **Audit Logs vs Workflow History**: Verified that `audit_logs` (8 columns with record ID links) and `trademark_workflow_history` (event-driven status transitions) remain completely separate.
- **Documentation Synchronization**: Updated `DEV_NOTES.md` and `SMOKE_TEST_CHECKLIST.md` with full V2 components and operational workflows.

#### 2. VERIFIED BY CODE / MIGRATION INSPECTION
- **RLS & Security Policies**:
  - `public.trademarks`: RLS enabled; SELECT for authenticated staff; INSERT/UPDATE restricted to `editor` and `admin`; DELETE restricted to `admin`.
  - `public.clients`: RLS enabled; SELECT for authenticated staff; INSERT/UPDATE/DELETE restricted to `editor` and `admin`.
  - `public.agents`: RLS enabled; SELECT for authenticated staff; INSERT/UPDATE/DELETE restricted to `editor` and `admin`.
  - `public.agent_fees`: RLS enabled; SELECT for authenticated staff; INSERT/UPDATE/DELETE restricted to `editor` and `admin`.
  - `public.trademark_files`: RLS enabled; SELECT for authenticated staff; INSERT/UPDATE/DELETE restricted to `editor` and `admin`.
  - `public.audit_logs`: RLS enabled; SELECT for authenticated staff; mutations controlled solely by security-definer trigger `trademarks_audit_and_sync()`.
  - `public.trademark_workflow_history`: RLS enabled; SELECT for authenticated staff; mutations controlled solely by security-definer trigger `trademarks_workflow_history_trigger()`.
  - `public.sheet_sync_outbox`: RLS enabled; managed by triggers and Edge Function.
  - `public.form_registry` & `public.journal_registry`: RLS enabled; SELECT for authenticated staff; mutations restricted to `admin`.
  - Match Engine RPCs (`run_journal_match`, `run_form_match`): Security definer with explicit `current_brandex_role() IN ('editor', 'admin')` authorization check.
- **Storage & Private Documents**:
  - `trademark-files` bucket configured with `public = false`, 10MB file size limit.
  - Storage policies: SELECT for authenticated staff; INSERT/UPDATE for `editor` and `admin`; DELETE for `admin`.
  - Application code uses `createSignedUrl` / `createSignedUrls` (1-hour expiry); no permanent public URLs are exposed.
  - Deterministic paths `{trademarkId}/{stage}/{uuid}.{ext}` with automatic orphan storage cleanup on DB insert failure.
- **Secrets & Configuration**:
  - Code inspection confirms only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are used in client bundle.
  - No `SUPABASE_SERVICE_ROLE_KEY` or Apps Script secrets are referenced as `VITE_*` variables.
- **Print Layout**:
  - A4 portrait (`margin: 10mm 12mm`), clean black ink on white background.
  - Navigation/sidebar chrome hidden (`print:hidden`).
  - Professional Brandex letterhead, full application details, reminders, office notes, and formal CEO Signature / Stamp block (no fake signature).
  - Page break protection applied (`print-avoid-break`).

#### 3. MANUAL PRODUCTION CHECK REQUIRED
- **Live Supabase RLS Enforcement**: Code/migration inspection completed; live Supabase policy verification remains manual (requires authenticated live sessions).
- **Live Storage Signed URL Access**: Bucket configuration and signed URL generation verified in code; live Supabase storage download test remains manual.
- **Live Authenticated Role Smoke Test**: Verification of Viewer, Editor, and Admin workflows on `https://brandexsheet.vercel.app` requires staff credentials.
- **Vercel Dashboard Secret Inventory**: Confirmation that `SUPABASE_SERVICE_ROLE_KEY` is absent from Vercel environment variables requires Vercel dashboard access.
- **Publication Opposition Legal Confirmation**: Current 60-day calendar calculation from journal date is documented; legal practice-owner confirmation regarding Trade Marks Ordinance 2001 Section 28 (extension rules via TM-44) remains a business/legal decision.

### Release Decision
**V2 FREEZE RECOMMENDED** — All code-level implementations, RLS policies, migrations, payment gates, document storage protections, reminders, print styles, and test sequences have passed with zero errors.



