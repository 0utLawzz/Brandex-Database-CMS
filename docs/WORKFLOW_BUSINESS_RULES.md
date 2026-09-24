# Brandex Workflow Business Rules

**Canonical Source of Truth for Workflow Implementation**

This document defines the approved business rules for the Brandex trademark workflow system. All AI coding agents and developers must reference this document before implementing workflow changes.

---

## STAGE 1: Filing → Acknowledgement (Examination Optional)

### Workflow Sequence
- **Filing** → **Acknowledgement**
- **Examination** is OPTIONAL and may occur between Filing and Acknowledgement
- Valid sequences:
  - `Filing → Acknowledgement`
  - `Filing → Examination → Acknowledgement`
- Do NOT force Examination
- Do NOT allow Acknowledgement → Examination
- Do NOT allow backward movement
- Stage 1 must NOT jump directly to Stage 2
- Stage 1 payment must be checked/cleared before Stage 2 can begin
- Once Stage 2 is entered, Stage 1 is LOCKED (no backward Stage 2 → Stage 1)

### Payment Gate
- Stage 1 payment (`stage1_paid = true`) required before entering Stage 2
- Payment source: Brandex-Ledger (https://github.com/0utLawzz/Brandex-Ledger)
- CMS contains temporary/local payment logic for workflow gates
- `stage1_paid_date` records when payment was marked

### Implementation Notes
- New records default to: STAGE 1, sub-stage "Filing", `stage1_paid = true`, `filing_date = today`
- DB trigger `trademarks_workflow_created_trigger` creates initial workflow history event
- Sub-stage values: "Filing", "Examination", "Acknowledgment"

---

## STAGE 2: Assignment Workflow

### Entry Requirements
- Stage 1 complete
- Required Stage 1 payment clear (`stage1_paid = true`)

### Workflow Sequence
- **Assigned** → **Accepted** OR **Assigned** → **Hearing**
- Hearing is an alternate workflow outcome
- When status becomes "Assigned", agent assignment functionality becomes available
- Agent assignment is INTERNAL case handling

### Agent Assignment
- Agent assignment is completely separate from client payment accounting
- Case assigned to Agent + custom internal rate
- Example: 10 cases assigned, Rate = Rs. 1,000 per case
- When case becomes "Accepted":
  - The assigned agent's case is marked COMPLETE
  - The corresponding agent credit becomes payable
  - Do NOT delete the assignment/history
- Hearing must remain part of the case history

### Payment Gate
- Stage 2 payment (`stage2_paid = true`) required before entering Stage 3
- **Stage 2 payment does NOT block Agent Assignment**
- Payment source: Brandex-Ledger (https://github.com/0utLawzz/Brandex-Ledger)
- CMS contains temporary/local payment logic for workflow gates

### Sub-stage Values
- "Assigned", "Accepted", "Hearing"

### Implementation Notes
- `assignStage2Agent()` enforces Stage 2 payment gate
- Agent assignment stored in `trademarks.agent` text field (no FK)
- Agents master table (`agents`) stores agent profiles
- Agent fees tracked in `agent_fees` table with computed balance

---

## STAGE 3: Publication & Opposition

### Entry Requirements
- Stage 2 workflow requirement complete
- Required Stage 2 payment clear (`stage2_paid = true`)

### Primary Workflow
- **Publication** → **Demand Note Received** → **Demand Note Submitted**

### Publication Counter
- Publication starts the publication counter
- **Internal Workflow / Business Rule**: 2-month publication period/counter
- Represented as an internal workflow timer/business rule
- Do not invent statutory language

### Opposition
- Opposition can occur during the publication period
- There may be MULTIPLE opposition records/events
- If Opposition is Received:
  - The case remains within Stage 3
  - Do NOT automatically move it backward
  - Opposition is not a simple one-time boolean

### TM56
- TM56 provides:
  - 1 month response period
  - 1 month possible extension through TM56 submission
- Do not invent additional legal/statutory rules
- These are the firm's workflow/business rules

### Demand Note
- After Demand Note payment/required step:
  - Certificate received / acknowledgement has 25-day internal counter
- Represent as an internal workflow/business rule, not statutory claim

### Payment Gate
- Stage 3 payment (`stage3_paid = true`) required before entering Stage 4
- Payment is manual/placeholder (marked by staff, not auto-verified)

### Sub-stage Values
- "D-Note Submitted", "D-Note Received", "OPPO: Filed", "OPPO: Received", "OPPO: Withdrawn", "Published"
- **User-facing terminology**: "Demand Note Submitted", "Demand Note Received", "Opposition: Filed", "Opposition: Received", "Opposition: Withdrawn"

### Implementation Notes
- Publication fields: `publication_date`, `opposition_deadline`, `demand_note_received`, `demand_note_date`
- Opposition deadline calculated as `publication_date + 60 days` (2 months)
- Journal match engine (`run_journal_match`) populates publication data
- TM form match engine (`run_form_match`) sets TM5/TM6/TM11/TM16/TM56 flags

---

## STAGE 4: Certificate Workflow

### Entry Requirements
- Stage 3 workflow requirement complete
- Required Stage 3 payment clear (`stage3_paid = true`)

### Workflow Sequence
- **CER Acknowledge** → **CER Received** → **CER Dispatch**
- Forward only (no Stage 4 → Stage 3)
- No backward stage changes:
  - No CER Received → CER Acknowledge
  - No CER Dispatch → CER Received

### Payment Gate
- Stage 4 payment (`stage4_paid = true`) optional (final stage)
- Payment is manual/placeholder (marked by staff, not auto-verified)

### Sub-stage Values
- "CER Dispatch", "CER Received", "CER Acknowledge"

### Implementation Notes
- All 4 stages use the same manual payment tracking pattern
- No additional payment automation in Stage 4

---

## STOPPED: Special Exception

### Entry Rules
- STOPPED can be entered from ANY stage
- It does not have a sub-stage
- When STOPPED is selected:
  - A reason is REQUIRED
  - The reason must be stored in the case Notes field

### Terminal State
- STOPPED is terminal unless the firm's explicitly defined future rule says otherwise
- Do NOT invent a reactivation mechanism
- No workflow progression from STOPPED

### Implementation Notes
- STOPPED is included in `STAGES` array
- `isValidStageTransition()` allows entering STOPPED from any stage
- `isValidStageTransition()` rejects exiting STOPPED (backward to normal stages)

---

## FORWARD-ONLY WORKFLOW RULE

### Normal Workflow
- **NORMAL workflow = FORWARD ONLY**
- Stage 1 → Stage 2 → Stage 3 → Stage 4
- Backward transitions are rejected:
  - No Stage 2 → Stage 1
  - No Stage 3 → Stage 2
  - No Stage 4 → Stage 3
  - No Acknowledgement → Filing
  - No Acknowledgement → Examination
  - No CER Received → CER Acknowledge
  - No CER Dispatch → CER Received
- **Admin does NOT bypass these rules**

### Exception: STOPPED
- STOPPED can be entered from any stage (forward exception)
- STOPPED cannot be exited (terminal state)

### Implementation Notes
- `isValidStageTransition(fromStage, toStage)` enforces forward-only rule
- Returns `false` for backward transitions
- Returns `true` for STOPPED entry from any stage
- Returns `false` for STOPPED exit
- Enforced in API layer (`updateTrademarkStatus`, `updateTrademark`)

---

## AGENT ACCOUNTING MODEL

### Conceptual Separation
- Agent system is NOT client payment accounting
- These are completely separate systems
- Payment source: Brandex-Ledger (https://github.com/0utLawzz/Brandex-Ledger)
- CMS contains temporary/local payment logic for workflow gates

### Agent Credit Calculation
- Case assigned to Agent + custom internal rate
- Example: 10 cases assigned, Rate = Rs. 1,000 per case
- 8 cases become Accepted
- Agent payable credit: 8 × 1,000 = Rs. 8,000

### Agent Payment Recording
- Office can manually record:
  - Agent Payment
  - Date
  - Amount
- That payment reduces the outstanding Agent payable balance

### Implementation Notes
- `agents` table: master agent profiles
- `agent_fees` table: per-case fee entries
- `agent_summary` view: computed fee statistics
- Agent assignment stored in `trademarks.agent` text field (no FK constraint)
- Case counts derived from `trademarks.agent` exact string matching
- Client Stage Payments have NOTHING to do with Agent Payment

---

## ROLE PERMISSIONS

### Application Roles
- **admin**: Full application access
  - Can edit/create/update/delete where the application currently permits
  - Can change workflow status only according to valid workflow rules
  - **Admin must NOT bypass workflow sequence/payment gates merely because they are admin**
- **viewer**: Read-only
  - Cannot edit records
  - Cannot change workflow
  - Cannot upload/delete/modify documents
  - Cannot modify ledger-related data

### Legacy Database Compatibility
- **editor** role exists in database schema for legacy compatibility
- Application-facing role model is Admin + Viewer only
- Do not use editor as an active application role in new code

### Database RLS Policies
- `trademarks`:
  - SELECT: authenticated users
  - INSERT/UPDATE: admin only (application-facing)
  - DELETE: admin only
- `agents`, `agent_fees`:
  - SELECT: authenticated users
  - INSERT/UPDATE/DELETE: admin only (application-facing)
- `form_registry`, `journal_registry`:
  - SELECT: authenticated users
  - INSERT/UPDATE/DELETE: admin only

### API Enforcement
- All write operations check `current_brandex_role()`
- UI gates disabled controls based on role
- Viewers see read-only alerts and disabled buttons

### Implementation Notes
- `current_brandex_role()` function returns user role
- RLS enforced at database level
- API enforces role checks before mutations
- UI enforces role checks for user experience

---

## TM FORM RULES

### Registry Matching
- TM5, TM6, TM11, TM16, TM56 are boolean controls
- Do not invent legal labels without practice-owner approval
- Match engine (`run_form_match`) sets flags based on `form_registry` data

### Heading Requirement
- Current heading: "TM DOCUMENT CONTROL (REGISTRY MATCHES)"
- Required heading: "TM FORM IPO (REGISTRY MATCHES)"

### URL Filters
- `/database?tmForm=TM5` must work
- `/database?tmForm=TM11` must work

### Workflow History
- Historical imported TM forms must NOT fabricate workflow history
- TM form matching does NOT trigger workflow history events
- Only user-initiated status changes create workflow history

### Implementation Notes
- `form_registry` table stores imported TM form data
- `run_form_match()` RPC function performs matching
- TM form flags stored as boolean columns in `trademarks` table
- Match engine requires editor/admin role

---

## JOURNAL / PUBLICATION RULES

### Journal Import Location
- The Journal Import button should live in the Journal/Publications area
- Currently in Publication Pipeline page

### Publication Display Model
- Image: small thumbnail, click to enlarge
- JOURNAL NO
- PUB DATE
- TYPE + icon
- CLIENT CODE
- CASE NO
- separator
- APPLICATION NAME
- TRADEMARK NO: display as 6 digits where appropriate
- CLASS: 1-45 represented as compact buttons
- separator
- STAGE: large, color coded
- SUB-STAGE: smaller, color coded
- separator
- DEADLINE
- DAYS REM.: visual indicator
- separator
- STATUS
- ACTIONS

### Implementation Notes
- `journal_registry` table stores imported journal data
- `run_journal_match()` RPC function performs matching
- Publication fields: `publication_date`, `opposition_deadline`, `demand_note_received`, `demand_note_date`
- Opposition deadline = publication_date + 60 days
- Publication Pipeline page displays matched cases

---

## INTERNAL WORKFLOW TIMERS

### Publication Counter
- **Internal Workflow / Business Rule**: 2-month publication period
- 60-day calendar calculation from publication date
- Do not present as verified statutory deadline

### TM56 Response Period
- **Internal Workflow / Business Rule**: 1 month response period
- 1 month possible extension through TM56 submission
- Do not invent additional legal/statutory rules

### Demand Note Counter
- **Internal Workflow / Business Rule**: 25-day internal counter
- After Demand Note payment/required step
- Certificate received / acknowledgement
- Do not present as verified statutory deadline

### Implementation Notes
- All timing rules are internal business rules
- No statutory claims in UI or documentation
- Clearly labeled as "Internal Workflow / Business Rule"

---

## WORKFLOW HISTORY

### Recording Rules
- Triggered by status or sub_status changes
- AFTER INSERT trigger creates initial "RECORD_CREATED" event
- AFTER UPDATE trigger creates "STATUS_CHANGE" events
- Records: from_status, from_sub_status, to_status, to_sub_status, event_at, changed_by

### Display Rules
- Chronological event history
- Timestamp, changed by user, full terminology transitions
- Preserve repeated status events intact
- Separate from audit_logs (which track all field changes)

### Implementation Notes
- `trademark_workflow_history` table stores workflow events
- `trademarks_workflow_history_trigger()` function handles UPDATE events
- `trademarks_workflow_created_trigger()` function handles INSERT events
- RLS: authenticated users can read, triggers control writes

---

## NOTES FIELD

### Purpose
- Free-form remarks and manual proceeding notes
- Preserves original case (no uppercase normalization)

### STOPPED Reason Storage
- When STOPPED is selected, reason is REQUIRED
- Reason must be stored in the case Notes field

### Implementation Notes
- `notes` column in `trademarks` table
- No case normalization applied
- Used for STOPPED reason and general remarks

---

## DATA INTEGRITY RULES

### Legal Identifiers
- Preserve exactly: `type`, `client_code`, `case_number`, `tm_cpr_number`
- Uppercase normalization applied to ordinary business data
- Original case preserved for free-form fields (notes, email, notes)

### Canonical Order
- Datasheet order: Type, then Client Code, then Case Number
- Enforced in list sorting and display

### Version Control
- Optimistic concurrency via `version` column
- `ConflictError` raised on concurrent modifications
- User must reload and retry on conflict

### Implementation Notes
- `version` column incremented on each update
- `set_updated_metadata()` trigger handles version increment
- UI handles `ConflictError` with user-friendly message

---

## SECURITY RULES

### Never Expose
- Service-role key
- Database password
- Google Apps Script secret
- Cron secret

### Client-Side Environment
- Only allowed: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- No secrets in client bundle

### Storage Security
- Private storage bucket (`trademark-files`)
- Signed URLs with 1-hour expiry
- No public URLs exposed
- Deterministic paths for orphan cleanup

### Implementation Notes
- Storage policies restrict by role
- Signed URLs generated server-side
- Orphan cleanup on DB insert failure

---

## DOCUMENTATION LABELING

### Timing Rules
- Clearly label as: **Internal Workflow / Business Rule**
- Do not present as verified statutory deadlines
- No invented legal language

### Status Labels
- Use full user-facing terminology
- Expand abbreviations: "Demand Note", "Opposition", "CER"
- Preserve "CER" (no full form established)

### Implementation Notes
- `WORKFLOW_DISPLAY_LABELS` mapping in api.ts
- `formatWorkflowLabel()` function for display
- `normalizeWorkflowValue()` function for database values

---

## VERSION HISTORY

- **Created**: 2026-09-24 (Workflow Rules Audit)
- **Purpose**: Canonical source of truth for workflow implementation
- **Scope**: All stages, payment gates, agent accounting, role permissions, timers

---

## AUDIT NOTES

This document is the authoritative source of truth for workflow implementation.

**This document is the authoritative workflow/business-rule source. Do not infer workflow rules from UI appearance or old code.**

**Do not modify this document without explicit practice-owner approval.**

## PAYMENT SOURCE

**Brandex-Ledger (https://github.com/0utLawzz/Brandex-Ledger) is the source of truth for payment data.**

The CMS contains temporary/local payment logic for workflow gates only. Do not redesign Brandex-Ledger, duplicate ledger tables, or hard-code payment amounts.
