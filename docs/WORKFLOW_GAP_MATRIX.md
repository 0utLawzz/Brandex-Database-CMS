# Workflow Gap Matrix — 25 September 2026

This replaces the stale 24 September matrix. Canonical requirements are in
[WORKFLOW_BUSINESS_RULES.md](WORKFLOW_BUSINESS_RULES.md); source, test, live database and flow evidence
are separated in [PROJECT_TRUTH.md](PROJECT_TRUTH.md).

| Requirement | Current truth | Status |
|---|---|---|
| Stage 1 optional examination | Correct choices; reversal/completion not enforced | ❌ CONTRADICTED |
| Normal stage progression | Backward stage guard exists; skipping allowed | ❌ CONTRADICTED |
| Stage 2 assignment | Stage 2 payment NOT required; stage eligibility not enforced in mutation | 🟡 PARTIAL |
| Stage payment gates | Local flags checked by browser functions; no database gate or Ledger lookup | 🟡 PARTIAL |
| Stage 2 alternatives | Assigned/Accepted/Hearing membership, no directed transitions | ❌ CONTRADICTED |
| Stage 3 sequence | Unordered flat choices; publication fields separate | ❌ CONTRADICTED |
| Stage 4 sequence | Dictionary corrected; no sub-stage reversal guard | ❌ CONTRADICTED |
| STOPPED | Dedicated reason/exit checks; general update bypass; Case Stopped sub-stage remains | 🟡 PARTIAL |
| Publication counter | SQL uses two calendar months, not 60 days; internal only | 🟡 PARTIAL |
| Opposition events | No structured multiple-event model | 🔴 NOT IMPLEMENTED |
| TM56 response/extension | Registry boolean/date only | 🔴 NOT IMPLEMENTED |
| Demand Note 25-day timer | No implementation; exact trigger step unresolved | 🔴 NOT IMPLEMENTED |
| Accepted agent payable | Manual fee entry only | 🔴 NOT IMPLEMENTED |
| Ledger integration | Local payment placeholders only | 🔴 NOT IMPLEMENTED |
| Admin + Viewer | Editor actively authorized and has existing profile | ❌ CONTRADICTED |
| Case documents | Current-stage UI/client restriction; historical display; role-only DB/storage rules | 🟡 PARTIAL |
| Publication display | Text cards; thumbnails, formatting and class actions incomplete | 🟡 PARTIAL |
| Date Created | Corrected locally with regression tests; production unchanged | ⚠️ IMPLEMENTED BUT NOT VERIFIED |
| TM heading | Corrected locally; TM5/TM11 URLs verified in production | 🟡 PARTIAL |
| Branding | Default assets present; live settings table absent and persistence issues | 🟡 PARTIAL |
| Workbench | Tiny metadata and dominant borders verified at desktop size | ❌ CONTRADICTED |
| Document test isolation | Full-suite failures fixed by clearing queued mock implementations | 🟢 DONE + VERIFIED |

Do not use historical PASS counts or a completion percentage.
Do not restore the obsolete agent-assignment payment gate.
Phase 0 makes truth/documentation/test/date/heading corrections only.
Established phases: Truth Cleanup → Business Workflow Completion → Payment Architecture → Workflow Hardening → UI / Workbench Transformation.
