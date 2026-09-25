> Phase 0 audit snapshot. Later implementation is tracked at the top of Progress.md; this table records the audited baseline, not later fixes.

# Project Truth — Phase 0 verification

Verified 25 September 2026 against source, Git, mocked tests, live Supabase catalogs and authenticated admin UI.
Intended rules: [WORKFLOW_BUSINESS_RULES.md](WORKFLOW_BUSINESS_RULES.md).
This document supersedes historical completion/freeze claims; no percentage is assigned.

## Evidence standard

SOURCE VERIFIED means inspected implementation, not executed behavior.
TEST VERIFIED means the named automated check; mocked Supabase tests are not live RLS/integration tests.
FLOW VERIFIED means the specific browser interaction was exercised.
DOCUMENTED means requirements and limitations agree here and in the canonical rules.
A missing applicable layer prevents 🟢 DONE + VERIFIED.

## 1. Current Commit

Main, origin/main and the live Vercel production deployment were `727ec07775300cb22841a4748f1bfb4c1de58758`.
Vercel deployment `dpl_4Z1A8UczgopXyAmhFQzWwN9MJ36A` is READY and aliases
[production](https://brandexsheet.vercel.app).
GitHub metadata confirms the requested repository and default branch main.

Inspected history: Batch 2 `5a6e06c`, Batch 3 `58859e0`, Batch 4 `73b42d3`,
Batch 5 `45d751f`, Batch 6A `909b43b`, branding `727ec07`, and workflow `b7b21fc`.
Their subjects overstate several requirements. In particular `b7b21fc` corrected dictionaries,
not sub-stage enforcement or the active Editor model.

## 2. Working Tree

Fresh clone was clean on main. Phase 0 changes are local on `phase0-truth-cleanup`.
No commit, push, deployment, production mutation or migration execution was performed.
Existing tags v1.1.0, v2.0.0 and v2.0.1 were inspected and not modified.
Production still displays pre-correction headings, date mapping and payment-source wording.

## 3. Master Status Table

Paths below are relative to the repository. Application source prefix is `artifacts/tm-tracker/src/`.

| Requirement | Status | Source Evidence | Test Evidence | Flow Evidence | Notes |
|---|---|---|---|---|---|
| Stage 1 optional examination, no reversal | ❌ CONTRADICTED | lib/api.ts STATUS_WORKFLOW, updateTrademarkStatus | Existing named sub-stage tests pass same-stage strings, not sub-stages | Not exercised as a successful write | Dictionary permits both routes but no old sub-stage is fetched/validated |
| Sequential Stage 1→2→3→4 | ❌ CONTRADICTED | isValidStageTransition uses target >= source | A normalization test actually accepts 1→3 | Stage 3 dialog hides earlier stages | Stage skipping and incomplete-stage exits still possible |
| Stage payment gates | 🟡 PARTIAL | validatePaymentGate; local fields present in live DB | Payment rejection tests | Unpaid Stage 3 disables Stage 4 save | Browser-only; not financial verification |
| No Stage 2 payment prerequisite for assignment | 🟡 PARTIAL | assignStage2Agent/updateTrademarkAgent have no payment read | Assignment tests pass | Assignment dialog inspected on paid case; unpaid save not exercised | Stage eligibility itself is not enforced by these functions |
| Stage 2 alternative outcomes | ❌ CONTRADICTED | Membership only; no transition graph | Same-stage tests do not verify outcomes | Existing history includes Accepted→Hearing | No rule enforcing alternatives |
| Stage 3 normal sequence | ❌ CONTRADICTED | Dictionary starts with Submitted; no ordered validation | No adequate sequence tests | Published dialog offers every Stage 3 sub-stage | Publication metadata is separate from workflow state |
| Stage 4 exact sequence | ❌ CONTRADICTED | Correct dictionary, no previous sub-stage check | “rejects” tests assert same-stage true | Correct options displayed | Correct option order is not transition enforcement |
| STOPPED reason, terminal, no sub-stage | 🟡 PARTIAL | Dedicated status path appends reason/time; general update/create bypass reason; Case Stopped remains | Reason rejection/exit helper covered; persistence test is weak | Empty-reason save rejected; disabled sub-stage shows Case Stopped | No existing STOPPED case; terminal persistence flow not exercised |
| Two-month internal counter | 🟡 PARTIAL | SQL/live RPC use INTERVAL '2 months' | Pipeline mapping/countdown tests | Publication date + two calendar months displayed | Not 60 days; not a verified legal deadline; begins on journal match |
| Multiple opposition events | 🔴 NOT IMPLEMENTED | Only status text/history, no opposition entity | None | No event UI | History is not a structured multiple-opposition model |
| TM56 response/extension | 🔴 NOT IMPLEMENTED | Flag/date only | Registry/date helpers only | Matching badge only | Timer anchor needs clarification |
| Demand Note 25-day timer | 🔴 NOT IMPLEMENTED | No counter fields/function/UI | None | Absent from inspected publication view | Required trigger step is ambiguous |
| Automatic agent credit on Accepted | 🔴 NOT IMPLEMENTED | No fee creation in transition functions or live triggers | None | No write exercised | Manual fees are not automatic credits |
| Manual agent accounting | 🟡 PARTIAL | agents, agent_fees, agent_summary and UI | No complete live accounting test | Agent list and zero totals load | Database has no fee rows; payable reduction not flow verified |
| Actual Ledger integration | 🔴 NOT IMPLEMENTED | CMS writes local paid flags | Local mutation tests only | Production source label misleading | Label corrected locally, no integration added |
| Publication display model | 🟡 PARTIAL | PublicationPipelinePage, listPublicationPipeline | Mapping tests | Journal/date/stage/countdown/actions load | No thumbnail, six-digit formatter or class action buttons |
| Documents/current-stage/history | 🟡 PARTIAL | uploadStageDocument; StageDocumentsSection | Eight Stage Document tests now pass | Current-stage-only selector and historical Stage 1 file visible | Upload/download/expiry not end-to-end exercised; DB bypass remains |
| Viewer read-only/Admin+Viewer | ❌ CONTRADICTED | UI, RLS and RPCs actively authorize Editor | No live role-matrix tests | Admin only | One live Editor profile; no Viewer profile in snapshot |
| Private file security | 🟡 PARTIAL | Live bucket private, RLS enabled; 3600s document URLs | Signing/cleanup mocks | Signed VIEW link generated | MIME disagreement and role-only policies; not full security sign-off |
| Record creation/filing/modified dates | ⚠️ IMPLEMENTED BUT NOT VERIFIED | created_at mapping fixed; RecordView uses createdAt | Two mapping + two rendered-component cases | Original bug confirmed against DB | Corrected UI not deployed; Date Created still within journal block |
| TM heading and filters | 🟡 PARTIAL | All four display pages corrected; matching unchanged | RecordView heading test; existing filter tests | TM5 returns match, TM11 selects filter and empty result | Corrected heading not deployed |
| Branding | 🟡 PARTIAL | Assets/provider/settings/modal exist | 20 branding unit tests | Default brand visible | app_settings absent; snake_case save/camelCase load mismatch; fallback conceals failure |
| Data-first workbench | ❌ CONTRADICTED | 8–10px case metadata, nested borders/shadows | No readability acceptance tests | 1440×900 record/publication inspection | Phase 4 pending, not redesigned |
| Phase 0 test isolation correction | 🟢 DONE + VERIFIED | api.test.ts resetAllMocks | Baseline 5 failures; isolated 8 pass; corrected full suite 178 pass | Browser not applicable to test isolation | No assertions relaxed or upload implementation changed |
| Documentation reconciliation | 🟢 DONE + VERIFIED | Canonical rules, current truth, Progress, notices/checklist | Manual cross-document search/diff | Not applicable | Historical reports explicitly superseded; no overall product completion claim |

## 4. Phase 0 Changes Made

- `artifacts/tm-tracker/src/lib/api.ts`: carry database created_at separately into createdAt and include it in list columns.
- `artifacts/tm-tracker/src/pages/RecordView.tsx`: correct Date Created binding and TM heading.
- `artifacts/tm-tracker/src/pages/Dashboard.tsx`, `SearchPage.tsx`, `DatabasePage.tsx`: exact TM heading on applicable displays; query/filter/matching logic unchanged.
- `artifacts/tm-tracker/src/components/CaseWorkflowSection.tsx` and `artifacts/tm-tracker/src/pages/AssignedPage.tsx`: replace false Ledger-source labels with MANUAL CMS FLAGS — NOT LEDGER VERIFIED (reported before editing).
- `artifacts/tm-tracker/src/lib/api.test.ts`: reset queued mock implementations and add independent/missing creation timestamp regressions.
- `artifacts/tm-tracker/src/pages/RecordView.test.tsx`: render actual RecordView with mocked dependencies to verify dates and heading.
- `docs/WORKFLOW_BUSINESS_RULES.md`: reconcile intended rules and separate implementation limitations.
- `docs/WORKFLOW_GAP_MATRIX.md`, `docs/PROJECT_TRUTH.md`: current evidence and gaps without completion percentages.
- `Progress.md`: current Phase 0 status above explicitly historical log; correct stale assignment/timer/default/agent claims.
- `AGENTS.md`: replace instruction to retain three active roles with intended model and compatibility caveat.
- `WORKFLOW_V2_ARCHITECTURE_AUDIT.md`, `SUPABASE_SQL_DEEP_AUDIT.md`, `RELEASE_NOTES_V2.0.0.md`, `RELEASE_NOTES_V2.0.1.md`: historical notices, canonical pointers and targeted false rule corrections.
- `README.md`, `INSTALL.md`, `SECURITY.md`, `DEV_NOTES.md`, `CONTRIBUTING.md`: authority/roles/current architecture clarified.
- `SMOKE_TEST_CHECKLIST.md`: replace stale acceptance rules with current requirements and explicit remaining checks.

## 5. Important Gaps Still Remaining

### Workflow

No sub-stage transition validator, stage completion prerequisite or adjacency enforcement.
updateTrademark ignores a failed current-state lookup before updating; dedicated mutations lack
optimistic version checks. General create/update does not enforce STOPPED reason; same-stage STOPPED
edits and its nonempty sub-stage remain possible. Assignment functions do not enforce Stage 2 eligibility.
No Phase 1 behavior was changed.

### Agent

No automatic Accepted credit or assignment/rate event model.
Fee rows reference agents/trademarks by FK, but the case's assigned agent remains plain text
and counts use exact string matching. Existing manual amount_paid reduces the computed balance.

### Payments

No Ledger connector, shared ledger identifier mapping or verified payment read path.
Local new-record paid defaults are not receipts. Production's false Ledger label is corrected only locally.

### Publication/Opposition

One set of publication/demand-note fields and a flat sub-stage model. No independent multiple opposition events.
Publication cards omit images despite existing trademark logo storage, no required TM formatter/class actions.
Journal registry itself lacks an image column; that does not prove the thumbnail requirement is complete.
Pipeline DONE means demand_note_received, not full case completion.

### TM56/Timers

No response, extension or Demand Note 25-day timer. Calendar-month calculation verified in SQL,
but timer start/event semantics beyond existing journal matching need reconciliation.
No legal claims are approved by this audit.

### Roles/Security

Repository-wide Editor inventory:

| Location | Classification | Verified behavior |
|---|---|---|
| 202608280001 enum; registryImport getStaffRole type; DatabasePage role union | Compatibility plus active role plumbing | Values viewer/editor/admin; no conversion to Viewer |
| RecordView canEdit; StageDocumentsSection canUpload | Active authorization | Explicit editor OR admin |
| DatabasePage, RecordModal, AgentsPage, PublicationPipelinePage | Active authorization / unsafe unknown-role presentation | Non-viewer checks also admit null/loading state; actual writes depend on RLS |
| AssignedPage | Missing frontend role gate | Assignment UI does not consult staff role; Viewer writes should be stopped by DB, not UI |
| CaseWorkflowSection | Inherited authorization | Receives canEdit from RecordView, including Editor |
| 202608280001 RLS; 202609200002 agent policies | Active DB authorization | Editor writes on trademarks; ALL on clients/file metadata/agents/fees; storage upload/update |
| 202609220001 match RPCs | Active authorization | Explicit editor/admin check, confirmed live |
| 202609240001 branding comment | Read compatibility | Describes staff reads; writes admin-only in migration, table absent live |
| UI permission messages in DatabasePage, RecordModal, AgentsPage, PublicationPipelinePage | Active-role wording debt | Still say Editor/Admin; changing text alone would falsely describe current permissions |
| BrandingSettingsModal “editorial banner”; SQL “SQL Editor” | Not roles | Ordinary language/tool references |
| Historical audits/release logs | Documentation drift | Explicitly superseded; not instructions for new provisioning |

Most lib/api.ts mutations have no getStaffRole check; they call Supabase directly.
Registry import and branding have separate admin checks. There are no dedicated application
server workflow API routes in this Vite SPA. The sync Edge Function is not a workflow authorization service.
Live role counts: one admin, one editor, no viewer. No accounts or policies were altered.

### Documents

Stage/STOPPED checks are browser code, not table/storage policies.
Live bucket permits PNG/JPEG/WebP/PDF only; UI/API also advertise Word/Excel/text/GIF.
Branding advertises SVG but bucket rejects it. Document code does not validate every sub-stage
against the case. Stage can change between client check and upload. Actual upload/expiry testing remains open.

### UI/Workbench

**CASE DATA FIRST. UI FURNITURE SECOND.**

Representative source: RecordView Field labels (9px), TM dates (9px), journal labels (8px);
SearchPage TM ages (8px), metadata (10px); DatabasePage table (text-xs), modified/sub-status/date-age
(8–10px); PublicationPipelinePage labels (8px), agent/stage/actions (9px), TM/class/deadlines (10px);
CaseWorkflowSection progression captions (9px), sub-stage chips (10px); StageDocumentsSection
nested 2px frames and 2–4px shadows.

At 1440×900 publication navigation/header is prominent while one case card occupies about one-third
of available width with small data. Record View has an 896px max width, repeated card borders/shadows,
and workflow/history/documents requiring substantial scrolling. Stage is repeated, payment source was
misleading, and controls do not identify a reliably valid next action because workflow validation is incomplete.
Not every text-xs token is defective; evaluate actual case tasks in Phase 4 rather than globally replacing sizes.
No CSS/font/layout redesign was made. Exact TM heading length may widen the existing nowrap table.

### Database

Live catalog inspection: business tables have RLS; agent_summary has security_invoker=true.
No workflow stage/sub-stage/payment/STOPPED constraints or enforcing triggers.
History triggers log INSERT/UPDATE; metadata trigger increments version; audit/outbox trigger records writes.
trademarks.agent and client_code have no FK; agent_fees relationships do have FKs.
Private bucket, document metadata constraints and authenticated reads verified by catalog inspection.

Only four migrations are recorded through 202609120001, while later payment, agent, publication,
document and history objects exist. This is migration-history drift, not proof those objects are absent.
app_settings is actually absent. Do not replay all migrations blindly: many later policies/triggers already exist.
Snapshot: 7 cases, 13 file metadata rows, 4 agents, no fee rows. These are read-only counts, not an
import-history diagnosis. Historical “1,671 records” is not current inventory.

Branding also writes snake_case JSON but reads camelCase, masks DB failures with local cache,
persists expiring URLs, and falls back to getPublicUrl on a private bucket.
Existing branding was audited, not rebuilt or speculatively migrated.

### Documentation

Current authority is reconciled. Historical logs remain clearly labelled as superseded.
Old “rejects sub-stage reversal” test names do not prove those rules: they assert
isValidStageTransition with identical stage names and expect true. Existing assertions were not rewritten
to manufacture compliance. Test coverage needs proper requirement-based cases in Phase 1/3.
Dashboard workflow summaries also still describe obsolete ordering; retained as a reported UI truth gap
rather than expanding Phase 0 into broad wording/behavior work.

## 6. Tests

- pnpm install --frozen-lockfile: success, pnpm 11.24.0; lockfile unchanged.
- Baseline pnpm test: **169 passed, 5 failed, 174 total**, five files, Vitest 4.1.11.
- Isolation check: pnpm --filter @workspace/tm-tracker exec vitest run src/lib/api.test.ts -t 'Batch 9: Stage document API':
  **8 passed, 77 skipped**. This targeted run was diagnostic, not the final acceptance run.
- Final pnpm test: **178 passed, 0 failed, six files**, 12.62 seconds.
- Five baseline failures in lib/api.test.ts: upload mapping, orphan cleanup, signing failure fallback,
  list all documents, filtered list. Root cause: clearAllMocks preserved unused mockReturnValueOnce
  queues from preceding assignment/early-validation tests. Later tests consumed wrong row shapes.
  resetAllMocks removes that cross-test leakage. Assertions and production document implementation unchanged.
- Four added date regressions cover mapping, absent timestamps, actual rendered labels and no filing fallback.
- No live DB write/RLS integration suite or browser end-to-end suite exists in these commands.
  Existing tests still have coverage gaps; passing tests are not requirement completion.

## 7. Typecheck

pnpm typecheck → tsc -p tsconfig.json --noEmit: passed, zero errors.

## 8. Build

pnpm build → Vite production build: passed, 23.02 seconds.
Build validates bundling, not live credentials/schema compatibility. No deployment was made.

## 9. Git Diff Summary

Only the files listed in section 4 were changed/added. No migration, dependency, lockfile,
workflow behavior, historical tag or unrelated commit was changed.
Final git diff --check passed. The Phase 0 handoff includes a distributable patch and validation logs.

## 10. What CMS Can Do Today

Authenticated admin can navigate Database/Search/Agents/Publication, open a real case, see current
stage and local payment state, inspect history and historical document metadata, obtain a signed VIEW link,
open a current-stage upload dialog, and search for a known case.
TM5 URL filtering returns a matching row; TM11 filter selects correctly and shows an empty result.
Journal Import opens in Publication. No separate Journal page/route exists.
Unpaid Stage 3 blocks Stage 4 save; empty STOPPED reason is rejected without changing the case.
Default Brandex assets display.

## 11. What CMS Cannot Do Yet

It cannot claim complete sequential workflow enforcement, an Admin+Viewer-only boundary,
automatic Accepted agent payables, Ledger payment truth, multiple opposition tracking,
TM56 response/extensions, Demand Note 25-day tracking, complete publication visuals,
reliable shared branding persistence, or an accepted data-first workbench.

## 12. What Should NOT Be Started Yet

Do not begin Phase 1–4 features, broad role migration, Ledger integration, database hardening,
branding rebuild or UI redesign until this truth cleanup is accepted and scope is assigned.
Do not infer permission to delete the existing Editor or replay historical migrations.
Do not present a passed build or READY deployment as full release acceptance.

## 13. Recommended Next Phase

PHASE 0 = Truth Cleanup: documentation/source/DB/role/UI audits, scoped local fixes and automated
validation complete. Remaining acceptance: review corrections, deploy in a separately authorized release,
verify corrected UI, and complete Viewer/successful mutation/upload/terminal STOPPED tests with suitable
test accounts and disposable cases. No production case was transitioned or file uploaded by this audit.

Then PHASE 1 = Business Workflow Completion for the established missing workflow requirements.
PHASE 2 = Payment Architecture; PHASE 3 = Workflow Hardening; PHASE 4 = UI / Workbench Transformation.
This preserves the established phases and is not a new roadmap.

