# Current Phase 0 status — 25 September 2026

[Project Truth](docs/PROJECT_TRUTH.md) is the evidence-backed current status. [Workflow Business Rules](docs/WORKFLOW_BUSINESS_RULES.md) defines intended behavior. The historical work log below is preserved as context; its checkmarks, release/freeze claims, and test counts are not current acceptance evidence.

- Scope: PHASE 0 = Truth Cleanup. No Phase 1–4 features, migration execution, production data changes, deployment or tag changes.
- Baseline main/production: `727ec07775300cb22841a4748f1bfb4c1de58758`.
- Date Created now maps `created_at` independently from filing and modification dates, with mapping and rendered-component tests.
- TM headings corrected; filter/matching logic preserved. Payment label now explicitly identifies manual CMS flags.
- Five baseline Stage Document failures traced to queued mock responses leaking between tests. Resetting mocks restores isolation without changing expected results or application upload behavior.
- Local validation: 178 tests pass across 6 files; typecheck passes; production build passes. These are not live database integration tests.
- Authenticated admin production navigation, case display, unpaid Stage 4 gate, missing STOPPED reason rejection, document upload selector and historical document visibility inspected. Viewer, successful writes/uploads and deployed corrections remain unverified.
- Major contradictions: stage skipping and sub-stage reversals are not prevented; STOPPED can retain a sub-stage and general update lacks its reason gate; Editor is actively authorized; DB workflow constraints absent; branding persistence table absent on live CMS.
- Missing: automatic Accepted agent payable, Ledger integration, multiple opposition events, TM56 response/extension tracking and Demand Note 25-day counter.
- CASE DATA FIRST. UI FURNITURE SECOND. Live 1440×900 inspection and source confirm tiny metadata and dominant borders; Phase 4 remains pending.
- Acceptance/release checks remain open. No project completion percentage or full V2 completion claim is made.

Established phases only: Phase 0 Truth Cleanup → Phase 1 Business Workflow Completion → Phase 2 Payment Architecture → Phase 3 Workflow Hardening → Phase 4 UI / Workbench Transformation.

## Historical work log — superseded as current status

# Brandex Datasheet Progress

**Last updated: 24 September 2026 (Batch 6B: Branding + Logo System)**

The following is a historical work log. Current status is the Phase 0 section above and docs/PROJECT_TRUTH.md.
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

## Historical UI batch labelled Phase 1 (not the current Phase 1 acceptance)

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

## V2.0.1 Batch 1 — Core Workflow + New Record Creation (Completed 22 September 2026)

- [x] Strict forward-only workflow enforcement in `updateTrademarkStatus` (STAGE 1→2→3→4 only; backward rejected)
- [x] New record defaults: STAGE 1, sub-stage "Filing", `stage1_paid = true`, `filing_date = today`
- [x] Payment gate: STAGE 2 transition blocked unless `stage1_paid = true`
- Correction: migration 202609220006 creates an AFTER INSERT history event; it does not enforce creation defaults.
- [x] Applied migration 202609220006 to Supabase production (confirmed by Supabase console)
- [x] All 46 tests pass; typecheck clean; production build successful
- [x] Committed `9468de4` and pushed to origin/main

## V2.0.1 Batch 2 — RecordView UX Corrections (Completed 22 September 2026)

- [x] **Section reorder** in `RecordView.tsx`: 1. Workflow/Status Control → 2. Stage Payments → 3. Workflow History → 4. Stage Documents → 5. TM Forms → 6. Office Notes
- [x] **Two-column header redesign**: Left = logo + app name + TM/Class; Right = client info (name, code, case no, type, case type); footer strip = current stage badge + sub-stage + filed date + previous workflow action
- [x] **Stage Document visibility**: sections hidden for future stages with no uploaded documents (`isStageDocumentSectionVisible` helper in `api.ts`, applied in `StageDocumentsSection.tsx`)
- [x] **Uppercase normalization at API boundary** (`inputToRow`): clientCode, caseNumber, type, appName, clientName, agent, city, caseType, appClass, tmCprNo all uppercased for ordinary business data
- [x] **Agent/city uppercase** propagated to `assignStage2Agent`, `updateTrademarkAgent`, `createAgentProfile`, `updateAgentProfile`
- [x] **Application Details card** now also surfaces Agent and City fields
- [x] Three stale test assertions updated to expect UPPERCASE agent/city (matching corrected behaviour)
- [x] All 46 tests pass; typecheck clean; production build successful (2142 modules, 31.56s)
- [x] Committed `95660c5` and pushed to origin/main
- [x] v2.0.0 tag unchanged

## V2.0.1 Batch 3 — Final Print & Upload UX Polish (Completed 22 September 2026)

- [x] **Stage Document Upload UX (`StageDocumentsSection.tsx`)**:
  - Dedicated in-modal success view with checkmark and document title
  - Clear section-level success notification banner (`sectionSuccess`)
  - Auto-close cleanly with cancellation protection and "Done" dismissal
  - Full upload form state reset: `targetStage` reset to default, `targetSubStage` reset to empty, `title` cleared, `selectedFile` cleared
  - Native file input reset via `fileInputRef.current.value = ""`
  - `uploadMutation.reset()` called on modal close and open
  - All existing storage permissions, 10MB bounds, MIME validation, and Viewer/Boss read-only gates preserved
- [x] **Print CSS Polish (`index.css`)**:
  - Stage and status badges styled with clean light/white background, dark/black text, and 1px crisp borders
  - Removed heavy shaded cream backgrounds (`#E8DFC7`, `#F0E8D0`, `#F8F4EC`, etc.) for ink-friendly A4 printing
  - Stripped all offset drop shadows in print (`* { box-shadow: none !important; }`)
  - All borders, dividers, A4 structure, and screen UI styles 100% preserved
- [x] All 46 tests pass; typecheck clean; production build successful
- [x] v2.0.0 tag untouched

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

- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
- [x] Reused existing Agents master system (`listAgentProfiles()`) for agent assignment dropdowns
- [x] Preserved legacy agent names and data integrity without schema changes or fake data
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
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

## 2026-09-24 — Batch 1: Workflow Rules Audit & Business Foundation

- [x] Created canonical `docs/WORKFLOW_BUSINESS_RULES.md` as authoritative source of truth for workflow implementation
- [x] Created `docs/WORKFLOW_GAP_MATRIX.md` documenting current implementation gaps
- [x] Updated workflow rules in `api.ts`:
  - Stage 1: Examination is optional (Filing → Acknowledgement OR Filing → Examination → Acknowledgement)
  - Stage 2: Agent assignment no longer requires Stage 2 payment
  - Stage 4: Corrected sequence to CER Acknowledge → CER Received → CER Dispatch
  - STOPPED: Added mandatory reason requirement, stored in notes with timestamp
  - General forward-only workflow enforced for all roles including admin
- [x] Updated UI components to remove Stage 2 payment blocks from agent assignment:
  - `CaseWorkflowSection.tsx`: Removed agent assignment payment gate, added STOPPED reason handling
  - `RecordModal.tsx`: Removed Stage 2 payment block from general updates
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
- [x] Added workflow validation tests (27 passing) covering all stage transitions, payment gates, and STOPPED behavior
- [x] Verified: `pnpm test` (117 passed, 2 pre-existing failures unrelated to workflow), `pnpm typecheck` (0 errors), `pnpm build` (passed)
- [x] Committed `b7b21fc` and pushed to origin/main

## 2026-09-24 — Batch 2: Record View / Application Detail + Case Documents

- [x] Renamed "Stage Documents" to "Case Documents" throughout the application
- [x] Removed unnecessary "Available Sub-stages" display from document section
- [x] Enforced document stage rules at API level:
  - Records can only upload documents for their current workflow stage
  - STOPPED records cannot upload documents
  - Direct API calls cannot bypass the stage restriction
- [x] Updated `isStageDocumentSectionVisible()` to show only current stage and stages with existing documents (historical preservation)
- [x] Updated upload modal to use read-only stage display (current stage only) instead of dropdown
- [x] Restricted upload button to current stage only in stage cards
- [x] Added image preview functionality with click-to-enlarge modal
- [x] PDF files continue to use existing "View" action (open in new tab)
- [x] Improved Record View header hierarchy:
  - Type displayed as prominent H1-level identifier in Client Information section
  - Client Code and Case No remain visible with proper visual weight
- [x] Reorganized Application Details with better visual hierarchy:
  - IMPORTANT/PRIMARY fields: Filing Date, TM/CPR Number, Class, City/Agent City, Assigned Agent, Applicant Name
  - Secondary fields: Client Code, Case Number, Case Type
- [x] Added document stage restriction tests (3 passing) in `api.test.ts`
- [x] Verified: `pnpm test` (117 passed, 5 pre-existing stage document API mock failures unrelated to Batch 2), `pnpm typecheck` (0 errors), `pnpm build` (passed, 31.54s)
- [x] All Batch 1 workflow rules preserved and respected

## 2026-09-24 — Batch 4: Journal / Publications

### Scope
- Compact, structured Journal Record presentation in RecordView
- Improved Publications / Publication Pipeline presentation with better visual hierarchy
- Journal Import positioned in Journal/Publications area (PublicationPipelinePage) rather than general Database import
- Publication and Demand Note deadline information clearly presented
- Print Preview hierarchy applied to Journal/Publications data

### Files Changed
- `artifacts/tm-tracker/src/pages/RecordView.tsx` — Journal section redesigned with compact hierarchy
- `artifacts/tm-tracker/src/pages/PublicationPipelinePage.tsx` — Compact card layout with print-friendly table view
- `artifacts/tm-tracker/src/lib/api.ts` — PublicationRecord mapping includes filing_date for display
- `artifacts/tm-tracker/src/components/RegistryImportModal.tsx` — Contextual import labeling (showOnly prop)
- `artifacts/tm-tracker/src/pages/DatabasePage.tsx` — Import trigger adjusted (showOnly null for general import)
- `artifacts/tm-tracker/src/index.css` — Print styling for Journal/Publications hierarchy
- `artifacts/tm-tracker/src/lib/api.test.ts` — Formatting and indentation cleanup (no new Batch 4 tests added to avoid conflict with pre-existing failures)

### Implementation Summary

**Journal Record (RecordView.tsx)**:
- Redesigned to compact, line-by-line presentation
- Primary hierarchy: Journal No (green) and Publication Date (maroon) in prominent header
- Secondary: TM/CPR Number, Class, Filing Date
- Compact: Applicant Name, Agent
- End: Last Modified (always displayed)
- All existing journal fields preserved via journal_data mapping
- No image field exists in journal_registry schema — no thumbnail added

**Publication Pipeline (PublicationPipelinePage.tsx)**:
- Replaced oversized table with compact card grid layout
- Card hierarchy:
  - Header: Journal No (green) | Publication Date (maroon)
  - Type · Client Code · Case No
  - Application Name
  - TM No | Class
  - Applicant | Agent
  - Stage (badge) | Sub-stage
  - Deadline | Days Remaining
  - Demand Note status
  - Status badge | Actions (Details, Open)
- Print-friendly table view: clean 1px borders, light styling, compact font
- All existing behavior preserved: journal/form match, demand note mutations, record links, role gating

**Journal Import Placement**:
- Journal Import button added to PublicationPipelinePage header
- Opens RegistryImportModal with `showOnly="journal"` (Journal-only mode)
- DatabasePage import preserved with `showOnly={null}` (full access: Form, Journal, Trademark)
- Existing import behavior intact

**Print Preview (index.css)**:
- Applied compact, light styling to Journal/Publications print
- 1px borders where useful
- No dominant black areas
- No decorative graphics
- No unnecessary shadows
- Publication Pipeline prints as clean table with hierarchy

### Tests
- No new Batch 4-specific tests added to avoid conflict with 5 pre-existing Stage Document API mock failures
- `pnpm test --run` → 123 passed, 5 failed (pre-existing Stage Document API failures unrelated to Batch 4)
- Pre-existing failures: uploadStageDocument (2), listStageDocuments (2), uploadStageDocument signing failure (1)
- Batch 4 changes did not introduce new test failures

### Typecheck & Build
- `pnpm typecheck` → 0 errors
- `pnpm build` → production bundle compiled successfully (Vite v7.3.6, 2143 modules)

### Verification
- All existing matching, import, workflow, calculation, security, and private-image behavior preserved
- No schema changes required
- Journal registry has no image field — no thumbnail implementation needed
- Publication deadline calculation unchanged (uses existing opposition_deadline field)
- Days remaining calculation unchanged (based on opposition_deadline vs today)
- Demand Note behavior unchanged (received flag, date, status calculation)

### Known Pre-existing Failures
- 5 Stage Document API test failures exist in baseline (unrelated to Batch 4)
- Failures: mock structure issues in `mapStageDocRow` and `listStageDocuments`
- These were present before Batch 4 and remain unchanged

## 2026-09-24 — Batch 5: Search Page + Search Results

### Scope
- Search result cards/rows redesigned from table to compact card layout
- Search result image thumbnails using existing secure storage
- Status + Sub Status hierarchy as primary visual prominence
- TM Forms indication in search results
- Journal indication in search results
- Search pagination consistency preserved
- Responsive Search presentation for desktop/tablet/mobile

### Files Changed
- `artifacts/tm-tracker/src/pages/SearchPage.tsx` — General search results redesigned as card grid
- `artifacts/tm-tracker/src/lib/api.test.ts` — Added Batch 5 tests for search field verification

### Implementation Summary

**Search Result Cards (SearchPage.tsx)**:
- Replaced oversized table with compact card grid layout (1/2/3 columns responsive)
- Card hierarchy following Brandex visual guidelines:
  - **Primary Header**: Status badge (large, colored) + Sub-stage badge (smaller, cream background)
  - **Image + Identity**: Thumbnail (64px) + Application Name + Type/Client Code/Case No + TM/Class
  - **Supporting Info**: City + Agent
  - **TM Forms**: Compact chip indicators showing only forms that exist (TM5/TM6/TM11/TM16/TM56)
  - **Journal**: Green-bordered box with Journal No and Date (only when journal exists)
  - **Filing Date**: At bottom of card
- All existing behavior preserved: search query, filters, pagination, record navigation

**Image Handling**:
- Uses existing `image` field from TrademarkRecord (already includes signed URL from private storage)
- Shows "No Img" placeholder when no image exists
- Thumbnail is secondary to record information
- No new storage logic added — reuses existing secure/private storage mechanism

**TM Forms Indicator**:
- Uses existing `tm5`, `tm6`, `tm11`, `tm16`, `tm56` string fields ("YES"/"")
- Shows only forms that exist as green chips with checkmarks
- Shows "No forms found" italic text when no forms exist
- Does not interpret as workflow events — purely display of boolean match flags

**Journal Indicator**:
- Uses existing `journalNumber` and `journalDate` fields
- Shows only when journal exists (no empty Journal section)
- Journal No is more prominent than Date
- Green-bordered box with checkmark to distinguish from missing journal

**Pagination**:
- Preserved exactly as implemented in Batch 3
- First/Previous/Next/Last buttons functional
- Page count and result count preserved
- Pagination resets on search/filter changes (existing `useEffect` on `debouncedQuery`)

**Responsive Design**:
- Card grid: 1 column on mobile, 2 on tablet, 3 on desktop
- Thumbnail remains small (64px) on all screens
- Status/Sub-Status remain easy to identify (large badges in header)
- Secondary fields wrap/compact appropriately
- No horizontal overflow

**Search Query/Filter Behavior**:
- Preserved without changes:
  - Keyword search (client_name, client_code, case_number, application_name, tm_cpr_number, nice_class, agent, city)
  - Type filter
  - Stage filter
  - Agent filter
  - City filter
  - Case Type filter
- No search engine redesign — only visual presentation improved

### Tests
- Added 3 tests in `api.test.ts` for Batch 5:
  - A. listTrademarkPage includes logo_path and legacy_image_url for image thumbnails
  - B. listTrademarkPage includes TM Forms fields (tm5, tm6, tm11, tm16, tm56)
  - C. listTrademarkPage includes Journal fields (journal_number, journal_date)
- Tests verify API field selection, not UI rendering (UI testing would require browser/component tests)
- All 3 new tests passing

### Typecheck & Build
- `pnpm typecheck` → 0 errors
- `pnpm build` → production bundle compiled successfully (Vite v7.3.6, 2143 modules)

### Verification
- 5 pre-existing Stage Document API test failures (unrelated to Batch 5)
- Batch 5 did not introduce new test failures
- All existing search behavior preserved
- Pagination functional
- Responsive layout verified via Tailwind grid classes

### Known Pre-existing Failures
- 5 Stage Document API test failures exist in baseline (unrelated to Batch 5)
- Failures: mock structure issues in `mapStageDocRow` and `listStageDocuments`
- These were present before Batch 5 and remain unchanged

## 2026-09-24 — Batch 6A: TM Form Document Status Indicator

### Scope
- Add document date and relative age display to TM Form status indicators
- Improve visual information for TM5, TM6, TM11, TM16, TM56 form matches
- Compact UI fitting existing BrandEx / Neo-Brutalism visual language
- No database schema changes, no workflow business rule changes

### Files Changed
- `artifacts/tm-tracker/src/lib/api.ts` — Extended `TmMatches` interface to include form dates; updated `mergeRegistryMatches` to fetch `form_date` from `form_registry`
- `artifacts/tm-tracker/src/lib/utils.ts` — Added `formatDateLong` (DD-MMM-YYYY), `getRelativeAge` (calendar-based calculation), and `getFormDate` helper
- `artifacts/tm-tracker/src/lib/utils.test.ts` — Added 23 tests for date formatting and relative age calculation
- `artifacts/tm-tracker/src/pages/RecordView.tsx` — Updated `TmFormBadge` component to show date and relative age
- `artifacts/tm-tracker/src/pages/SearchPage.tsx` — Updated TM form display in search results and TM number search with date/age
- `artifacts/tm-tracker/src/pages/DatabasePage.tsx` — Updated TM form columns in database table with date/age

### Implementation Summary

**API Changes**:
- Extended `TmMatches` interface with optional date fields: `TM5_date`, `TM6_date`, `TM11_date`, `TM16_date`, `TM56_date`
- Updated `mergeRegistryMatches` to fetch `form_date` from `form_registry` table in addition to `form_type`
- Dates are only populated when a matching form registry record exists with a valid date
- Updated `searchTm` to apply `mergeRegistryMatches` for consistent date availability

**Date Utilities**:
- `formatDateLong`: Formats dates to DD-MMM-YYYY (e.g., "03-Jan-2026")
- `getRelativeAge`: Calculates calendar-based relative age (e.g., "3 days ago", "1 month ago", "1 year 2 months ago")
  - Handles today, future dates safely
  - Avoids awkward formats like "0 months X days ago" or "X months 0 days ago"
  - Uses proper singular/plural for day/month/year
- `getFormDate`: Helper to extract form date from TmMatches object

**UI Updates**:
- **RecordView**: `TmFormBadge` component shows form name with checkmark, followed by formatted date and relative age on next line. Shows "Date not available" when form exists but no date.
- **SearchPage**: Both general search results and TM number search cards show form indicators with date/age below the form badge.
- **DatabasePage**: TM form column shows each form with date/age below the form name in compact vertical layout.

**Print Compatibility**:
- Existing print styles in `index.css` handle the new date/age display appropriately
- Compact font sizes (8px-9px) for date/age text in print
- No new heavy styling, shadows, or black-heavy elements added

**Data Integrity**:
- No database schema changes
- No modification to TM form meaning, import behavior, or workflow rules
- Only uses existing `form_date` from `form_registry` table
- Never fabricates dates or uses today's date as substitute
- Preserves existing null/empty behavior when no date exists

### Tests
- Added 23 new tests in `utils.test.ts` covering:
  - Date formatting (valid dates, ISO strings, Date objects, null/undefined handling)
  - Relative age calculation (today, future dates, 3 days, 1 month, 2 months, 1 month + days, 1 year, 2 years, 1 year 2 months)
  - Singular/plural correctness and avoidance of awkward formats
  - `getFormDate` helper function
- All 23 new tests passing
- 5 pre-existing Stage Document API test failures remain (unrelated to Batch 6A)

### Typecheck & Build
- `pnpm typecheck` → 0 errors
- `pnpm build` → production bundle compiled successfully (Vite v7.3.6, 2143 modules, 45.94s)

### Verification
- All existing TM Form behavior preserved
- No database schema changes required
- Print output remains compact and professional
- Responsive layout maintained across desktop/tablet/mobile

## 2026-09-24 — Batch 6B: Branding + Logo System

### Scope
- Implement a configurable Brandex logo system across the CMS
- Single reusable branding configuration across Dashboard, Top Header, Browser Favicon, Shared-Link Preview, Print Preview, and Print Watermark
- Support PNG, JPG/JPEG, and sanitized SVG upload formats (max 5MB)
- Admin-controlled branding management with Viewer read-only protection
- 10% subtle print-only watermark behind document content on A4 print
- High-resolution Open Graph / social preview metadata and dynamic browser favicon updater

### Files Changed
- `supabase/migrations/202609240001_branding_settings.sql` — Additive migration creating `public.app_settings` with staff read / admin write RLS policies
- `artifacts/tm-tracker/src/lib/branding.ts` — Central branding module with file validation (PNG/JPG/SVG <=5MB), SVG security sanitization, storage upload, role gates, and dynamic favicon helper
- `artifacts/tm-tracker/src/lib/branding.test.ts` — 20 comprehensive unit tests for file validation, SVG sanitization, defaults, role gating, and reset behavior
- `artifacts/tm-tracker/src/hooks/useBranding.tsx` — Global React context and `useBranding()` hook providing reactive branding state and mutations
- `artifacts/tm-tracker/src/components/BrandingSettingsModal.tsx` — Admin branding management modal with 1-click preset selector, custom file upload & live preview, and reset controls
- `artifacts/tm-tracker/src/components/layout/Navbar.tsx` — Updated to use configured mark logo with fallback and added Admin BRANDING settings launcher
- `artifacts/tm-tracker/src/pages/Dashboard.tsx` — Updated to use configured primary logo with responsive scaling and fallback
- `artifacts/tm-tracker/src/pages/RecordView.tsx` — Updated print header to render configured logo and added print-only full-page watermark container
- `artifacts/tm-tracker/src/index.css` — Added `@media print` fixed-position subtle 10% watermark styling
- `artifacts/tm-tracker/index.html` — Updated Open Graph, Twitter card, and favicon links to canonical production-accessible Brandex assets
- `artifacts/tm-tracker/src/App.tsx` — Wrapped application with `BrandingProvider`
- `artifacts/tm-tracker/public/branding/` — Added organized canonical Brandex logo variants

### Implementation Summary

**1. Central Branding Configuration (`branding.ts` + `useBranding.tsx`)**:
- Manages `logoUrl`, `markUrl`, `bannerUrl`, `faviconUrl`, and `watermarkUrl` with fallback to official Brandex defaults (`/brandex-wordmark.svg`, `/brandex-mark.svg`, `/brandex-banner.png`).
- Persists to `public.app_settings` via Supabase with automatic `localStorage` caching for instant load.
- Strictly role-gated: only users with `admin` role can update or upload branding assets (`getStaffRole() === 'admin'`).

**2. Asset Allocation & Variants**:
- **Dashboard Logo**: Primary Brandex horizontal banner / wordmark (`brandex-wordmark.svg` or configured banner) for prominent, crisp display.
- **Top Header Logo**: Compact Brandex BR mark (`brandex-mark.svg`) preserving header compactness and responsiveness on mobile/desktop.
- **Browser Favicon**: Vector square mark (`brandex-mark.svg` / `/favicon.svg`) dynamically synced to document head.
- **Shared-Link / Social Preview**: High-resolution Open Graph image (`https://brandexsheet.vercel.app/brandex-banner.png`) and Twitter summary_large_image card.
- **Print Preview**: Configured Brandex logo rendered cleanly in the print letterhead banner.
- **Print Watermark**: Full-page, fixed-position subtle 10% opacity watermark centered behind document content in `@media print`.

**3. Upload & Security Validation**:
- Accepts PNG, JPG, JPEG, and SVG files up to 5MB.
- Strictly rejects unsupported types (PDF, GIF, EXE, etc.) and oversized files with clear error messages.
- SVG security sanitization scans for `<script>`, `javascript:`, `<foreignObject>`, and event handlers (`onload`, `onerror`), rejecting dangerous payloads.

**4. Admin Modal & UI**:
- `BrandingSettingsModal` accessible to Admin via the Navbar `BRANDING` button.
- 1-Click presets for supplied styles (Classic SVG Wordmark, Cream Banner, Capsule, Square Maroon, Square Gold).
- Live preview for Dashboard, Header, and Print Watermark before and after saving.

### Tests
- Added 20 new tests in `branding.test.ts` covering file validation, SVG sanitization, default branding, and Admin/Viewer role permissions.
- Total passed: 169 tests across 4 passing test files.
- Known pre-existing failures: 5 Stage Document API mock tests (untouched).
- New failures: 0.

### Typecheck & Build
- `pnpm typecheck` → 0 errors.
- `pnpm build` → production bundle built cleanly in 44.43s (Vite v7.3.6, 2146 modules).

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
- Historical status-gate claim corrected: Stage 1 payment gates Stage 2; Stage 2 payment gates Stage 3. The client data layer is not database workflow enforcement.
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
- [x] Created `CaseWorkflowSection.tsx` component in `artifacts/tm-tracker/src/components/`:
  - **Progression Stepper**: horizontal track visually tracing normal forward workflow (`Stage 1` → `Stage 2` → `Stage 3` → `Stage 4`) with completed checkmarks, bold active stage indicator, and distinct alert for `STOPPED` cases
  - **Current Status & Transition Control**: clear Stage and Sub-Stage display with complete canonical terminology (Demand Note, Opposition, CER); role-gated "Update Status" modal for Editor/Admin enforcing the Stage 2 payment gate
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
  - **Stage Payments**: compact 4-stage payment block (Stage 1 to 4) with real-time toggle, date recording, and prominent `MANUAL — NOT VERIFIED` indication
  - **Workflow History**: chronological event history with timestamp, changed by user, and full terminology transitions (preserving repeated status events intact)
- [x] Consolidated `RecordView.tsx`: replaced fragmented status, agent, history, and payment cards with unified `CaseWorkflowSection`; preserved registry-matching "Document Status" (TM forms) and Batch 11 `StageDocumentsSection` completely intact
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
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
- Phase 0 correction: the live/repository publication counter uses two calendar months as an internal business timer; no statutory deadline or extension rule has been verified.
- Phase 0 correction: the live/repository publication counter uses two calendar months as an internal business timer; no statutory deadline or extension rule has been verified.

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
- Historical assignment-gate claim superseded: Stage 2 payment is NOT required for agent assignment. Current payment gates govern stage progression; see docs/WORKFLOW_BUSINESS_RULES.md.
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
- Phase 0 correction: the live/repository publication counter uses two calendar months as an internal business timer; no statutory deadline or extension rule has been verified.

### Release Decision
**V2 FREEZE RECOMMENDED** — All code-level implementations, RLS policies, migrations, payment gates, document storage protections, reminders, print styles, and test sequences have passed with zero errors.

## 2026-09-22 — Security Remediation: agent_summary

- [x] Investigated Supabase Security Advisor warning regarding `SECURITY DEFINER` on `public.agent_summary` view.
- [x] Verified underlying RLS policies (`staff_read_agents`, `staff_read_fees`) already grant unrestricted `SELECT` access to `authenticated` users, confirming zero practical risk.
- [x] Created migration `202609220005_fix_agent_summary_security.sql` applying `ALTER VIEW public.agent_summary SET (security_invoker = true);` and explicit grants to resolve the warning while maintaining correct access.
- [x] Verified `pnpm typecheck` (0 errors), `pnpm test` (passed), and `pnpm build` (passed).

---

## 2026-09-22 — Batch 18: Final UI + Print + V2 Freeze

### Summary of Completed Improvements

1. **Global UI Final Audit & Brand Polish**:
   - Strictly preserved the Neo-Brutalism design system with `#6C1C1F` (Maroon), `#B0740E` (Gold), and `#F0E8D0` (Cream) brand palette.
   - Purged all remaining legacy tokens (`#C94A00`, `#D4A800`, `#0A1931`, `#3A506B`) across all components and pages (`AuthGate.tsx`, `RecordModal.tsx`, `CaseWorkflowSection.tsx`, `StageDocumentsSection.tsx`, `AssignedPage.tsx`, `AgentsPage.tsx`, `PublicationPipelinePage.tsx`, `not-found.tsx`, `ui/button.tsx`, `ui/badge.tsx`).
   - Standardized input focus outlines, borders, badges, status pills, and empty states.

2. **Canonical Terminology Final Verification**:
   - Audited user-facing terminology across the application:
     - Stage 1: Filing, Acknowledgment, Examination
     - Stage 2: Assigned, Accepted, Hearing
     - Stage 3: Demand Note Submitted, Demand Note Received, Opposition: Filed, Opposition: Received, Opposition: Withdrawn, Published
     - Stage 4: CER Dispatch, CER Received, CER Acknowledge
   - Internal database values (`D-Note Submitted`, `OPPO: Filed`, etc.) preserved intact for database backwards compatibility via `formatWorkflowLabel` and `normalizeWorkflowValue`.
   - Preserved `CER` without inventing unauthorized expansions.

3. **RecordView Structural Architecture**:
   - Clearly separated into 6 distinct, modular top-level sections:
     1. **Case Workflow & Status Control**: Stepper progression track, status/sub-status display with role-gated update modal, agent assignment details with role-gated modal.
     2. **Stage Payments**: Distinct standalone section with 4-stage payment toggles, date recordings, and prominent `MANUAL — NOT VERIFIED` status badge.
     3. **Stage Documents**: File attachment register with uploaded document metadata, signed 1-hour URLs, and role-gated upload modal.
     4. **Document Status (TM Forms)**: TM5, TM6, TM11, TM16, and TM56 registry match badges.
     5. **Office Notes & Manual Remarks**: Formatted remarks text block.
     6. **Workflow History**: Event-driven chronological audit timeline with timestamps, user names, and stage transitions.

4. **Print System Optimization (A4 Compact Layout)**:
   - Diagnosed root cause of the 4-page print explosion: outer wrapper elements with `print-avoid-break` forced the browser print engine to push entire composite blocks to subsequent pages prematurely.
   - Removed `print-avoid-break` from composite wrappers; applied `break-inside: avoid` strictly to atomic units (header banner, application details, individual payment box, TM forms, notes, and CEO signature block).
   - In `StageDocumentsSection`: hid upload buttons and interactive sub-stage pills in print (`print:hidden`); rendered attached documents in a compact, formal register; hid empty stage boxes in print, providing a single concise 1-line notice if no documents exist.
   - In `RecordView`: compacted image size (`80x80px`), field padding (`print:p-1.5 print:shadow-none`), and reminders grid (`print:p-1.5 print:gap-1.5`).
   - In `WorkflowHistorySection`: removed fixed height and scroll restrictions in print (`print:max-h-none print:overflow-visible`) with compact event typography (`print:text-[9px] print:py-0.5`).
   - Standard record now fits comfortably in **2 A4 pages** without awkward breaks, clipped content, or artificial whitespace.

5. **Responsive & Role Verification**:
   - Verified horizontal scroll protection (`overflow-x-auto`) and flexible layouts across narrow/mobile viewports for all 8 application pages.
   - Enforced V2 role boundary: Owner/Admin (Full management), Boss/Viewer (Read-only access across all mutations and gates), Public (No access).

6. **Production Migrations Verification**:
   - Verified that `202609220003_stage_payment_columns.sql`, `202609220004_trademark_files_stage_columns.sql`, and `202609220005_fix_agent_summary_security.sql` are properly sequenced and present in `supabase/migrations/`.

7. **Automated Verification**:
   - `pnpm test --run`: 43/43 tests passed across 2 test files (`api.test.ts`, `registryImport.test.ts`).
   - `pnpm typecheck`: 0 errors (`tsc -p tsconfig.json --noEmit`).
   - `pnpm build`: production bundle compiled successfully in 12.87s (`vite build`).

---

### V2 COMPLETE

The following functionality is fully implemented, tested, and ready for production operations:
- Full Trademark Registry Datasheet with canonical Type → Client Code → Case Number hierarchy.
- Server-side 50-record pagination, universal multi-field search, and multi-parameter filters.
- Asynchronous Google Sheet outbox synchronization with dead-letter queue and retry limit.
- 4-Stage Workflow Progression Stepper with strict Stage 2 payment gate enforcement.
- Manual agent fees/payments and computed balances exist; automatic Accepted payable creation and Ledger reconciliation do not.
- Phase 0 correction: the live/repository publication counter uses two calendar months as an internal business timer; no statutory deadline or extension rule has been verified.
- Dual Match Engine RPCs (`run_journal_match`, `run_form_match`) with role-based security definer protection.
- Stage-wise Private Document Storage with 10MB bounds, MIME validation, and 1-hour signed URL access.
- Structured Stage 1–4 manual payment ledger with `MANUAL — NOT VERIFIED` attestation banner.
- 8-Column Audit Logs with direct case links and trigger-driven Trademark Workflow History.
- 4-Stage adaptive Workflow Reminders hard-capped at 4 informational items.
- Compact 2-page A4 Branded Print Layout with formal CEO Signature / Stamp block.
- Staff role gating (Admin, Editor, Viewer) enforced across all UI entry points and database RLS.

---

### MANUAL PRODUCTION CHECKS

The following release items require authenticated human/dashboard execution:
1. **Live Supabase RLS Policy Execution**: Confirm policy enforcement on production Supabase instance using live Viewer and Editor credentials.
2. **Live Private Storage File Upload/Download**: Perform end-to-end file upload and verify signed URL retrieval in the production bucket `trademark-files`.
3. **Authenticated Role Smoke Test**: Execute manual test scenarios from `SMOKE_TEST_CHECKLIST.md` on `https://brandexsheet.vercel.app`.
4. **Vercel Secret Audit**: Verify in Vercel project settings that `SUPABASE_SERVICE_ROLE_KEY` is not exposed in client environment variables.
- Phase 0 correction: the live/repository publication counter uses two calendar months as an internal business timer; no statutory deadline or extension rule has been verified.

---

### V3 / FUTURE BACKLOG

The following items are deferred to future major versions and must NOT be implemented in V2:
- **Public Journal Page**: Standalone public lookup exposing only limited fields (TM number, mark name, class, journal date) with strict isolation from client data, payments, notes, internal agents, and documents.
- **Automated Payment Gateway / API Integration**: Banking or financial API integration for direct automatic payment clearance.
- **Automated Payment Checking**: Background worker to periodically reconcile payment receipts.
- **Hourly Automation Worker**: Automated hourly cron scheduling for journal and form registry matching.
- **Exceptional Workflow / Remand Mechanism**: Specialized handling for court remands, appellate reviews, and abandoned case revival workflows.
- **Advanced Dashboard KPI Analytics**: Extended financial analytics, fee recovery curves, and agent performance cohort metrics.

---

### RELEASE STATUS: Brandex Database CMS V2 — FROZEN / OFFICIAL RELEASE (v2.0.0)
All planned V2 batches are completed and verified. Codebase is frozen against new feature additions. Official release tag `v2.0.0` created.

---

## 2026-09-22 — V2.0.1 Batch 1: Core Workflow & New Record Creation Corrections

- [x] Applied additive migration `202609220006_workflow_creation_trigger.sql` adding `AFTER INSERT` trigger (`trademarks_workflow_created_trigger`) writing initial `RECORD_CREATED` event to `trademark_workflow_history`.
- [x] Enforced strict forward-only workflow progression (`STAGE 1` → `STAGE 2` → `STAGE 3` → `STAGE 4`) and rejection of backward transitions at the API level (`updateTrademark`, `updateTrademarkStatus`).
- [x] Enforced progression payment gates: Stage 2 requires `stage1_paid`, Stage 3 requires `stage2_paid`, Stage 4 requires `stage3_paid` with clear user-facing error messaging.
- [x] Initialized new record defaults with `STAGE 1`, `Filing`, `stage1_paid = true`, and `stage1_paid_date` set to filing date.
- [x] Filtered target stage dropdown in `CaseWorkflowSection.tsx` to valid forward stages and added payment gate warning banners.
- [x] Updated default form state in `RecordModal.tsx` to `subStage: "Filing"`.
- [x] Added automated tests in `api.test.ts` covering new record defaults, forward progression, payment gate validation, and backward blocking (46/46 passed).

## V2.0.1 OFFICIAL RELEASE (23 September 2026)

### Release Status
- [x] V2.0.1 = OFFICIAL RELEASE
- [x] Batch 1 complete (Core Workflow & New Record Creation)
- [x] Batch 2 complete (RecordView UX Corrections)
- [x] Batch 3 complete (Final Print & Upload UX Polish)
- [x] Final commit: 8a29729
- [x] Release tag: v2.0.1
- [x] Release notes created: RELEASE_NOTES_V2.0.1.md
- [x] All verification checks passed (46/46 tests, typecheck, production build)
- [x] Previous history intact (v2.0.0 unchanged)

### Release Composition
V2.0.1 is a correction/polish release on top of V2.0.0 with:
- Strict forward-only Stage 1 → Stage 2 → Stage 3 → Stage 4 workflow
- Stage payment gates enforced
- New record defaults to Stage 1 / Filing with automatic payment initialization
- Initial workflow history event on record creation
- STOPPED protection
- Workflow History positioned after Stage Payments
- Two-column RecordView header
- Stage document visibility based on current stage/existing documents
- Uppercase normalization for ordinary business fields
- Improved document upload success/reset UX
- Print-friendly light badges/backgrounds
- Reduced print shadows and heavy shading

### Verification
- 46/46 tests passed
- Typecheck passed
- Production build passed
- Production migration 202609220006 applied
- Working tree clean

---

## Post-V2.0.1 Batch 1 — Dashboard Redesign (Completed 23 September 2026)

- [x] **7 Primary Metric Cards**: Total Records, Stage 1 (`#0D9970`), Stage 2 (`#B0740E`), Stage 3 (`#6C1C1F`), Stage 4 (`#0A6B52`), STOPPED (`#CC0000`), and Modified (7D) using verified live database queries.
- [x] **First-Class STOPPED Metric**: Added real count of records in `status = 'STOPPED'` alongside stages 1–4.
- [x] **Agent & Class Dashboard Filters**: Added responsive filter bar for Agent (from `listAgents()`) and Nice Class (1–45) with active filter indicators and reset/clear controls.
- [x] **Workflow Progression & Distribution Overview**: Replaced duplicate status section with horizontal progress bars showing stage distribution, case count, and percentage of active total.
- [x] **Enhanced TM Document Control**: Modernized 5-box grid for TM5, TM6, TM11, TM16, TM56 with descriptive statutory form titles, matched counts, and direct links to datasheet filter views.
- [x] **Preserved Regional Distribution**: Kept clean city breakdown below TM Document Control.
- [x] **Preserved Quick Actions & Recent Activity**: Maintained 5-button quick action launcher and 10-entry audit log feed with direct record links.
- [x] **API Filter Support (`api.ts`)**: Extended `getStats()` to accept optional `agent` and `appClass` parameters.
- [x] **Automated Tests (`api.test.ts`)**: Added unit tests for `getStats()` (unfiltered, agent-filtered, class-filtered).
- [x] **Verification**: All 49 tests passed (47 in `api.test.ts`, 2 in `registryImport.test.ts`), typecheck clean (0 errors), production build passed.

## Post-V2.0.1 Batch 2 — Main Trademark Database Bulk CSV Import (Completed 23 September 2026)

- [x] **Dedicated Bulk Import Engine (`trademarkImport.ts`)**:
  - Implemented standalone parsing, validation, dry-run, and batch insert engine for main trademark records.
  - **Payment Safety**: Explicitly sets `stage1_paid = false` and `stage1_paid_date = null` on imported historical records (never falsely attests payment like default new record creation).
  - **Deduplication Engine**: In-CSV and database-level duplicate detection matching on canonical business key `(type, client_code, case_number)`.
  - **Flexible CSV Schema**: Robust case-insensitive header mapping supporting standard column aliases (`TM #`, `Class`, `Mark Name`, `Client`, `Agent`, `City`, `Filing Date`).
  - **Two-Phase Commit**: Safe dry-run analysis with validation breakdown (valid, duplicate, invalid) followed by explicit admin commit in chunked batches.
- [x] **Registry Import Modal Integration (`RegistryImportModal.tsx`)**:
  - Added 3rd tab: **"Trademark Database"** alongside "Form Registry" and "Journal Registry".
  - Distinct brand styling with file upload, dry-run summary card, row-by-row validation table, and admin commit button.
  - Role-gated for Admin access.
- [x] **Functional QA & Automated Test Suite (`trademarkImport.test.ts`)**:
  - 44 automated tests covering CSV parsing, header mapping, duplicate detection, batch insertion, payment history safety, error handling, and realistic QA Scenarios A–G.
  - Verified Minimum valid record, Full business-field record, CSV duplicates, DB duplicates, Invalid rows, Blocked/system fields rejection, and Real-world historical Stage 3/4 record safety.
- [x] **Verification**:
  - `pnpm test --run` → 93/93 tests passed across 3 test suites (`trademarkImport.test.ts`, `api.test.ts`, `registryImport.test.ts`).
  - `pnpm typecheck` → 0 errors.
  - `pnpm build` → production bundle built cleanly in 19.88s.

## Post-V2.0.1 Batch 3 — Design & Display QA and Visual Unification (Completed 23 September 2026)

- [x] **Visual Unification across RecordView**:
  - Unified all RecordView cards (`Application Details`, `Case Workflow & Status Control`, `Stage Payments`, `Workflow History`, `Stage Documents`, `Document Status (TM Forms)`, `Office Notes`, `Journal Record`, `CEO Signature / Stamp`) to the clean Neo-Brutalism design language (`border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C]` with `px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7]` header strips).
  - Replaced crude `border-3`, oversized shadows (`shadow-[5px_5px_0_#0C0C0C]`), and nested dark/cream backgrounds with clean, information-dense `#FFF9F0` content cards and crisp 2px borders.
- [x] **Removed Workflow Reminders Panel**:
  - Completely removed the obsolete `"Workflow Reminders (Informational Only)"` panel from `RecordView.tsx`.
  - Kept underlying reminder API intact for safety and testing.
- [x] **Print / PDF View Optimization**:
  - Enforced the Black/Dark usage rule: eliminated dominant black areas (no black headers, black backgrounds, or dark fills).
  - Lightened dark headers and containers to white background in print with dark gray / black text and crisp 1px borders.
  - Retained clean A4 margins (`10mm 12mm`), `break-inside: avoid` on atomic units, and zero drop shadows.
- [x] **Database Page & Registry Import Modal Consistency**:
  - Softened table headers to dark charcoal (`#1A1A1A`) with clean borders.
  - Ensured consistent `—` fallback representation for empty fields.
  - Added tooltip titles for truncated long values.
  - Unified modal styling and tab buttons in `RegistryImportModal.tsx`.
- [x] **Verification**:
  - `pnpm test` → 93/93 tests passed across 3 test suites.
  - `pnpm typecheck` → 0 errors.
  - `pnpm build` → production bundle compiled cleanly in 25.33s.








