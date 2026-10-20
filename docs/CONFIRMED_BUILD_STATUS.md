# Confirmed workflow build candidate

## 20 October 2026 update

The owner selected the mature Database CMS as the base for the integrated Ledger. Mail Merge remains separate. The 17 October Suite-target note in older handoff sections is historical. This branch now also contains source fixes for payment completion dates, Sheet job claims/order, spreadsheet formula escaping, bounded imports/lists, upload checks and clickjacking headers. See `../PROCESS.MD` for the current source and release checklist. These checks do not establish live migration, Google Drive upload, or hosted acceptance.

16 October 2026. Branch: `feat/confirmed-workflow-ledger`.

## 17 October connection update

Google OAuth consent and Drive root discovery are verified; private credentials remain outside the repository. Supabase secrets set/list failed HTTP 403, so server configuration is not complete. Hosted billing/Drive tables are absent; migrations/function/frontend cutover remain pending. Follow `../PROCESS.MD`, `../AGENT.MD` and `../CHANGELOG.md` for current execution order.

## Placement and boundaries

The mature CMS React/Vite frontend remains the base: its datasheet, registry matching, publication, private stage documents, search, print and audit are retained. New integrated financial tables live alongside CMS records in the same Postgres project so case events and automatic charges can commit atomically. This is a fresh integrated financial baseline, not a claim that the old standalone Ledger's real data is connected or migrated.

The standalone Client Ledger, its Sheets and the existing Suite deployment are unchanged. Recoverable source bundles are under the workspace's private `work/recovery-20261016/`; these are Git snapshots, NOT live database backups. No destructive reset was performed.

## Source implemented locally

- Series and client accounts, all-client Monthly Billing default, configurable Advance terms and per-client stage rates.
- Stable case links; no-TM intake/receiving; validation and normalization of newly entered six-digit TM identifiers without bulk rewriting older ones.
- Stage charges in the case-event transaction, rate snapshot, duplicate suppression, Stage 3 billing on Accepted, explicit unpriced charge if rate was not set.
- Parent receiving with manual allocations across charges/cases, separate case receipts, edits, VOID and database audit snapshots.
- Ledger account screens, rate/terms settings, new clients/series, case financial panel, printable receipts.
- Hearing-to-Accepted correction; no direct Hearing-to-Published transition.
- STOPPED preservation plus guarded TM-57 reactivation to prior workflow, separate manual charge and restarted timing baseline.
- Assignment payable, default amount in assignment form, weekly/partial FIFO settlements and edit/void reversal.
- Calendar timing helper and server-filterable follow-up view; no hearing alert automation.
- Certificate office receipt, courier/hand collection, delivery confirmation and optional receipt upload.
- Private Drive Edge Function with Admin checks, folder reuse by ID/name, duplicate-name conflict, per-case lease, retry upload ID, resumable upload, and folder-name sync when a TM is added in the app.
- Admin + Viewer retained; no Service Associate login.

## Verification evidence

- TypeScript application checks passed during implementation.
- Local PostgreSQL-compatible PGlite tests execute the complete ordered migration chain, not mocked SQL.
- Regression and new tests cover payment splitting, atomic rejection of overspending, revised receipt identity, void exclusion, client rates, Accepted Stage 3 billing, Advance gate using actual allocation, restoration, FIFO settlement/void, Viewer denials, and timing boundaries.
- Drive Edge Function has a separate Deno type check.
- Final application TypeScript checks, 231 tests across 9 files, and the production frontend build passed. Edge Function Deno type check passed. Final formatting is rechecked before the local commit.
- Live browser/API/database integration with these migrations is NOT yet verified. No new migration or Edge Function has been applied to a production project.

## Required before release

1. Select target deployment/database and take a verified database/Storage recovery snapshot before changing a live schema. Do not blindly apply new migrations to an old financial dataset.
2. Reconcile old Ledger/Sheet case identities, missing allocations and balances. Source preservation is not data migration; no fabricated allocations/backfill allowed.
3. Configure Google OAuth privately: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` and comma-separated `BRANDEX_ALLOWED_ORIGINS` in Edge Function secrets. Never put refresh tokens/secrets in frontend variables or commit them. Enable Drive API and ensure the authorized account can reach the chosen roots and share private files with intended staff. Connected chat Drive access does not provision web-app OAuth.
4. Set verified series root and existing client/case folder IDs in the Admin settings. Root names are defaults, not verified IDs. Existing uncertain folder matches require reconciliation.
5. Deploy the migration/function and verify real isolated Admin/Viewer flows, receipts, multipart/multi-case receiving, corrections and Drive files before cutover.
6. Advanced legacy financial reporting/export parity and large-data handling must be reviewed against the old Ledger before replacing that tool. Its original UI remains available; no parity completion claim is made here.
7. First-stage intake under Advance terms, historical arrears policy and restored Accepted journal eligibility remain bounded business edge cases. Monthly Billing is the confirmed all-client initial behavior. Restored Accepted journal cases deliberately show Review rather than an invented due date.
8. Verify safe operation under concurrent duplicate requests and cross-table edits against hosted PostgreSQL, not just the local test runtime.

## Drive references

- Upload protocol: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Function authorization: https://supabase.com/docs/guides/functions/auth

Google setup and hosted end-to-end verification are deployment prerequisites, not features silently simulated as working.
