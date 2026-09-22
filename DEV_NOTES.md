# Developer Notes

## Runtime flow

1. `AuthGate` establishes the staff Supabase session.
2. List screens request compact, server-filtered pages from `src/lib/api.ts`.
3. Record View fetches the full row and signs its private image only when opened.
4. Database triggers audit writes and enqueue Google Sheet mirror operations.
5. The Edge Function processes the outbox without exposing its secrets to the browser.

## Performance contract

- Database and Assigned screens use 50-row server pages.
- Canonical order is `type`, `client_code`, `case_number`.
- Dashboard metrics use count-only queries and never fetch trademark payloads.
- Notes, journal JSON and signed image URLs are excluded from lists.
- React Query caches pages, filter options and metrics with explicit stale times.
- CSV export downloads only records matching the active filters and does so on demand.

## Core files

- `artifacts/tm-tracker/src/lib/api.ts`: typed Supabase data layer and workflow logic
- `artifacts/tm-tracker/src/pages/DatabasePage.tsx`: canonical Datasheet and CSV export
- `artifacts/tm-tracker/src/pages/Dashboard.tsx`: count-only operational summary
- `artifacts/tm-tracker/src/pages/RecordView.tsx`: full digital and A4 record
- `artifacts/tm-tracker/src/pages/AssignedPage.tsx`: Stage 2 Assigned operational queue
- `artifacts/tm-tracker/src/pages/AgentsPage.tsx`: agent master profiles and per-case fee tracking
- `artifacts/tm-tracker/src/pages/PublicationPipelinePage.tsx`: journal-matched publication pipeline & demand notes
- `artifacts/tm-tracker/src/pages/LogsPage.tsx`: 8-column audit logs viewer
- `artifacts/tm-tracker/src/components/CaseWorkflowSection.tsx`: Stage 1–4 progression stepper, payment gate & history
- `artifacts/tm-tracker/src/components/StageDocumentsSection.tsx`: stage-wise document upload and signed URL view
- `artifacts/tm-tracker/src/components/RecordModal.tsx`: create/edit workflow
- `supabase/migrations`: authoritative database schema
- `supabase/functions/sync-google-sheet`: asynchronous mirror worker

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```

Do not revive the removed Express/Neon/mobile stack or make Google Sheets the primary browser datastore.
