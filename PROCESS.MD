# Brandex process and release checklist

## 20 October 2026 - CMS-base implementation checkpoint

The owner chose the mature Database CMS as the base, with Client Ledger integrated into it. Mail Merge remains separate. The 17 October Suite-target note below is retained as history and is no longer a deployment instruction. Target database and frontend must be explicitly verified against current accounts and existing records before a release.

### Source checklist

- [x] Preserve workflow rules and replace stale smoke expectations with Monthly Billing default, assignment payable and calendar-month certificate checks.
- [x] Fix partial/void settlement dates, direct Agent payment dates, and add regression coverage.
- [x] Add atomic Sheet-sync job claiming, stale lease recovery and ordered per-case processing.
- [x] Escape spreadsheet/CSV formula-like user values and remove insecure legacy Sheet export fallback.
- [x] Bound CSV import size/rows/columns; validate uploaded file signatures and Drive folder ancestry.
- [x] Bound Ledger and publication reads; add clickjacking response headers.
- [x] Local verification: 236 tests across 11 files, TypeScript check, frontend production build, Edge Function syntax check and clean diff check. Deno runtime was unavailable for a full function type check.
- [ ] Review hosted schema/data and reconcile old Ledger/Sheet identities and balances before any migration.
- [ ] Verify destination, obtain recoverable database/Storage snapshot, configure secrets and validate Admin/Viewer flows on the hosted app before cutover.

The upload checks cover common file signatures and the Drive Edge Function path. Direct Admin writes to private Supabase Storage still rely on bucket authorization; deeper document-content scanning is a separate hardening boundary. Existing historical partial-payment dates require data review before any corrective backfill. No live deployment or financial migration has happened in this checkpoint.

## Owner target correction - 17 October 2026

The owner explicitly confirmed **Brandex-Suite `xogbpsnsmephupbqsfgb`** as the hosted target, with `https://brandex-suite.vercel.app`. This mature CMS branch remains a preserved, separate candidate/reference. Do not deploy its migrations into Suite. Current Drive implementation/release evidence is in `../brandex-suite/PROCESS.MD` and `../brandex-suite/docs/DRIVE_CONNECTION_STATUS.md`. Earlier CMS-target secrets/403 instructions below are historical, not the next action.


Updated: 17 October 2026 (Asia/Karachi).

## Current position

The implementation candidate is in this mature CMS repository on `feat/confirmed-workflow-ledger`. Source commits: `48ae5f6`, `beae83f`. The original standalone Ledger/Sheets and old Suite deployment remain separate. No new integrated schema, Drive function, or frontend cutover has been released. Never interpret a local passing test as hosted acceptance.

## Read in this order

1. This file: execution order and live blockers.
2. `AGENTS.md` and `AGENT.MD`: contributor rules and handoff.
3. `docs/SYSTEM_ROADMAP.md`: confirmed business decisions.
4. `docs/CONFIRMED_BUILD_STATUS.md`: implementation and verification boundaries.
5. `CHANGELOG.md` and newest entries in `Progress.md`: dated changes.

Later explicit owner decisions override historical notes. Preserve older records as history, not current instructions.

## Business baseline

- Database + Ledger are integrated; Mail Merge remains a separate workstream.
- Admin + authenticated read-only Viewer. Service Associate is a payee/contact, not a login.
- Series are configurable; client `X-254`, case `X-254-002`; TM optional initially, exactly six digits when issued, preserve leading zeroes.
- Monthly Billing is the initial default for all clients. Unpaid debt remains visible; no 60% threshold. Configurable Advance terms use actual full stage allocations.
- Stage 3 automatic charge is created at Accepted. Rates are snapshots; later rate edits affect new charges only.
- Staff record events manually. Flags never advance case status or send reminders. Calendar days/months include holidays.
- Filed -> optional Examination (reply submitted) -> Acknowledgment. Hearing must reach Accepted before publication.
- Filing: day 15 overdue; Examination: 7 days. Assigned: 0-7 green, 8-9 yellow, 10+ red.
- Accepted on days 1-20 targets that month's 25-28 journal, otherwise next month; missing by 29th flagged. Published + two calendar months flags missing Demand Note without objection. Actual ten-year fee submission + one calendar month flags missing certificate.
- STOPPED pauses flags; balances remain. TM-57 reactivation restores prior workflow, separate fee, restarted timing; does not assert IPO approval.
- Associate payable starts at assignment, default Rs1,000, separate from client stage fees. Partial/weekly settlement uses oldest unpaid fees. Dropped/stopped cases retain liabilities.
- Receiving may allocate across cases/stages; each case has its own receipt. Edit/void is audited; financial corrections never roll back workflow.
- Certificate office receipt differs from courier dispatch/hand collection. Store tracking, dates, destination, delivery and receipt attachment.

## Completed checklist

- [x] Creative 21-slide roadmap PowerPoint and PDF produced and visually checked (workspace `outputs/Brandex-Presentation.*`).
- [x] Recoverable source bundles created (not database backups).
- [x] Integrated billing/workflow/receipts/settlements/timing/delivery/Drive source committed locally.
- [x] 231 local tests, TypeScript and frontend production build passed during 16 October implementation; Drive Deno type check passed.
- [x] Google web OAuth client configured by owner; localhost callback registered.
- [x] User completed consent; local helper exchanged code and verified Drive API account access.
- [x] Refresh credentials saved privately outside repository. Do not copy them into docs.
- [x] Refresh-token exchange and exact-name folder discovery succeeded on 17 October; one matching folder for each configured root.
- [x] Live CMS migration inventory inspected. New `billing_series` and `case_drive_files` tables are absent.

## Drive mapping verified 17 October

| Series | Existing root | Folder ID |
|---|---|---|
| X | 1 ALL CLIENTS | `18T0MojE1IiT7uIz9P8Sthlamj8icR8X6` |
| A | 2 CONSULTANTS | `1Ke_B9vI_DdiiXPTTCBDtS4Ny6l73kIBU` |

N/new series require an owner-selected root. Preserve existing client/case folder IDs; do not create duplicate named folders. Folder discovery proves read access, not a successful app upload. No upload test file was created.

## Deployment targets and current blocker

- Existing mature CMS Supabase project: `jzcrfbyypbbbittzbyyx`, name `Brandex-Database-CMS`.
- Existing mature CMS frontend: `https://brandexsheet.vercel.app` (documented target; no fresh hosted acceptance this session).
- Old Suite URL: `https://brandex-suite.vercel.app`; do not confuse the two applications.
- Historical Suite project `xogbpsnsmephupbqsfgb` was not in the connected account's project listing on 17 October. Do not guess credentials or change another project.
- Attempt to set/list CMS function secrets returned HTTP 403, insufficient account privileges. Upload did NOT succeed. This is a platform permission failure, not an automatic approval-review rejection.
- Owner action pending: save the four values from private `G:\Brandex Workspace\private-config\cms-drive.env` to CMS Edge Function Secrets with an authorized Owner/Admin account, or repair CLI access. Never paste values into chat.
- Required names: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `BRANDEX_ALLOWED_ORIGINS`. Prepared origin is only `https://brandexsheet.vercel.app`; update deliberately for a verified preview host.

## Next execution checklist (in order)

- [ ] Confirm secrets were saved successfully, checking names/presence only.
- [ ] Reverify the intended hosted target and obtain a recoverable database/Storage snapshot before schema release.
- [ ] Reconcile old Ledger/Sheet identities, balances and allocation gaps; never fabricate backfill or wipe real financial data.
- [ ] Review exact pending migrations against hosted inventory and existing policies/functions. Do not blindly push the whole directory.
- [ ] Apply reviewed integrated schema; verify grants/RLS and Admin/Viewer access.
- [ ] Save verified X/A roots in series settings after the schema exists; choose other series roots explicitly.
- [ ] Deploy `case-drive-upload` with JWT/Admin validation and origin allowlist.
- [ ] Verify isolated real Admin upload, folder reuse, TM rename, retry and private retrieval; verify Viewer write denial.
- [ ] Verify hosted financial flow: stage charges, Accepted charge once, multi-case allocations/receipts, edit/void, FIFO settlements, timing and STOPPED/reactivation.
- [ ] Resolve bounded business edges listed below before affected workflows are released.
- [ ] Build and deploy a reviewable frontend; run browser -> API -> database acceptance with Admin + Viewer before production cutover.
- [ ] Record exact deployment URL, migration versions, test evidence, rollback material and remaining limits in this checklist and changelog.

## Remaining boundaries

Advance first-stage intake, old arrears/post-void Advance policy, restored Accepted journal cutoff, associate reassignment/fee correction, legacy Ledger reporting/export parity and renewal behavior still require review. Do not silently invent rules.

## Private material handling

Private directory: `G:\Brandex Workspace\private-config`. It contains OAuth client JSON, saved Drive credentials, a server env file, root discovery evidence and the one-time local consent helper. Never commit/upload this directory. Do not log tokens, authorization callback URLs/codes, client secret, refresh token, or env contents. Browser consent success is not deployment success. Check Google consent publishing/token-expiry behavior before calling the connection durable.

## Change recording rule

For every further change: record date, problem/decision, files/target, what changed, evidence, deployed vs local status, blocker and next step. Update checkboxes only from evidence. Preserve historical entries.
