# Historical Documentation Index

This folder is the index for historical/superseded references. These records are retained for traceability and inbound links; they are not active instructions or proof of current implementation.

## Current authority — read these first

- [`AGENTS.md`](../../AGENTS.md): mandatory AI contribution rules.
- [`DOCUMENTATION_AUTHORITY.md`](../DOCUMENTATION_AUTHORITY.md): topic routing and conflict resolution.
- [`LEDGER_REQUIREMENTS.md`](../LEDGER_REQUIREMENTS.md): owner-confirmed financial requirements; the separate Brandex Client Ledger is authoritative.
- [`WORKFLOW_BUSINESS_RULES.md`](../WORKFLOW_BUSINESS_RULES.md): existing case workflow and guards.
- [`LEDGER_INTEGRATION.md`](../LEDGER_INTEGRATION.md): external Ledger bridge and known enforcement limitations.
- [`Progress.md`](../../Progress.md): current status summary; older entries are historical.

## Retained historical references

The following large files remain at their existing paths for now because other audit/release documents cross-link to them. Their top-of-file notices and the authority rules above must be read before using any historical claim:

- [`SUPABASE_SQL_DEEP_AUDIT.md`](../../SUPABASE_SQL_DEEP_AUDIT.md) — 22 September audit snapshot; not current acceptance evidence.
- [`WORKFLOW_V2_ARCHITECTURE_AUDIT.md`](../../WORKFLOW_V2_ARCHITECTURE_AUDIT.md) — 22 September workflow/UI audit; contains old paths and historical findings.
- [`RELEASE_NOTES_V2.0.0.md`](../../RELEASE_NOTES_V2.0.0.md) — tagged release history, not current behavior.
- [`RELEASE_NOTES_V2.0.1.md`](../../RELEASE_NOTES_V2.0.1.md) — tagged release history, not current behavior.
- [`RELEASE_NOTES_V2.1.0.md`](../../RELEASE_NOTES_V2.1.0.md) — tagged release history, not current behavior.
- [`PROJECT_TRUTH.md`](../PROJECT_TRUTH.md) and [`WORKFLOW_GAP_MATRIX.md`](../WORKFLOW_GAP_MATRIX.md) — historical 25 September baseline; their opening notices define their evidence limits.

## Archive maintenance rules

1. Never use a historical audit, release note, old chat export, or memory file to override the latest owner instruction or canonical topic requirements.
2. For current implementation, inspect source, ordered migrations, RLS/RPCs, tests, and target deployment evidence.
3. Before physically moving any retained file, search and repair all inbound links and preserve unique evidence. Do not delete historical records just to reduce file count.
4. When a historical statement is superseded, add a clear notice and link to the current canonical reference rather than silently rewriting history.

