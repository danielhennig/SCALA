-- Etapa 4: schedules and shifts.

-- btree_gist lets exclusion constraints mix equality (uuid) with range overlap.
create extension if not exists btree_gist with schema extensions;

create type public.schedule_status as enum ('draft', 'published');

-------------------------------------------------------------------------------
-- Schedules: one per team per period (no overlapping periods for a team).
-------------------------------------------------------------------------------

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  period_start date not null,
  period_end date not null,
  status public.schedule_status not null default 'draft',
  published_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start and period_end - period_start < 62),
  check ((status = 'published') = (published_at is not null)),
  unique (id, org_id),
  -- NO ACTION: a team with schedules can't be deleted (keeps history).
  foreign key (team_id, org_id) references public.teams (id, org_id),
  constraint schedules_no_overlap exclude using gist (
    team_id with =,
    daterange(period_start, period_end, '[]') with &&
  )
);

create index schedules_team_org_idx on public.schedules (team_id, org_id);
create index schedules_org_period_idx on public.schedules (org_id, period_start);
create index schedules_created_by_idx on public.schedules (created_by);

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function private.set_updated_at();

create function private.sync_schedule_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' or old.status <> 'published' then
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger schedules_sync_published_at
  before insert or update of status on public.schedules
  for each row execute function private.sync_schedule_published_at();

-------------------------------------------------------------------------------
-- Shifts: concrete instants, so editing a shift type later doesn't rewrite
-- history. No person can hold two overlapping shifts in the same
-- organization, even across different schedules/teams.
-------------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  schedule_id uuid not null,
  -- References the profile (not the membership) so removing someone from the
  -- organization keeps their past shifts.
  user_id uuid not null references public.profiles (id) on delete cascade,
  shift_type_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'),
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade,
  foreign key (shift_type_id, org_id) references public.shift_types (id, org_id)
    on delete set null (shift_type_id),
  -- [) ranges: a 07–19 shift followed by 19–07 is allowed (no overlap).
  constraint shifts_no_overlap exclude using gist (
    org_id with =,
    user_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

create index shifts_schedule_org_idx on public.shifts (schedule_id, org_id);
create index shifts_user_starts_idx on public.shifts (user_id, starts_at);
create index shifts_shift_type_org_idx on public.shifts (shift_type_id, org_id);

-------------------------------------------------------------------------------
-- Visibility
-------------------------------------------------------------------------------

-- Admins/managers see every schedule of their org. Members see a schedule only
-- once published, and only if they belong to its team or have a shift in it
-- (e.g. covering for another team).
--
-- The schedules policy must evaluate on the row's own columns: INSERT/UPDATE
-- ... RETURNING applies the SELECT policy to the new row, and a function that
-- re-reads `schedules` can't see a row inserted by the same statement.

-- Member part: belongs to the team, or has a shift in the schedule. Security
-- definer so it reads team_members/shifts without re-entering their RLS.
create function private.is_schedule_participant(p_schedule_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.shifts sh
    where sh.schedule_id = p_schedule_id and sh.user_id = (select auth.uid())
  );
$$;

-- Same rule by schedule id, for the shifts policy.
create function private.can_view_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedules s
    where s.id = p_schedule_id
      and (
        private.is_org_member(s.org_id, array['admin', 'manager']::public.org_role[])
        or (
          s.status = 'published'
          and private.is_org_member(s.org_id)
          and private.is_schedule_participant(s.id, s.team_id)
        )
      )
  );
$$;

-- Whether p_user_id belongs to the org (shifts can only be assigned to members).
create function private.is_member_of_org(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = p_user_id
  );
$$;

revoke all on function private.is_schedule_participant(uuid, uuid) from public;
revoke all on function private.can_view_schedule(uuid) from public;
revoke all on function private.is_member_of_org(uuid, uuid) from public;
grant execute on function private.is_schedule_participant(uuid, uuid) to authenticated;
grant execute on function private.can_view_schedule(uuid) to authenticated;
grant execute on function private.is_member_of_org(uuid, uuid) to authenticated;

-------------------------------------------------------------------------------
-- Privileges and RLS
-------------------------------------------------------------------------------

revoke all on public.schedules, public.shifts from anon, authenticated;

grant select, delete on public.schedules, public.shifts to authenticated;
grant insert (org_id, team_id, name, period_start, period_end) on public.schedules to authenticated;
grant update (name, status) on public.schedules to authenticated;
grant insert (org_id, schedule_id, user_id, shift_type_id, starts_at, ends_at)
  on public.shifts to authenticated;

alter table public.schedules enable row level security;
alter table public.shifts enable row level security;

create policy "schedules: managers see all, members see published"
  on public.schedules for select to authenticated
  using (
    private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
    or (
      status = 'published'
      and private.is_org_member(org_id)
      and private.is_schedule_participant(id, team_id)
    )
  );

create policy "schedules: admins and managers create"
  on public.schedules for insert to authenticated
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "schedules: admins and managers update"
  on public.schedules for update to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]))
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "schedules: admins and managers delete"
  on public.schedules for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "shifts: visible with their schedule"
  on public.shifts for select to authenticated
  using (
    private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
    or private.can_view_schedule(schedule_id)
  );

create policy "shifts: admins and managers assign members"
  on public.shifts for insert to authenticated
  with check (
    private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
    and private.is_member_of_org(org_id, user_id)
  );

create policy "shifts: admins and managers delete"
  on public.shifts for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

-------------------------------------------------------------------------------
-- RPC: atomically delete shifts of a schedule (all of them when p_delete_ids
-- is null, or just the listed ids) and insert new ones. Used both by the
-- generator (replace everything) and by single-cell edits. Security invoker:
-- RLS and the overlap constraint apply to every row; any failure rolls back.
-------------------------------------------------------------------------------

create function public.replace_schedule_shifts(
  p_schedule_id uuid,
  p_shifts jsonb,
  p_delete_ids uuid[] default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_inserted integer;
begin
  select s.org_id into v_org_id from public.schedules s where s.id = p_schedule_id;
  if v_org_id is null then
    raise exception 'schedule not found' using errcode = 'P0002';
  end if;

  if not private.is_org_member(v_org_id, array['admin', 'manager']::public.org_role[]) then
    raise exception 'not allowed to edit schedules' using errcode = '42501';
  end if;

  if p_delete_ids is null then
    delete from public.shifts where schedule_id = p_schedule_id;
  else
    delete from public.shifts where schedule_id = p_schedule_id and id = any (p_delete_ids);
  end if;

  insert into public.shifts (org_id, schedule_id, user_id, shift_type_id, starts_at, ends_at)
  select v_org_id, p_schedule_id, s.user_id, s.shift_type_id, s.starts_at, s.ends_at
  from jsonb_to_recordset(coalesce(p_shifts, '[]'::jsonb))
    as s(user_id uuid, shift_type_id uuid, starts_at timestamptz, ends_at timestamptz);

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.replace_schedule_shifts(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.replace_schedule_shifts(uuid, jsonb, uuid[]) to authenticated;
