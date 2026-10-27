# Brandex Client Ledger — CMS Integration Snapshot

**Architecture decision (owner-confirmed 28 October 2026):** the separate [Brandex Client Ledger](https://github.com/0utLawzz/Brandex-Client-Ledger) is the only financial source of truth. CMS consumes verified payment status through an authenticated, server-side bridge. Desired financial behavior is specified in [LEDGER_REQUIREMENTS.md](LEDGER_REQUIREMENTS.md); workflow rules remain in [WORKFLOW_BUSINESS_RULES.md](WORKFLOW_BUSINESS_RULES.md).

## Intended read path

1. CMS frontend calls its Supabase Edge Function `ledger-payment-status` with the signed-in user's bearer token and normalized six-digit TM numbers.
2. The CMS function verifies the user and Admin/Viewer profile, then calls the Ledger-side `cms-payment-status` function using the shared server-only integration secret.
3. The Ledger function calls its read-only `get_stage_payment_status` RPC and returns aggregate stage amounts/status.
4. CMS may synchronize `stage*_paid`, `stage*_paid_date`, and `payment_reference` as workflow cache fields. These cache values are not the financial source of truth.
5. Before attempting a gated stage transition, the CMS UI must obtain a fresh successful response from the Ledger bridge. If the bridge cannot verify payment, the UI must block the transition and show an explicit verification error.

## Receipt and financial writes

- New client charges, receipts, refunds, reversals, waivers, and client balances belong in the separate Brandex Client Ledger.
- CMS must not create local client receipts or print a fabricated receipt as if it were issued by the Ledger. CMS links staff to the authoritative Ledger for receipt entry and official receipt printing.
- Agent payables and agent payments remain separate from client receipts.

## Legacy CMS-local implementation — do not treat as authoritative

The CMS repository contains `supabase/migrations/20261024000100_unified_client_ledger.sql`, which creates `public.client_ledger_entries` and local receipt RPCs. This is a legacy competing implementation and conflicts with the owner's confirmed architecture. The migration is retained for history; it must not be used for new financial writes or financial status decisions.

Do not drop the table, delete its migration, or merge its rows into the separate Ledger automatically. First inspect whether the migration was applied, whether any real financial records exist, and how each record reconciles with the authoritative Ledger. Any cleanup or transfer requires an explicit, audited migration plan and owner approval.

## Verification boundaries

- **Source inspected:** code and configuration are present in the repository.
- **Automated tested:** named unit tests ran; this does not verify remote Ledger credentials or live data.
- **Database verified:** target Supabase objects and grants were inspected.
- **Deployment verified:** both Edge Functions are deployed with the expected URLs and matching secret values, and an authenticated end-to-end status request succeeded.
- **Workflow verified:** a gated stage transition was exercised with both cleared and uncleared Ledger statuses.

Until the relevant checks are actually completed, do not claim live synchronization or strict database-level enforcement is verified. The current database workflow guard still consumes CMS cache fields, so direct API/database paths must be audited separately to ensure stale cache cannot bypass the external Ledger check.

## Security

- Never expose the shared integration secret or either project's service-role key to the browser or any `VITE_*` variable.
- Preserve CMS authentication and Admin/Viewer checks and the Ledger-side secret check.
- Do not execute production migrations, alter production data, or deploy without explicit owner approval.

