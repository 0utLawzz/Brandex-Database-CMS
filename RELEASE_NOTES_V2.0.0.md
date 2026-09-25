> **Phase 0 correction — 25 September 2026:** This is a historical report, not current acceptance evidence. Its completion, test, role, payment and UI claims are superseded by [Project Truth](docs/PROJECT_TRUTH.md) and [canonical business rules](docs/WORKFLOW_BUSINESS_RULES.md). Stage 2 payment is NOT required for agent assignment; Stage 1 payment gates Stage 2, and Stage 2 payment gates Stage 3. Intended active roles are Admin + Viewer; Editor remains active in the current implementation. Timers are internal business rules, not verified statutory deadlines. Do not execute the historical recommendations below as a roadmap.

# Brandex Database CMS — Version 2.0.0 Release Notes

**Release Tag**: `v2.0.0`  
**Release Date**: 22 September 2026  
**Status**: **FROZEN / OFFICIAL RELEASE**  
**Production URL**: [https://brandexsheet.vercel.app](https://brandexsheet.vercel.app)

---

## Overview

Brandex Database CMS V2 is the authoritative, production-grade trademark case management and registry platform for **Brandex Law Associates**. V2 represents a complete operational consolidation—transitioning from spreadsheet-centric processes to an audited, role-gated, cloud-native architecture powered by Supabase Postgres, Supabase Auth, Private Storage, React, Vite, and an asynchronous Google Sheets mirror.

---

## Key Features in V2.0.0

### 1. Complete Stage 1–4 Workflow Progression
- **Lifecycle Stepper**: Visual progression stepper tracing normal forward case advancement (`Stage 1` → `Stage 2` → `Stage 3` → `Stage 4`) with checkmarks, active stage pulses, and dedicated `STOPPED` state handling.
- **Canonical Terminology**:
  - **Stage 1**: `Filing`, `Acknowledgment`, `Examination`
  - **Stage 2**: `Assigned`, `Accepted`, `Hearing`
  - **Stage 3**: `Demand Note Submitted`, `Demand Note Received`, `Opposition: Filed`, `Opposition: Received`, `Opposition: Withdrawn`, `Published`
  - **Stage 4**: `CER Dispatch`, `CER Received`, `CER Acknowledge`
- **Transparent Expansion**: All display layers expand shorthand codes (`D-Note Submitted`, `OPPO: Filed`, etc.) to full legal terminology via `formatWorkflowLabel` while preserving internal database schema values for 100% backwards compatibility. `CER` is strictly preserved without unauthorized expansion.

### 2. Structured Stage Payments & Stage 2 Payment Gate
- **Structured Database Columns**: Persisted payment tracking via additive migration `202609220003_stage_payment_columns.sql` (`stage1_paid`, `stage1_paid_date`, `stage2_paid`, `stage2_paid_date`, `stage3_paid`, `stage3_paid_date`, `stage4_paid`, `stage4_paid_date`, `payment_reference`).
- **Stage 2 Payment Gate**: Historical claim withdrawn: Stage 1 payment gates entry to Stage 2; Stage 2 payment gates Stage 3 and does NOT gate agent assignment. Enforcement is incomplete and browser-side; see Project Truth.
- **Payment Attestation**: Marked with a clear `MANUAL — NOT VERIFIED` status badge indicating human bookkeeping entry without automated bank clearance.

### 3. Agent Assignment & Fee Tracking System
- **Agents Master System**: Dedicated master directory (`public.agents`) with contact details, active/inactive toggles, and city filtering.
- **Per-Case Fee Ledger**: `public.agent_fees` tracking billed amounts, paid amounts, payment dates, and automatic paid status calculation (`amountPaid >= amountBilled`).
- **Real-Time Assignment Counts**: On-demand query of trademark cases assigned to each agent (`assignedCases`, `acceptedCases`, `totalCases`).
- **Interactive Assignment Queue**: Dedicated `AssignedPage.tsx` filtering Stage 2 assigned cases with payment status pills and assignment modals.

### 4. Stage-Wise Private Document Storage
- **Private Supabase Bucket**: Configured private `trademark-files` storage bucket (10MB limit) restricted to authenticated staff via short-lived (1-hour) signed URLs; no public URLs are ever exposed.
- **Database Metadata**: `public.trademark_files` table with `stage`, `sub_stage`, and `title` columns created via migration `202609220004_trademark_files_stage_columns.sql`.
- **Atomic Upload & Cleanup**: Client validates MIME types and sizes; uploads are stored deterministically under `{trademarkId}/{stage}/{uuid}.{ext}` with automatic orphan storage cleanup if the database metadata insert fails.
- **Role-Gated Upload**: Upload modal restricted to Editor and Admin roles; Viewers have strictly read-only access.

### 5. Publication Pipeline & Match Engine
- **Journal-Matched Pipeline**: `PublicationPipelinePage.tsx` operating exclusively on published cases (`publication_date IS NOT NULL`).
- **Opposition Deadline Tracking**: Computes days remaining against internal publication counters with color-coded badges (`pending`, `overdue`, `done`).
- **Demand Note Management**: Controlled recording of Demand Note received dates.
- **Dual Match Engine RPCs**: `run_journal_match()` and `run_form_match()` with security-definer execution restricted to Editor and Admin roles.

### 6. Audit Logs & Trademark Workflow History
- **8-Column Audit Log**: `LogsPage.tsx` with date, time, user, action badge, clickable case link, application number, trademark name, and detailed change summaries.
- **Event-Driven Workflow History**: Dedicated trigger `trademarks_workflow_history_trigger` logging stage/sub-stage transitions with user timestamps in `public.trademark_workflow_history`.

### 7. Compact A4 Print System & Workflow Reminders
- **Professional A4 Print Layout**: Clean black ink on white background with official Brandex Law Associates letterhead banner and confidentiality dossier footer.
- **Compact 2-Page Flow**: Removed outer-wrapper `break-inside: avoid` constraints that previously caused artificial 4-page expansion. A standard case now prints cleanly on 2 pages.
- **4 Workflow Reminders**: Purely informational stage-adaptive guidance cards hard-capped at exactly 4 items (1: Filing, 2: Agent Assignment, 3: Publication & Opposition, 4: Registration Certificate).
- **CEO Attestation Block**: Official signature and stamp attestation box (no fabricated signatures).

### 8. Role-Based Access Control (RBAC) & Security
- **Admin / Owner**: Full write, delete, user management, and CSV registry import access.
- **Boss / Viewer**: Strictly read-only access; create/edit/delete buttons, status transition modals, and file uploads are disabled or hidden.
- **Public**: Zero access to private CMS.
- **Security Remediation**: Migration `202609220005_fix_agent_summary_security.sql` applied `security_invoker = true` to `public.agent_summary` view to resolve Supabase Security Advisor warnings.

### 9. Neo-Brutalism / BrandEx Visual Identity
- **Curated Brand Palette**: Brandex Maroon (`#6C1C1F`), Gold (`#B0740E`), Cream (`#F0E8D0`), Dark Black (`#0C0C0C`), and Green (`#0A6B52`).
- **Token Cleanup**: Purged all legacy experimental tokens (`#C94A00`, `#D4A800`, `#0A1931`, `#3A506B`).
- **Responsive Layout**: Full horizontal scroll protection (`overflow-x-auto`) and mobile-friendly grids across all 8 screens.

---

## Database Migrations in V2

1. `202608280001_brandex_datasheet.sql` — Base schema and outbox triggers
2. `202608280002_allow_duplicate_case_references.sql` — Flexible case references
3. `202609070001_phase1_query_indexes.sql` — Query performance indexes
4. `202609120001_form_journal_registry.sql` — TM form & journal registries
5. `202609200001_match_engine_publication.sql` — Publication workflow & match engine
6. `202609200002_agents_fees.sql` — Agents master & fee tracking
7. `202609220001_fix_match_engine_security_and_logic.sql` — RPC authorization hardening
8. `202609220002_trademark_workflow_history.sql` — Status transition trigger & history table
9. `202609220003_stage_payment_columns.sql` — Structured stage payment columns
10. `202609220004_trademark_files_stage_columns.sql` — Stage document tracking columns
11. `202609220005_fix_agent_summary_security.sql` — Agent summary view security invoker fix

---

## Verification & Test Results

- **Vitest Unit & Integration Tests**: 43/43 passing (2 test suites: `api.test.ts`, `registryImport.test.ts`).
- **TypeScript Typecheck**: 0 errors (`tsc -p tsconfig.json --noEmit`).
- **Production Bundle**: Compiled cleanly with Vite v7.3.6 (`dist` generated).

---

## Manual Production Verification Items

The following items require authenticated staff credentials or cloud console access:
1. **Live Supabase RLS Policy Verification**: Verify row-level restrictions for live Viewer and Editor accounts.
2. **Live Storage Upload / Download**: End-to-end test of signed URL retrieval in the production `trademark-files` bucket.
3. **Live Web Smoke Test**: Verification against [SMOKE_TEST_CHECKLIST.md](file:///g:/PyTools/Brandex-Database-CMS/SMOKE_TEST_CHECKLIST.md) on `https://brandexsheet.vercel.app`.
4. **Vercel Secret Inventory**: Confirm absence of `SUPABASE_SERVICE_ROLE_KEY` from public client environment variables.
- Phase 0 correction: the publication counter is an internal two-calendar-month business rule; statutory periods/extensions were not verified. TM56 response and extension tracking remain unimplemented.

---

## V3 / Future Backlog Boundary

Deferred to future versions (must not be added to V2):
- Public Journal Lookup Page (isolated from private client data).
- Automated banking / payment API clearance integration.
- Automated periodic payment checking worker.
- Automated hourly cron worker for journal/form matching.
- Exceptional workflow & court remand revival mechanisms.
- Advanced dashboard KPI analytics and cohort curves.
