# Authenticated Smoke Test — Phase 0

25 September 2026. Current source/deployment: `727ec07775300cb22841a4748f1bfb4c1de58758`.
[Project Truth](docs/PROJECT_TRUTH.md) records implementation contradictions;
[canonical rules](docs/WORKFLOW_BUSINESS_RULES.md) define acceptance. These are separate.

## Completed production observations

- [x] Sign-in screen renders; user supplied an authenticated Admin session.
- [x] Dashboard, Database, Search, Assigned, Agents and Publication navigation load.
- [x] Existing case opens with stage/sub-stage, four local payment states and workflow history.
- [x] Search for an existing case returns the expected record.
- [x] `/database?tmForm=TM5` selects TM5 and returns a matching row.
- [x] `/database?tmForm=TM11` selects TM11 and returns a correct empty result for this snapshot.
- [x] Stage 3 case cannot save a Stage 4 transition while Stage 3 payment is unpaid.
- [x] Dedicated status dialog rejects STOPPED with an empty reason, without changing the case.
- [x] Case Document upload dialog fixes stage to the current Stage 3; historical Stage 1 document remains visible.
- [x] Private signed VIEW link is generated; no upload or download/expiry cycle claimed.
- [x] Journal Import opens from Publication in journal-only mode; no independent Journal route exists.
- [x] Assignment dialog opens with agents and confirmation control; no assignment saved.
- [x] Date Created production bug confirmed: UI uses filing date while database created_at differs.
- [x] Default branding renders; Vercel deployment READY and matches main commit.
- [x] At 1440×900, tiny data text and nested decorative borders are visible; UI acceptance is NOT complete.

No successful production case/payment/agent/branding mutation, import or document upload was made.

## Remaining acceptance checks

- [ ] Review local Phase 0 corrections and verify them after an authorized deployment.
- [ ] Viewer session: all read views work; create/edit/delete/payment/assignment/upload/match/import controls obey read-only rules. AssignedPage currently lacks a role gate.
- [ ] Admin session on disposable test cases: validate complete workflows and rejection at each sub-stage boundary.
- [ ] Stage 1: Filing→Acknowledgement OR Filing→Examination→Acknowledgement; no reverse; payment before Stage 2.
- [ ] Stage 2: Assigned→Accepted OR Assigned→Hearing; assignment works without Stage 2 payment; Stage 2 payment before Stage 3.
- [ ] Stage 3: Publication→Demand Note Received→Demand Note Submitted.
- [ ] Stage 4: CER Acknowledge→CER Received→CER Dispatch, forward only.
- [ ] STOPPED: mandatory timestamped reason on every entry path, terminal, no sub-stage or reactivation.
- [ ] Attempt same invalid transitions through direct authenticated data access in a safe test environment; current DB does not enforce workflow.
- [ ] Upload current-stage files and reject other stages/STOPPED; historical files remain readable; verify MIME limits and URL expiry.
- [ ] Manual agent fee/payment arithmetic with actual test data; do not claim automatic Accepted credits.
- [ ] Legacy Editor regression: measure current permissions before any migration. Do not treat Editor as an approved target role.
- [ ] Check Vercel environment inventory separately; connector metadata did not expose it.
- [ ] Reconcile migration history and branding schema on a controlled environment; do not replay existing migrations blindly.
- [ ] Normal desktop task readability and print output require acceptance beyond responsive classes.

These boxes are requirements, not claims that implementation can pass them today. Known failing requirements
remain documented; no tests were weakened to manufacture acceptance. No verified legal deadlines are implied.
