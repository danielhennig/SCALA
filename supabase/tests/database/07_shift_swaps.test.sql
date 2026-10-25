begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Fixtures -------------------------------------------------------------------
-- carla manager · bruno, eva (team UTI) · diego member (no team).
-- Dates in 2030 so shifts stay "future" whenever the suite runs.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('a7000000-0000-0000-0000-000000000002', 'carla@example.com', now(), '{"full_name": "Carla"}'),
  ('a7000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}'),
  ('a7000000-0000-0000-0000-000000000004', 'diego@example.com', now(), '{"full_name": "Diego"}'),
  ('a7000000-0000-0000-0000-000000000005', 'eva@example.com',   now(), '{"full_name": "Eva"}');

insert into public.organizations (id, name, slug) values
  ('b7000000-0000-0000-0000-000000000001', 'Hospital', 'hospital-swaps');
insert into public.memberships (org_id, user_id, role) values
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002', 'manager'),
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003', 'member'),
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000004', 'member'),
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000005', 'member');
insert into public.teams (id, org_id, name) values
  ('c7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'UTI'),
  ('c7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000001', 'PS');
insert into public.team_members (team_id, org_id, user_id) values
  ('c7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003'),
  ('c7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000005');

insert into public.schedules (id, org_id, team_id, name, period_start, period_end) values
  ('d7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'UTI jan', '2030-01-01', '2030-01-31'),
  ('d7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 'PS jan',  '2030-01-01', '2030-01-31'),
  ('d7000000-0000-0000-0000-000000000003', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'UTI 2020', '2020-01-01', '2020-01-31'),
  ('d7000000-0000-0000-0000-000000000004', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'UTI fev rascunho', '2030-02-01', '2030-02-28');

-- Shifts (07:00–19:00 São Paulo = 10:00Z–22:00Z).
insert into public.shifts (id, org_id, schedule_id, user_id, starts_at, ends_at) values
  -- bruno
  ('e7000000-0000-0000-0000-000000000010', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003', '2030-01-10T10:00Z', '2030-01-10T22:00Z'),
  ('e7000000-0000-0000-0000-000000000014', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003', '2030-01-14T10:00Z', '2030-01-14T22:00Z'),
  ('e7000000-0000-0000-0000-000000000016', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003', '2030-01-16T10:00Z', '2030-01-16T22:00Z'),
  ('e7000000-0000-0000-0000-000000000021', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003', '2030-01-21T10:00Z', '2030-01-21T22:00Z'),
  ('e7000000-0000-0000-0000-000000000099', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000003', '2020-01-10T10:00Z', '2020-01-10T22:00Z'),
  ('e7000000-0000-0000-0000-000000000098', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000004', 'a7000000-0000-0000-0000-000000000003', '2030-02-10T10:00Z', '2030-02-10T22:00Z'),
  -- eva: Jan 12 (UTI) and Jan 16, same slot as bruno's Jan 16 (PS schedule)
  ('e7000000-0000-0000-0000-000000000112', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000005', '2030-01-12T10:00Z', '2030-01-12T22:00Z'),
  ('e7000000-0000-0000-0000-000000000116', 'b7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000005', '2030-01-16T10:00Z', '2030-01-16T22:00Z');

update public.schedules set status = 'published'
where id in ('d7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'd7000000-0000-0000-0000-000000000003');

insert into public.time_off (org_id, user_id, kind, status, start_date, end_date) values
  ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000005', 'vacation', 'approved', '2030-01-20', '2030-01-25');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create temp table swap_ids (name text primary key, id uuid);
grant all on swap_ids to authenticated;

set local role authenticated;

-- Coverage request: bruno asks eva to cover Jan 10 --------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000003'); -- bruno

insert into swap_ids
  select 'cover', public.create_shift_swap('e7000000-0000-0000-0000-000000000010', 'a7000000-0000-0000-0000-000000000005');

select is(
  (select status::text from public.shift_swaps where id = (select id from swap_ids where name = 'cover')),
  'pending_target',
  'a coverage request starts waiting for the colleague'
);

select throws_ok(
  $$ select public.create_shift_swap('e7000000-0000-0000-0000-000000000010', 'a7000000-0000-0000-0000-000000000004') $$,
  '23505', null,
  'only one active request per shift'
);

select throws_ok(
  $$ select public.create_shift_swap('e7000000-0000-0000-0000-000000000112', 'a7000000-0000-0000-0000-000000000004') $$,
  'SC007', null,
  'you can only offer your own shift'
);

select throws_ok(
  $$ select public.create_shift_swap('e7000000-0000-0000-0000-000000000014', 'a7000000-0000-0000-0000-000000000003') $$,
  'SC007', null,
  'you cannot ask yourself'
);

select throws_ok(
  $$ select public.create_shift_swap('e7000000-0000-0000-0000-000000000099', 'a7000000-0000-0000-0000-000000000005') $$,
  'SC007', null,
  'past shifts cannot be swapped'
);

select throws_ok(
  $$ select public.create_shift_swap('e7000000-0000-0000-0000-000000000098', 'a7000000-0000-0000-0000-000000000005') $$,
  'SC007', null,
  'shifts in draft schedules cannot be swapped'
);

select throws_ok(
  $$ insert into public.shift_swaps (org_id, requester_id, target_id, offered_shift_id, offered_starts_at, offered_ends_at)
     values ('b7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000003',
             'a7000000-0000-0000-0000-000000000005', 'e7000000-0000-0000-0000-000000000014', now(), now()) $$,
  '42501', null,
  'no direct writes: only the RPCs'
);

-- Visibility ------------------------------------------------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000005'); -- eva
select is((select count(*)::int from public.shift_swaps), 1, 'the colleague asked sees the request');

select pg_temp.login('a7000000-0000-0000-0000-000000000004'); -- diego
select is_empty($$ select 1 from public.shift_swaps $$, 'other members do not');

select pg_temp.login('a7000000-0000-0000-0000-000000000002'); -- carla
select is((select count(*)::int from public.shift_swaps), 1, 'managers see all requests');

-- Responses and review ------------------------------------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000003'); -- bruno
select throws_ok(
  format('select public.respond_shift_swap(%L, true)', (select id from swap_ids where name = 'cover')),
  '42501', null,
  'only the colleague asked can respond'
);

select pg_temp.login('a7000000-0000-0000-0000-000000000005'); -- eva
select is(
  public.respond_shift_swap((select id from swap_ids where name = 'cover'), true)::text,
  'pending_approval',
  'accepting moves it to manager approval'
);

select throws_ok(
  format('select public.respond_shift_swap(%L, true)', (select id from swap_ids where name = 'cover')),
  'SC008', null,
  'a request can only be answered once'
);

select throws_ok(
  format('select public.review_shift_swap(%L, true)', (select id from swap_ids where name = 'cover')),
  '42501', null,
  'members cannot approve'
);

select pg_temp.login('a7000000-0000-0000-0000-000000000002'); -- carla
select is(
  public.review_shift_swap((select id from swap_ids where name = 'cover'), true)::text,
  'approved',
  'manager approves the coverage'
);

select is(
  (select user_id from public.shifts where id = 'e7000000-0000-0000-0000-000000000010'),
  'a7000000-0000-0000-0000-000000000005'::uuid,
  '...and the shift now belongs to eva'
);

-- Exchange: bruno's Jan 14 for eva's Jan 12 -------------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000003');
insert into swap_ids
  select 'exchange', public.create_shift_swap(
    'e7000000-0000-0000-0000-000000000014', 'a7000000-0000-0000-0000-000000000005',
    'e7000000-0000-0000-0000-000000000112');
select pg_temp.login('a7000000-0000-0000-0000-000000000005');
select public.respond_shift_swap((select id from swap_ids where name = 'exchange'), true);
select pg_temp.login('a7000000-0000-0000-0000-000000000002');
select public.review_shift_swap((select id from swap_ids where name = 'exchange'), true);

select results_eq(
  $$ select id::text, user_id::text from public.shifts
     where id in ('e7000000-0000-0000-0000-000000000014', 'e7000000-0000-0000-0000-000000000112')
     order by id $$,
  $$ values ('e7000000-0000-0000-0000-000000000014', 'a7000000-0000-0000-0000-000000000005'),
            ('e7000000-0000-0000-0000-000000000112', 'a7000000-0000-0000-0000-000000000003') $$,
  'an exchange reassigns both shifts'
);

-- Same time slot (bruno UTI Jan 16 ↔ eva PS Jan 16): needs the deferrable check.

select pg_temp.login('a7000000-0000-0000-0000-000000000003');
insert into swap_ids
  select 'same_slot', public.create_shift_swap(
    'e7000000-0000-0000-0000-000000000016', 'a7000000-0000-0000-0000-000000000005',
    'e7000000-0000-0000-0000-000000000116');
select pg_temp.login('a7000000-0000-0000-0000-000000000005');
select public.respond_shift_swap((select id from swap_ids where name = 'same_slot'), true);
select pg_temp.login('a7000000-0000-0000-0000-000000000002');

select is(
  public.review_shift_swap((select id from swap_ids where name = 'same_slot'), true)::text,
  'approved',
  'swapping two shifts at the same time slot works (end-of-statement overlap check)'
);

-- Time off blocks the approval --------------------------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000003');
insert into swap_ids
  select 'vacation', public.create_shift_swap('e7000000-0000-0000-0000-000000000021', 'a7000000-0000-0000-0000-000000000005');
select pg_temp.login('a7000000-0000-0000-0000-000000000005');
select public.respond_shift_swap((select id from swap_ids where name = 'vacation'), true);
select pg_temp.login('a7000000-0000-0000-0000-000000000002');

select throws_ok(
  format('select public.review_shift_swap(%L, true)', (select id from swap_ids where name = 'vacation')),
  'SC006', null,
  'cannot hand a shift to someone on approved time off'
);

select is(
  (select status::text from public.shift_swaps where id = (select id from swap_ids where name = 'vacation')),
  'pending_approval',
  'a failed approval changes nothing'
);

select is(
  public.review_shift_swap((select id from swap_ids where name = 'vacation'), false)::text,
  'rejected',
  'the manager can reject it instead'
);

-- Cancel ----------------------------------------------------------------------

select pg_temp.login('a7000000-0000-0000-0000-000000000003'); -- bruno
insert into swap_ids
  select 'cancel', public.create_shift_swap('e7000000-0000-0000-0000-000000000021', 'a7000000-0000-0000-0000-000000000004');

select is(
  public.cancel_shift_swap((select id from swap_ids where name = 'cancel'))::text,
  'cancelled',
  'the requester can cancel a pending request'
);

select throws_ok(
  format('select public.cancel_shift_swap(%L)', (select id from swap_ids where name = 'cover')),
  'SC008', null,
  'approved swaps cannot be cancelled'
);

-- Regenerating the schedule drops pending requests ---------------------------

insert into swap_ids
  select 'stale', public.create_shift_swap('e7000000-0000-0000-0000-000000000021', 'a7000000-0000-0000-0000-000000000004');
select pg_temp.login('a7000000-0000-0000-0000-000000000002'); -- carla
select public.replace_schedule_shifts('d7000000-0000-0000-0000-000000000001', '[]'::jsonb);

select is_empty(
  $$ select 1 from public.shift_swaps where id = (select id from swap_ids where name = 'stale') $$,
  'deleting the shift removes its pending requests (the audit log keeps history)'
);

select * from finish();
rollback;
