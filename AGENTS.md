# Brandex AI Contributor Rules

This file is the mandatory entry point for every AI agent and automated contributor. Read this file first, then follow the task-specific reference route in [Documentation Authority](docs/DOCUMENTATION_AUTHORITY.md). Do not read every historical audit as if it were a current instruction.

## Non-negotiable rules

1. Follow the current human request and explicit approvals. If a request conflicts with a safety boundary or leaves a consequential business decision unclear, stop and ask.
2. Do not silently change business rules, legal workflow, financial calculations, permissions, database schema, or production configuration.
3. Do not run production migrations, alter production data, deploy, merge a PR, or change secrets unless explicitly authorized for that action.
4. Treat historical audits, old release notes, memory notes, issue discussions, and past progress logs as context only—not current requirements or proof.
5. Separate **required behavior**, **implemented behavior**, and **verified behavior**. Never infer one from another.
6. When documents conflict, use the resolution procedure in [Documentation Authority](docs/DOCUMENTATION_AUTHORITY.md). Do not choose the most convenient interpretation.
7. Before coding, inspect the relevant implementation, database migrations/policies/RPCs, and tests. If the implementation contradicts the canonical requirement, report the gap; do not silently rewrite the requirement to match the code.
8. Keep unrelated changes out of scope. Preserve existing data, identifiers, workflow guards, audit history, and compatibility unless the owner approves a change.
9. Prefer a reviewable branch and pull request for multi-file or high-impact changes. Never claim a change was deployed or live-tested unless that actually happened.

## Documentation entry points

- **Which reference to use / conflict resolution:** [docs/DOCUMENTATION_AUTHORITY.md](docs/DOCUMENTATION_AUTHORITY.md)
- **Current user-confirmed client ledger requirements:** [docs/LEDGER_REQUIREMENTS.md](docs/LEDGER_REQUIREMENTS.md)
- **Existing case workflow requirements:** [docs/WORKFLOW_BUSINESS_RULES.md](docs/WORKFLOW_BUSINESS_RULES.md)
- **Current status and pending work (summary, not source of truth):** [Progress.md](Progress.md)
- **Evidence levels and historical audit context:** [docs/PROJECT_TRUTH.md](docs/PROJECT_TRUTH.md)
- **Release/browser checks:** [SMOKE_TEST_CHECKLIST.md](SMOKE_TEST_CHECKLIST.md)

## Repository facts

- Current repository layout has root-level `src/`, `supabase/`, and `scripts/`; verify paths before using older references to `artifacts/tm-tracker/`.
- The checked-in root manifest is `package.json` and the lockfile is `package-lock.json`. Use the commands and scripts that actually exist in the checked-out manifest. Do not assume pnpm/workspace scripts or a test script exists.
- Vercel configuration currently uses `npm install` and `npm run build`; do not change package-manager/deployment settings as part of documentation-only work.
- Supabase Postgres, Auth, RLS, migrations, and Storage are security-critical. Never expose service-role keys, database passwords, Apps Script secrets, or cron secrets in browser variables or committed files.
- Active role model documented for the application is Admin + User/Viewer; do not reintroduce Editor authorization or public access without explicit approval.
- Google Sheets is an asynchronous mirror, not the primary browser datastore.
- **Financial source of truth:** the separate [Brandex Client Ledger](https://github.com/0utLawzz/Brandex-Client-Ledger) owns client charges, receipts, adjustments, refunds, and balances. CMS payment status is read through the authenticated Ledger bridge. The CMS-local `client_ledger_entries` migration/table is a legacy competing implementation, not authority for new financial writes; do not delete or reconcile any existing records without an approved audited plan.
- Preserve trademark identifiers as stored. Non-empty TM numbers are unique by digits-only normalized value; normalization is for matching/uniqueness, not rewriting the stored legal identifier.

## Change and verification discipline

- For documentation-only work, check links, headings, references, and consistency; do not claim application tests passed if they were not run.
- For code changes, run the relevant tests and the actual manifest-supported typecheck/lint/build commands. Report commands that do not exist rather than inventing them.
- For schema changes, inspect existing migrations and add an ordered migration only after authorization. Never execute it against production without explicit approval.
- Update `Progress.md` only with evidence-backed status. Mark source inspection, automated tests, database verification, and browser-flow verification separately.
- Use concise commit messages in the repository's existing style; do not amend or retag historical releases.

## Stop condition

If two authoritative sources still disagree after following `docs/DOCUMENTATION_AUTHORITY.md`, do not implement either interpretation. Record the exact conflict, its impact, and the single decision needed from the owner.
