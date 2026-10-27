# Documentation Authority & AI Routing

**Purpose:** prevent AI contributors from treating every repository file as equally authoritative. This is the canonical map for which source to consult for each question, how to resolve contradictions, and how to distinguish a requirement from implementation evidence.

## 1. Read order

For every task, follow this order—not every document in the repository:

1. Root [`AGENTS.md`](../AGENTS.md): mandatory safety and contribution rules.
2. This file: documentation authority, routing, and conflict resolution.
3. The one canonical topic document listed in the routing table below.
4. The relevant implementation, database migrations/policies/RPCs, and tests.
5. [`Progress.md`](../Progress.md) and [`docs/PROJECT_TRUTH.md`](PROJECT_TRUTH.md) only to understand reported status and evidence limits.
6. Historical audits, release notes, memories, and old logs only when investigating history or regressions.

Do not load every document by default. Follow only the references needed for the current task.

## 2. Authority order depends on the question

There is no single file that can answer every kind of question. Use the following hierarchy:

### A. What is the required business behavior?
1. The owner's latest explicit instruction or decision in the active task.
2. The canonical topic requirements document.
3. Other documentation only as context.

### B. What does the code/database currently do?
1. Checked-out source code, current ordered migrations, database policies/RPCs/triggers, and relevant tests.
2. Current deployment/live database evidence, when actually inspected and available.
3. Progress summaries and audit documents as pointers—not proof.

### C. Has something been verified?
Use the strongest evidence actually obtained:
- **SOURCE INSPECTED** — implementation was read; execution is not implied.
- **AUTOMATED TESTED** — named tests ran and passed; mocks are not live integration tests.
- **DATABASE VERIFIED** — the relevant database objects/behavior were inspected in the target environment.
- **FLOW VERIFIED** — the specific authenticated browser/user flow was exercised.
- **DEPLOYMENT VERIFIED** — the deployed version and relevant behavior were checked.
- **DOCUMENTED ONLY** — written down but not independently verified.

Never describe source inspection as live verification. Never infer production deployment from a local change or merged code.

## 3. Task routing table

| Task / question | Required canonical reference | Also inspect |
|---|---|---|
| Case stages, sub-stages, transitions, STOPPED, workflow guards | [Workflow Business Rules](WORKFLOW_BUSINESS_RULES.md) | Relevant UI/mutation code, ordered migrations, triggers/RPCs, tests |
| Client accounts, ledger charges, receipts, fee caps, outstanding balances, refunds, print statements | [Ledger Requirements](LEDGER_REQUIREMENTS.md) | Ledger code, schema/migrations, RLS, triggers/RPCs, receipt UI and tests |
| Ledger source of truth and CMS bridge | [Ledger Requirements](LEDGER_REQUIREMENTS.md) and [Ledger Integration](LEDGER_INTEGRATION.md) | Separate Brandex Client Ledger owns financial records; inspect both repositories and the bridge. CMS-local unified-ledger migration is legacy, not authority. Verify deployments before claiming live integration |
| Current project status, pending work, release checks | [Progress](../Progress.md) | Verify the named source/test/deployment evidence before acting |
| Historical baseline or why a prior audit differs | [Project Truth](PROJECT_TRUTH.md) and [Workflow Gap Matrix](WORKFLOW_GAP_MATRIX.md) | Current code/migrations; these files contain historical material |
| Auth, roles, RLS, storage, secrets | [Security](../SECURITY.md) and [AGENTS.md](../AGENTS.md) | Actual RLS policies, storage policies, RPC grants, environment usage |
| Build/test/deployment process | [README](../README.md), [Install](../INSTALL.md), root `package.json`, `package-lock.json`, `vercel.json` | Use only scripts/configuration present in the current checkout |
| UI design, brand assets, component behavior | [AGENTS.md](../AGENTS.md) | Current shared theme, assets, target component and visual tests |
| Old release claims, old architecture, past plans | Relevant release/audit file as history only | Current implementation and status; never use old claims as active instructions |

## 4. Known conflicts and how to handle them

The following conflicts have been identified during the documentation audit. They must not be silently resolved by an AI guess:

1. **Ledger architecture — owner decision recorded 28 October 2026:** the separate Brandex Client Ledger repository/application is the sole financial source of truth. `Progress.md` and the CMS-local `20261024000100_unified_client_ledger.sql` describe a competing legacy implementation and are not authority for future financial writes. CMS reads status through the authenticated `ledger-payment-status` Edge Function and keeps any `stage*_paid` fields as a cache only. Preserve the old migration/table until existing records and deployment state are audited; do not drop or reconcile them silently. Production bridge configuration and strict database-level enforcement still require independent verification.
2. **Root app path/package manager:** older `AGENTS.md` wording referenced `artifacts/tm-tracker/` and pnpm, while the current root contains `src/`, `package-lock.json`, and a Vercel config using npm. The checked-out manifest/configuration wins for commands and paths; verify again if the repository changes.
3. **Historical project truth:** `PROJECT_TRUTH.md` and `WORKFLOW_GAP_MATRIX.md` include a September 2026 baseline with findings later superseded by implementation. Their opening notices are part of their meaning. Do not copy an old status row into a current plan without rechecking.
4. **Progress is a summary:** `Progress.md` may include claims reported by the owner, local verification, deployed checks, and future work. Read the status labels and evidence details; do not treat every bullet as production-verified.
5. **Agent memory and skill content:** files under `.agents/memory/` and `.agents/skills/` can be stale or generic. They are never allowed to override this authority map, current repository configuration, or canonical topic rules.

If a new contradiction is found, add it to the audit file with both file paths, the conflict, the impact, and the evidence needed to resolve it. If it affects money, legal workflow, security, data ownership, or production, stop and request the owner's decision when evidence does not resolve it.

## 5. File lifecycle rules

- **Canonical:** one explicitly named document per topic; other files link to it rather than restating rules.
- **Status summary:** summarizes progress and evidence; does not redefine business requirements.
- **Historical/archive:** retained for traceability, visibly labeled historical/superseded, never treated as instructions.
- **Implementation:** code/schema/tests establish what is present, not what should be required.
- **Memory/skill:** optional convenience only; must not duplicate changing requirements or credentials.

Before deleting or moving documentation, search for inbound links and unique information. Prefer adding a clear historical notice and a canonical pointer over destructive deletion. Do not move/delete files as a cosmetic cleanup if it could break references or erase audit history.

## 6. Required pre-change checklist

Before a non-trivial implementation:
- [ ] Identify the task domain and read its canonical topic document.
- [ ] Confirm the owner-approved behavior and scope.
- [ ] Inspect current code, migrations/policies/RPCs, and relevant tests.
- [ ] Compare required behavior against implementation; list gaps rather than guessing.
- [ ] Identify any conflicting or historical documents.
- [ ] Avoid unrelated refactors, production operations, and unapproved migrations.
- [ ] After changes, run only available checks and report exact evidence and limitations.

## 7. Audit trail

See [Documentation Conflict Audit](DOCUMENTATION_CONFLICT_AUDIT.md) for the known contradictions and cleanup decisions. Update that file when a conflict is resolved or new evidence changes the assessment.
