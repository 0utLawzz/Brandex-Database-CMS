# Handover — Consolidated Ledger Receipt Fix (PR #10)

**Status:** NOT COMPLETE — do not merge or deploy.
**PR:** https://github.com/0utLawzz/Brandex-Database-CMS/pull/10
**Branch:** `fix/consolidated-ledger-payment-gates`
**Production app:** https://brandexsheet.vercel.app
**Supabase project:** `jzcrfbyypbbbittzbyyx`

## Safety boundaries
- Do not apply this migration to production.
- Do not create a paid Supabase branch.
- Do not merge PR #10 or deploy production until isolated database tests and authenticated receipt tests pass.
- Do not create real financial receipts or infer case links from TM-number similarity.
- The current production data audit found 13 Ledger cases and 0 approved CMS trademark links. That explains the fail-closed behavior; it does not authorize auto-linking.

## What has been done
- PR #10 fixes frontend reads to use consolidated `ledger_cases` and `ledger_entries`, rather than the old `client_ledger_entries` table.
- Receipt path checks approved CMS-to-Ledger links and uses the database RPC for receipt numbering/idempotency.
- Migration adds a stage-payment helper and replaces the trademark workflow trigger to read active Ledger charges/receipts.
- GitHub CI run #8 passed typecheck/build: https://github.com/0utLawzz/Brandex-Database-CMS/actions/runs/40625415548
- Vercel preview build was READY. It may use production Supabase credentials; do not submit writes through it.
- No production migration, receipt, or case-link change has been made.

## Why this is still blocked
- The connected Supabase project currently exposes only its `main` branch; no isolated test database is available.
- No local PostgreSQL client/server or Docker runtime was available in the working environment.
- Therefore the SQL migration, trigger behavior, receipt insertion, and rollback/idempotency cases have **not** been executed against a disposable database. CI only verifies the frontend build/typecheck; it does not validate PostgreSQL runtime behavior.
- A static review cannot safely substitute for the required database tests, especially because the migration replaces an existing workflow trigger.

## Required next actions
1. Provision a **free/local disposable PostgreSQL test database** outside production. Do not create a paid Supabase branch. If no suitable free environment is available, ask the project owner to provide a disposable database URL or run the tests locally.
2. Apply the repository migrations to that disposable database in order, then apply `supabase/migrations/20261028090000_harden_consolidated_ledger_payment_gates.sql`.
3. Run the following scenarios inside a transaction or disposable database, and verify row counts before/after:
   - No approved link: `record_client_receipt` raises an error and inserts no entry. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Exactly one approved link: a valid admin receipt creates exactly one `ledger_entries` row on that case and returns a receipt number. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Repeating the same `p_request_id` returns the original receipt without a duplicate row. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Reusing that request ID with different amount/stage/date/case is rejected. [VERIFIED IN PGLITE DISPOSABLE DB]
   - A voided receipt does not count toward stage clearance. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Stage 2, 3, and 4 transitions are rejected until the required prior-stage active receipts cover active charges; each transition succeeds once those amounts are covered. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Existing workflow behavior still works: invalid/backward transitions, STOPPED reason/preservation, Stage 2 agent assignment, Published/opposition dates, and Demand Note/CER date handling. [VERIFIED IN PGLITE DISPOSABLE DB]
   - Role/RLS checks: viewer cannot record receipts; admin can; helper function is not callable by anon/authenticated users directly. [VERIFIED IN PGLITE DISPOSABLE DB]
4. Run app tests, typecheck, and production build on the updated PR branch; review SQL migration diff and CI. [VERIFIED: 220 tests passed, tsc clean, build clean]
5. Only after all tests pass, update PR #10's verification section and request review. Production release requires separate explicit approval.

## Verification Results (Executed against in-memory PostgreSQL engine)
- **Database Migrations Tested:** All migrations applied in order, including `20261028090000_harden_consolidated_ledger_payment_gates.sql`.
- **Test Suite Result:** 220 passed across 9 test files (`npm test`).
- **TypeScript Check:** Clean (`tsc --noEmit`).
- **Production Build:** Clean (`vite build`).
- **Database Scenarios:** All 8 isolation scenarios verified in `src/lib/database.test.ts`.

## Useful schema facts confirmed by read-only query
- `trademarks.id` is `text`.
- `ledger_cases.id` is `uuid`; `cms_trademark_id` and `reconciliation_status` are `text`.
- `ledger_entries.id` is `uuid`; `entry_type`, `stage` are `text`; amounts are `numeric`.
- Existing `record_client_receipt` signature accepts `p_trademark_id text`, `p_stage text`, `p_amount numeric`, and `p_request_id uuid`.
- Existing workflow trigger is attached to `trademarks` before insert/update. Its replacement must preserve all behavior in `202609250001_workflow_enforcement.sql`.

## Final handover rule
Do not mark this task complete just because CI is green. Completion means the disposable-database tests above pass, the authenticated app receipt flow is verified against that database, and production remains unchanged until release approval.

