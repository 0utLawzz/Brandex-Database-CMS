# Brandex Client Ledger integration

Brandex Client Ledger remains the source of truth for client stage payments. CMS matches a case to a Ledger case by the digits-only six-digit TM number and reads `get_stage_payment_status(p_tm_digits)`. Ledger payment entries are not copied into CMS; the existing `stageX_paid` fields are a protected workflow cache only.

## Runtime flow

1. Staff records a charge or receiving in Brandex Client Ledger.
2. The CMS calls its authenticated `ledger-payment-status` Edge Function from the staff session.
3. CMS verifies the user and Admin/Viewer profile, then calls Ledger's `cms-payment-status` Edge Function with a server-only shared secret.
4. Ledger's function calls its own stage-status RPC and returns only the stage totals and payment state.
5. CMS refreshes the matching case's cached paid flags/dates from the Ledger response. Manual browser edits to those fields are rejected by the CMS migration.
6. The existing database workflow guard allows a stage transition only when the refreshed Ledger cache shows all required prior stages fully paid. A failed or missing Ledger lookup leaves the cache unchanged and blocks the transition.

The Payments page and case record view refresh every 30 seconds and on demand. CMS also refreshes from Ledger immediately before a stage change. The CMS Payments page links staff to the standalone Ledger for entering receipts; it does not create receipts itself.

## Required setup

The Ledger and CMS Supabase projects are separate. Apply the additive migration in each repository before deploying that repository's function. Do not run these migrations against production as part of a frontend-only Vercel preview.

1. Generate a strong random integration secret and store the exact same value as a Supabase Edge Function secret in both projects. Do not add it to a `.env` committed to Git, a `VITE_*` variable, or browser-visible Vercel environment.
2. In the Ledger project, set `CMS_LEDGER_INTEGRATION_SECRET` and deploy `cms-payment-status` with JWT verification disabled; the function authenticates each request with the shared secret and exposes only payment-status reads.
3. In the CMS project, set `LEDGER_PAYMENT_STATUS_URL` to `https://<ledger-project-ref>.supabase.co/functions/v1/cms-payment-status` and set `LEDGER_CMS_INTEGRATION_SECRET` to the same secret. Deploy `ledger-payment-status` with JWT verification enabled.
4. Configure Vercel Preview's public `VITE_BRANDEX_LEDGER_URL` if the Ledger link uses a different URL. No Ledger secret belongs in Vercel's browser environment.
5. Verify a known case with (a) no Ledger receipt, (b) a partial receipt, (c) a fully cleared stage, and (d) a voided/corrected receipt. Confirm that only fully cleared stages unlock the corresponding CMS stage gate, and that unavailable Ledger requests fail closed.

Example CLI flow after selecting and linking the intended project (the migrations/functions are not auto-applied by Vercel):

```sh
supabase db push
supabase secrets set CMS_LEDGER_INTEGRATION_SECRET=<secret>
supabase functions deploy cms-payment-status --no-verify-jwt
```

For the CMS project, use its corresponding secret names and deploy the `ledger-payment-status` function without `--no-verify-jwt`.

## Current boundary

This source implementation does not apply either migration, configure either project's secrets, or deploy Supabase Edge Functions. The connected Supabase account in this workspace can inspect CMS project `jzcrfbyypbbbittzbyyx` but is not authorized for the Ledger project. Live receipt synchronization therefore remains unverified until the owner applies the two additive migrations, configures secrets, and exercises the acceptance cases above.
