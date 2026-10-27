# Client Ledger — Canonical Business Requirements

**Status:** Owner-confirmed requirements. This document defines desired financial behavior; it does not claim every requirement is already implemented or production-verified.

**Scope:** Client financial accounts and ledger behavior inside Brandex Database CMS. Existing case workflow rules remain defined in [Workflow Business Rules](WORKFLOW_BUSINESS_RULES.md). This document does not authorize code changes, schema changes, migrations, deployment, or production data edits by itself.

## 1. Source of truth

- The financial ledger is the authoritative source for client charges, valid receipts, adjustments, refunds/reversals, and client balances.
- A case's workflow status or cached stage-paid flag must not fabricate, erase, or silently alter financial truth.
- Workflow may be corrected independently, but ledger totals must remain consistent with recorded financial events.
- A predefined fee is a fee agreement, not a charge. A charge exists only when it becomes due under the agreed processing/work rule.
- If code, cache, UI, or documentation disagrees with the ledger, flag the discrepancy; do not silently select the value that makes a workflow gate pass.
- Agent payables and agent payments remain separate from client receipt accounting.

## 2. Client accounts and case ownership

- Each client has a configurable code prefix and unique client codes (example: `NXA-001`).
- Each client has one consolidated ledger account covering all trademark cases belonging to that client.
- The client list should show name, code, and a compact financial summary/balance. Opening a client should show the consolidated ledger across their related cases and financial transactions.
- A trademark number cannot be duplicated under another client. Normalize digits for uniqueness/matching while preserving the originally stored legal identifier.
- A case must not appear twice across client ledgers. Moving a case between clients requires an explicit, authorized, audited transfer that preserves history and reconciles account ownership and balances. Never silently reassign ownership to make a duplicate pass.
- The database/code must enforce ownership and uniqueness; UI-only checks are insufficient.

## 3. Stage fees and charges

There are four agreed stage fees per client, configured when creating the client or fee agreement. Use the existing full stage names in user-facing UI:

1. **Stage 1 — Filing and Acknowledgement**
2. **Stage 2 — Assignment and Outcome**
3. **Stage 3 — Publication and Demand Note**
4. **Stage 4 — Certificate (CER) Processing**

A saved fee schedule does not create four charges. The confirmed fee rule is **Option 1: charge a stage fee only when it becomes due under the agreed work/processing rule. Future unearned stages are not charged.**

- When a stage fee becomes due, create the agreed charge for that case/stage.
- The total charge for one case and one stage must not exceed the agreed fee cap for that stage. For example, a Stage 1 fee of Rs 10,000 cannot be charged multiple times to exceed Rs 10,000 in total.
- Define and test an idempotent charge-creation rule so repeated saves/retries cannot create duplicate stage charges.
- Outstanding balance is calculated from due charges minus valid allocated receipts, adjusted by recorded waivers, refunds, reversals, and other authorized adjustments. Never silently delete an already-due charge.
- If a client abandons a case, cannot be reached, or does not wish to continue, do not charge future unearned stages. An already-due charge remains in the ledger unless an authorized, explicitly recorded waiver/adjustment applies.
- Partial payments are allowed. Every actual payment, including partial payment, must have a receipt record. Refunds and reversals must also be recorded and auditable.
- Receipt numbers must be generated and validated by the authoritative ledger mechanism; UI-generated random numbers must not bypass official sequencing or uniqueness.

## 4. Workflow/payment interaction

Preserve the existing case workflow and database guards defined in [Workflow Business Rules](WORKFLOW_BUSINESS_RULES.md); do not redesign the legal/business sequence as part of ledger work.

- Stage 1 payment must clear before Stage 2.
- Stage 2 payment must clear before Stage 3.
- Stage 3 payment must clear before Stage 4.
- Stage 4 payment is optional under the existing rule.
- Stage 2 payment is not required to assign an agent. An Accepted case creates a separate agent payable according to the existing agent-accounting rule.
- Recording a payment does not automatically advance the case. After a stage payment is recorded, the case waits for acknowledgement/review and proceeds only after acknowledgement is confirmed and all existing workflow requirements are met.
- A stale cached paid flag cannot override the ledger. A receipt against a zero-charge stage must not mark that stage paid merely because a positive amount was received; exceptions require an explicit, auditable accounting rule, not an inference.

## 5. Client ledger statement and printing

The client ledger view must support:
- A consolidated client header showing client name and code, with a Print action.
- **Full Ledger:** print all ledger entries for the client.
- **Selected Ledger:** select multiple rows and print only the selected entries.
- A readable, branded Brandex print layout with client name/code, statement details, and transaction history.
- Transaction rows large enough to read, including date, case/TM reference, full stage name, transaction/receipt details, charge, receipt/payment, adjustments/refunds/reversals, and a correctly calculated running/client balance where the data model supports it.
- The printed statement must not invent transactions or include unselected rows in Selected Ledger mode.

## 6. Evidence and implementation boundary

Before implementation, inspect the current schema, migrations, RLS, triggers/RPCs, ledger libraries, receipt modals, and tests. Identify existing behavior and gaps first.

At minimum, test:
- A fee schedule alone creates no charge.
- A due stage creates at most one charge, capped at the agreed amount.
- Future stages do not affect current outstanding.
- Partial receipts reduce outstanding only by valid allocated amounts.
- Duplicate receipt/charge retries do not duplicate financial events.
- Refunds, reversals, and waivers remain in the audit trail and update balances correctly.
- Cached stage flags cannot create financial truth.
- Workflow gates follow ledger-derived status without payment auto-advancing a case.
- Client-wide ledger shows each case/entry once and rejects duplicate TM ownership.
- Audited transfer preserves prior ownership/history and reconciles balances.
- Full Ledger and Selected Ledger print modes include the correct rows.
- Agent payments do not enter client receipt totals.

Any ambiguity affecting fee-due timing, allocation across cases, transfer treatment, or adjustment authorization must be raised for owner decision before coding. Do not make assumptions to fill these gaps.
