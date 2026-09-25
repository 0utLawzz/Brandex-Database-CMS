# Brandex Workflow Business Rules

Canonical business requirements, reconciled 25 September 2026 with the owner's Phase 0 instructions.
This is intended behavior, not a completion claim. Current evidence and contradictions are in
[PROJECT_TRUTH.md](PROJECT_TRUTH.md). Old reports and release notes cannot override these rules.

DONE requires requirement, code, database, UI, tests, actual flow verification and aligned documentation.
Use 🟢 DONE + VERIFIED, 🟡 PARTIAL, 🔴 NOT IMPLEMENTED, ⚠️ IMPLEMENTED BUT NOT VERIFIED, or ❌ CONTRADICTED.
Do not publish completion percentages.

## Stage 1

Filing → Acknowledgement, or Filing → Examination → Acknowledgement.
Examination is optional. Acknowledgement → Examination and other backward moves are invalid.
Complete Stage 1 and clear Stage 1 payment before Stage 2. Stored spelling is `Acknowledgment`.

Current new-record code defaults to Stage 1 / Filing and local `stage1_paid = true`;
this is an existing manual initialization, not payment verification. Historical CSV import sets it false.
The database creation trigger records history; it does not enforce these defaults.

## Stage 2

Assigned → Accepted OR Assigned → Hearing. These are alternative outcomes, not a linear sequence.
Stage 2 payment is NOT required for Agent Assignment.
Assignment is internal case handling after the appropriate Stage 2 state.
Stage 2 payment must clear before Stage 3.
Current `assignStage2Agent()` and `updateTrademarkAgent()` do not check payment or enforce stage eligibility.
Do not restore an assignment payment gate from old documentation.

## Stage 3

Publication → Demand Note Received → Demand Note Submitted.
Stored labels include `Published`, `D-Note Received`, and `D-Note Submitted`.
Publication starts an internal two-calendar-month counter. Both the latest repository SQL and
inspected live `run_journal_match()` use `INTERVAL '2 months'`, not a fixed 60 days.

Multiple opposition events, TM56 response tracking and possible extensions are required future work.
The previous canonical document records a one-month response and possible one-month extension as internal
business intent; the event anchor and detailed implementation need clarification before implementation.
Do not infer legal deadlines from form names or registry flags.

After the relevant Demand Note payment/required step, a 25-day internal counter applies to
certificate received/acknowledgement. The exact anchor is not resolved by existing code.
Stage 3 payment is currently required by the application before Stage 4; preserve this existing gate.

## Stage 4

Exact sequence: CER Acknowledge → CER Received → CER Dispatch. No backward or skipped sub-stage moves.
Preserve CER without inventing an expansion. Stage 4 payment is optional in existing code.

## STOPPED

Can be entered from any normal stage. Mandatory reason preserved in notes/history with timestamp.
Terminal: no reactivation, no progression, no sub-stage.
Current dedicated status function appends a timestamped reason; general create/update paths and
the `Case Stopped` dictionary contradict the complete rule. Do not describe STOPPED as fully enforced.

## General workflow

Stage 1 → Stage 2 → Stage 3 → Stage 4, without skipping, backward movement or admin exemptions.
Required sub-stage completion and payment gates apply to admins too.
Current browser data functions are not a trusted server API; direct Supabase writes are governed by RLS.
Database-level workflow enforcement remains absent.

## Payments and agents

CMS owns cases, workflow, stage progression and gates.
[Brandex-Ledger](https://github.com/0utLawzz/Brandex-Ledger) is the intended source of actual payments.
CMS stage flags/dates are temporary manual placeholders; there is no verified Ledger integration.
Do not duplicate Ledger or build an integration in Phase 0.

Agent accounting is separate from client payments.
Assign cases with per-case fees/rates. Ten cases at Rs.1000 with eight Accepted should eventually
create Rs.8000 payable; manual Agent Payment reduces the outstanding balance.
Current `agents`, `agent_fees` and `agent_summary` support manual fees/payments.
Automatic payable creation on Accepted is absent. `trademarks.agent` remains text without an FK.
Existing fee totals must not be called automatic Accepted credits.

## Roles and security

Intended active model: Admin + Viewer. Viewer is read-only; Admin follows the same workflow.
Preserve legacy enum/data compatibility until a deliberate migration.
Editor is currently ACTIVE in UI checks, RLS and match RPCs, not merely a legacy enum.
A live editor profile exists. See the role inventory in PROJECT_TRUTH.md.
Do not silently remove that account, rewrite historical migrations or claim admin-only RLS already exists.

Keep RLS enabled. Private case files use signed URLs (3600 seconds in document/image code).
Current storage policies are role-based and do not enforce case stage or STOPPED rules.
Branding has a separate one-year URL/public-URL fallback path; do not generalize document security to it.
Never expose service-role/database/Apps Script/cron secrets in browser variables.

## Documents and dates

Only current-stage uploads; no uploads for STOPPED; retain historical-stage documents.
Viewer read-only behavior must hold in UI and database, not only hidden buttons.
Date Created = database `created_at`; Filing Date = `filing_date`;
Last Modified = `updated_at`. Unknown creation timestamps must not fall back to filing dates.

## TM forms

User-facing heading: **TM FORM IPO (REGISTRY MATCHES)**.
Preserve TM5/TM6/TM11/TM16/TM56 matching and
`/database?tmForm=TM5`, `/database?tmForm=TM11`.
Flags and registry dates are matching data, not workflow events or TM56 response tracking.
Form matching must not fabricate workflow history.

## Publication display and workbench

Required publication model: thumbnail/enlargement where available, journal number/date,
type/icon, client code, case number, application name, appropriate six-digit TM number formatting,
class presentation/actions, prominent stage/sub-stage, internal deadline/days remaining,
status and available actions. Do not alter stored legal identifiers to obtain formatting.

**CASE DATA FIRST. UI FURNITURE SECOND.**
Responsive classes and consistent branding do not prove readability.
Primary case data, current stage, manual payment state and next valid action must be readily legible
at normal desktop size. Tiny 8–10px metadata, nested borders and shadows require a later UI audit
and transformation, not an unrequested Phase 0 redesign.

## History, integrity and scope

Keep status history distinct from the full audit log. Preserve timestamped reasons and case history.
Preserve legal identifiers and existing business behavior except explicitly scoped corrections.
Do not claim canonical Type / Client Code / Case Number presentation means default sorting:
the current list sorts filing date descending, updated time descending, then identifier tiebreakers.
Existing uppercase normalization and broader integrity questions are separate audit items.

PHASE 0 = Truth Cleanup
PHASE 1 = Business Workflow Completion
PHASE 2 = Payment Architecture
PHASE 3 = Workflow Hardening
PHASE 4 = UI / Workbench Transformation

Do not start later phases during truth cleanup. Do not change historical Git tags.
