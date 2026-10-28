# Ledger consolidation into Brandex Database CMS

This branch prepares the Ledger to use the CMS Supabase project as the single database. It does not apply the migration, import live data, change production Vercel configuration, or deploy production.

## Target

- Use the Brandex Database CMS Supabase project as the sole active database.
- Keep the CMS `public.clients` schema unchanged. Store Ledger data in `ledger_series`, `ledger_clients`, `ledger_client_stage_rates`, `ledger_cases`, and `ledger_entries` so existing CMS columns cannot collide with Ledger columns.
- Point the Ledger UI to the CMS Supabase URL and public publishable key, use CMS staff authentication, and use the prefixed Ledger tables.
- Let CMS payment views read the same Ledger rows. Derive stage-paid status only from non-voided charges and receipts; a stage with zero due is never paid.
- Generate receipt numbers in the database. Use an idempotency UUID for receipt requests; ignore caller-supplied receipt serial suggestions.
- Preserve financial history. Detach linked cases rather than cascade-delete entries. Require an admin RPC, normalized TM match, and an audit reason to link cases.

## Data reconciliation gate

The read-only audit found case ownership conflicts between the two projects and CMS cases with legacy paid flags that do not have corresponding matching Ledger cases. The importer preserves source IDs, void metadata, client ownership, and case history. It leaves unmatched/conflicted cases unlinked and never merges client ownership automatically. Those records must be reconciled by an authorized owner before they can affect CMS workflow status.

The exact production case identifiers and financial amounts are kept out of this repository branch. Use the private reconciliation report in the task outputs for those details.

## Proposed rollout

1. Review this branch and validate the migration in an isolated CMS Supabase branch.
2. Run `node scripts/import-ledger-to-cms.mjs` in dry-run mode using locally supplied source/target service keys; inspect counts and reconciliation output without printing keys.
3. Resolve or formally quarantine ownership conflicts and decide how CMS-only paid flags will be represented in the financial ledger.
4. Confirm target backup/restore and explicit approval for each production-changing action: migration/RLS, data import, Vercel configuration/deployment, and PR merge.
5. Apply the migration, import Ledger rows, reconcile source/target counts and balances, then link only owner-approved cases through `link_ledger_case_to_trademark`.
6. Verify CMS login, viewer/admin access, case payments, receipt issuance/voiding, balances, and workflow gates on preview before production cutover.
7. Keep the original Ledger Supabase project as a read-only rollback archive until the migration is accepted and the rollback window closes.

## Importer

The importer defaults to dry-run. It requires source/target service keys from the operator's local environment. It writes only when invoked with `--apply` and the explicit `LEDGER_IMPORT_APPROVAL=approved-after-backup-and-reconciliation` gate. Do not put service keys in GitHub, Vercel browser variables, or chat. Do not run production import until owner approval and backup requirements are met.

## Verification status

The live state was inspected read-only. This branch's SQL has not been applied to an isolated or production database, the importer has not been run against production, and no browser flow or deployment has been verified. A successful build/preview alone will not establish data reconciliation or RLS correctness.
