begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- Fixtures: ana admin · carla manager · bruno, eva members (São Paulo time).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('a6000000-0000-0000-0000-000000000001', 'ana@example.com',   now(), '{"full_name": "Ana"}'),
  ('a6000000-0000-0000-0000-000000000002', 'carla@example.com', now(), '{"full_name": "Carla"}'),
  ('a6000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}'),
  ('a6000000-0000-0000-0000-000000000005', 'eva@example.com',   now(), '{"full_name": "Eva"}');

insert into public.organizations (id, name, slug) values
  ('b6000000-0000-0000-0000-000000000001', 'Hospital', 'hospital-time-off');
insert into public.memberships (org_id, user_id, role) values
  ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'admin'),
  ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', 'manager'),
  ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000003', 'member'),
  ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000005', 'member');
insert into public.teams (id, org_id, name) values
  ('c6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 'UTI');
insert into public.schedules (id, org_id, team_id, name, period_start, period_end) values
  ('d6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001', 'UTI nov', '2026-11-01', '2026-11-30');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- One shift for bruno starting at 07:00 São Paulo (10:00Z) on p_date.
create function pg_temp.day_shift(p_user uuid, p_date date) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'user_id', p_user,
    'starts_at', (p_date::text || 'T10:00:00Z'),
    'ends_at', (p_date::text || 'T22:00:00Z')
  ));
$$;

set local role authenticated;

-- Managers register; members request ------------------------------------------

select pg_temp.login('a6000000-0000-0000-0000-000000000002'); -- carla (manager)

select lives_ok(
  $$ insert into public.time_off (org_id, user_id, kind, status, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000003',
             'vacation', 'approved', '2026-11-10', '2026-11-20')
     returning id $$,
  'manager registers approved vacation for a member (insert ... returning)'
);

select is(
  (select reviewed_by from public.time_off where user_id = 'a6000000-0000-0000-0000-000000000003'),
  'a6000000-0000-0000-0000-000000000002'::uuid,
  'approval is stamped with the reviewer'
);

select throws_ok(
  $$ insert into public.time_off (org_id, user_id, kind, status, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000003',
             'medical', 'approved', '2026-11-18', '2026-11-25') $$,
  '23P01', null,
  'overlapping time off for the same person is rejected'
);

select throws_ok(
  $$ insert into public.time_off (org_id, user_id, kind, status, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000003',
             'vacation', 'approved', '2026-11-10', '2026-11-05') $$,
  '23514', null,
  'end date must not be before start date'
);

select pg_temp.login('a6000000-0000-0000-0000-000000000005'); -- eva (member)

select throws_ok(
  $$ insert into public.time_off (org_id, user_id, kind, status, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000005',
             'vacation', 'approved', '2026-12-01', '2026-12-10') $$,
  '42501', null,
  'members cannot self-approve'
);

select throws_ok(
  $$ insert into public.time_off (org_id, user_id, kind, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000003',
             'vacation', '2026-12-01', '2026-12-10') $$,
  '42501', null,
  'members cannot request time off for someone else'
);

select lives_ok(
  $$ insert into public.time_off (org_id, user_id, kind, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000005',
             'vacation', '2026-12-01', '2026-12-10') $$,
  'members request their own time off (pending)'
);

-- Visibility ------------------------------------------------------------------

select results_eq(
  $$ select user_id from public.time_off $$,
  $$ values ('a6000000-0000-0000-0000-000000000005'::uuid) $$,
  'members see only their own entries'
);

select pg_temp.login('a6000000-0000-0000-0000-000000000002'); -- carla
select is((select count(*)::int from public.time_off), 2, 'managers see everyone''s entries');

-- Review ----------------------------------------------------------------------

select pg_temp.login('a6000000-0000-0000-0000-000000000005'); -- eva
update public.time_off set status = 'approved' where user_id = 'a6000000-0000-0000-0000-000000000005';

select pg_temp.login('a6000000-0000-0000-0000-000000000002'); -- carla
select is(
  (select status::text from public.time_off where user_id = 'a6000000-0000-0000-0000-000000000005'),
  'pending',
  'a member''s update does not approve anything'
);

update public.time_off set status = 'rejected' where user_id = 'a6000000-0000-0000-0000-000000000005';
select is(
  (select reviewed_by from public.time_off where user_id = 'a6000000-0000-0000-0000-000000000005'),
  'a6000000-0000-0000-0000-000000000002'::uuid,
  'rejection is stamped with the reviewer'
);

select pg_temp.login('a6000000-0000-0000-0000-000000000005'); -- eva
select lives_ok(
  $$ insert into public.time_off (org_id, user_id, kind, start_date, end_date)
     values ('b6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000005',
             'leave', '2026-12-05', '2026-12-06') $$,
  'a rejected request does not block a new one for the same days'
);

select lives_ok(
  $$ delete from public.time_off where kind = 'leave' $$,
  'members can cancel their own pending request'
);
select is_empty(
  $$ select 1 from public.time_off where kind = 'leave' $$,
  '...and it is gone'
);

-- Blocking shifts -------------------------------------------------------------

select pg_temp.login('a6000000-0000-0000-0000-000000000002'); -- carla

select throws_ok(
  format('select public.replace_schedule_shifts(%L, %L::jsonb, array[]::uuid[])',
    'd6000000-0000-0000-0000-000000000001',
    pg_temp.day_shift('a6000000-0000-0000-0000-000000000003', '2026-11-15')),
  'SC006', null,
  'no new shifts during approved time off'
);

select throws_ok(
  format('select public.replace_schedule_shifts(%L, %L::jsonb, array[]::uuid[])',
    'd6000000-0000-0000-0000-000000000001',
    pg_temp.day_shift('a6000000-0000-0000-0000-000000000003', '2026-11-10')),
  'SC006', null,
  'the first day of time off is blocked'
);

select is(
  public.replace_schedule_shifts(
    'd6000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'user_id', 'a6000000-0000-0000-0000-000000000003',
      'starts_at', '2026-11-09T22:00:00Z', 'ends_at', '2026-11-10T10:00:00Z')),
    array[]::uuid[]
  ),
  1,
  'a night shift starting the day before time off is allowed'
);

select is(
  public.replace_schedule_shifts(
    'd6000000-0000-0000-0000-000000000001',
    pg_temp.day_shift('a6000000-0000-0000-0000-000000000005', '2026-11-21'),
    array[]::uuid[]
  ),
  1,
  'people without approved time off are scheduled normally'
);

select lives_ok(
  $$ update public.time_off set start_date = '2026-11-09'
     where user_id = 'a6000000-0000-0000-0000-000000000003' $$,
  'approving/extending time off over an existing shift is allowed (app flags it)'
);

select pg_temp.login('a6000000-0000-0000-0000-000000000003'); -- bruno
delete from public.time_off; -- RLS: only his own *pending* entries are deletable

select pg_temp.login('a6000000-0000-0000-0000-000000000002'); -- carla
select is(
  (select count(*)::int from public.time_off where user_id = 'a6000000-0000-0000-0000-000000000003'),
  1,
  'members cannot delete approved entries'
);

-- Audit -----------------------------------------------------------------------

select pg_temp.login('a6000000-0000-0000-0000-000000000001'); -- ana (admin)
select ok(
  (select count(*) from public.audit_log where entity = 'time_off') >= 4,
  'time off changes are audited'
);

select * from finish();
rollback;
