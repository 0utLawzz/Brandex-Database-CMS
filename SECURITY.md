> Current requirements and verification limits: [Project Truth](docs/PROJECT_TRUTH.md), [canonical workflow](docs/WORKFLOW_BUSINESS_RULES.md), and [Progress](Progress.md). Admin + Viewer is intended; existing Editor permissions are active compatibility debt, not the target model.

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

- `viewer`: read access
- `editor`: existing active compatibility debt; current RLS still permits writes, including deletion on some tables. Not the intended application role.
- `admin`: application management, subject to the same workflow rules; enforcement gaps are listed in Project Truth.

Keep public sign-up disabled and create staff accounts through the Supabase dashboard. Review staff accounts and roles periodically.

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
