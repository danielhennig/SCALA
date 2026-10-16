-- Etapa 6: time off (vacation, leave) that blocks scheduling.
--
-- New business-rule SQLSTATE (mapped in src/server/errors.ts):
--   SC006 person is on approved time off on the shift's day
--
-- LGPD: there is deliberately no free-text field (no diagnoses). Members see
-- only their own entries; admins/managers see the whole organization.

create type public.time_off_kind as enum ('vacation', 'medical', 'leave', 'other');
create type public.time_off_status as enum ('pending', 'approved', 'rejected');

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Profile, not membership: history survives leaving the organization.
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.time_off_kind not null,
  status public.time_off_status not null default 'pending',
  -- Local calendar dates (organization time zone), inclusive.
  start_date date not null,
  end_date date not null,
  requested_by uuid default auth.uid() references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date < 366),
  -- One active (pending or approved) entry per person per day; rejected
  -- requests don't block a new one.
  constraint time_off_no_overlap exclude using gist (
    org_id with =,
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'rejected')
);

create index time_off_org_start_idx on public.time_off (org_id, start_date);
create index time_off_user_idx on public.time_off (user_id);
create index time_off_requested_by_idx on public.time_off (requested_by);
create index time_off_reviewed_by_idx on public.time_off (reviewed_by);

create trigger time_off_set_updated_at
  before update on public.time_off
  for each row execute function private.set_updated_at();

-- Who approved/rejected and when; cleared when back to pending.
create function private.stamp_time_off_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif tg_op = 'INSERT' or old.status is distinct from new.status then
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger time_off_stamp_review
  before insert or update of status on public.time_off
  for each row execute function private.stamp_time_off_review();

create trigger audit_time_off after insert or update or delete on public.time_off
  for each row execute function private.audit_row();

-------------------------------------------------------------------------------
-- Block new shifts on days of approved time off. A shift belongs to the local
-- date it starts on (same rule as the grid), so a night shift starting the day
-- before a vacation is allowed. Existing shifts are not touched when time off
-- is approved later; the app flags those conflicts for the manager.
-------------------------------------------------------------------------------

create function private.block_shift_during_time_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  select (new.starts_at at time zone o.timezone)::date
  into v_date
  from public.organizations o
  where o.id = new.org_id;

  if exists (
    select 1
    from public.time_off t
    where t.org_id = new.org_id
      and t.user_id = new.user_id
      and t.status = 'approved'
      and v_date between t.start_date and t.end_date
  ) then
    raise exception 'person is on approved time off on %', v_date using errcode = 'SC006';
  end if;
  return new;
end;
$$;

revoke all on function private.block_shift_during_time_off() from public;

create trigger shifts_block_time_off
  before insert on public.shifts
  for each row execute function private.block_shift_during_time_off();

-------------------------------------------------------------------------------
-- Privileges and RLS
-------------------------------------------------------------------------------

revoke all on public.time_off from anon, authenticated;
grant select, delete on public.time_off to authenticated;
grant insert (org_id, user_id, kind, status, start_date, end_date) on public.time_off to authenticated;
grant update (kind, status, start_date, end_date) on public.time_off to authenticated;

alter table public.time_off enable row level security;

create policy "time_off: own entries, or everything for managers"
  on public.time_off for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
  );

create policy "time_off: managers register for members"
  on public.time_off for insert to authenticated
  with check (
    private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
    and private.is_member_of_org(org_id, user_id)
  );

create policy "time_off: members request for themselves"
  on public.time_off for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.is_org_member(org_id)
  );

create policy "time_off: managers review and edit"
  on public.time_off for update to authenticated
  using (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]))
  with check (private.is_org_member(org_id, array['admin', 'manager']::public.org_role[]));

create policy "time_off: managers delete, members cancel own pending"
  on public.time_off for delete to authenticated
  using (
    private.is_org_member(org_id, array['admin', 'manager']::public.org_role[])
    or (user_id = (select auth.uid()) and status = 'pending')
  );
