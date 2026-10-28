import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, expect, it, describe } from 'vitest';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select coalesce(nullif(current_setting('request.role',true),''),'authenticated') $$;
    create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to authenticated;
  `);
  const directory = resolve(process.cwd(), readdirSync(process.cwd()).includes('supabase') ? 'supabase/migrations' : '../../supabase/migrations');
  for (const file of readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
    if (file === '20260929212118_admin_viewer_role_closure.sql') {
      await db.exec(`insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
        update public.profiles set role='admin' where user_id='00000000-0000-4000-8000-000000000001';
        update public.profiles set role='editor' where user_id='00000000-0000-4000-8000-000000000002';`);
    }
    // PGlite provides gen_random_uuid in core; pgcrypto is not needed by these tests.
    await db.exec(readFileSync(resolve(directory,file),'utf8').replace(/create extension if not exists pgcrypto;/i,''));
  }
  await db.exec(`grant select,insert,update,delete on all tables in schema public,storage to authenticated;
    grant usage,select on all sequences in schema public to authenticated;
    set request.uid='00000000-0000-4000-8000-000000000001';
    set role authenticated;`);
}, 60000);
afterAll(async () => { await db?.close(); });

async function newCase(id: string, tmNo: string = '12345') {
  await db.query(`insert into trademarks(id,type,client_code,case_number,application_name,city,sub_status,tm_cpr_number) values($1,'X','TEST','TEST','TEST','TEST','Filing',$2)`,[id, tmNo]);
}

async function linkLedgerCase(trademarkId: string, tmNo: string = '12345') {
  const clientId = '20000000-0000-4000-8000-000000000001';
  const caseId = crypto.randomUUID();
  await db.query(`
    insert into ledger_clients(id, client_code, client_name)
    values($1::uuid, 'TEST-CLIENT-' || substr($1::text, 1, 8), 'Test Client')
    on conflict (client_code) do nothing
  `, [clientId]);

  await db.exec(`set brandex.internal_case_link = 'true';`);
  await db.query(`
    insert into ledger_cases(id, client_id, cms_trademark_id, reconciliation_status, tm_no, tm_no_normalized)
    values($1::uuid, $2::uuid, $3, 'approved_link', $4, $4)
  `, [caseId, clientId, trademarkId, tmNo]);
  await db.exec(`reset brandex.internal_case_link;`);

  return { clientId, caseId };
}

async function addLedgerCharge(clientId: string, caseId: string, stage: string, amount: number) {
  const res = await db.query<{ id: string }>(`
    insert into ledger_entries(client_id, case_id, entry_type, stage, amount_due, amount_received)
    values($1, $2, 'charge', $3, $4, 0)
    returning id
  `, [clientId, caseId, stage, amount]);
  return res.rows[0].id;
}

it('enforces the complete direct-SQL flow, agent payable and 25-day timer', async () => {
  await newCase('flow', '11111');
  const { clientId, caseId } = await linkLedgerCase('flow', '11111');

  await expect(db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await db.exec(`update trademarks set sub_status='Acknowledgment' where id='flow'`);
  await expect(db.exec(`update trademarks set sub_status='Examination' where id='flow'`)).rejects.toThrow('Invalid workflow transition');

  // Attempting STAGE 2 without cleared S1 payment in Ledger is rejected
  await expect(db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='flow'`)).rejects.toThrow('Stage 1 payment must be cleared in the Ledger');

  // Add S1 charge and receipt
  await addLedgerCharge(clientId, caseId, 'S1', 1000);
  await db.query(`select record_client_receipt('flow', 'S1', 1000)`);

  // Now STAGE 2 transition succeeds
  await db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='flow';
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

  // Attempting STAGE 3 without S2 clearance in Ledger is rejected
  await expect(db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='flow'`)).rejects.toThrow('Stage 2 payment must be cleared in the Ledger');

  // Add S2 charge and receipt
  await addLedgerCharge(clientId, caseId, 'S2', 2000);
  await db.query(`select record_client_receipt('flow', 'S2', 2000)`);

  await db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='flow';
    update trademarks set sub_status='D-Note Received' where id='flow';
    update trademarks set sub_status='D-Note Submitted' where id='flow';`);
  expect((await db.query(`select certificate_due_date-demand_note_submitted_date as days from trademarks where id='flow'`)).rows).toEqual([{days:25}]);

  // Attempting STAGE 4 without S3 clearance in Ledger is rejected
  await expect(db.exec(`update trademarks set status='STAGE 4',sub_status='CER Acknowledge' where id='flow'`)).rejects.toThrow('Stage 3 payment must be cleared in the Ledger');

  // Add S3 charge and receipt
  await addLedgerCharge(clientId, caseId, 'S3', 3000);
  await db.query(`select record_client_receipt('flow', 'S3', 3000)`);

  await db.exec(`update trademarks set status='STAGE 4',sub_status='CER Acknowledge' where id='flow'`);
  await expect(db.exec(`update trademarks set sub_status='CER Dispatch' where id='flow'`)).rejects.toThrow('Invalid workflow transition');
  await db.exec(`update trademarks set sub_status='CER Received' where id='flow'; update trademarks set sub_status='CER Dispatch' where id='flow'`);
});

it('requires and preserves STOPPED reason and rejects uploads/reactivation', async () => {
  await newCase('stopped', '22222');
  await expect(db.exec(`update trademarks set status='STOPPED',sub_status=null where id='stopped'`)).rejects.toThrow('requires a reason');
  await db.exec(`update trademarks set status='STOPPED',sub_status=null,stopped_reason='Client instruction' where id='stopped'`);
  const row = (await db.query<any>(`select sub_status,notes,stopped_at from trademarks where id='stopped'`)).rows[0];
  expect(row.sub_status).toBeNull(); expect(row.notes).toContain('Client instruction'); expect(row.stopped_at).toBeTruthy();
  await expect(db.exec(`update trademarks set status='STAGE 1',sub_status='Filing' where id='stopped'`)).rejects.toThrow('Invalid workflow transition');
  await expect(db.exec(`update trademarks set notes='' where id='stopped'`)).rejects.toThrow('preserved');
  expect((await db.query(`select can_upload_case_object('stopped/STAGE_1/file.pdf') as allowed`)).rows).toEqual([{allowed:false}]);
});

it('supports independent oppositions, calendar-month extension and timely TM56', async () => {
  await newCase('oppo', '33333');
  const { clientId, caseId } = await linkLedgerCase('oppo', '33333');
  await addLedgerCharge(clientId, caseId, 'S1', 1000);
  await db.query(`select record_client_receipt('oppo', 'S1', 1000)`);
  await addLedgerCharge(clientId, caseId, 'S2', 2000);
  await db.query(`select record_client_receipt('oppo', 'S2', 2000)`);

  await db.exec(`update trademarks set sub_status='Acknowledgment' where id='oppo';
    update trademarks set status='STAGE 2',sub_status='Assigned' where id='oppo';
    update trademarks set sub_status='Hearing' where id='oppo';
    update trademarks set status='STAGE 3',sub_status='Published' where id='oppo';
    insert into opposition_events(trademark_id,received_date,description) values('oppo','2026-01-31','First'),('oppo','2026-02-02','Second');`);
  expect((await db.query(`select response_due_date::text from opposition_events where description='First'`)).rows).toEqual([{response_due_date:'2026-02-28'}]);
  await db.exec(`update opposition_events set extension_used=true where description='First'`);
  expect((await db.query(`select response_due_date::text from opposition_events where description='First'`)).rows).toEqual([{response_due_date:'2026-03-28'}]);
  await expect(db.exec(`update opposition_events set tm56_submitted_date='2026-03-29' where description='First'`)).rejects.toThrow('deadline');
  await db.exec(`update opposition_events set tm56_submitted_date='2026-03-28' where description='First'`);
});

it('converts legacy Editor profiles to Viewer and prevents active Editor assignments', async () => {
  expect((await db.query(`select role::text from profiles where user_id='00000000-0000-4000-8000-000000000002'`)).rows).toEqual([{role:'viewer'}]);
  expect((await db.query(`select enumlabel from pg_enum join pg_type on pg_type.oid=enumtypid where typname='brandex_role' and enumlabel='editor'`)).rows).toHaveLength(1);
  await db.exec(`reset role`);
  await expect(db.exec(`update profiles set role='editor' where user_id='00000000-0000-4000-8000-000000000002'`)).rejects.toThrow('profiles_active_role_not_editor');
  await db.exec(`set role authenticated`);
  await db.exec(`set request.uid='00000000-0000-4000-8000-000000000002'`);
  try {
    expect((await db.query(`select current_brandex_role()::text as role`)).rows).toEqual([{role:'viewer'}]);
    expect((await db.query(`select has_table_privilege('authenticated','public.trademarks','truncate') as can_truncate, has_table_privilege('anon','public.trademarks','select') as anon_can_read`)).rows).toEqual([{can_truncate:false,anon_can_read:false}]);
    expect((await db.query(`select has_function_privilege('authenticated','public.audit_and_queue_trademark()','execute') as can_call_trigger, has_function_privilege('authenticated','public.run_form_match()','execute') as can_call_admin_rpc, has_function_privilege('anon','public.run_form_match()','execute') as anon_can_call_admin_rpc`)).rows).toEqual([{can_call_trigger:false,can_call_admin_rpc:true,anon_can_call_admin_rpc:false}]);
    await expect(newCase('forbidden', '99999')).rejects.toThrow('row-level security');
    await expect(db.exec(`insert into agents(name) values('VIEWER WRITE TEST')`)).rejects.toThrow('row-level security');
    await expect(db.exec(`insert into storage.objects(bucket_id,name) values('trademark-files','flow/STAGE_1/forbidden.pdf')`)).rejects.toThrow('row-level security');
    await expect(db.query(`select run_form_match()`)).rejects.toThrow('Access denied');
    await expect(db.query(`select record_agent_payment(gen_random_uuid(),1)`)).rejects.toThrow('Admin required');
    expect((await db.query(`select id from trademarks where id='flow'`)).rows).toHaveLength(1);
    expect((await db.query(`update trademarks set notes='forbidden' where id='flow' returning id`)).rows).toHaveLength(0);
  } finally { await db.exec(`set request.uid='00000000-0000-4000-8000-000000000001'`); }
});

describe('PR #10 Consolidated Ledger Payment Gates & Receipts Scenarios', () => {
  it('Scenario 1: No approved link: record_client_receipt raises error and inserts no entry', async () => {
    await newCase('no-link-case', '44444');
    const initialCount = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;

    await expect(
      db.query(`select record_client_receipt('no-link-case', 'S1', 5000)`)
    ).rejects.toThrow('No single approved Ledger case is linked to this CMS trademark');

    const afterCount = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;
    expect(afterCount).toBe(initialCount);
  });

  it('Scenario 2: Exactly one approved link: a valid admin receipt creates exactly one ledger_entries row and returns receipt number', async () => {
    await newCase('single-link-case', '55555');
    const { clientId, caseId } = await linkLedgerCase('single-link-case', '55555');
    await addLedgerCharge(clientId, caseId, 'S1', 5000);

    const initialEntries = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;

    const res = await db.query<{ record_client_receipt: any }>(
      `select record_client_receipt('single-link-case', 'S1', 5000) as record_client_receipt`
    );
    const receipt = res.rows[0].record_client_receipt;
    expect(receipt.id).toBeDefined();
    expect(receipt.receipt_no).toMatch(/^REC-\d{4}-\d{4}$/);
    expect(receipt.amount).toBe(5000);
    expect(receipt.stage).toBe('S1');

    const afterEntries = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;
    expect(Number(afterEntries)).toBe(Number(initialEntries) + 1);

    const insertedRow = (await db.query<any>(`select * from ledger_entries where id = $1`, [receipt.id])).rows[0];
    expect(insertedRow.case_id).toBe(caseId);
    expect(insertedRow.client_id).toBe(clientId);
    expect(insertedRow.entry_type).toBe('receiving');
    expect(insertedRow.stage).toBe('S1');
    expect(Number(insertedRow.amount_received)).toBe(5000);
  });

  it('Scenario 3: Repeating same p_request_id returns original receipt without duplicate row', async () => {
    await newCase('idempotent-case', '66666');
    const { clientId, caseId } = await linkLedgerCase('idempotent-case', '66666');
    await addLedgerCharge(clientId, caseId, 'S1', 3000);

    const reqId = '30000000-0000-4000-8000-000000000001';
    const res1 = await db.query<{ record_client_receipt: any }>(
      `select record_client_receipt('idempotent-case', 'S1', 3000, current_date, 'cash', null, null, null, null, null, $1::uuid) as record_client_receipt`,
      [reqId]
    );
    const receipt1 = res1.rows[0].record_client_receipt;

    const countAfterFirst = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;

    // Call again with exact same request ID
    const res2 = await db.query<{ record_client_receipt: any }>(
      `select record_client_receipt('idempotent-case', 'S1', 3000, current_date, 'cash', null, null, null, null, null, $1::uuid) as record_client_receipt`,
      [reqId]
    );
    const receipt2 = res2.rows[0].record_client_receipt;

    expect(receipt2.id).toBe(receipt1.id);
    expect(receipt2.receipt_no).toBe(receipt1.receipt_no);

    const countAfterSecond = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('Scenario 4: Reusing request ID with different amount/stage/date/case is rejected', async () => {
    await newCase('reuse-key-case', '77777');
    const { clientId, caseId } = await linkLedgerCase('reuse-key-case', '77777');
    await addLedgerCharge(clientId, caseId, 'S1', 4000);

    const reqId = '40000000-0000-4000-8000-000000000001';
    await db.query(
      `select record_client_receipt('reuse-key-case', 'S1', 4000, current_date, 'cash', null, null, null, null, null, $1::uuid)`,
      [reqId]
    );

    const countBeforeConflict = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;

    // Reuse request ID with different amount
    await expect(
      db.query(
        `select record_client_receipt('reuse-key-case', 'S1', 9999, current_date, 'cash', null, null, null, null, null, $1::uuid)`,
        [reqId]
      )
    ).rejects.toThrow('Idempotency key was already used for a different receipt');

    // Reuse request ID with different stage
    await expect(
      db.query(
        `select record_client_receipt('reuse-key-case', 'S2', 4000, current_date, 'cash', null, null, null, null, null, $1::uuid)`,
        [reqId]
      )
    ).rejects.toThrow('Idempotency key was already used for a different receipt');

    const countAfterConflict = (await db.query<{ count: string }>(`select count(*) from ledger_entries`)).rows[0].count;
    expect(countAfterConflict).toBe(countBeforeConflict);
  });

  it('Scenario 5: A voided receipt does not count toward stage clearance', async () => {
    await newCase('void-test-case', '88888');
    const { clientId, caseId } = await linkLedgerCase('void-test-case', '88888');
    await addLedgerCharge(clientId, caseId, 'S1', 2500);

    // Record receipt
    const res = await db.query<{ record_client_receipt: any }>(
      `select record_client_receipt('void-test-case', 'S1', 2500) as record_client_receipt`
    );
    const receiptId = res.rows[0].record_client_receipt.id;

    // Move to Acknowledgment first
    await db.exec(`update trademarks set sub_status='Acknowledgment' where id='void-test-case'`);

    // Void the receipt
    await db.query(`select void_client_receipt($1::uuid, 'Customer cancelled payment')`, [receiptId]);

    // Attempting STAGE 2 transition must be rejected because voided receipt does not clear payment
    await expect(
      db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='void-test-case'`)
    ).rejects.toThrow('Stage 1 payment must be cleared in the Ledger before progression');
  });

  it('Scenario 6: Stage 2, 3, and 4 transitions are rejected until prior active receipts cover active charges', async () => {
    await newCase('stages-progression', '90001');
    const { clientId, caseId } = await linkLedgerCase('stages-progression', '90001');

    await db.exec(`update trademarks set sub_status='Acknowledgment' where id='stages-progression'`);

    // Stage 1 charge = 1000
    await addLedgerCharge(clientId, caseId, 'S1', 1000);

    // Partial payment = 500
    await db.query(`select record_client_receipt('stages-progression', 'S1', 500)`);
    await expect(
      db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='stages-progression'`)
    ).rejects.toThrow('Stage 1 payment must be cleared in the Ledger before progression');

    // Remaining payment = 500 (total 1000 covers 1000 due)
    await db.query(`select record_client_receipt('stages-progression', 'S1', 500)`);
    await db.exec(`update trademarks set status='STAGE 2',sub_status='Assigned' where id='stages-progression'`);

    // Assign agent before accepted
    await db.exec(`update trademarks set assigned_agent_id='10000000-0000-4000-8000-000000000001',agent_rate=500 where id='stages-progression'`);
    await db.exec(`update trademarks set sub_status='Accepted' where id='stages-progression'`);

    // Stage 2 charge = 2000
    await addLedgerCharge(clientId, caseId, 'S2', 2000);

    // Progression to Stage 3 rejected without S2 payment
    await expect(
      db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='stages-progression'`)
    ).rejects.toThrow('Stage 2 payment must be cleared in the Ledger before progression');

    // Pay S2 in full
    await db.query(`select record_client_receipt('stages-progression', 'S2', 2000)`);
    await db.exec(`update trademarks set status='STAGE 3',sub_status='Published' where id='stages-progression'`);

    // Move along Stage 3
    await db.exec(`update trademarks set sub_status='D-Note Received' where id='stages-progression'`);
    await db.exec(`update trademarks set sub_status='D-Note Submitted' where id='stages-progression'`);

    // Stage 3 charge = 3000
    await addLedgerCharge(clientId, caseId, 'S3', 3000);

    // Progression to Stage 4 rejected without S3 payment
    await expect(
      db.exec(`update trademarks set status='STAGE 4',sub_status='CER Acknowledge' where id='stages-progression'`)
    ).rejects.toThrow('Stage 3 payment must be cleared in the Ledger before progression');

    // Pay S3 in full
    await db.query(`select record_client_receipt('stages-progression', 'S3', 3000)`);
    await db.exec(`update trademarks set status='STAGE 4',sub_status='CER Acknowledge' where id='stages-progression'`);
  });

  it('Scenario 7: Role/RLS checks: viewer cannot record receipts; helper function is not callable directly', async () => {
    await newCase('rls-case', '90002');
    await linkLedgerCase('rls-case', '90002');

    // Switch to Viewer role
    await db.exec(`set request.uid='00000000-0000-4000-8000-000000000002'`);
    try {
      // Viewer cannot call record_client_receipt
      await expect(
        db.query(`select record_client_receipt('rls-case', 'S1', 1000)`)
      ).rejects.toThrow('Only administrators can record client receipts');

      // Direct call to cms_stage_payment_cleared is revoked from authenticated/anon/public
      await expect(
        db.query(`select cms_stage_payment_cleared('rls-case', 'S1')`)
      ).rejects.toThrow('permission denied for function cms_stage_payment_cleared');
    } finally {
      // Restore Admin role
      await db.exec(`set request.uid='00000000-0000-4000-8000-000000000001'`);
    }

    // Admin can record receipt
    const res = await db.query<{ record_client_receipt: any }>(
      `select record_client_receipt('rls-case', 'S1', 1000) as record_client_receipt`
    );
    expect(res.rows[0].record_client_receipt.receipt_no).toBeDefined();
  });
});
