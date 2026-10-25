-- Etapa 7: shift swaps and coverage requests.
--
-- New business-rule SQLSTATEs (mapped in src/server/errors.ts):
--   SC007 shift not eligible (not yours/the target's, past, draft, or changed)
--   SC008 swap request is not in a state that allows this action
--
-- Flow: requester creates (pending_target) → target accepts (pending_approval)
-- or declines → a manager approves (shifts are reassigned atomically) or
-- rejects. The requester may cancel while pending. All writes go through the
-- RPCs below; there are no direct write grants.

-------------------------------------------------------------------------------
-- Shifts: make the overlap constraint DEFERRABLE (initially immediate) so it's
-- checked at the end of each statement instead of per row. Swapping two
-- shifts at the same time slot between two people briefly gives one person
-- both shifts mid-statement; a per-row check would reject a valid swap.
-------------------------------------------------------------------------------

alter table public.shifts drop constraint shifts_no_overlap;
alter table public.shifts add constraint shifts_no_overlap exclude using gist (
  org_id with =,
  user_id with =,
  tstzrange(starts_at, ends_at) with &&
) deferrable initially immediate;

-- Time off must also block reassignment (swaps update user_id).
drop trigger shifts_block_time_off on public.shifts;
create trigger shifts_block_time_off
  before insert or update of user_id on public.shifts
  for each row execute function private.block_shift_during_time_off();

-------------------------------------------------------------------------------
-- Swap requests
-------------------------------------------------------------------------------

create type public.swap_status as enum (
  'pending_target',
  'pending_approval',
  'approved',
  'declined',
  'rejected',
  'cancelled'
);

create table public.shift_swaps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  -- A shift that gets deleted (e.g. schedule regenerated) takes its pending
  -- requests with it; the audit log keeps the history.
  offered_shift_id uuid not null references public.shifts (id) on delete cascade,
  -- Null: coverage request (the target takes the shift, gives nothing back).
  requested_shift_id uuid references public.shifts (id) on delete cascade,
  -- Snapshot for display: the target may not be able to read the requester's
  -- schedule (e.g. covering for another team) until the swap is approved.
  offered_starts_at timestamptz not null,
  offered_ends_at timestamptz not null,
  offered_shift_type_id uuid references public.shift_types (id) on delete set null,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_shift_type_id uuid references public.shift_types (id) on delete set null,
  status public.swap_status not null default 'pending_target',
  responded_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> target_id),
  check (requested_shift_id is null or requested_shift_id <> offered_shift_id)
);

-- One active request per offered shift.
create unique index shift_swaps_one_active_per_shift
  on public.shift_swaps (offered_shift_id)
  where status in ('pending_target', 'pending_approval');

create index shift_swaps_org_status_idx on public.shift_swaps (org_id, status);
create index shift_swaps_requester_idx on public.shift_swaps (requester_id);
create index shift_swaps_target_idx on public.shift_swaps (target_id);
create index shift_swaps_offered_shift_idx on public.shift_swaps (offered_shift_id);
create index shift_swaps_requested_shift_idx on public.shift_swaps (requested_shift_id);
create index shift_swaps_offered_type_idx on public.shift_swaps (offered_shift_type_id);
create index shift_swaps_requested_type_idx on public.shift_swaps (requested_shift_type_id);
create index shift_swaps_reviewed_by_idx on public.shift_swaps (reviewed_by);

create trigger shift_swaps_set_updated_at
  before update on public.shift_swaps
  for each row execute function private.set_updated_at();

create trigger audit_shift_swaps after insert or update or delete on public.shift_swaps
  for each row execute function private.audit_row();

revoke all on public.shift_swaps from anon, authenticated;
grant select on public.shift_swaps to authenticated;

alter table public.shift_swaps enable row level security;

create policy "shift_swaps: parties and managers read"
  on public.shift_swaps for select to authenticated
  using (
    requester_id = (select auth.uid())
    or target_id = (select auth.uid())
    or private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
  );

-------------------------------------------------------------------------------
-- Helper: a shift the given user may offer/receive in a swap. Returns the row
-- or raises SC007. Eligible = belongs to p_owner, published schedule, starts
-- in the future.
-------------------------------------------------------------------------------

create function private.eligible_swap_shift(p_shift_id uuid, p_owner uuid)
returns public.shifts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift public.shifts;
begin
  select sh.* into v_shift
  from public.shifts sh
  join public.schedules s on s.id = sh.schedule_id
  where sh.id = p_shift_id
    and sh.user_id = p_owner
    and s.status = 'published'
    and sh.starts_at > now();

  if v_shift.id is null then
    raise exception 'shift % is not eligible for a swap', p_shift_id using errcode = 'SC007';
  end if;
  return v_shift;
end;
$$;

revoke all on function private.eligible_swap_shift(uuid, uuid) from public;

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

create function public.create_shift_swap(
  p_offered_shift_id uuid,
  p_target_id uuid,
  p_requested_shift_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_offered public.shifts;
  v_requested public.shifts;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_offered := private.eligible_swap_shift(p_offered_shift_id, v_user_id);

  if p_target_id = v_user_id or not private.is_member_of_org(v_offered.org_id, p_target_id) then
    raise exception 'target must be another member of the organization' using errcode = 'SC007';
  end if;

  if p_requested_shift_id is not null then
    v_requested := private.eligible_swap_shift(p_requested_shift_id, p_target_id);
    if v_requested.org_id <> v_offered.org_id then
      raise exception 'shifts belong to different organizations' using errcode = 'SC007';
    end if;
  end if;

  insert into public.shift_swaps (
    org_id, requester_id, target_id, offered_shift_id, requested_shift_id,
    offered_starts_at, offered_ends_at, offered_shift_type_id,
    requested_starts_at, requested_ends_at, requested_shift_type_id
  )
  values (
    v_offered.org_id, v_user_id, p_target_id, v_offered.id, v_requested.id,
    v_offered.starts_at, v_offered.ends_at, v_offered.shift_type_id,
    v_requested.starts_at, v_requested.ends_at, v_requested.shift_type_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

create function public.respond_shift_swap(p_swap_id uuid, p_accept boolean)
returns public.swap_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null or v_swap.target_id is distinct from (select auth.uid()) then
    raise exception 'only the colleague asked can respond' using errcode = '42501';
  end if;
  if v_swap.status <> 'pending_target' then
    raise exception 'swap is %', v_swap.status using errcode = 'SC008';
  end if;

  update public.shift_swaps
  set status = case when p_accept then 'pending_approval' else 'declined' end::public.swap_status,
      responded_at = now()
  where id = p_swap_id
  returning status into v_swap.status;

  return v_swap.status;
end;
$$;

create function public.cancel_shift_swap(p_swap_id uuid)
returns public.swap_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null or v_swap.requester_id is distinct from (select auth.uid()) then
    raise exception 'only the requester can cancel' using errcode = '42501';
  end if;
  if v_swap.status not in ('pending_target', 'pending_approval') then
    raise exception 'swap is %', v_swap.status using errcode = 'SC008';
  end if;

  update public.shift_swaps set status = 'cancelled' where id = p_swap_id;
  return 'cancelled'::public.swap_status;
end;
$$;

-- Approving re-checks ownership, then reassigns both shifts in ONE statement
-- (the deferrable overlap constraint is checked after it). Overlaps (23P01)
-- and time off (SC006) abort the whole approval.
create function public.review_shift_swap(p_swap_id uuid, p_approve boolean)
returns public.swap_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.shift_swaps;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;

  if v_swap.id is null
     or not private.is_org_member(v_swap.org_id, array['admin', 'manager']::public.org_role[])
  then
    raise exception 'only admins and managers can review swaps' using errcode = '42501';
  end if;
  if v_swap.status <> 'pending_approval' then
    raise exception 'swap is %', v_swap.status using errcode = 'SC008';
  end if;

  if p_approve then
    if not exists (
      select 1 from public.shifts
      where id = v_swap.offered_shift_id and user_id = v_swap.requester_id
    ) or (
      v_swap.requested_shift_id is not null and not exists (
        select 1 from public.shifts
        where id = v_swap.requested_shift_id and user_id = v_swap.target_id
      )
    ) then
      raise exception 'shifts changed since the request' using errcode = 'SC007';
    end if;

    update public.shifts
    set user_id = case
      when id = v_swap.offered_shift_id then v_swap.target_id
      else v_swap.requester_id
    end
    where id in (v_swap.offered_shift_id, v_swap.requested_shift_id);
  end if;

  update public.shift_swaps
  set status = case when p_approve then 'approved' else 'rejected' end::public.swap_status,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_swap_id
  returning status into v_swap.status;

  return v_swap.status;
end;
$$;

revoke all on function public.create_shift_swap(uuid, uuid, uuid) from public, anon;
revoke all on function public.respond_shift_swap(uuid, boolean) from public, anon;
revoke all on function public.cancel_shift_swap(uuid) from public, anon;
revoke all on function public.review_shift_swap(uuid, boolean) from public, anon;
grant execute on function public.create_shift_swap(uuid, uuid, uuid) to authenticated;
grant execute on function public.respond_shift_swap(uuid, boolean) to authenticated;
grant execute on function public.cancel_shift_swap(uuid) to authenticated;
grant execute on function public.review_shift_swap(uuid, boolean) to authenticated;
