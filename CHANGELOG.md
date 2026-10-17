# Changelog

Changes describe evidence and release status; dates use Asia/Karachi. Historical CMS logs remain in `Progress.md`.

## 17 October 2026 — Drive connection preparation and handoff

### Verified
- Owner saved Google OAuth web-client JSON outside source, enabled/configured Google access and registered `http://localhost:8765/oauth/callback`.
- Local one-time consent helper used state validation, PKCE and loopback binding; exchanged consent code, saved offline credentials privately and verified Drive API access. No token values recorded here.
- Refresh exchange and root folder discovery succeeded: X -> 1 ALL CLIENTS, A -> 2 CONSULTANTS. IDs recorded in `PROCESS.MD`.
- Connected account lists mature CMS project `jzcrfbyypbbbittzbyyx`; live migration inventory and absence of integrated billing/Drive tables checked.

### Blocked / not deployed
- Supabase CLI set/list secrets failed HTTP 403 (account privileges). Prepared env file is private, not proof of server configuration.
- No new schema migration, Edge Function deployment, frontend cutover or hosted upload/financial acceptance completed.
- Existing real data and standalone systems preserved.

### Documentation
- Added `PROCESS.MD` execution checklist, target map, root map, evidence, security handling, blockers and release gates.
- Added owner-requested `AGENT.MD` handoff linked to canonical `AGENTS.md`.
- Updated canonical agent instructions, build status and progress entry; preserved historical notes.

## 16 October 2026 — Integrated workflow/Ledger candidate (local)

- `48ae5f6`: integrated billing, client terms/rates, stage charges, multi-case allocations, receipts/edit/void, audit, associate settlement, timing, restoration, delivery and private Drive upload source.
- `beae83f`: aligned actual fee dates and fail-closed privileged checks.
- Local verification: 231 tests across nine files, TypeScript, Vite production build; Drive Deno type check passed. Not hosted acceptance.
- Produced editable 21-slide presentation and PDF in workspace outputs; source recovery bundles retained outside repository. Bundles do not back up production databases.
