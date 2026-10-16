-- Etapa 2: member management, invitations, teams.
--
-- Business-rule errors use custom SQLSTATEs (mapped in src/server/errors.ts):
--   SC001 organization must keep at least one admin
--   SC002 invitation invalid, expired, revoked or already used
--   SC003 invitation belongs to another e-mail (or e-mail not confirmed)
--   SC004 invitee is already a member

create extension if not exists pgcrypto with schema extensions;

-- Advisor: FK without covering index (from Etapa 1).
create index organizations_created_by_idx on public.organizations (created_by);

-------------------------------------------------------------------------------
-- Memberships: admins change roles and remove members; anyone can leave.
-------------------------------------------------------------------------------

create function private.ensure_org_keeps_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Deletes cascaded from removing the organization or the user account are
  -- not member management; let them through.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (
       select 1
       from public.memberships m
       where m.org_id = old.org_id
         and m.role = 'admin'
         and m.user_id <> old.user_id
     )
  then
    raise exception 'organization must keep at least one admin' using errcode = 'SC001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_admin
  before update of role or delete on public.memberships
  for each row execute function private.ensure_org_keeps_admin();

grant update (role) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

create policy "memberships: admins change roles"
  on public.memberships for update to authenticated
  using (private.is_org_member(org_id, array['admin']::public.org_role[]))
  with check (private.is_org_member(org_id, array['admin']::public.org_role[]));

create policy "memberships: admins remove, anyone leaves"
  on public.memberships for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_member(org_id, array['admin']::public.org_role[])
  );

-------------------------------------------------------------------------------
-- Invitations
-------------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  role public.org_role not null default 'member',
  -- Only the SHA-256 of the token is stored; the token itself is shown once.
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  check (accepted_at is null or revoked_at is null)
);

create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;
create index invitations_org_id_idx on public.invitations (org_id);
create index invitations_invited_by_idx on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

revoke all on public.invitations from anon, authenticated;
-- token_hash is deliberately left out.
grant select (id, org_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

alter table public.invitations enable row level security;

create policy "invitations: admins and managers read"
  on public.invitations for select to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

-- Managers can only revoke what they could have created (member invitations).
create policy "invitations: admins and managers revoke"
  on public.invitations for update to authenticated
  using (
    private.is_org_member(org_id, array['admin']::public.org_role[])
    or (role = 'member' and private.is_org_member(org_id, array['manager']::public.org_role[]))
  )
  with check (
    private.is_org_member(org_id, array['admin']::public.org_role[])
    or (role = 'member' and private.is_org_member(org_id, array['manager']::public.org_role[]))
  );

-- Creates (or re-issues) an invitation and returns the plain token once.
create function public.create_invitation(
  p_org_id uuid,
  p_email text,
  p_role public.org_role default 'member'
)
returns table (
  invitation_id uuid,
  invitation_email text,
  invitation_role public.org_role,
  invitation_expires_at timestamptz,
  token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(trim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_invitation public.invitations;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not (
    private.is_org_member(p_org_id, array['admin']::public.org_role[])
    or (p_role = 'member' and private.is_org_member(p_org_id, array['manager']::public.org_role[]))
  ) then
    raise exception 'not allowed to invite with role %', p_role using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id
      and lower(u.email) = v_email
  ) then
    raise exception 'already a member' using errcode = 'SC004';
  end if;

  update public.invitations i
  set revoked_at = now()
  where i.org_id = p_org_id
    and i.email = v_email
    and i.accepted_at is null
    and i.revoked_at is null;

  insert into public.invitations (org_id, email, role, token_hash, invited_by)
  values (
    p_org_id,
    v_email,
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_user_id
  )
  returning * into v_invitation;

  return query
  select v_invitation.id, v_invitation.email, v_invitation.role, v_invitation.expires_at, v_token;
end;
$$;

-- What the invite page shows before accepting.
create function public.get_invitation(p_token text)
returns table (organization_name text, role public.org_role, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.role,
    i.email,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.invitations;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if v_invitation.id is null
     or v_invitation.accepted_at is not null
     or v_invitation.revoked_at is not null
     or v_invitation.expires_at < now()
  then
    raise exception 'invitation is invalid or expired' using errcode = 'SC002';
  end if;

  -- Only the confirmed owner of the invited address can accept.
  if not exists (
    select 1
    from auth.users u
    where u.id = v_user_id
      and lower(u.email) = v_invitation.email
      and u.email_confirmed_at is not null
  ) then
    raise exception 'invitation was sent to another e-mail' using errcode = 'SC003';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_invitation.org_id, v_user_id, v_invitation.role)
  on conflict (org_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invitation.id;

  return v_invitation.org_id;
end;
$$;

revoke all on function public.create_invitation(uuid, text, public.org_role) from public, anon;
revoke all on function public.get_invitation(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_invitation(uuid, text, public.org_role) to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-------------------------------------------------------------------------------
-- Teams
-------------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of team_members' composite FK: guarantees team and member share an org.
  unique (id, org_id)
);

create unique index teams_org_name_key on public.teams (org_id, lower(name));

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function private.set_updated_at();

create table public.team_members (
  team_id uuid not null,
  org_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (team_id, org_id) references public.teams (id, org_id) on delete cascade,
  -- Only organization members can join; leaving the organization leaves its teams.
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);

create index team_members_team_org_idx on public.team_members (team_id, org_id);
create index team_members_org_user_idx on public.team_members (org_id, user_id);

revoke all on public.teams, public.team_members from anon, authenticated;
grant select, delete on public.teams, public.team_members to authenticated;
grant insert (org_id, name) on public.teams to authenticated;
grant update (name) on public.teams to authenticated;
grant insert (team_id, org_id, user_id) on public.team_members to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "teams: members read"
  on public.teams for select to authenticated
  using (private.is_org_member(org_id));

create policy "teams: admins and managers create"
  on public.teams for insert to authenticated
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "teams: admins and managers rename"
  on public.teams for update to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]))
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "teams: admins and managers delete"
  on public.teams for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "team_members: members read"
  on public.team_members for select to authenticated
  using (private.is_org_member(org_id));

create policy "team_members: admins and managers add"
  on public.team_members for insert to authenticated
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "team_members: admins and managers remove"
  on public.team_members for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));
