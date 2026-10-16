begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Fixtures ---------------------------------------------------------------------
-- Org A: ana admin · carla manager · bruno member (team UTI) · eva member (no team)
-- Org B: diego admin
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'ana@example.com',   now(), '{"full_name": "Ana"}'),
  ('10000000-0000-0000-0000-000000000002', 'carla@example.com', now(), '{"full_name": "Carla"}'),
  ('10000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}'),
  ('10000000-0000-0000-0000-000000000004', 'diego@example.com', now(), '{"full_name": "Diego"}'),
  ('10000000-0000-0000-0000-000000000005', 'eva@example.com',   now(), '{"full_name": "Eva"}');

insert into public.organizations (id, name, slug) values
  ('20000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('20000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');
insert into public.memberships (org_id, user_id, role) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002', 'manager'),
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'member'),
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000005', 'member'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000004', 'admin');

insert into public.teams (id, org_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', 'UTI'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', 'PS');
insert into public.team_members (team_id, org_id, user_id) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003');

insert into public.shift_types (id, org_id, name, start_time, duration_minutes) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', 'Diurno', '07:00', 720);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- shift rows for replace_schedule_shifts
create function pg_temp.shift(p_user uuid, p_start text, p_end text) returns jsonb language sql as $$
  select jsonb_build_object(
    'user_id', p_user,
    'shift_type_id', '40000000-0000-0000-0000-000000000001',
    'starts_at', p_start,
    'ends_at', p_end
  );
$$;

set local role authenticated;

-- Schedules ------------------------------------------------------------------

select pg_temp.login('10000000-0000-0000-0000-000000000002'); -- carla (manager)

select throws_ok(
  $$ insert into public.schedules (id, org_id, team_id, name, period_start, period_end, status)
     values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a',
             '30000000-0000-0000-0000-000000000001', 'UTI nov', '2026-11-01', '2026-11-30', 'published') $$,
  '42501', null,
  'id and status are not insertable (column grants)'
);

-- With RETURNING, like the API does: the SELECT policy is applied to the new row.
select lives_ok(
  $$ insert into public.schedules (org_id, team_id, name, period_start, period_end)
     values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 'UTI nov', '2026-11-01', '2026-11-30')
     returning id, name $$,
  'manager creates a schedule (insert ... returning)'
);

reset role;
create temp table sched as select id, name from public.schedules;
grant select, insert on sched to authenticated;
set local role authenticated;

select throws_ok(
  $$ insert into public.schedules (org_id, team_id, name, period_start, period_end)
     values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 'UTI dup', '2026-11-15', '2026-12-14') $$,
  '23P01', null,
  'a team cannot have overlapping schedule periods'
);

select lives_ok(
  $$ insert into public.schedules (org_id, team_id, name, period_start, period_end)
     values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', 'PS nov', '2026-11-01', '2026-11-30') $$,
  'another team can use the same period'
);

reset role;
insert into sched select id, name from public.schedules where name = 'PS nov';
set local role authenticated;

select throws_ok(
  $$ insert into public.schedules (org_id, team_id, name, period_start, period_end)
     values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', 'Longa', '2027-01-01', '2027-03-31') $$,
  '23514', null,
  'periods are limited to 62 days'
);

select is(
  (select status::text from public.schedules where name = 'UTI nov'),
  'draft',
  'new schedules start as draft'
);

-- Shifts via replace_schedule_shifts ----------------------------------------

select is(
  public.replace_schedule_shifts(
    (select id from sched where name = 'UTI nov'),
    jsonb_build_array(
      pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-01T10:00:00Z', '2026-11-01T22:00:00Z'),
      pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-03T10:00:00Z', '2026-11-03T22:00:00Z')
    )
  ),
  2,
  'manager inserts shifts and gets the count'
);

select throws_ok(
  format(
    'select public.replace_schedule_shifts(%L, %L::jsonb, array[]::uuid[])',
    (select id from sched where name = 'PS nov'),
    jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-01T20:00:00Z', '2026-11-02T08:00:00Z'))
  ),
  '23P01', null,
  'overlapping shifts are rejected even across schedules'
);

select is(
  public.replace_schedule_shifts(
    (select id from sched where name = 'PS nov'),
    jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-01T22:00:00Z', '2026-11-02T10:00:00Z')),
    array[]::uuid[]
  ),
  1,
  'back-to-back shifts (07–19 then 19–07) are allowed'
);

select throws_ok(
  format(
    'select public.replace_schedule_shifts(%L, %L::jsonb, array[]::uuid[])',
    (select id from sched where name = 'UTI nov'),
    jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000004', '2026-11-05T10:00:00Z', '2026-11-05T22:00:00Z'))
  ),
  '42501', null,
  'shifts can only be assigned to organization members'
);

select throws_ok(
  format(
    'select public.replace_schedule_shifts(%L, %L::jsonb, array[]::uuid[])',
    (select id from sched where name = 'UTI nov'),
    jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-10T10:00:00Z', '2026-11-11T12:00:00Z'))
  ),
  '23514', null,
  'a shift cannot exceed 24 hours'
);

select throws_ok(
  $$ insert into public.shifts (org_id, schedule_id, user_id, starts_at, ends_at)
     select '20000000-0000-0000-0000-00000000000a', id, '10000000-0000-0000-0000-000000000003',
            '2026-11-20T10:00:00Z', '2026-11-20T09:00:00Z' from sched where name = 'UTI nov' $$,
  '23514', null,
  'a shift must end after it starts'
);

-- Visibility -----------------------------------------------------------------

select pg_temp.login('10000000-0000-0000-0000-000000000003'); -- bruno (member, UTI)

select throws_ok(
  format('select public.replace_schedule_shifts(%L, %L::jsonb)', (select id from sched where name = 'UTI nov'), '[]'),
  'P0002', null,
  'a draft is invisible to members, so editing it reports "not found"'
);

select is_empty($$ select 1 from public.schedules $$, 'members do not see draft schedules');
select is_empty($$ select 1 from public.shifts $$, '...nor their shifts');

select pg_temp.login('10000000-0000-0000-0000-000000000002'); -- carla
update public.schedules set status = 'published' where name = 'UTI nov';

select isnt(
  (select published_at from public.schedules where name = 'UTI nov'),
  null,
  'publishing stamps published_at'
);

select pg_temp.login('10000000-0000-0000-0000-000000000003'); -- bruno
select results_eq(
  $$ select name from public.schedules $$,
  $$ values ('UTI nov'::text) $$,
  'team member sees the published schedule of their team only'
);
select is((select count(*)::int from public.shifts), 2, '...and its shifts');

select throws_ok(
  format('select public.replace_schedule_shifts(%L, %L::jsonb)', (select id from sched where name = 'UTI nov'), '[]'),
  '42501', null,
  'members cannot edit a schedule they can see'
);

select pg_temp.login('10000000-0000-0000-0000-000000000005'); -- eva (no team)
select is_empty($$ select 1 from public.schedules $$, 'member outside the team does not see it');

select pg_temp.login('10000000-0000-0000-0000-000000000002'); -- carla adds eva as cover
select public.replace_schedule_shifts(
  (select id from sched where name = 'UTI nov'),
  jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000005', '2026-11-02T10:00:00Z', '2026-11-02T22:00:00Z')),
  array[]::uuid[]
);

select pg_temp.login('10000000-0000-0000-0000-000000000005'); -- eva
select is(
  (select count(*)::int from public.schedules where name = 'UTI nov'),
  1,
  'a member covering a shift sees that schedule'
);

select pg_temp.login('10000000-0000-0000-0000-000000000004'); -- diego (org B)
select is_empty($$ select 1 from public.schedules $$, 'other organizations see nothing');

select pg_temp.login('10000000-0000-0000-0000-000000000002'); -- carla
update public.schedules set status = 'draft' where name = 'UTI nov';
select is(
  (select published_at from public.schedules where name = 'UTI nov'),
  null,
  'unpublishing clears published_at'
);

-- Replace semantics ----------------------------------------------------------

select is(
  public.replace_schedule_shifts(
    (select id from sched where name = 'UTI nov'),
    '[]'::jsonb,
    array(select id from public.shifts where user_id = '10000000-0000-0000-0000-000000000005')
  ),
  0,
  'deleting only listed ids'
);
select is(
  (select count(*)::int from public.shifts where schedule_id = (select id from sched where name = 'UTI nov')),
  2,
  '...keeps the other shifts'
);

select public.replace_schedule_shifts(
  (select id from sched where name = 'UTI nov'),
  jsonb_build_array(pg_temp.shift('10000000-0000-0000-0000-000000000003', '2026-11-05T10:00:00Z', '2026-11-05T22:00:00Z'))
);
select is(
  (select count(*)::int from public.shifts where schedule_id = (select id from sched where name = 'UTI nov')),
  1,
  'null p_delete_ids replaces every shift of the schedule'
);

-- History and cascades ---------------------------------------------------------

select throws_ok(
  $$ delete from public.teams where name = 'UTI' $$,
  '23503', null,
  'a team with schedules cannot be deleted'
);

reset role;
delete from public.memberships where user_id = '10000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.shifts where user_id = '10000000-0000-0000-0000-000000000003'),
  2,
  'removing someone from the org keeps their past shifts'
);

select * from finish();
rollback;
