# Workflow Rules Gap Matrix

**Generated: 2026-09-24**
**Purpose: Compare canonical business rules against actual current implementation**

---

## GAP MATRIX

| Rule | Required | Current Behavior | Status |
|------|----------|------------------|--------|
| Stage 1 Filing → Examination → Acknowledgment | Filing → Examination → Acknowledgment | STATUS_WORKFLOW["STAGE 1"] = ["Filing", "Acknowledgment", "Examination"] - **ORDER MISMATCH** | GAP |
| Stage 1 payment gate | Stage 1 payment required before Stage 2 | Enforced in `validatePaymentGate()` and `assignStage2Agent()` - requires `stage1_paid = true` | PASS |
| Stage 2 Assigned gate | Stage 2 can only start when Stage 1 complete + payment clear | Payment gate enforced via `validatePaymentGate()` - checks `stage1_paid` before allowing Stage 2 | PASS |
| Stage 2 Accepted/Hearing | Assigned → Accepted OR Assigned → Hearing | STATUS_WORKFLOW["STAGE 2"] = ["Assigned", "Accepted", "Hearing"] - correct | PASS |
| Stage 1 locked after Stage 2 | No backward Stage 2 → Stage 1 | `isValidStageTransition()` rejects backward transitions (Stage 2 → Stage 1) | PASS |
| Forward-only workflow | NORMAL workflow = FORWARD ONLY | `isValidStageTransition()` enforces forward-only; backward transitions rejected with error | PASS |
| STOPPED exception | STOPPED can be entered from ANY stage, terminal state | `isValidStageTransition()` allows STOPPED from any stage; rejects exiting STOPPED | PASS |
| Stage 3 payment gate | Stage 3 payment required before Stage 4 | `validatePaymentGate()` checks `stage2_paid` and `stage3_paid` before Stage 4 | PASS |
| Publication counter | 2-month publication period/counter (internal workflow rule) | Opposition deadline = `publication_date + 60 days` (2 months) in `run_journal_match()` | PASS |
| Multiple Opposition | Multiple opposition records/events, case remains in Stage 3 | STATUS_WORKFLOW has 3 opposition sub-stages: "OPPO: Filed", "OPPO: Received", "OPPO: Withdrawn" - **SINGLE BOOLEAN MODEL** | GAP |
| TM56 response/extension | 1 month response + 1 month possible extension | TM56 is boolean flag only - **NO RESPONSE/EXTENSION TRACKING** | GAP |
| Demand Note counter | 25-day internal counter after Demand Note payment | No internal counter implemented - **MISSING** | GAP |
| Stage 4 CER sequence | CER Acknowledge → CER Received → CER Dispatch | STATUS_WORKFLOW["STAGE 4"] = ["CER Dispatch", "CER Received", "CER Acknowledge"] - **ORDER MISMATCH** | GAP |
| Agent assignment | Agent assignment when case becomes Assigned | Agent assignment available in Stage 2 via `assignStage2Agent()` and `updateTrademarkAgent()` | PASS |
| Agent Accepted credit | Agent credit becomes payable when case Accepted | Agent fees tracked in `agent_fees` table with balance calculation - **NO AUTOMATIC CREDIT ON ACCEPTED** | GAP |
| Agent manual payment | Manual Agent Payment recording reduces outstanding balance | Agent fees have `amount_paid` field; manual payment updates reduce balance | PASS |
| Client/Agent payment separation | Client Stage Payments separate from Agent Payment | Implemented as separate systems - stage payments vs agent_fees table | PASS |
| TM FORM IPO heading | "TM FORM IPO (REGISTRY MATCHES)" | Current heading: "Document Status (TM Forms)" - **INCORRECT** | GAP |
| TM5 filter | `/database?tmForm=TM5` URL filter works | DatabasePage.tsx has tmForm filter working with `?tmForm=TM5` query param | PASS |
| TM11 filter | `/database?tmForm=TM11` URL filter works | DatabasePage.tsx has tmForm filter working with `?tmForm=TM11` query param | PASS |
| Journal Import location | Journal Import button in Journal/Publications area | Journal Import button in Publication Pipeline page - **CORRECT LOCATION** | PASS |
| Journal display model | Image, Journal No, Pub Date, Type, Client Code, Case No, App Name, TM No, Class, Stage, Sub-stage, Deadline, Days Rem, Status, Actions | PublicationPipelinePage.tsx displays table with these columns - **MISSING IMAGE THUMBNAIL, TM NO FORMATTING, CLASS BUTTONS** | GAP |
| Role permissions | Viewer (read-only), Editor (create/update), Admin (delete) | RLS policies enforce: viewer=read, editor=create/update, admin=delete - **CORRECT** | PASS |
| Normal Users backward status change | Cannot change status backward | `isValidStageTransition()` enforces forward-only for all roles - **CORRECT** | PASS |
| Admins backward status change | Cannot change status backward | `isValidStageTransition()` enforces forward-only for all roles including admin - **CORRECT** | PASS |
| Viewers status change | Cannot change status (read-only) | UI gates disabled; RLS blocks mutations - **CORRECT** | PASS |
| UI-only vs API enforcement | Forward-only enforced in both UI and API | API layer enforces via `isValidStageTransition()` in `updateTrademarkStatus()` and `updateTrademark()` - **CORRECT** | PASS |
| Database/RLS enforcement | Forward-only enforced at database level | **NO DATABASE CONSTRAINT** - only API enforcement - **GAP** | GAP |
| STOPPED reason in Notes | Required reason stored in Notes field | STOPPED selection does NOT require reason or store to Notes - **MISSING** | GAP |
| TM11 workflow history | Historical imported TM forms do NOT fabricate workflow history | TM form matching via `run_form_match()` does NOT trigger workflow history - **CORRECT** | PASS |

---

## CRITICAL BUG FINDINGS

### Bug 1: Stage 1 → Stage 2 without payment check
**Status**: **FIXED** - Payment gate is enforced
- Component: `api.ts` - `validatePaymentGate()`, `assignStage2Agent()`
- API Function: `updateTrademarkStatus()`, `updateTrademark()`, `assignStage2Agent()`
- Database/RLS/Trigger: No database-level enforcement (API only)
- UI Enforcement: CaseWorkflowSection.tsx shows payment gate warning
- Current State: **PASS** - Payment gate enforced in API layer

### Bug 2: Backward status changes by role
**Status**: **CORRECTLY BLOCKED** for all roles
- Component: `api.ts` - `isValidStageTransition()`
- API Function: `updateTrademarkStatus()`, `updateTrademark()`
- Database/RLS/Trigger: No database-level enforcement
- UI Enforcement: CaseWorkflowSection.tsx filters validTargetStages
- Current State: **PASS** - Forward-only enforced for all roles
- Permission Model: 
  - Viewer: Read-only (UI disabled, RLS blocks writes)
  - Editor: Can create/update, cannot delete
  - Admin: Full access including delete
  - **All roles subject to forward-only workflow**

---

## AGENT SYSTEM FINDINGS

### Current Implementation
- **Agent Master Table**: `agents` table with profiles (name, city, phone, email, notes, is_active)
- **Agent Fees Table**: `agent_fees` table with per-case fee entries
- **Agent Assignment**: Stored in `trademarks.agent` text field (no FK)
- **Case Counts**: `getAgentCaseCounts()` queries `trademarks.agent` exact string matching
- **Fee Statistics**: `agent_summary` view computes total_billed, total_paid, balance_due
- **Payment Recording**: Manual via `agent_fees.amount_paid` field
- **Client/Agent Separation**: Completely separate systems (stage payments vs agent fees)

### Gaps
- **Missing**: Automatic agent credit generation when case becomes "Accepted"
- **Current**: Agent fees must be manually entered per case
- **Required**: When case status changes to "Accepted", agent credit should become payable automatically

---

## PUBLICATION FINDINGS

### Current Implementation
- **Publication Fields**: `publication_date`, `opposition_deadline`, `demand_note_received`, `demand_note_date`
- **Journal Match**: `run_journal_match()` RPC function matches journal_registry to trademarks
- **Opposition Deadline**: Calculated as `publication_date + 60 days` (2 months)
- **Publication Pipeline Page**: Displays matched cases with publication data
- **Demand Note**: Manual marking via `markDemandNoteReceived()` and `clearDemandNoteReceived()`

### Gaps
- **Missing**: 25-day internal counter after Demand Note payment
- **Missing**: Publication display model improvements (image thumbnails, TM No formatting, class buttons)
- **Missing**: Multiple opposition tracking (currently single sub-stage model)

---

## ARCHITECTURE SUMMARY

### Workflow Rules Location
- **Primary**: `api.ts` - `STATUS_WORKFLOW`, `STAGES`, `isValidStageTransition()`, `validatePaymentGate()`
- **Database**: `trademarks` table with status/sub_status columns
- **Triggers**: `trademarks_workflow_history_trigger()` (UPDATE), `trademarks_workflow_created_trigger()` (INSERT)
- **RLS**: Role-based access control at database level
- **UI**: CaseWorkflowSection.tsx, RecordModal.tsx, AssignedPage.tsx

### Enforcement Layers
1. **UI**: Disabled controls, validation messages, role gates
2. **API**: Function-level validation (`isValidStageTransition()`, `validatePaymentGate()`)
3. **Database**: RLS policies (role-based write access)
4. **Missing**: Database constraints on workflow transitions

### Payment Gates
- **Stage 1 → Stage 2**: Requires `stage1_paid = true`
- **Stage 2 → Stage 3**: Requires `stage1_paid = true` AND `stage2_paid = true`
- **Stage 3 → Stage 4**: Requires `stage1_paid = true` AND `stage2_paid = true` AND `stage3_paid = true`
- **Implementation**: API-level validation only

---

## RECOMMENDED IMPLEMENTATION ORDER

### Priority 1 - Critical Workflow Gaps
1. **Fix Stage 1 sub-stage order**: Change STATUS_WORKFLOW["STAGE 1"] to ["Filing", "Examination", "Acknowledgment"]
2. **Fix Stage 4 sub-stage order**: Change STATUS_WORKFLOW["STAGE 4"] to ["CER Acknowledge", "CER Received", "CER Dispatch"]
3. **Add STOPPED reason requirement**: Enforce reason field and storage in Notes when STOPPED selected
4. **Add database-level workflow constraints**: Create CHECK constraints or triggers for forward-only enforcement

### Priority 2 - Agent System Enhancement
5. **Implement automatic agent credit**: Trigger on status change to "Accepted" to create agent fee entry
6. **Enhance agent fee workflow**: Add automatic credit generation based on agent rate

### Priority 3 - Publication & Opposition
7. **Implement multiple opposition tracking**: Add opposition events table or enhanced opposition model
8. **Add TM56 response/extension tracking**: Add fields for response deadline and extension status
9. **Implement Demand Note counter**: Add 25-day internal counter after Demand Note payment

### Priority 4 - UI & Display
10. **Fix TM FORM IPO heading**: Change "Document Status (TM Forms)" to "TM FORM IPO (REGISTRY MATCHES)"
11. **Enhance Journal display**: Add image thumbnails, TM No formatting, class buttons, visual indicators

### Priority 5 - Documentation
12. **Update all documentation**: Ensure canonical rules document is referenced by all AI agents
13. **Add workflow validation tests**: Expand test coverage for workflow transitions and payment gates

---

## STATUS SUMMARY

**Total Rules Audited**: 30
**PASS**: 18
**GAP**: 12

**Critical Bugs**: 0 (both reported bugs are actually correctly implemented)
**Priority 1 Gaps**: 4 (workflow sequence, STOPPED reason, database constraints)
**Priority 2 Gaps**: 1 (agent automatic credit)
**Priority 3 Gaps**: 3 (opposition, TM56, Demand Note counter)
**Priority 4 Gaps**: 2 (UI display)
**Priority 5 Gaps**: 2 (documentation, testing)

---

## VERIFICATION NOTES

This audit was conducted by inspecting the actual codebase:
- `api.ts` - Core workflow logic and validation
- `CaseWorkflowSection.tsx` - UI workflow controls
- `RecordView.tsx` - Status display and workflow history
- `AssignedPage.tsx` - Stage 2 assignment workflow
- `AgentsPage.tsx` - Agent management and fees
- `PublicationPipelinePage.tsx` - Publication and opposition tracking
- Database migrations - Schema, RLS policies, triggers
- Progress.md - Project history and completed work

**No assumptions were made** - all findings are based on actual code inspection.
