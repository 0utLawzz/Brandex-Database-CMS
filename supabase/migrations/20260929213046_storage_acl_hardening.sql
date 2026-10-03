begin;

-- Restrict the managed Storage object ACL where the migration actor has authority.
-- The live table is owned by supabase_storage_admin; Storage RLS remains authoritative.
revoke all privileges on table storage.objects from public, anon, authenticated;
grant select, insert, update, delete on table storage.objects to authenticated;
grant all privileges on table storage.objects to service_role;

commit;
