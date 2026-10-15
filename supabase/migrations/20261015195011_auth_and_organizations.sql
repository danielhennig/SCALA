-- Etapa 1: profiles, organizations, memberships + RLS.

create type public.org_role as enum ('admin', 'manager', 'member');

-- Helpers used by RLS policies and triggers. This schema is not exposed by the
-- Data API (see `api.schemas` in config.toml), so nothing here is callable via REST.
create schema private;
grant usage on schema private to authenticated;

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (
    char_length(slug) between 3 and 50
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  timezone text not null default 'America/Sao_Paulo',
  min_rest_hours smallint not null default 11 check (min_rest_hours between 0 and 48),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- The PK covers lookups by org_id; RLS checks and "my organizations" filter by user_id.
create index memberships_user_id_idx on public.memberships (user_id);

-------------------------------------------------------------------------------
-- Triggers
-------------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger organizations_validate_timezone
  before insert or update of timezone on public.organizations
  for each row execute function private.validate_timezone();

-- Creates the profile when a user signs up. full_name comes from the sign-up
-- metadata; falls back to the e-mail's local part.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Usuário'
      ),
      120
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-------------------------------------------------------------------------------
-- RLS helpers (security definer: they read memberships without triggering
-- memberships' own RLS, which would otherwise recurse)
-------------------------------------------------------------------------------

create function private.is_org_member(
  p_org_id uuid,
  p_roles public.org_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create function private.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.is_org_member(uuid, public.org_role[]) from public;
revoke all on function private.shares_org_with(uuid) from public;
grant execute on function private.is_org_member(uuid, public.org_role[]) to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC: create an organization and make the caller its admin, atomically.
-------------------------------------------------------------------------------

create function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Sao_Paulo'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug, timezone, created_by)
  values (p_name, p_slug, p_timezone, v_user_id)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, v_user_id, 'admin');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-------------------------------------------------------------------------------
-- Privileges: least privilege on top of RLS. Supabase grants ALL to anon and
-- authenticated by default; reset that and grant only what the policies use.
-------------------------------------------------------------------------------

revoke all on public.profiles, public.organizations, public.memberships from anon, authenticated;

grant select on public.profiles, public.organizations, public.memberships to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (name, slug, timezone, min_rest_hours) on public.organizations to authenticated;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy "profiles: read self or co-members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "organizations: members read"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "organizations: admins update"
  on public.organizations for update to authenticated
  using (private.is_org_member(id, array['admin']::public.org_role[]))
  with check (private.is_org_member(id, array['admin']::public.org_role[]));

create policy "memberships: members read"
  on public.memberships for select to authenticated
  using (private.is_org_member(org_id));
