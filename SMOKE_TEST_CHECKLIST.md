# Authenticated Smoke Test — Release Closure

Updated 30 September 2026. Active roles are Admin and User/Viewer only. Production remains private and staff-authenticated; public Viewer access is not enabled.
[Progress](Progress.md) is the current status; the 25 September observations below are historical, not current acceptance evidence.

## Verified Database State

- [x] Exactly two Auth users remain: `Admin / IT` and `User / Viewer`; no user was deleted or created.
- [x] The legacy Editor profile is now stored as Viewer; the enum value remains only for compatibility and cannot be assigned to a profile.
- [x] Admin write policies cover records, clients, agents, fees, file metadata, storage, registries, opposition events, settings and workflow RPCs.
- [x] Viewer role resolution returns read-only; database tests reject record, agent, storage and Admin RPC mutations.
- [x] Anonymous access to exposed `public` tables/security-definer RPCs and authenticated `TRUNCATE` on those tables are revoked.
- [x] The `trademark-files` bucket is private and its RLS policies restrict storage reads to authenticated staff and all writes to Admin. Raw `storage.objects` grants are Supabase-owner-managed and remain outside project migration authority.
- [x] `trademark-files` is private, limited to 10 MiB, and retains the configured file-type allowlist.
- [x] Ordered closure migrations are applied and recorded in Supabase as `20260929212118`, `20260929212404`, and `20260929213046`.
- [x] Local PostgreSQL-backed and unit tests pass (207 tests across 7 files).

These checks verify database catalogs and automated tests, not authenticated production browser flows.

## Remaining Production Checks

- [ ] Sign in as Admin and verify authorized record/workflow/assignment/import/registry/agent/document actions on disposable test data.
- [ ] Sign in as User/Viewer and verify permitted read views plus disabled UI mutations; confirm direct writes remain rejected by RLS.
- [ ] Verify signed document access, current-stage upload rules, STOPPED restrictions, and URL expiry in an authenticated browser session.
- [ ] Verify the current Vercel deployment and its environment inventory; only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may reach the browser.
- [ ] Confirm Supabase public sign-ups are disabled and enable/verify leaked-password protection.
- [ ] Rotate the service-role credential found in ignored local environment files; the files are not tracked, but the credential was exposed during inspection.
- [ ] Complete these checks before claiming production browser acceptance. No browser workflow or production business-record mutation was performed during this closure.

## Deferred Follow-Up

- Ledger integration remains deferred; CMS payment indicators are manual and are not Ledger-verified.
- Branding/theme/logo/social-preview and Record View/workbench design remain a separate follow-up.
- Public Viewer access remains future consideration only.

## Historical Phase 0 Observations (25 September)

The following observations predate the workflow and Admin/Viewer closure migrations and must not be used as evidence of current behavior.

- [x] Sign-in screen renders; user supplied an authenticated Admin session.
- [x] Dashboard, Database, Search, Assigned, Agents and Publication navigation load.
- [x] Existing case opens with stage/sub-stage, four local payment states and workflow history.
- [x] Search for an existing case returns the expected record.
- [x] `/database?tmForm=TM5` selects TM5 and returns a matching row.
- [x] `/database?tmForm=TM11` selects TM11 and returns a correct empty result for this snapshot.
- [x] Stage 3 case cannot save a Stage 4 transition while Stage 3 payment is unpaid.
- [x] Dedicated status dialog rejects STOPPED with an empty reason, without changing the case.
- [x] Case Document upload dialog fixes stage to the current Stage 3; historical Stage 1 document remains visible.
- [x] Private signed VIEW link is generated; no upload or download/expiry cycle claimed.
- [x] Journal Import opens from Publication in journal-only mode; no independent Journal route exists.
- [x] Assignment dialog opens with agents and confirmation control; no assignment saved.
- [x] Date Created production bug confirmed: UI uses filing date while database created_at differs.
- [x] Default branding renders; Vercel deployment READY and matches main commit.
- [x] At 1440×900, tiny data text and nested decorative borders are visible; UI acceptance is NOT complete.

No successful production case/payment/agent/branding mutation, import or document upload was made.

These are retained historical observations only. Later workflow rules, migration confirmation, role closure, and production checks are documented above.
