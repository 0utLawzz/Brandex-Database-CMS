# Documentation Conflict Audit

**Audit date:** 28 October 2026  
**Scope:** documentation and AI-instruction conflicts found during the documentation-authority cleanup. This is a conflict register, not an implementation-completion report.

## Findings

| ID | Conflict / risk | References | Resolution for AI contributors | Status |
|---|---|---|---|---|
| DOC-01 | Ledger is described as a separate repository-owned payment system in one document and as unified in the CMS database in others. | `docs/WORKFLOW_BUSINESS_RULES.md`; `docs/LEDGER_INTEGRATION.md`; `Progress.md` | Use `docs/LEDGER_REQUIREMENTS.md` for owner-confirmed desired financial behavior. Inspect the current migration/code for implemented architecture. Do not claim live integration is verified merely because a migration/file exists. | Partially reconciled; source implementation/live verification still required |
| DOC-02 | Old AI instructions reference `artifacts/tm-tracker/` and pnpm, but current root manifest/config use root-level `src/`, `package-lock.json`, and npm commands. | `AGENTS.md`; `package.json`; `package-lock.json`; `vercel.json` | Updated `AGENTS.md` to direct agents to current checkout/config and not assume unsupported scripts. | Addressed in instructions; re-check if layout changes |
| DOC-03 | Project Truth and Workflow Gap Matrix contain a historical 25 September baseline that differs from later implementation/status. | `docs/PROJECT_TRUTH.md`; `docs/WORKFLOW_GAP_MATRIX.md`; `Progress.md` | Treat opening historical notices as mandatory context. Current code, migrations, tests, and target-environment evidence must be rechecked before implementing or reporting status. | Historical docs retained; not deleted |
| DOC-04 | Agent memory records an Express/Drizzle/Replit stack and secret requirements inconsistent with the current root React/Vite/Supabase app. | `.agents/memory/tm-tracker-stack.md`; `README.md`; `package.json`; `vercel.json` | The stale memory now explicitly identifies itself as superseded and points to canonical current files. Do not reuse old stack/secrets advice. | Addressed in this change |
| DOC-05 | Root docs sometimes restate current status or architecture, creating duplicate claims that drift. | `README.md`; `DEV_NOTES.md`; `Progress.md`; topic docs | `AGENTS.md` and this index route agents to a single canonical topic document per domain; summary files should link rather than redefine rules. | Guidance added; broader link-by-link cleanup deferred |
| DOC-06 | Several old audit/release files are large and cross-linked; deleting/moving them immediately could erase evidence or break links. | Root audit/release files; `docs/PROJECT_TRUTH.md`; `docs/WORKFLOW_GAP_MATRIX.md` | Retain them for traceability, explicitly treat historical claims as non-authoritative, and avoid destructive moves until inbound links and unique content are mapped. | Intentionally retained |

## Canonical route after this change

- AI entry point and safety rules: [`AGENTS.md`](../AGENTS.md)
- Authority and task routing: [`DOCUMENTATION_AUTHORITY.md`](DOCUMENTATION_AUTHORITY.md)
- Client ledger requirements: [`LEDGER_REQUIREMENTS.md`](LEDGER_REQUIREMENTS.md)
- Existing workflow requirements: [`WORKFLOW_BUSINESS_RULES.md`](WORKFLOW_BUSINESS_RULES.md)
- Current status summary: [`Progress.md`](../Progress.md)
- Evidence/historical context: [`PROJECT_TRUTH.md`](PROJECT_TRUTH.md)
- Known conflicts: this file

## Next audit actions

1. Inspect the unified ledger migration and current ledger implementation end-to-end; document exactly which requirements are present, missing, and unverified.
2. Reconcile the payment-source paragraph in `WORKFLOW_BUSINESS_RULES.md` with the inspected schema/code and current production evidence. Do not edit it from documentation inference alone.
3. Search all markdown for stale root paths, pnpm/workspace commands, separate-repository claims, and duplicated current-status claims; repair links only where the intended target is certain.
4. Consider moving superseded large audits into `docs/archive/` only after verifying all inbound links and preserving their history.
5. Keep documentation-only changes separate from ledger implementation changes.
