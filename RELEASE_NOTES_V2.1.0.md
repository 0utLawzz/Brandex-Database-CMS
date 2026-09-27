# Brandex Database CMS V2.1.0 Release Notes

**Release date:** 27 September 2026 | **Release type:** Minor release | **Previous release:** v2.0.1

## Overview

V2.1.0 consolidates the implemented CMS improvements accumulated since V2.0.1. This release-preparation task adds no application behavior and does not change workflow rules, branding assets, or production data.

## Included improvements

- Workflow validation and database guards, case event history, and focused PostgreSQL-backed tests.
- Dashboard metrics and filters, expanded search/database/publication displays, and trademark CSV import.
- Registry matching, publication tracking, case assignment, and agent fee management.
- Private case-document handling, record history, and existing role-gated operations.
- The existing configurable branding system remains in the source tree; theme, logo, and social-preview refinements are a separate follow-up.

CMS payment fields remain manual indicators and are not verified against Brandex Ledger. This release adds no Ledger connector or payment read path.

## Database migrations

The release source includes the ordered migrations `202609250001_workflow_enforcement.sql` and `202609260001_restore_branding_settings.sql`. This repository release does not apply migrations to production; deployment and live schema state must be confirmed separately.

## Verification

- `pnpm test` — 207 tests passed across 7 files.
- `pnpm typecheck` — passed.
- `pnpm build` — passed (Vite production bundle).
- Authenticated production role/document flows and production migration state remain unverified in this task.
- Editor access remains active in the current implementation; no role-model change is included here.

## Version and tag

- Release tag: `v2.1.0`.
- Existing tags `v2.0.0` and `v2.0.1` are unchanged.
