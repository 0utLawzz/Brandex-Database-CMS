# Brandex Unified Client Ledger Architecture (1 Database, 1 Place, 1 System)

Brandex Client Ledger is integrated directly into the Brandex Database CMS. 
Instead of operating two disconnected databases with cross-project network polling, the Ledger tables, triggers, and receipt vouchers are unified directly inside the primary CMS Supabase database.

## Architecture

- **Primary Table**: `public.client_ledger_entries` (linked via foreign key `trademark_id REFERENCES public.trademarks(id) ON DELETE CASCADE`).
- **Receipt Sequence**: `public.client_receipt_seq` generating official serial numbers (`REC-YYYY-XXXX`).
- **Instant Gate Synchronization**: A PostgreSQL database trigger (`trg_sync_trademark_from_ledger`) automatically recalculates paid statuses across S1, S2, S3, and S4 upon any receipt creation, update, or soft-void, instantly unlocking or locking the statutory workflow progression gates.
- **Audit & Anti-Tamper**: Single records cannot be permanently deleted from the database. Corrections are recorded as soft-voids (`voided_at`, `void_reason`) by administrators, preserving financial audit trails.
- **Voucher Generation**: Authentic printable receipt vouchers for clients, displaying Brandex Law Associates bank accounts (UBL, Meezan Bank, EasyPaisa, JazzCash).

## Benefits

1. **Zero Cross-Project Sync Failures**: No shared API secrets or Edge Function outages between separate Supabase projects.
2. **Instant Consistency**: A receipt posted in `/payments` or on `/record/:id` unlocks the workflow gate immediately in the same database transaction.
3. **Single Source of Truth**: All trademark cases, documents, journals, and client financial receipts live in one backup and one management dashboard.
