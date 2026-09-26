import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, expect, it } from 'vitest';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select coalesce(nullif(current_setting('request.role',true),''),'authenticated') $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to authenticated;
  `);
  const directory = resolve(process.cwd(), '../../supabase/migrations');
  for (const file of readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
    // PGlite provides gen_random_uuid in core; pgcrypto is not needed by these tests.
    await db.exec(readFileSync(resolve(directory,file),'utf8').replace(/create extension if not exists pgcrypto;/i,''));
  }
  await db.exec(`grant select,insert,update,delete on all tables in schema public,storage to authenticated;
    grant usage,select on all sequences in schema public to authenticated;
    insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
    update public.profiles set role='admin' where user_id='00000000-0000-4000-8000-000000000001';
    update public.profiles set role='editor' where user_id='00000000-0000-4000-8000-000000000002';
    set request.uid='00000000-0000-4000-8000-000000000001';
    set role authenticated;`);
}, 60000);
afterAll(async () => { await db?.close(); });

async function newCase(id: string) {
  await db.query(`insert into trademarks(id,type,client_code,case_number,application_name,city,sub_status) values($1,'X','TEST','TEST','TEST','TEST','Filing')`,[id]);
}
it('enforces the complete direct-SQL flow, agent payable and 25-day timer', async () => {
  await newCase('flow');
  await expect(db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await db.exec(`update trademarks set sub_status='Acknowledgment' where id='flow'`);
  await expect(db.exec(`update trademarks set sub_status='Examination' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await expect(db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='flow'`)).rejects.toThrow('payment');
  await db.exec(`update trademarks set stage1_paid=true,status='STAGE 2',sub_status='Assigned' where id='flow';
    insert into agents(id,name) values('10000000-0000-4000-8000-000000000001','TEST AGENT');
    update trademarks set assigned_agent_id='10000000-0000-4000-8000-000000000001',agent_rate=1000 where id='flow';
    update trademarks set sub_status='Accepted' where id='flow';`);
  expect((await db.query(`select amount_billed from agent_fees where trademark_id='flow'`)).rows).toEqual([{amount_billed:'1000.00'}]);
  await db.exec(`update trademarks set notes='unchanged workflow' where id='flow'`);
  expect((await db.query(`select count(*)::int n from agent_fees where trademark_id='flow'`)).rows).toEqual([{n:1}]);
  await db.exec(`select record_agent_payment((select id from agent_fees where trademark_id='flow'),400)`);
  expect((await db.query(`select balance_due from agent_summary where id='10000000-0000-4000-8000-000000000001'`)).rows).toEqual([{balance_due:'600.00'}]);
  await expect(db.exec(`select record_agent_payment((select id from agent_fees where trademark_id='flow'),601)`)).rejects.toThrow('outstanding');
  await expect(db.exec(`update trademarks set sub_status='Hearing' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await db.exec(`update trademarks set stage2_paid=true,status='STAGE 3',sub_status='Published' where id='flow';
    update trademarks set sub_status='D-Note Received' where id='flow';
    update trademarks set sub_status='D-Note Submitted' where id='flow';`);
  expect((await db.query(`select certificate_due_date-demand_note_submitted_date as days from trademarks where id='flow'`)).rows).toEqual([{days:25}]);
  await db.exec(`update trademarks set stage3_paid=true,status='STAGE 4',sub_status='CER Acknowledge' where id='flow'`);
  await expect(db.exec(`update trademarks set sub_status='CER Dispatch' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await db.exec(`update trademarks set sub_status='CER Received' where id='flow'; update trademarks set sub_status='CER Dispatch' where id='flow'`);
});
it('requires and preserves STOPPED reason and rejects uploads/reactivation', async () => {
  await newCase('stopped');
  await expect(db.exec(`update trademarks set status='STOPPED',sub_status=null where id='stopped'`)).rejects.toThrow('requires a reason');
  await db.exec(`update trademarks set status='STOPPED',sub_status=null,stopped_reason='Client instruction' where id='stopped'`);
  const row = (await db.query<any>(`select sub_status,notes,stopped_at from trademarks where id='stopped'`)).rows[0];
  expect(row.sub_status).toBeNull(); expect(row.notes).toContain('Client instruction'); expect(row.stopped_at).toBeTruthy();
  await expect(db.exec(`update trademarks set status='STAGE 1',sub_status='Filing' where id='stopped'`)).rejects.toThrow('Invalid workflow transition');
  await expect(db.exec(`update trademarks set notes='' where id='stopped'`)).rejects.toThrow('preserved');
  expect((await db.query(`select can_upload_case_object('stopped/STAGE_1/file.pdf') as allowed`)).rows).toEqual([{allowed:false}]);
});
it('supports independent oppositions, calendar-month extension and timely TM56', async () => {
  await newCase('oppo');
  await db.exec(`update trademarks set sub_status='Acknowledgment' where id='oppo';
    update trademarks set status='STAGE 2',sub_status='Assigned',stage1_paid=true where id='oppo';
    update trademarks set sub_status='Hearing' where id='oppo';
    update trademarks set status='STAGE 3',sub_status='Published',stage2_paid=true where id='oppo';
    insert into opposition_events(trademark_id,received_date,description) values('oppo','2026-01-31','First'),('oppo','2026-02-02','Second');`);
  expect((await db.query(`select response_due_date::text from opposition_events where description='First'`)).rows).toEqual([{response_due_date:'2026-02-28'}]);
  await db.exec(`update opposition_events set extension_used=true where description='First'`);
  expect((await db.query(`select response_due_date::text from opposition_events where description='First'`)).rows).toEqual([{response_due_date:'2026-03-28'}]);
  await expect(db.exec(`update opposition_events set tm56_submitted_date='2026-03-29' where description='First'`)).rejects.toThrow('deadline');
  await db.exec(`update opposition_events set tm56_submitted_date='2026-03-28' where description='First'`);
});
it('treats legacy Editor as read-only without deleting the profile or enum', async () => {
  await db.exec(`set request.uid='00000000-0000-4000-8000-000000000002'`);
  try {
    expect((await db.query(`select current_brandex_role()::text as role`)).rows).toEqual([{role:'viewer'}]);
    await expect(newCase('forbidden')).rejects.toThrow('row-level security');
    expect((await db.query(`select id from trademarks where id='flow'`)).rows).toHaveLength(1);
    expect((await db.query(`update trademarks set notes='forbidden' where id='flow' returning id`)).rows).toHaveLength(0);
  } finally { await db.exec(`set request.uid='00000000-0000-4000-8000-000000000001'`); }
});
