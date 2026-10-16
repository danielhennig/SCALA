-- Etapa 3: shift types and rotation patterns.
--
-- New business-rule SQLSTATE (mapped in src/server/errors.ts):
--   SC005 rotation cycle must have 1–28 days and at least one shift

-------------------------------------------------------------------------------
-- Shift types: "Diurno 07–19" = start 07:00, 720 minutes. A night shift is
-- just a start + duration that crosses midnight; no special case needed.
-------------------------------------------------------------------------------

create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);

create unique index shift_types_org_name_key on public.shift_types (org_id, lower(name));

create trigger shift_types_set_updated_at
  before update on public.shift_types
  for each row execute function private.set_updated_at();

-------------------------------------------------------------------------------
-- Rotation patterns: a cycle of `cycle_length` days. Only working days are
-- stored in rotation_pattern_days; a missing day_index is a day off.
-------------------------------------------------------------------------------

create table public.rotation_patterns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  cycle_length smallint not null check (cycle_length between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);

create unique index rotation_patterns_org_name_key on public.rotation_patterns (org_id, lower(name));

create trigger rotation_patterns_set_updated_at
  before update on public.rotation_patterns
  for each row execute function private.set_updated_at();

create table public.rotation_pattern_days (
  pattern_id uuid not null,
  org_id uuid not null,
  day_index smallint not null check (day_index between 0 and 27),
  shift_type_id uuid not null,
  primary key (pattern_id, day_index),
  foreign key (pattern_id, org_id) references public.rotation_patterns (id, org_id) on delete cascade,
  -- Same org as the pattern; NO ACTION blocks deleting a shift type in use.
  foreign key (shift_type_id, org_id) references public.shift_types (id, org_id)
);

create index rotation_pattern_days_pattern_org_idx on public.rotation_pattern_days (pattern_id, org_id);
create index rotation_pattern_days_shift_type_org_idx on public.rotation_pattern_days (shift_type_id, org_id);

-------------------------------------------------------------------------------
-- Privileges and RLS
-------------------------------------------------------------------------------

revoke all on public.shift_types, public.rotation_patterns, public.rotation_pattern_days
  from anon, authenticated;

grant select, delete on public.shift_types, public.rotation_patterns to authenticated;
grant select on public.rotation_pattern_days to authenticated;
grant insert (org_id, name, start_time, duration_minutes, color) on public.shift_types to authenticated;
grant update (name, start_time, duration_minutes, color) on public.shift_types to authenticated;
-- Patterns and their days are written only through save_rotation_pattern(),
-- which keeps cycle_length and the days consistent in one transaction.

alter table public.shift_types enable row level security;
alter table public.rotation_patterns enable row level security;
alter table public.rotation_pattern_days enable row level security;

create policy "shift_types: members read"
  on public.shift_types for select to authenticated
  using (private.is_org_member(org_id));

create policy "shift_types: admins and managers create"
  on public.shift_types for insert to authenticated
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "shift_types: admins and managers update"
  on public.shift_types for update to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]))
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "shift_types: admins and managers delete"
  on public.shift_types for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "rotation_patterns: members read"
  on public.rotation_patterns for select to authenticated
  using (private.is_org_member(org_id));

create policy "rotation_patterns: admins and managers delete"
  on public.rotation_patterns for delete to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "rotation_pattern_days: members read"
  on public.rotation_pattern_days for select to authenticated
  using (private.is_org_member(org_id));

-------------------------------------------------------------------------------
-- RPC: create (p_pattern_id omitted) or replace a pattern and its whole cycle.
-- p_days has one entry per cycle day: a shift type id, or null for a day off.
-------------------------------------------------------------------------------

create function public.save_rotation_pattern(
  p_org_id uuid,
  p_name text,
  p_days uuid[],
  p_pattern_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_length integer := coalesce(cardinality(p_days), 0);
  v_pattern_id uuid := p_pattern_id;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not private.is_org_member(p_org_id, array['admin', 'manager']::public.org_role[]) then
    raise exception 'not allowed to manage rotation patterns' using errcode = '42501';
  end if;

  if v_length not between 1 and 28
     or not exists (select 1 from unnest(p_days) as d(shift_type_id) where d.shift_type_id is not null)
  then
    raise exception 'cycle must have 1 to 28 days and at least one shift' using errcode = 'SC005';
  end if;

  if v_pattern_id is null then
    insert into public.rotation_patterns (org_id, name, cycle_length)
    values (p_org_id, p_name, v_length)
    returning id into v_pattern_id;
  else
    update public.rotation_patterns
    set name = p_name, cycle_length = v_length
    where id = v_pattern_id and org_id = p_org_id;

    if not found then
      raise exception 'rotation pattern not found' using errcode = 'P0002';
    end if;

    delete from public.rotation_pattern_days where pattern_id = v_pattern_id;
  end if;

  insert into public.rotation_pattern_days (pattern_id, org_id, day_index, shift_type_id)
  select v_pattern_id, p_org_id, (d.position - 1)::smallint, d.shift_type_id
  from unnest(p_days) with ordinality as d(shift_type_id, position)
  where d.shift_type_id is not null;

  return v_pattern_id;
end;
$$;

revoke all on function public.save_rotation_pattern(uuid, text, uuid[], uuid) from public, anon;
grant execute on function public.save_rotation_pattern(uuid, text, uuid[], uuid) to authenticated;
