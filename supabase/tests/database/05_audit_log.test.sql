begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Fixtures: ana admin · carla manager · bruno member (team UTI).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('60000000-0000-0000-0000-000000000001', 'ana@example.com',   now(), '{"full_name": "Ana"}'),
  ('60000000-0000-0000-0000-000000000002', 'carla@example.com', now(), '{"full_name": "Carla"}'),
  ('60000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('60000000-0000-0000-0000-000000000001'); -- ana

create temp table org as
  select (public.create_organization('Hospital', 'hospital-audit')).id;

reset role;
grant select on org to authenticated;
-- Fixture memberships/team inserted as postgres: no JWT, so actor_id is null.
select set_config('request.jwt.claims', '', true);
insert into public.memberships (org_id, user_id, role)
  select id, '60000000-0000-0000-0000-000000000002'::uuid, 'manager'::public.org_role from org
  union all
  select id, '60000000-0000-0000-0000-000000000003'::uuid, 'member'::public.org_role from org;
insert into public.teams (id, org_id, name)
  select '70000000-0000-0000-0000-000000000001', id, 'UTI' from org;
insert into public.shift_types (id, org_id, name, start_time, duration_minutes)
  select '80000000-0000-0000-0000-000000000001', id, 'Diurno', '07:00', 720 from org;
set local role authenticated;

-- What gets recorded --------------------------------------------------------

select pg_temp.login('60000000-0000-0000-0000-000000000001'); -- ana (admin)

select is(
  (select actor_id from public.audit_log
   where entity = 'memberships' and action = 'insert'
     and changes -> 'row' ->> 'user_id' = '60000000-0000-0000-0000-000000000001'),
  '60000000-0000-0000-0000-000000000001'::uuid,
  'creating an organization records the creator joining, with actor'
);

select is(
  (select actor_id from public.audit_log
   where entity = 'memberships' and changes -> 'row' ->> 'user_id' = '60000000-0000-0000-0000-000000000003'),
  null,
  'changes made without a session have no actor'
);

update public.memberships set role = 'manager'
  where user_id = '60000000-0000-0000-0000-000000000003';

select is(
  (select changes -> 'changed' -> 'role' from public.audit_log
   where entity = 'memberships' and action = 'update'),
  '["member", "manager"]'::jsonb,
  'updates record only the changed columns as [old, new]'
);

update public.shift_types set name = 'Diurno' where id = '80000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.audit_log where entity = 'shift_types' and action = 'update'),
  0,
  'no-op updates (only updated_at changes) are not recorded'
);

select pg_temp.login('60000000-0000-0000-0000-000000000002'); -- carla (manager)

insert into public.schedules (org_id, team_id, name, period_start, period_end)
  select id, '70000000-0000-0000-0000-000000000001', 'UTI nov', '2026-11-01', '2026-11-30' from org;

select public.replace_schedule_shifts(
  (select id from public.schedules where name = 'UTI nov'),
  jsonb_build_array(
    jsonb_build_object('user_id', '60000000-0000-0000-0000-000000000003', 'shift_type_id', '80000000-0000-0000-0000-000000000001',
                       'starts_at', '2026-11-01T10:00:00Z', 'ends_at', '2026-11-01T22:00:00Z'),
    jsonb_build_object('user_id', '60000000-0000-0000-0000-000000000003', 'shift_type_id', '80000000-0000-0000-0000-000000000001',
                       'starts_at', '2026-11-03T10:00:00Z', 'ends_at', '2026-11-03T22:00:00Z')
  )
);

update public.schedules set status = 'published' where name = 'UTI nov';

-- Who can read it -----------------------------------------------------------

select is_empty(
  $$ select 1 from public.audit_log $$,
  'managers cannot read the audit log'
);

select pg_temp.login('60000000-0000-0000-0000-000000000003'); -- bruno
select is_empty($$ select 1 from public.audit_log $$, 'members cannot read the audit log');

select pg_temp.login('60000000-0000-0000-0000-000000000001'); -- ana

select is(
  (select count(*)::int from public.audit_log where entity = 'shifts' and action = 'insert'),
  2,
  'each shift insert is recorded'
);

select is(
  (select count(distinct txid)::int from public.audit_log where entity = 'shifts'),
  1,
  'shifts written by one RPC call share a txid'
);

select is(
  (select actor_id from public.audit_log where entity = 'shifts' limit 1),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'the RPC caller is the actor'
);

select is(
  (select changes -> 'changed' -> 'status' from public.audit_log
   where entity = 'schedules' and action = 'update'),
  '["draft", "published"]'::jsonb,
  'publishing is recorded as a status change'
);

-- Append-only -----------------------------------------------------------------

select throws_ok(
  $$ insert into public.audit_log (org_id, action, entity, changes)
     select id, 'insert', 'fake', '{}' from org $$,
  '42501', null,
  'nobody can write to the audit log directly'
);

select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', null,
  'nobody can delete from the audit log, not even admins'
);

select * from finish();
rollback;
