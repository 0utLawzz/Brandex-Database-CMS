# Authenticated Browser Smoke Test & Vercel Production Verification Checklist

Use this checklist to complete the remaining **Required release checks** listed in `Progress.md`.

Perform the browser tests while logged in with three different roles (viewer, editor, admin). Record pass/fail and any observations.

---

## 1. Preparation

- [x] Confirm production URL is reachable: https://brandexsheet.vercel.app (login/AuthGate rendered successfully)
- [ ] Have three test accounts ready (viewer, editor, admin) — blocked: credentials were not supplied
- [x] Browser console monitoring completed; no console errors were observed on the unauthenticated entry screen
- [ ] Access to the Vercel project dashboard (Project → Settings → Environment Variables) — project metadata was available, but environment-variable inventory was not exposed
- [ ] Access to the Supabase project dashboard (for role verification and outbox checks)

---

## 2. Viewer role

Status: **MANUAL RELEASE CHECK REQUIRED — credentials not supplied in automated environment.**

- [ ] Can log in successfully
- [ ] Can view Dashboard, Database list, Search TM, Assigned queue, Agents page, Publication Pipeline, Audit Logs
- [ ] Can open Record View, see details, documents, reminders, workflow history
- [ ] Cannot create records (`ADD RECORD` disabled with role restriction message)
- [ ] Cannot edit records (`RecordModal` displays read-only viewer banner; Save button disabled)
- [ ] Cannot delete records (`DELETE` action disabled / not permitted)
- [ ] Cannot assign or change agents (Agent assignment action hidden in `CaseWorkflowSection`)
- [ ] Cannot mutate workflow status or advance stages (Update Status action hidden in `CaseWorkflowSection`)
- [ ] Cannot toggle stage payments or edit payment dates (checkboxes and date fields disabled)
- [ ] Cannot upload stage documents (Upload Document action hidden in `StageDocumentsSection`)
- [ ] Cannot create/edit agent profiles (`NEW AGENT` button disabled)
- [ ] Cannot delete agent fees (Delete action hidden in `AgentsPage`)
- [ ] Cannot run Match Engine (`RUN MATCH ENGINE` button disabled with role requirement tooltip)
- [ ] Cannot access Admin CSV Import (`IMPORT` button alerts admin required)

---

## 3. Editor role

Status: **MANUAL RELEASE CHECK REQUIRED — credentials not supplied in automated environment.**

- [ ] Can log in successfully
- [ ] Can perform all viewer actions
- [ ] Can create new trademark records with validation (canonical Type, Client Code, Case No)
- [ ] Can edit existing records (optimistic concurrency version check prevents overwrite conflicts)
- [ ] Can transition workflow stages in `CaseWorkflowSection`:
  - STAGE 1: Filing → Acknowledgment → Examination
  - STAGE 2: Assigned → Accepted → Hearing
  - STAGE 3: Demand Note Submitted → Demand Note Received → Opposition: Filed → Opposition: Received → Opposition: Withdrawn → Published
  - STAGE 4: CER Dispatch → CER Received → CER Acknowledge
  - STOPPED: Case Stopped halts lifecycle track
- [ ] Stage 2 Payment Gate: Editor cannot advance case to STAGE 2 or assign an agent if `stage2_paid` is false
- [ ] Stage Payments: Editor can record manual payment checkboxes and dates (clearly labeled `MANUAL — NOT VERIFIED`)
- [ ] Stage Documents: Editor can upload files to private bucket (<=10MB, permitted MIME types) with automatic signed URL generation
- [ ] Agent Operations: Editor can create/edit agent profiles and record per-case fees
- [ ] Publication Pipeline: Editor can mark Demand Note received with custom date, clear status, and run Match Engine RPCs
- [ ] Cannot delete records (`DELETE` button restricted to Admin)
- [ ] Cannot access Admin CSV Import modal (Admin only)

---

## 4. Admin role

Status: **MANUAL RELEASE CHECK REQUIRED — credentials not supplied in automated environment.**

- [ ] Can log in successfully
- [ ] Can perform all editor actions
- [ ] Can delete a single record with confirmation
- [ ] Deleted record is removed from Datasheet, recorded in `audit_logs` (DELETE), and queued in `sheet_sync_outbox`
- [ ] Can access and execute Admin CSV Import (`RegistryImportModal`) for Form Registry and Journal Registry
- [ ] Can manage staff roles in `public.profiles`

---

## 5. Cross-cutting & V2 Workflow verification

- [ ] Canonical ordering: Datasheet and export maintain Type → Client Code → Case Number
- [ ] Stage 2 Assigned queue displays only Stage 2 Assigned cases with S2 PMT status pill (PAID / UNPAID)
- [ ] Agent summary statistics: Assigned/Accepted/Total case counts load on demand; financial totals compute correctly
- [ ] Publication Pipeline displays journal-matched records with countdown days, opposition deadline, demand note date, and direct `/record/:id` link
- [ ] Exactly 4 Informational Reminders: Filing & Documentation, Agent & Assignment, Publication & Opposition, Registration & Certificate
- [ ] A4 Print layout: clean black ink on white background, Brandex letterhead, no navigation/sidebar chrome, official CEO signature/stamp block
- [ ] 8-column Audit Logs: DATE, TIME, USER, ACTION, RECORD (link to `/record/:id`), APP NUMBER, NAME, CHANGES
- [ ] Workflow history: chronological status transitions recorded in `trademark_workflow_history` via database trigger, separate from general audit logs
- [ ] Signed image and document URLs expire after 1 hour (no permanent public URLs exposed)
- [ ] CSV export downloads only currently filtered records without leaking unauthorized data

---

## 6. Vercel Production Verification (Item 2)

Perform these checks in the Vercel dashboard for the production environment.

### 6.1 Environment Variables (Critical)

Status: **Not independently verified.** The available Vercel project metadata did not expose the environment-variable inventory. Do not treat the prior documentation claim as a fresh dashboard confirmation.

- [ ] Only the following two variables exist for Production (and Preview if used):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] No variable named `SUPABASE_SERVICE_ROLE_KEY` is present
- [ ] No variable named `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_SECRET`, or `SHEET_SYNC_CRON_SECRET` is present
- [ ] No other secrets appear under any `VITE_*` prefix
- [ ] Values match the correct Supabase project (publishable key only)

### 6.2 Build & Deployment Settings

Status: **Partially verified from repository configuration.** `vercel.json` matches the documented build, install, framework, and output settings; dashboard override fields were not exposed by the available project metadata.

- [ ] Root directory is the repository root (not a sub-folder)
- [ ] Build command matches `vercel.json`: `pnpm --filter @workspace/tm-tracker run build`
- [ ] Output directory matches `vercel.json`: `artifacts/tm-tracker/dist`
- [ ] Framework preset is Vite (or left as detected)
- [ ] Install command uses pnpm (`pnpm install`)

### 6.3 Deployment Health

- [x] Latest Production deployment is READY and linked to the expected Git commit / branch (`main`); detailed build-log inspection was not exposed by the available project API
- [x] Deployment is linked to the expected Git commit / branch (main)
- [ ] No failed or cancelled deployments in the recent history that indicate secret or build problems — earlier recent ERROR deployments exist, although the current production deployment is READY
- [x] Production domain `brandexsheet.vercel.app` resolves and serves the application

### 6.4 Runtime Spot Checks (from browser)

- [x] Opening https://brandexsheet.vercel.app shows the login / AuthGate screen (no hard crash)
- [ ] After login, network requests go only to the Supabase project URL (no unexpected third-party calls carrying secrets)
- [x] Browser console contains no errors about missing environment variables on the unauthenticated entry screen
- [ ] Page source / network tab never reveals a service-role key

### 6.5 Post-verification actions

- [ ] If any forbidden secret was found in Vercel, rotate that secret immediately in Supabase / Apps Script and remove it from Vercel
- [ ] Record the deployment URL / commit hash that was verified
- [ ] Update `Progress.md` – mark “Vercel production verification” as complete and set the new “Last updated” date

---

## 7. Sign-off

Date: 12 September 2026
Tester: Codex automated verification
Result: **Partial / blocked** — public entry-point and code-side checks passed; authenticated role flows and dashboard secret inventory were not executable without credentials/dashboard access.

Verified Production deployment commit / URL:

`45c7c046dd7b65b4f7a02bcf8790d42c044e7921` / https://brandexsheet.vercel.app



Notes:

- Automated tests, typecheck, and production build passed.
- The unauthenticated production screen rendered successfully and showed no captured browser console errors.
- Viewer, editor, and admin smoke flows remain unchecked because no credentials were supplied; no PASS was inferred.
- The held phases (CSV import, related sheets, agent assignment timeline, and public search endpoint) were not started.



After completing the checklist, mark the corresponding items as done in `Progress.md` and update the “Last updated” date.
