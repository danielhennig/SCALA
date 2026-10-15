begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- Fixtures (as postgres). The auth trigger creates the profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com', '{"full_name": "Ana Admin"}'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com', '{"full_name": "Carla"}');

-- Profile trigger -------------------------------------------------------------

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana Admin',
  'profile uses full_name from sign-up metadata'
);

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bruno',
  'profile falls back to the e-mail local part'
);

-- Ana creates an organization ------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ select public.create_organization('Hospital Central', 'hospital-central') $$,
  'authenticated user can create an organization'
);

select is(
  (select role::text from public.memberships
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'creator becomes admin'
);

select is(
  (select timezone from public.organizations where slug = 'hospital-central'),
  'America/Sao_Paulo',
  'timezone defaults to America/Sao_Paulo'
);

select throws_ok(
  $$ select public.create_organization('Outro', 'hospital-central') $$,
  '23505', null,
  'slug must be unique'
);

select throws_ok(
  $$ select public.create_organization('Outro', 'Slug Invalido') $$,
  '23514', null,
  'slug format is enforced'
);

select throws_ok(
  $$ select public.create_organization('Outro', 'outro', 'Mars/Olympus') $$,
  '22023', null,
  'timezone must exist'
);

select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Direto', 'direto') $$,
  '42501', null,
  'direct insert into organizations is denied'
);

select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     select id, '22222222-2222-2222-2222-222222222222', 'admin'
     from public.organizations where slug = 'hospital-central' $$,
  '42501', null,
  'direct insert into memberships is denied'
);

-- Bruno, outside the organization, sees nothing -----------------------------

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is_empty(
  $$ select 1 from public.organizations $$,
  'non-member cannot read other organizations'
);

select is_empty(
  $$ select 1 from public.memberships $$,
  'non-member cannot read other organizations'' memberships'
);

select is_empty(
  $$ select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'non-member cannot read profiles outside shared organizations'
);

select lives_ok(
  $$ update public.organizations set name = 'Invadido' $$,
  'update by non-member does not error...'
);

-- Carla joins as a plain member (setup as postgres) --------------------------

reset role;
insert into public.memberships (org_id, user_id, role)
select id, '33333333-3333-3333-3333-333333333333', 'member'
from public.organizations where slug = 'hospital-central';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.organizations),
  1,
  'member reads own organization'
);

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana Admin',
  'member reads co-member profiles'
);

select lives_ok(
  $$ update public.organizations set name = 'Renomeado por membro' $$,
  'update by plain member does not error...'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Carla Souza'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'user can update own profile'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Hackeado'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'update of another profile does not error...'
);

-- Ana checks that none of the above leaked through ---------------------------

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(
  (select name from public.organizations where slug = 'hospital-central'),
  'Hospital Central',
  '...but neither non-members nor plain members changed the organization'
);

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ana Admin',
  '...and nobody changed another user''s profile'
);

-- Anonymous access -----------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select public.create_organization('Anon', 'anon-org') $$,
  '42501', null,
  'anon cannot call create_organization'
);

select throws_ok(
  $$ select 1 from public.organizations $$,
  '42501', null,
  'anon has no privileges on organizations'
);

select * from finish();
rollback;
