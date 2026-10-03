# Brandex Workflow Business Rules

Canonical implemented business rules, reconciled 3 October 2026 with the workflow enforcement
migration and PostgreSQL-backed tests. These are the final workflow rules; do not treat them as
future work or change their logic without explicit owner approval.

DONE requires requirement, code, database, UI, tests, actual flow verification and aligned documentation.
Use 🟢 DONE + VERIFIED, 🟡 PARTIAL, 🔴 NOT IMPLEMENTED, ⚠️ IMPLEMENTED BUT NOT VERIFIED, or ❌ CONTRADICTED.
Do not publish completion percentages.

## Stage 1

Filing → Acknowledgement, or Filing → Examination → Acknowledgement.
Examination is optional. Acknowledgement → Examination and other backward moves are invalid.
Complete Stage 1 and clear Stage 1 payment before Stage 2. Stored spelling is `Acknowledgment`.

New records start at Stage 1 / Filing. The database trigger enforces this starting status for
ordinary authenticated inserts. The app initializes `stage1_paid = true`; that is a manual CMS
flag, not evidence that a payment was received. Historical service-role imports can preserve
imported workflow values.

## Stage 2

`Assigned` can progress to either `Accepted` or `Hearing`; these are alternative outcomes.
Agent and agreed rate are set while the case is Stage 2 / Assigned. Stage 2 payment is NOT
required for assignment. Stage 2 payment must clear before progression to Stage 3.
`Accepted` requires an assigned agent and rate. Reaching `Accepted` creates one agent payable
for that case and assignment; the unique source-event constraint prevents duplicate credits.
An Admin can record partial or full payments against that payable from the Accepted / Agent
Payments queue in the ASSIGNED page. These payments are distinct from client stage-payment flags.

## Stage 3

Publication → Demand Note Received → Demand Note Submitted.
Stored labels include `Published`, `D-Note Received`, and `D-Note Submitted`.
Publication starts an internal two-calendar-month counter. Both the latest repository SQL and
inspected live `run_journal_match()` use `INTERVAL '2 months'`, not a fixed 60 days.

Multiple opposition events are supported while a case is in Stage 3. Each event starts an
internal one-calendar-month response counter from its received date; an Admin may record one
one-calendar-month extension. A recorded extension cannot be removed, and a TM56 submission
cannot be later than the resulting internal due date. These are internal workflow counters,
not a representation of statutory legal deadlines.

The database starts a 25-day internal certificate acknowledgement counter when Demand Note
Submitted is recorded. Stage 3 payment must clear before Stage 4.

## Stage 4

Exact sequence: CER Acknowledge → CER Received → CER Dispatch. No backward or skipped sub-stage moves.
Preserve CER without inventing an expansion. Stage 4 payment is optional in existing code.

## STOPPED

Can be entered from any normal stage. A mandatory reason is preserved in notes/history with a
timestamp, and the sub-stage is cleared. STOPPED is terminal: it cannot be reactivated or
progressed, and its reason, timestamp, and notes cannot be rewritten.

## General workflow

The database enforces the following progression for Admins and all other callers alike:

- Stage 1: Filing → Examination (optional) → Acknowledgment; transition to Stage 2 / Assigned
  is allowed only from Acknowledgment.
- Stage 2: Assigned → Accepted OR Assigned → Hearing; transition to Stage 3 / Published is
  allowed only from either outcome.
- Stage 3: Published → D-Note Received → D-Note Submitted; transition to Stage 4 / CER
  Acknowledge is allowed only from D-Note Submitted.
- Stage 4: CER Acknowledge → CER Received → CER Dispatch.

No skipped, backward, or invalid sub-stage transitions are allowed. Stage-payment gates apply
to stage progression, including for Admins. Database triggers enforce workflow transitions;
RLS separately controls who may write.

## Payments and agents

CMS owns cases, workflow, stage progression and gates.
[Brandex-Ledger](https://github.com/0utLawzz/Brandex-Ledger) remains the intended source of actual
client payments. CMS stage flags/dates are manual workflow placeholders; there is no verified
Ledger integration. Do not duplicate Ledger or represent CMS flags as Ledger-confirmed payments.

Agent accounting is separate from client payments. Assign cases with per-case fees/rates.
Ten cases at Rs.1000 with eight Accepted create Rs.8000 payable. The database creates one payable
when each eligible case reaches Accepted. Admin-recorded Agent Payments reduce a payable via the
`record_agent_payment` RPC, which rejects non-positive, over-balance, and over-precision amounts
and records payment history. Agent Payment entry is in the ASSIGNED page's Accepted / Agent
Payments queue, not Case Events. `trademarks.agent` remains text alongside the assigned-agent reference.

## Roles and security

Active model: Admin + User/Viewer. Viewer is read-only; Admin follows the same workflow.
The legacy `editor` enum member and historical migrations are preserved, but the live Editor profile was converted to Viewer and a profile constraint prevents assigning Editor. Current write policies and storage mutations are Admin-only; role-guarded RPCs reject Viewer. No account or historical data was deleted.
Production remains private and staff-authenticated. Public read-only access is future consideration only.

Keep RLS enabled. Private case files use signed URLs (3600 seconds in document/image code).
Database storage policies restrict writes to Admin; the upload helper rejects STOPPED cases.
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

## TM number uniqueness

Every non-empty `tm_cpr_number` is unique by its digits-only normalized value. Formatting marks may differ,
but `121212`, `12-12-12`, and `TM 121212` identify the same number. Preserve the originally stored legal
identifier exactly; normalization is only for matching and uniqueness. Repeated `(type, client_code,
case_number)` references are valid when their TM numbers differ.

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
Ledger integration and publication/workbench presentation improvements remain separate follow-up
scope; they do not make the implemented workflow rules incomplete. Do not change historical Git tags.
