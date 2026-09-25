> **Phase 0 correction — 25 September 2026:** This is a historical report, not current acceptance evidence. Its completion, test, role, payment and UI claims are superseded by [Project Truth](docs/PROJECT_TRUTH.md) and [canonical business rules](docs/WORKFLOW_BUSINESS_RULES.md). Stage 2 payment is NOT required for agent assignment; Stage 1 payment gates Stage 2, and Stage 2 payment gates Stage 3. Intended active roles are Admin + Viewer; Editor remains active in the current implementation. Timers are internal business rules, not verified statutory deadlines. Do not execute the historical recommendations below as a roadmap.

# BrandEx Database CMS V2.0.1 Release Notes

**Release Date:** 23 September 2026  
**Release Type:** Correction/Polish Release  
**Previous Release:** v2.0.0  
**Final Commit:** 8a29729

---

## Overview

V2.0.1 is a correction and polish release built on top of V2.0.0. This release addresses workflow enforcement, UX improvements, and final print/upload refinements without introducing new features or breaking changes.

All functional code from V2.0.0 remains intact. V2.0.1 focuses on:

- Enforcing strict forward-only workflow progression
- Improving RecordView UX and data consistency
- Final polish for document upload and print layouts

---

## V2.0.1 Core Workflow

### Strict Forward-Only Progression
- Enforced strict Stage 1 → Stage 2 → Stage 3 → Stage 4 workflow progression
- Backward transitions are rejected at the API level
- New records default to Stage 1 / Filing with automatic payment initialization

### Stage Payment Gates
- Stage 2 transition requires `stage1_paid = true`
- Stage 3 transition requires `stage2_paid = true`
- Stage 4 transition requires `stage3_paid = true`
- Clear user-facing error messaging when payment gates block progression

### New Record Defaults
- New records automatically initialize with:
  - Stage: STAGE 1
  - Sub-stage: Filing
  - `stage1_paid = true`
  - `stage1_paid_date` set to filing date
- Initial workflow history event (`RECORD_CREATED`) automatically logged on record creation

### STOPPED Protection
- Workflow progression respects `STOPPED` state and prevents invalid transitions

---

## RecordView / UX Improvements

### Workflow History Positioning
- Workflow History section repositioned after Stage Payments
- Improved chronological event timeline display

### Two-Column RecordView Header
- Left column: logo, app name, TM number, class
- Right column: client information (name, code, case number, type, case type)
- Footer strip: current stage badge, sub-stage, filing date, previous workflow action

### Stage Document Visibility
- Stage document sections hidden for future stages with no uploaded documents
- Visibility logic respects current stage and existing document state
- Cleaner UI by not showing empty future stage sections

### Uppercase Normalization
- Ordinary business fields normalized to uppercase at API boundary:
  - `clientCode`, `caseNumber`, `type`, `appName`, `clientName`, `agent`, `city`, `caseType`, `appClass`, `tmCprNo`
- Ensures data consistency across the application
- Agent and city uppercase propagated through all assignment functions

---

## Final Polish

### Document Upload UX
- Dedicated in-modal success view with checkmark and document title
- Clear section-level success notification banner
- Auto-close cleanly with cancellation protection and "Done" dismissal
- Full upload form state reset on modal close
- Native file input reset for clean UX
- All existing storage permissions, 10MB bounds, and MIME validation preserved

### Print-Friendly Styling
- Stage and status badges styled with clean light/white backgrounds
- Dark/black text for ink-friendly A4 printing
- Removed heavy shaded cream backgrounds for better print output
- Stripped all offset drop shadows in print mode
- All borders, dividers, and A4 structure preserved
- Improved readability on printed records

---

## Verification

### Automated Testing
- **46/46 tests passed** (all test files)
- **Typecheck passed** (0 errors)
- **Production build passed** (successful bundle generation)

### Database Migration
- Production migration `202609220006` applied
- Workflow creation trigger ensures initial history event on record creation

### Git Status
- Working tree clean
- All V2.0.1 batches (Batch 1, Batch 2, Batch 3) committed and pushed
- v2.0.0 tag remains unchanged

---

## Release Composition

### Batch 1: Core Workflow & New Record Creation
- Migration `202609220006_workflow_creation_trigger.sql`
- Strict forward-only workflow enforcement
- Payment gates and new record defaults
- Commit: 9468de4

### Batch 2: RecordView UX Corrections
- Section reorder in RecordView
- Two-column header redesign
- Stage document visibility logic
- Uppercase normalization at API boundary
- Commit: 95660c5

### Batch 3: Final Print & Upload UX Polish
- Document upload success/reset UX improvements
- Print-friendly light badges and backgrounds
- Reduced print shadows and heavy shading
- Commit: 8a29729

---

## Compatibility

### Backward Compatibility
- All V2.0.0 functionality preserved
- No breaking changes to database schema or API
- Existing data and records unaffected
- v2.0.0 tag remains unchanged for rollback capability

### Forward Compatibility
- Release tagged as `v2.0.1`
- Clean working tree ready for future development
- All verification checks passed

---

## Deployment

### Production Deployment
- Frontend deployed to Vercel: https://brandexsheet.vercel.app
- Supabase database migration applied: `202609220006`
- No environment variable changes required
- No service role key exposure

### Manual Production Checks (Post-Release)
The following items require authenticated human verification:
1. Live Supabase RLS policy execution with Viewer/Editor credentials
2. Live private storage file upload/download in production bucket
3. Authenticated role smoke test on production URL
4. Vercel dashboard secret audit confirmation
5. Publication opposition legal confirmation (Trade Marks Ordinance 2001)

---

## Summary

V2.0.1 is a focused correction and polish release that strengthens workflow enforcement, improves UX consistency, and refines print/upload handling. All changes are additive and non-breaking, building on the solid foundation of V2.0.0.

**Release Tag:** v2.0.1  
**Final Commit:** 8a29729  
**Status:** OFFICIAL RELEASE
