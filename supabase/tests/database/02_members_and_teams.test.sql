begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- Fixtures ---------------------------------------------------------------------
-- ana: admin · carla: manager · bruno: member · diego: outsider · eva, fabio: invitees
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@example.com',    now(), '{"full_name": "Ana"}'),
  ('a0000000-0000-0000-0000-000000000002', 'carla@example.com',  now(), '{"full_name": "Carla"}'),
  ('a0000000-0000-0000-0000-000000000003', 'bruno@example.com',  now(), '{"full_name": "Bruno"}'),
  ('a0000000-0000-0000-0000-000000000004', 'diego@example.com',  now(), '{"full_name": "Diego"}'),
  ('a0000000-0000-0000-0000-000000000005', 'Eva@Example.com',    now(), '{"full_name": "Eva"}'),
  ('a0000000-0000-0000-0000-000000000006', 'membro@example.com', now(), '{"full_name": "Fabio"}');

insert into public.organizations (id, name, slug) values
  ('b0000000-0000-0000-0000-000000000001', 'Hospital', 'hospital');
insert into public.memberships (org_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'manager'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member');

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Invitations: who can invite ------------------------------------------------

select pg_temp.login('a0000000-0000-0000-0000-000000000001'); -- ana (admin)

select lives_ok(
  $$ select public.create_invitation('b0000000-0000-0000-0000-000000000001', 'novo.gestor@example.com', 'manager') $$,
  'admin can invite with any role'
);

select is(
  (select length(token) from public.create_invitation('b0000000-0000-0000-0000-000000000001', 'x@example.com')),
  64,
  'token is 64 hex chars'
);

select throws_ok(
  $$ select public.create_invitation('b0000000-0000-0000-0000-000000000001', 'BRUNO@example.com') $$,
  'SC004', null,
  'cannot invite an existing member (case-insensitive)'
);

select throws_ok(
  $$ select token_hash from public.invitations $$,
  '42501', null,
  'token_hash is not readable, even by admins'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000002'); -- carla (manager)

create temp table fabio_invite as
  select * from public.create_invitation('b0000000-0000-0000-0000-000000000001', 'membro@example.com', 'member');

select is(
  (select invitation_role::text from fabio_invite),
  'member',
  'manager can invite members'
);

select throws_ok(
  $$ select public.create_invitation('b0000000-0000-0000-0000-000000000001', 'chefe@example.com', 'admin') $$,
  '42501', null,
  'manager cannot invite admins'
);

select is(
  (select count(*)::int from public.invitations where role = 'manager'),
  1,
  'manager can read all pending invitations of the org'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000003'); -- bruno (member)

select throws_ok(
  $$ select public.create_invitation('b0000000-0000-0000-0000-000000000001', 'y@example.com') $$,
  '42501', null,
  'member cannot invite'
);

select is_empty($$ select 1 from public.invitations $$, 'member cannot read invitations');

select pg_temp.login('a0000000-0000-0000-0000-000000000004'); -- diego (outsider)

select throws_ok(
  $$ select public.create_invitation('b0000000-0000-0000-0000-000000000001', 'z@example.com') $$,
  '42501', null,
  'outsider cannot invite'
);

-- Invitations: accept flow ---------------------------------------------------

select pg_temp.login('a0000000-0000-0000-0000-000000000001'); -- ana
create temp table eva_invite as
  select * from public.create_invitation('b0000000-0000-0000-0000-000000000001', 'eva@example.com', 'manager');
create temp table eva_reinvite as
  select * from public.create_invitation('b0000000-0000-0000-0000-000000000001', 'eva@example.com', 'member');

select is(
  (select count(*)::int from public.invitations where email = 'eva@example.com' and revoked_at is null),
  1,
  're-inviting revokes the previous pending invitation'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000004'); -- diego

select is(
  (select status from public.get_invitation((select token from eva_reinvite))),
  'pending',
  'get_invitation reports status to the token holder'
);

select throws_ok(
  format('select public.accept_invitation(%L)', (select token from eva_reinvite)),
  'SC003', null,
  'another user cannot accept someone else''s invitation'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000005'); -- eva

select throws_ok(
  format('select public.accept_invitation(%L)', (select token from eva_invite)),
  'SC002', null,
  'revoked (superseded) token cannot be used'
);

select is(
  (select public.accept_invitation((select token from eva_reinvite))),
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'invitee accepts and gets the organization id'
);

select is(
  (select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000005'),
  'member',
  'membership uses the invited role'
);

select throws_ok(
  format('select public.accept_invitation(%L)', (select token from eva_reinvite)),
  'SC002', null,
  'an invitation can be used only once'
);

-- Expired invitation (setup as postgres)
reset role;
update public.invitations set expires_at = now() - interval '1 minute'
  where email = 'membro@example.com' and org_id = 'b0000000-0000-0000-0000-000000000001';
set local role authenticated;

select pg_temp.login('a0000000-0000-0000-0000-000000000006'); -- fabio
select throws_ok(
  format('select public.accept_invitation(%L)', (select token from fabio_invite)),
  'SC002', null,
  'expired invitation cannot be accepted'
);

-- Roles and the last-admin rule ----------------------------------------------

select pg_temp.login('a0000000-0000-0000-0000-000000000003'); -- bruno (member)
update public.memberships set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000003';

select pg_temp.login('a0000000-0000-0000-0000-000000000001'); -- ana
select is(
  (select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000003'),
  'member',
  'member cannot promote themselves'
);

select throws_ok(
  $$ update public.memberships set role = 'member' where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'SC001', null,
  'the last admin cannot demote themselves'
);

select throws_ok(
  $$ delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'SC001', null,
  'the last admin cannot leave'
);

select lives_ok(
  $$ update public.memberships set role = 'admin' where user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'admin can promote another member'
);

select lives_ok(
  $$ update public.memberships set role = 'member' where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'an admin can step down once another admin exists'
);

-- Teams ---------------------------------------------------------------------

select pg_temp.login('a0000000-0000-0000-0000-000000000002'); -- carla (now admin)

select lives_ok(
  $$ insert into public.teams (org_id, name) values ('b0000000-0000-0000-0000-000000000001', 'UTI Adulto') $$,
  'admin creates a team'
);

reset role;
-- Scoped to this test's org: the database may hold other data (e.g. e2e runs).
create temp table uti as
  select id from public.teams
  where name = 'UTI Adulto' and org_id = 'b0000000-0000-0000-0000-000000000001';
grant select on uti to authenticated;
set local role authenticated;

select throws_ok(
  $$ insert into public.teams (org_id, name) values ('b0000000-0000-0000-0000-000000000001', 'uti adulto') $$,
  '23505', null,
  'team names are unique per organization (case-insensitive)'
);

select lives_ok(
  $$ insert into public.team_members (team_id, org_id, user_id)
     select id, 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003' from uti $$,
  'admin adds an organization member to a team'
);

select throws_ok(
  $$ insert into public.team_members (team_id, org_id, user_id)
     select id, 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004' from uti $$,
  '23503', null,
  'outsiders cannot be added to a team'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000003'); -- bruno (member)

select throws_ok(
  $$ insert into public.teams (org_id, name) values ('b0000000-0000-0000-0000-000000000001', 'Pronto-Socorro') $$,
  '42501', null,
  'plain member cannot create teams'
);

select is(
  (select count(*)::int from public.team_members),
  1,
  'members can read team composition'
);

select lives_ok(
  $$ delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000003' $$,
  'a member can leave the organization'
);

reset role;
select is(
  (select count(*)::int from public.team_members where user_id = 'a0000000-0000-0000-0000-000000000003'),
  0,
  'leaving the organization removes the member from its teams'
);

select pg_temp.login('a0000000-0000-0000-0000-000000000004'); -- diego (outsider)
set local role authenticated;
select is_empty($$ select 1 from public.teams $$, 'outsiders cannot see teams');

-- Cascades bypass the last-admin rule ---------------------------------------
reset role;
select lives_ok(
  $$ delete from public.organizations where id = 'b0000000-0000-0000-0000-000000000001' $$,
  'deleting an organization cascades through memberships'
);

select * from finish();
rollback;
