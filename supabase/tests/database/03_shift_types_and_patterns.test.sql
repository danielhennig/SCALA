begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Fixtures ---------------------------------------------------------------------
-- Org A: ana admin · carla manager · bruno member. Org B: diego admin.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000001', 'ana@example.com',   now(), '{"full_name": "Ana"}'),
  ('d0000000-0000-0000-0000-000000000002', 'carla@example.com', now(), '{"full_name": "Carla"}'),
  ('d0000000-0000-0000-0000-000000000003', 'bruno@example.com', now(), '{"full_name": "Bruno"}'),
  ('d0000000-0000-0000-0000-000000000004', 'diego@example.com', now(), '{"full_name": "Diego"}');

insert into public.organizations (id, name, slug) values
  ('e0000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('e0000000-0000-0000-0000-00000000000b', 'Org B', 'org-b');
insert into public.memberships (org_id, user_id, role) values
  ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001', 'admin'),
  ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000002', 'manager'),
  ('e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000003', 'member'),
  ('e0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-000000000004', 'admin');

-- Org B's shift type, used to check cross-org references.
insert into public.shift_types (id, org_id, name, start_time, duration_minutes) values
  ('f0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000b', 'Diurno B', '07:00', 720);

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Shift types ----------------------------------------------------------------

select pg_temp.login('d0000000-0000-0000-0000-000000000002'); -- carla (manager)

select lives_ok(
  $$ insert into public.shift_types (org_id, name, start_time, duration_minutes, color) values
     ('e0000000-0000-0000-0000-00000000000a', 'Diurno', '07:00', 720, '#f59e0b'),
     ('e0000000-0000-0000-0000-00000000000a', 'Noturno', '19:00', 720, '#4f46e5') $$,
  'manager creates shift types'
);

reset role;
create temp table st as
  select name, id from public.shift_types where org_id = 'e0000000-0000-0000-0000-00000000000a';
grant select on st to authenticated;
set local role authenticated;

select throws_ok(
  $$ insert into public.shift_types (org_id, name, start_time, duration_minutes)
     values ('e0000000-0000-0000-0000-00000000000a', 'DIURNO', '08:00', 480) $$,
  '23505', null,
  'shift type names are unique per org (case-insensitive)'
);

select throws_ok(
  $$ insert into public.shift_types (org_id, name, start_time, duration_minutes, color)
     values ('e0000000-0000-0000-0000-00000000000a', 'Cor', '08:00', 480, 'red') $$,
  '23514', null,
  'color must be #rrggbb'
);

select throws_ok(
  $$ insert into public.shift_types (org_id, name, start_time, duration_minutes)
     values ('e0000000-0000-0000-0000-00000000000a', 'Longo', '08:00', 1500) $$,
  '23514', null,
  'duration is capped at 24h'
);

select lives_ok(
  $$ update public.shift_types set duration_minutes = 660 where name = 'Noturno' $$,
  'manager edits a shift type'
);

select pg_temp.login('d0000000-0000-0000-0000-000000000003'); -- bruno (member)

select is(
  (select count(*)::int from public.shift_types),
  2,
  'members read their org''s shift types (and not other orgs'')'
);

select throws_ok(
  $$ insert into public.shift_types (org_id, name, start_time, duration_minutes)
     values ('e0000000-0000-0000-0000-00000000000a', 'Extra', '08:00', 480) $$,
  '42501', null,
  'member cannot create shift types'
);

select pg_temp.login('d0000000-0000-0000-0000-000000000004'); -- diego (org B)

select is(
  (select count(*)::int from public.shift_types),
  1,
  'other org sees only its own shift types'
);

-- Rotation patterns ----------------------------------------------------------

select pg_temp.login('d0000000-0000-0000-0000-000000000002'); -- carla (manager)

create temp table p12x36 as
  select public.save_rotation_pattern(
    'e0000000-0000-0000-0000-00000000000a', '12x36',
    array[(select id from st where name = 'Diurno'), null]::uuid[]
  ) as id;

select is(
  (select cycle_length from public.rotation_patterns where id = (select id from p12x36)),
  2::smallint,
  'pattern stores the cycle length'
);

select results_eq(
  $$ select day_index from public.rotation_pattern_days where pattern_id = (select id from p12x36) $$,
  $$ values (0::smallint) $$,
  'only working days are stored (day off = missing index)'
);

select lives_ok(
  format(
    'select public.save_rotation_pattern(%L, %L, %L::uuid[], %L)',
    'e0000000-0000-0000-0000-00000000000a',
    '12x36 alternado',
    array[(select id from st where name = 'Diurno'), null, (select id from st where name = 'Noturno'), null],
    (select id from p12x36)
  ),
  'saving again replaces name and cycle'
);

select results_eq(
  $$ select day_index, (select name from st where st.id = d.shift_type_id)
     from public.rotation_pattern_days d
     where pattern_id = (select id from p12x36) order by day_index $$,
  $$ values (0::smallint, 'Diurno'::text), (2::smallint, 'Noturno'::text) $$,
  'replaced cycle has the new days'
);

select throws_ok(
  $$ select public.save_rotation_pattern('e0000000-0000-0000-0000-00000000000a', 'Vazio', array[]::uuid[]) $$,
  'SC005', null,
  'empty cycle is rejected'
);

select throws_ok(
  $$ select public.save_rotation_pattern('e0000000-0000-0000-0000-00000000000a', 'Só folga', array[null, null]::uuid[]) $$,
  'SC005', null,
  'cycle without any shift is rejected'
);

select throws_ok(
  format(
    'select public.save_rotation_pattern(%L, %L, %L::uuid[])',
    'e0000000-0000-0000-0000-00000000000a', 'Longo demais',
    array_fill((select id from st where name = 'Diurno'), array[29])
  ),
  'SC005', null,
  'cycle longer than 28 days is rejected'
);

select throws_ok(
  $$ select public.save_rotation_pattern('e0000000-0000-0000-0000-00000000000a', 'Cruzado',
       array['f0000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  '23503', null,
  'cannot use another org''s shift type'
);

select throws_ok(
  $$ select public.save_rotation_pattern('e0000000-0000-0000-0000-00000000000a', 'Fantasma',
       array[null]::uuid[] || (select id from st where name = 'Diurno'), 'e0000000-0000-0000-0000-0000000000ff') $$,
  'P0002', null,
  'updating a missing pattern raises no_data_found'
);

select throws_ok(
  $$ insert into public.rotation_pattern_days (pattern_id, org_id, day_index, shift_type_id)
     select id, 'e0000000-0000-0000-0000-00000000000a', 5, (select id from st where name = 'Diurno') from p12x36 $$,
  '42501', null,
  'pattern days cannot be written directly'
);

select throws_ok(
  $$ delete from public.shift_types where name = 'Diurno' $$,
  '23503', null,
  'a shift type used by a pattern cannot be deleted'
);

select pg_temp.login('d0000000-0000-0000-0000-000000000003'); -- bruno (member)

select throws_ok(
  $$ select public.save_rotation_pattern('e0000000-0000-0000-0000-00000000000a', 'Meu', array[null]::uuid[] || (select id from st where name = 'Diurno')) $$,
  '42501', null,
  'member cannot save patterns'
);

select is(
  (select count(*)::int from public.rotation_pattern_days),
  2,
  'members read pattern days'
);

delete from public.rotation_patterns;

select pg_temp.login('d0000000-0000-0000-0000-000000000002'); -- carla
select is(
  (select count(*)::int from public.rotation_patterns),
  1,
  '...but a member''s delete removes nothing'
);

select lives_ok(
  $$ delete from public.rotation_patterns where id = (select id from p12x36) $$,
  'manager deletes a pattern'
);

select lives_ok(
  $$ delete from public.shift_types where name = 'Diurno' $$,
  'once unused, the shift type can be deleted'
);

select * from finish();
rollback;
