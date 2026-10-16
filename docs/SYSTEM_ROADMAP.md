# Brandex IPO Case Management — System Definition & Roadmap

**Decision baseline: 16 October 2026**  
**Status: Confirmed requirements. Local implementation candidate started in the mature CMS repository; no production cutover yet.**  
**Authority: Latest explicit owner decisions supersede conflicting earlier specifications.**

## 1. System hamara hai kya?

Brandex ka IPO trademark case-management backend. Filing aur record creation sirf shuruat hain. Case ko stages, payments, correspondence, publication, certificate receipt aur client delivery tak manage karna hai. Owner ne isay ten-year responsibility kaha; detailed renewal scheduling abhi specify nahi hui.

Datasheet se ek search par pata chale: case kahan hai, kab se pending hai, agla kaam kya hai, payment position kya hai aur kiski zimmedari hai.

**CMS workflow own karta hai. Client Ledger actual charges/receiving own karta hai.** Dono ki identity align karke reliable payment information connect karni hai. Mail Merge alag system/scope rahega.

### Working boundaries

- Mature `Brandex-Database-CMS` aur `Brandex-Client-Ledger` ko preserve/improve karna hai; smaller generic replacement nahi.
- Ledger ka HTML/JavaScript mein hona rewrite ki wajah nahi. UI redesign baad mein.
- Old source, active deployments, Sheets aur Drive documents ko delete, overwrite ya blindly import nahi karna.
- Earlier “all data is test data” statement is not permission to wipe subsequently supplied real business Sheets/files.
- New Suite ke previous phase labels business parity prove nahi karte. This roadmap is the updated business baseline.
- Roadmap banana production change, Suite deletion/rollback, data migration ya deployment approval nahi hai.

## 2. Relations and identities

```text
Series → Client account → Cases
Client → Payment Terms + Stage rates + Drive destination
Case → Events/history + Stage charges + Allocated receiving
Case → Documents + Certificate delivery + Service Associate assignment
Receiving → Multiple case/stage allocations → Receipt per case
Service Associate payment → Oldest unpaid assignment fees
```

| Example / field | Meaning |
|---|---|
| X / A / N | Configurable series; new series can be added |
| X-254 | Client account |
| X-254-002 | Series X, client 254, case 002 |
| Six-digit TM | Unique matching identifier when issued; initially may be absent |

- Case reference supports charges, receiving and receipts BEFORE a TM exists.
- Later add TM to the SAME case. Never duplicate the case, charge or payment.
- Keep a stable internal case relationship across systems. Match by aligned case identity before TM and unique TM when present.
- Normalize six-digit input/matching consistently; preserve leading zeros. Text storage can correctly preserve identifiers: the requirement is correct format/validation, not arithmetic.
- Reject ambiguous duplicate matches. Never pick the first of multiple matching TM rows.
- Preserve existing reference variants and client suffixes; reconcile them explicitly rather than merging by similar name.
- Case numbering remains manual unless separately approved. Drive upload discussion did not approve automatic numbering.

## 3. Final payment policy

**Every client initially defaults to Monthly Billing / Credit, across ALL series.**

| Client Payment Terms | CMS behavior |
|---|---|
| Monthly Billing / Credit | Pending receiving does not block progress; actual outstanding remains visible |
| Advance Payment | Required stage must be fully paid before entry into it |

- A-series represents ongoing business, often many cases monthly. Other series are usually one-off. Terms are configurable per client, not permanently inferred from series.
- **60% rule is removed.** Do not implement it.
- No extra per-case credit approval/reason workflow was requested.
- Credit permission is NOT Paid. Show billed, allocated received, outstanding and terms separately.
- Ledger must accept charges, advances, partial receiving and monthly payments. Stage gating belongs to CMS actions, not Ledger write restrictions.
- A client payment edit/void changes balances and verification display, never automatically reverses a case stage.
- Advance Payment integration needs a reviewed charge/receive/enter sequence so auto-charge creation cannot deadlock stage entry. Previous-stage arrears and later payment void handling need explicit acceptance examples. Default credit is already confirmed.

## 4. Stage charges, receiving and receipts

### Charges

- Each client has preset Stage 1–4 rates.
- Saving a new Filing case automatically creates Stage 1 charge.
- Entering each later stage creates its charge automatically, once.
- Repeated saves, retries and reactivation must not duplicate stage charges.
- Rate changes affect NEW charges only; existing charges retain their original amount.
- Missing rates must be shown for resolution; do not invent rates or silently treat missing fees as paid.
- TM-57 and other extra work use manually entered separate charges, outside standard Stage 1–4 rates.

### Receiving and allocations

- A receiving may cover multiple cases and stages; monthly A-series payments also allocate to case/stage.
- Maintain one receiving total and explicit allocations; never count case receipt copies as additional money.
- Staff allocates existing advance/unallocated funds MANUALLY. New charge does not automatically consume advance.
- Client-level received money alone does not confirm payment of a specific case/stage.
- One case can receive partial payments. Allocation amounts must reconcile with the parent receiving.

### Receipts, printing and corrections

- Separate receipt for EACH CASE in a payment.
- One case receipt can include multiple stage lines and their separate amounts.
- Support Edit and Void/Cancel for client entries AND Service Associate payments.
- Audit old/new values, user and timestamp. Voided entries remain visible as VOID and are excluded from active totals.
- Receiving edit retains its receipt number with revised details; preserve the previous issued details in history.
- Void marks the related receipt VOID. Recalculate balances and stage payment display without rewriting case progress.
- Preserve existing ledger print, reports, exports and client-wise balance views.

## 5. Workflow and time flags

All days include holidays. Months mean calendar months, not 30/60 working days. Use actual business event dates, not record creation or last modification.

**Only staff event/status updates advance the case.** Time creates a visible/filterable flag, never automatic progression or STOPPED. No email, reminder messages or notification automation requested.

| Event/state | Expected result | Confirmed internal flag |
|---|---|---|
| Filed | Examination reply submitted or Acknowledgement | Flag from calendar day 15 if neither recorded; no Filing Green/Yellow ladder |
| Examination marked | Acknowledgement | Flag at completion of 7 calendar days after reply submission |
| Stage 2 Assigned | Accepted or Hearing | Days 0–7 Green; 8–9 Yellow; day 10 onward Red/Overdue |
| Accepted on 1–20 | Same month's journal | Expected 25–28; missing publication Red from 29th |
| Accepted after 20 | Next month's journal | Expected next month 25–28; missing publication Red from 29th |
| Published, no objection | Demand Note | Mark immediately at completion of 2 calendar months if not received |
| Actual ten-year fee submitted | Certificate received at Brandex office | Red at completion of 1 calendar month if not received |
| Certificate at office awaiting client request | Dispatch/collection | No automatic overdue simply because client waits |

These are owner-defined internal operational targets, not assertions of statutory deadlines. Month-end arithmetic/time-of-day boundaries require concrete acceptance examples.

### Stage 1

- No issue: File → Acknowledgement.
- Issue: File → Examination → Acknowledgement.
- Examination optional; marking it means reply/written statement SUBMITTED, not merely examination letter received.

### Stage 2 and publication

- Assigned → Accepted OR Hearing. Rejection at this point means Hearing, not STOPPED.
- Hearing → Accepted when successful. Hearing cannot directly progress to Published.
- Journal expectation uses Accepted date, including acceptance after hearing.
- Expected month does not automatically publish the case; record/match actual publication.
- **Confirmed 16 October:** Stage 3 charge starts at Accepted while awaiting publication. Published remains an actual recorded event.

### Stage 3 and certificate

- Preserve Published → Demand Note Received → Demand Note Submitted, subject to Stage 3 boundary above.
- Objection switches follow-up away from the no-objection Demand Note path.
- Record actual hearing dates/history; no automatic hearing-date overdue marking and no invented repeating dates.
- Keep existing opposition/TM56 history and review its validations separately. Declining hearing alerts does not authorize deleting other procedural rules.
- Certificate timer starts from actual ten-year fee submission, not client payment receiving or charge creation.
- Office receipt and sending certificate to client are different events. Reconcile old Stage 4 labels rather than confusing IPO dispatch with Brandex dispatch.

## 6. STOPPED and restoration

- STOPPED is manual; overdue is never automatically dead/stopped.
- While STOPPED, normal timing flags stop. Preserve prior stage/sub-status, dates and stop history.
- Client dues and Service Associate payable remain; financial corrections are separate Edit/Void actions.
- TM-57 submission allows INTERNAL Active and return to previous stage/sub-status, per owner instruction.
- Record filing date, upload and manual extra charge. No duplicate standard-stage charge/payable.
- Restart elapsed-time timing from REACTIVATION date; preserve original event dates.
- Internal Active does not claim IPO restoration approval. Approval is recorded separately when known. Pakistan Trade Marks Rules 2004 Rule 27(3) describes restoration subject to Registrar satisfaction: https://www.wipo.int/wipolex/en/legislation/details/3491 . Screenshot fees are references, not permanent hardcoded rates.
- Reactivated Accepted cases require a specific journal-cutoff rule (original Accepted versus reactivation date); do not guess.

## 7. Service Associate accounting

- Working replacement for business term Agent; a service contact/payee, not automatically an app user/login role.
- Agreed amount separate from client fees; no percentage calculation from stage fee.
- Default Rs.1,000 per assigned case, adjustable agreed amount.
- Payable starts at ASSIGNMENT, not Accepted. Drop/failure/STOPPED does not automatically cancel it.
- Weekly payment can settle multiple cases: 10 default assignments = Rs.10,000.
- Partial payment allowed; allocate to oldest unpaid fees, leaving any partial remainder.
- Maintain assignment, fee, payment allocation, balance and Edit/Void history.
- Reassignment and fee correction after settlement require explicit rules; avoid duplicate payables on retry/reactivation.

## 8. Certificate delivery

- Office Received date separate from dispatch or collection.
- Courier fields: company/TCS, tracking number, dispatch date, destination, delivery confirmation date and receipt upload.
- Hand Collected option with collection date.
- Record events in case history. No automatic courier API/live carrier tracking was requested.

## 9. Drive folders and upload

- Computer/mobile UPLOAD only; existing-file picker is not required.
- Upload into real client/case folders; link actual folder/file IDs.
- Reuse existing folders. Create missing client/case folder with duplicate-safe retries.
- Case folder initially uses reference + mark name + class; add TM to SAME folder name when available, preserving ID/files.
- User chooses destination; X default `1 ALL CLIENTS`, A default `2 CONSULTANTS`. New series can have a chosen default root.
- Preserve existing naming variations; uncertain matches need reconciliation, not automatic bulk rename/merge.
- Local synchronized F-drive paths are examples, not server-accessible Drive IDs.
- Setup must establish Google account, root IDs, file ownership and private authorized access. A linked file does not automatically grant staff permission.
- Upload/rename failures must be visible and retryable. No public sharing or browser-exposed credentials.

## 10. Datasheet and permissions

Preserve existing search/filter coverage: TM, client/case reference, application name, date range, Type/Series, client code, stage, sub-status, Class, case type, city, Service Associate and TM Form registry matches. Add confirmed follow-up flags and payment-term/payment-position filtering.

Show identity, current stage/event date, elapsed time, flag reason, next action, stage charges/receiving/outstanding, payment terms, associate payable, documents, delivery and history together. Keep server-side filtered pagination; do not load all case records merely to paginate a dashboard.

Display Stage 1/Stage 2/Stage 3/Stage 4 in screens, receipts and reports; S1 etc. are internal codes. Keep workflow events distinct from full audit log.

Admin + read-only Viewer confirmed. Service Associate is a business contact/payee and has no login. Do not widen access based on the earlier Suite Agent implementation.

## 11. What source review actually found

Local review covered old CMS rules, active source and migrations; Ledger schema, scripts, loaded overrides and payment RPC. Selected header/sample rows of Consultants Sheet were read. This is not fresh live-schema or end-to-end production verification.

| Existing implementation | Required change/preservation |
|---|---|
| Mature CMS workflow, search, registry, publication, documents and audit | Preserve and regression-test |
| Manual CMS payment flags; incomplete Ledger connector | Verified stage/case payment contract and authenticated integration |
| Ledger series, client rates, charges, receiving, stage-status RPC | Reuse and extend; do not replace with simple paid/pending list |
| Non-unique normalized Ledger TM index; RPC takes first match | Resolve ambiguity before trusting identity/payment matches |
| Old previous-stage full-payment gates in BOTH systems | Replace with client terms; remove Ledger entry blocks conflicting with monthly billing |
| Single-case/stage receiving entry | Parent receiving + explicit multi-case/stage allocations |
| `phase2.js` functionality not loaded by inspected `index.html` | Dormant code is not operational evidence; inspect `gaps.js` and `gaps-print.js` active paths |
| Hearing can enter Published; STOPPED terminal | Hearing → Accepted; TM-57 internal reactivation |
| Associate payable starts on Accepted | Move creation to assignment, preserve historical amounts/history |
| Certificate timer 25 days; reminder helper informational | Confirmed 1 calendar month and actual filterable time flags |
| Existing stage uploads | Add confirmed Drive behavior and separate certificate delivery records |

Consultants workbook sample has separate client tabs A-001/A-008 with Date, Folder No, Stage, TM, Details, Due, Received, Balance. Some historical receiving has no case/stage. Do not guess those allocations or equate client balance with case-paid status.

Source: https://docs.google.com/spreadsheets/d/1tZqytFeYCnFCxVqJWTIUqJC8qwpop_J6IkuNwbr9nfw/edit . Unrelated local Ledger asset changes/CLI state must be preserved.

## 12. Implementation roadmap

### A. Baseline and final mapping

- Verify actual branches, deployed commits, live schema/RLS and active flows of both old systems.
- Establish regression baseline and recovery plan before writes.
- Resolve section 13 questions. Decide smallest integration placement: repo/deployment/auth and same versus separate database projects. Do not select another framework for appearances.

### B. Identity and client terms

- Align series/client/case relationships and no-TM cases; reconcile duplicates safely.
- Add all-client default Monthly Billing/Credit and existing client rate mapping.
- Establish authenticated server-side payment connector; no browser service keys.

### C. Financial integration

- Return verified case identity, stage charges/allocated receiving/outstanding, dates and payment references to CMS; report stale/unavailable sync explicitly, never as Paid.
- Add receiving splits, per-case receipts and audited Edit/Void.
- Add automatic stage charges with rate snapshots, duplicate protection and cross-system recovery.
- Apply final CMS terms rules; remove contradictory Ledger write gates. Advance allocation remains manual.

### D. Workflow and time flags

- Implement confirmed event transitions, journal cycle and calendar-date flags in Asia/Karachi.
- Add STOPPED suspension/TM-57 reactivation with history and no duplicate billing.
- Preserve objections/hearing history without declined hearing alerts.

### E. Associate accounting, delivery and Drive

- Assignment payable, weekly/partial oldest-unpaid settlement and corrections.
- Certificate received/courier/hand collection and receipt uploads.
- Private Drive upload, existing-folder reconciliation, create/retry and same-folder TM rename.

### F. Acceptance and release

- Exercise actual workflows with isolated fixtures and preserve existing operational features.
- Verify browser → API → database/payment connector → display/receipt/Drive, not build alone.
- Review final changes and deployment target; release only within owner-approved scope. Record tested commit, migrations and observed live behavior.
- Deliver the approved functional change together after analysis; no repeated redesign or UI-first detour.

## 13. Explicit remaining decisions

1. Confirmed: Stage 3 charge at Accepted. Staff roles confirmed: Admin + read-only Viewer; Service Associate has no login.
2. Admin + Viewer confirmed. Verify final role controls in the target deployment.
3. Existing live-data retention/reconciliation/import scope; historical missing payment allocations.
4. Advance Payment charge-before-entry mechanics, previous arrears and behavior after payment void. Default Monthly Billing is settled.
5. Month-end/reactivation journal examples; objection resolution event returning to normal flow.
6. Associate reassignment and rate changes after payments.
7. Drive account/root IDs and authorized file-access setup.
8. Long-term renewal/service dates and charges: ten-year responsibility is acknowledged, but renewal automation is not yet specified.
9. Exact implementation repo/database/deployment placement and safe cutover; old systems remain intact until decided.

## 14. Acceptance checklist

- No-TM case creates one Stage 1 charge; receipt works; later TM addition duplicates nothing.
- Duplicate/ambiguous TM or reference does not silently match another client's case.
- Monthly Billing advances with visible debt; explicit Advance terms gate correctly; 60% absent.
- Charge retries produce one charge at original rate; rate changes affect new charges only.
- One receiving splits across cases/stages; case receipts reconcile; advances require manual allocation.
- Edit/Void audit and revised/VOID receipts work; totals update without stage rollback.
- Boundary tests: filing 15; examination 7; assignment 7/8/9/10; acceptance 20/21; journal 28/29; calendar month-end/leap dates.
- Staff updates events; flags never advance case automatically. STOPPED suspends; reactivation restarts timing without duplicate fees.
- Ten assignments create Rs.10,000 default payable; partial/void/edit settlement correctly recalculates oldest unpaid fees.
- Certificate can wait at office; courier receipt and collection history remain linked.
- Drive retries reuse right folder; TM rename preserves ID/files; unauthorized access denied.
- Existing filters, server pagination, registry/journal matches, documents, print/export and roles pass regression checks.

## 15. Status and handoff

Confirmed decisions are captured above; unresolved edges are explicit. Local analysis identifies the major changes, but live compatibility, security and complete flow acceptance remain to be verified. This roadmap is not a claim of completed implementation.

No app/database/data/deployment change was made to prepare this document. Documentation is saved locally; no Git push is performed because this repo's main branch automatically deploys to Vercel.

## Implementation authorization and location

Owner authorized a visual PPTX/PDF and then coding, allowing a fresh implementation while preserving recoverable source/data. Work is on `Brandex-Database-CMS` branch `feat/confirmed-workflow-ledger`, preserving its operational frontend. New integrated billing tables support a fresh financial baseline; the old standalone Ledger and Sheets are unchanged. Legacy financial reconciliation and deployment setup remain required before cutover. Current source/test status is in that repo's `docs/CONFIRMED_BUILD_STATUS.md`.
