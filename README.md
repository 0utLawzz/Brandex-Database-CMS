> Current requirements and verification limits: [Project Truth](docs/PROJECT_TRUTH.md), [canonical workflow](docs/WORKFLOW_BUSINESS_RULES.md), and [Progress](Progress.md). Admin + Viewer is intended; existing Editor permissions are active compatibility debt, not the target model.

# Brandex Database CMS

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production-success)

> Fast, secure trademark case-management Datasheet for **Brandex Law Associates**.  
> Production URL: **[https://brandexsheet.vercel.app](https://brandexsheet.vercel.app)**

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Supabase Setup](#supabase-setup)
- [Google Sheets Mirror](#google-sheets-mirror)
- [Deployment](#deployment)
- [Security Model](#security-model)
- [Verification](#verification)
- [Suggested Improvements](#suggested-improvements)
- [License](#license)
- [Author](#author)

---

## Overview

Brandex Datasheet is the primary operational system for managing trademark records at Brandex Law Associates. It replaces spreadsheet-centric workflows with a role-based web application backed by Supabase Postgres, while retaining Google Sheets as an asynchronous operational mirror and backup.

**Key principles**
- Supabase is the source of truth.
- The browser never receives service-role keys or Google Apps Script secrets.
- Every mutation is audited and queued for Sheet synchronization.

---

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | React + Vite (artifacts/tm-tracker) | Staff UI on Vercel |
| Database | Supabase Postgres | Primary record store + audit log |
| Auth | Supabase Auth + RLS | Intended Admin + Viewer; legacy Editor still actively authorized |
| Storage | Supabase Storage (private) | Trademark logos & files (signed URLs) |
| Mirror | Google Sheets + Apps Script | Async operational backup |
| Sync | Supabase Edge Function | Retryable outbox processor |

```text
Browser (staff) → Vercel (Vite app) → Supabase (Auth + Postgres + Storage)
                                         ↓
                              Outbox → Edge Function → Google Sheets
```

---

## Features

| Feature | Description |
|---------|-------------|
| Role-based access | Intended Admin + Viewer; active Editor authorization remains a verified gap |
| Trademark records | Full case data with search and filtering |
| Private file storage | Logos and documents via short-lived signed URLs |
| Audit trail | Every change recorded in Postgres |
| Sheet mirror | Automatic, retryable sync to Google Sheets |
| Archive on delete | Deleted rows move to Sheet ARCHIVE tab |
| One-time import | Idempotent importer for legacy Sheet data (~1,671 records) |

---

## Tech Stack

- **Frontend**: React, Vite, Tailwind, Radix UI, TanStack Query, Wouter, Zod, React Hook Form
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Package manager**: pnpm (workspace)
- **Deploy**: Vercel (`vercel.json` builds `artifacts/tm-tracker`)

---

## Installation

### Prerequisites

- Node.js 20+
- pnpm

### Local development

```bash
git clone https://github.com/0utLawzz/Brandex-Database-CMS.git
cd Brandex-Database-CMS
pnpm install --frozen-lockfile
cp .env.example .env
```

Set browser-safe values in `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

```bash
pnpm dev
```

See [INSTALL.md](INSTALL.md) for the complete installation and import guide.

---

## Supabase Setup

1. Create a Supabase project.
2. Apply migrations from `supabase/migrations/` (starting with `202608280001_brandex_datasheet.sql`).
3. Create staff users in **Authentication → Users**. New users receive the `viewer` role.
4. Promote approved users:

```sql
update public.profiles
set role = 'admin'
where user_id = (select id from auth.users where email = 'owner@example.com');
```

Intended roles: Admin + Viewer. Current database policies also allow Editor writes; see the Project Truth role inventory. Disable public sign-ups.

---

## Google Sheets Mirror

### One-time import

Deploy `google-apps-script/Code.gs`, set `BRANDEX_MIRROR_SECRET`, then run (server secrets only in the terminal session):

```bash
pnpm import:sheet
```

The importer is idempotent by record ID.

### Automatic sync

Deploy the Edge Function `supabase/functions/sync-google-sheet` with secrets:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_SECRET`
- `SHEET_SYNC_CRON_SECRET`

Invoke on a schedule with `Authorization: Bearer <SHEET_SYNC_CRON_SECRET>`. It processes up to 50 pending/failed outbox items per run.

---

## Deployment

**Vercel** — set only these frontend variables for Preview and Production:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Deploy from the repository root. Production URL: [https://brandexsheet.vercel.app](https://brandexsheet.vercel.app)

Never place service-role keys or Apps Script secrets in `VITE_*` variables.

---

## Security Model

| Control | Implementation |
|---------|----------------|
| Access control | Supabase Auth + Postgres RLS |
| File access | Private bucket + short-lived signed URLs |
| Secrets | Service role & Apps Script secrets stay server-side only |
| Audit | All mutations logged in Postgres |
| Delete behaviour | Soft-move to Sheet ARCHIVE tab |
| Source of truth | Supabase; Sheet is mirror only |

---

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

---

## Suggested Improvements

| Priority | Item |
|----------|------|
| Medium | Expand unit/integration tests around the outbox and role gates |
| Medium | Add structured logging / observability for the Edge Function |
| Low | Consider rate-limiting or CAPTCHA on auth endpoints if exposed more widely |
| Low | Document backup/restore procedures for the private storage bucket |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Author

**Nadeem (OutLawZ)** — Brandex Law Associates tooling  
GitHub: [0utLawzz](https://github.com/0utLawzz)  
Contact: net2outlawzz@gmail.com
