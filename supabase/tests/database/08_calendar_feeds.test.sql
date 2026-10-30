begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Fixtures -------------------------------------------------------------------
-- bruno and eva are members of "Hospital" (team UTI, plus a draft for PS);
-- bruno also has a shift in "Antigo", an organization he has since left.
-- The feed window is relative to now(), so shift times are too.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('a8000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}'),
  ('a8000000-0000-0000-0000-000000000005', 'eva@example.com',   now(), '{"full_name": "Eva"}');

insert into public.organizations (id, name, slug) values
  ('b8000000-0000-0000-0000-000000000001', 'Hospital', 'hospital-feeds'),
  ('b8000000-0000-0000-0000-000000000002', 'Antigo', 'antigo-feeds');
insert into public.memberships (org_id, user_id, role) values
  ('b8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000003', 'member'),
  ('b8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000005', 'member'),
  ('b8000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000003', 'member');
insert into public.teams (id, org_id, name) values
  ('c8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'UTI'),
  ('c8000000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 'PS'),
  ('c8000000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000002', 'Geral');

insert into public.shift_types (id, org_id, name, start_time, duration_minutes, color) values
  ('f8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'Diurno', '07:00', 720, '#f59e0b');

insert into public.schedules (id, org_id, team_id, name, period_start, period_end) values
  ('d8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 'UTI', current_date, current_date + 30),
  ('d8000000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000002', 'PS rascunho', current_date, current_date + 30),
  ('d8000000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000002', 'c8000000-0000-0000-0000-000000000003', 'Antigo', current_date, current_date + 30);

insert into public.shifts (id, org_id, schedule_id, user_id, shift_type_id, starts_at, ends_at)
select id::uuid, org_id::uuid, schedule_id::uuid, user_id::uuid, shift_type_id::uuid,
       date_trunc('day', now()) + start_offset,
       date_trunc('day', now()) + start_offset + interval '12 hours'
from (values
  -- bruno, published UTI: two inside the window, two outside
  ('e8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000001', interval '-40 days'),
  ('e8000000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000001', interval '-5 days'),
  ('e8000000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000001', interval '10 days'),
  ('e8000000-0000-0000-0000-000000000004', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000003', 'f8000000-0000-0000-0000-000000000001', interval '200 days'),
  -- bruno, draft PS
  ('e8000000-0000-0000-0000-000000000005', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000003', null, interval '12 days'),
  -- bruno, published in the organization he left
  ('e8000000-0000-0000-0000-000000000006', 'b8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000003', 'a8000000-0000-0000-0000-000000000003', null, interval '14 days'),
  -- eva, published UTI
  ('e8000000-0000-0000-0000-000000000007', 'b8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000005', 'f8000000-0000-0000-0000-000000000001', interval '11 days')
) as v (id, org_id, schedule_id, user_id, shift_type_id, start_offset);

update public.schedules set status = 'published'
where id in ('d8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000003');

delete from public.memberships
where org_id = 'b8000000-0000-0000-0000-000000000002'
  and user_id = 'a8000000-0000-0000-0000-000000000003';

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role": "anon"}', true);
$$;

create temp table tokens (name text primary key, token text);
grant all on tokens to authenticated, anon;

-- Creating the feed -----------------------------------------------------------

set local role authenticated;
select pg_temp.login('a8000000-0000-0000-0000-000000000003'); -- bruno

insert into tokens values ('first', public.rotate_calendar_feed());

select matches(
  (select token from tokens where name = 'first'),
  '^[0-9a-f]{64}$',
  'rotate_calendar_feed returns a 256-bit hex token'
);

select is(
  (select count(*)::int from public.calendar_feeds),
  1,
  'the owner sees that a feed exists'
);

select throws_ok(
  $$ select token_hash from public.calendar_feeds $$,
  '42501', null,
  '...but cannot read the token hash'
);

select pg_temp.login('a8000000-0000-0000-0000-000000000005'); -- eva
select is(
  (select count(*)::int from public.calendar_feeds),
  0,
  'other users do not see it'
);

delete from public.calendar_feeds; -- RLS: only her own (none)

reset role;
select is(
  (select token_hash from public.calendar_feeds where user_id = 'a8000000-0000-0000-0000-000000000003'),
  (select encode(extensions.digest(token, 'sha256'), 'hex') from tokens where name = 'first'),
  'only the SHA-256 of the token is stored'
);
select is(
  (select count(*)::int from public.calendar_feeds where user_id = 'a8000000-0000-0000-0000-000000000003'),
  1,
  'other users cannot revoke it'
);

-- Reading the feed (anonymous, like a calendar app) ---------------------------

set local role anon;
select pg_temp.as_anon();

select results_eq(
  $$ select shift_id from public.calendar_feed_shifts((select token from tokens where name = 'first')) $$,
  $$ values ('e8000000-0000-0000-0000-000000000002'::uuid), ('e8000000-0000-0000-0000-000000000003'::uuid) $$,
  'the feed has only the owner''s published shifts, in the window, in current organizations'
);

select is(
  (select shift_type_name || ' · ' || team_name || ' · ' || org_name
   from public.calendar_feed_shifts((select token from tokens where name = 'first'))
   where shift_id = 'e8000000-0000-0000-0000-000000000003'),
  'Diurno · UTI · Hospital',
  'each shift comes with its type, team and organization'
);

select throws_ok(
  $$ select * from public.calendar_feed_shifts(repeat('0', 64)) $$,
  'P0002', null,
  'an unknown token is not found'
);

select throws_ok(
  $$ select 1 from public.calendar_feeds $$,
  '42501', null,
  'anon has no privileges on calendar_feeds'
);

select throws_ok(
  $$ select public.rotate_calendar_feed() $$,
  '42501', null,
  'anon cannot create feeds'
);

-- Rotating and revoking -------------------------------------------------------

set local role authenticated;
select pg_temp.login('a8000000-0000-0000-0000-000000000003'); -- bruno
insert into tokens values ('second', public.rotate_calendar_feed());

set local role anon;
select pg_temp.as_anon();

select throws_ok(
  $$ select * from public.calendar_feed_shifts((select token from tokens where name = 'first')) $$,
  'P0002', null,
  'a new token invalidates the old URL'
);

select is(
  (select count(*)::int from public.calendar_feed_shifts((select token from tokens where name = 'second'))),
  2,
  '...and the new one works'
);

set local role authenticated;
select pg_temp.login('a8000000-0000-0000-0000-000000000003'); -- bruno
delete from public.calendar_feeds;

select is(
  (select count(*)::int from public.calendar_feeds),
  0,
  'the owner can revoke the feed'
);

set local role anon;
select pg_temp.as_anon();

select throws_ok(
  $$ select * from public.calendar_feed_shifts((select token from tokens where name = 'second')) $$,
  'P0002', null,
  'a revoked feed is not found'
);

-- Profiles cascade --------------------------------------------------------------

reset role;
insert into tokens values ('eva', null);
set local role authenticated;
select pg_temp.login('a8000000-0000-0000-0000-000000000005'); -- eva
update tokens set token = public.rotate_calendar_feed() where name = 'eva';
reset role;
delete from auth.users where id = 'a8000000-0000-0000-0000-000000000005';
select is(
  (select count(*)::int from public.calendar_feeds where user_id = 'a8000000-0000-0000-0000-000000000005'),
  0,
  'deleting the account deletes its feed'
);

select * from finish();
rollback;
