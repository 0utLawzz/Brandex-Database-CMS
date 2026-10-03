> Current requirements and verification limits: [Project Truth](docs/PROJECT_TRUTH.md), [canonical workflow](docs/WORKFLOW_BUSINESS_RULES.md), and [Progress](Progress.md). Active roles are Admin + User/Viewer; Editor is a historical enum value only.

# Security Policy

## Data boundary

Supabase is the source of truth. The browser uses only a publishable key; access is enforced with Supabase Auth and Row Level Security. Google Sheets receives asynchronous server-to-server mirror updates and is not directly writable from the browser.

## Secrets

Allowed in the frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- database passwords
- `GOOGLE_APPS_SCRIPT_SECRET`
- `SHEET_SYNC_CRON_SECRET`

Never commit `.env`, paste secrets into source code, or expose server-only values through a `VITE_*` variable.

## Authorization

- `admin`: record and administrative mutations, subject to database workflow guards.
- `viewer` (User/Viewer): authenticated read-only access; database RLS rejects writes.
- `editor`: historical enum value only. Existing Editor profiles are migrated to Viewer; the database prevents assigning Editor to a profile.

Production is private and staff-authenticated. Keep public sign-up disabled; public Viewer access is a future consideration only. Create staff accounts through the Supabase dashboard and review roles periodically. Verify leaked-password protection is enabled in Auth settings before production sign-off.

## Stored files

Trademark files use a private Supabase Storage bucket. The app issues short-lived signed URLs only when a record is opened. Validate file type and size before upload.

## Operational safeguards

- Keep RLS enabled on every business table.
- Do not add bulk permanent deletion.
- Keep the audit trigger and Sheet-sync outbox enabled.
- Apply database migrations in order and test them outside production first.
- Run `pnpm test`, `pnpm typecheck` and `pnpm build` before deployment.
- Rotate a secret immediately if it appears in logs, screenshots, chat or git history.

Report a security issue privately to the Brandex system administrator; do not open a public issue containing client data or credentials.
