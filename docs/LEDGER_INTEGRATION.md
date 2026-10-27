# Unified Client Ledger — Implementation Snapshot

**Purpose:** describe the currently committed architecture, not define all required ledger behavior. Owner-confirmed financial behavior is in [LEDGER_REQUIREMENTS.md](LEDGER_REQUIREMENTS.md). AI reference routing is in [DOCUMENTATION_AUTHORITY.md](DOCUMENTATION_AUTHORITY.md).

## Current implementation described by the repository

The migration `supabase/migrations/20261024000100_unified_client_ledger.sql` creates `public.client_ledger_entries` in the CMS Supabase database. The table links each entry to a trademark/case through `trademark_id REFERENCES public.trademarks(id)`, stores `charge` or `receiving` entries with stage codes S1–S4, and includes soft-void metadata. A receipt sequence and trigger/RPC-based stage-paid synchronization are also defined in the migration.

The source code in `src/lib/ledgerPayments.ts` queries the unified table first, attempts an Edge Function fallback, and then has a cached case-flag fallback. This is an implementation observation, not a recommendation that all fallbacks are correct. In particular, a cached paid flag and fabricated nonzero receipt amount must not override financial ledger truth; see the owner-confirmed rules in [LEDGER_REQUIREMENTS.md](LEDGER_REQUIREMENTS.md).

## Important scope boundary

The current case-linked table is not, by itself, proof of the requested consolidated client-account model. The owner-confirmed target includes a client-level account across all cases, agreed stage fee schedules, due-only charge creation, stage fee caps, valid partial receipt allocation, explicit audited adjustments/refunds, duplicate case ownership protection, audited transfers, and Full Ledger / Selected Ledger printing.

Do not state that these requirements are implemented merely because a unified table or receipt modal exists. Inspect the current schema, code, RLS, triggers/RPCs, and tests; classify each requirement separately as source-inspected, automated-tested, database-verified, flow-verified, or deployment-verified.

## Security and audit principles

- Preserve RLS and role checks.
- Keep financial history auditable; do not permanently erase a financial event to correct it.
- Any void, refund, reversal, waiver, or ownership transfer must use an explicit authorized operation and preserve the audit trail.
- Receipt numbering must be enforced by the authoritative server/database path; UI-generated values must not bypass sequence/uniqueness guarantees.
- Do not expose database/service-role credentials to the browser.
- Do not execute migrations or change production data without explicit owner approval.

## Verification status

This document does not certify live production synchronization or complete client-wide ledger behavior. Use [Progress](../Progress.md) for the reported work queue, then independently verify the relevant behavior before marking any requirement complete.
