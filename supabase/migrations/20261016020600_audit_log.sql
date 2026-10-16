-- Etapa 5: audit log.
--
-- Append-only record of who changed what, filled by triggers (so it can't be
-- bypassed by the API). Rows of one transaction share `txid`, which lets the
-- UI collapse e.g. "generate schedule" (hundreds of shift rows) into one line.

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No FK: the history outlives deleted rows (and is read by org_id only).
  org_id uuid not null,
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id text,
  -- insert/delete: {"row": {...}}; update: {"row": new, "changed": {col: [old, new]}}
  changes jsonb not null,
  txid bigint not null default txid_current(),
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);

create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed jsonb;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old) - 'created_at' - 'updated_at';
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new) - 'created_at' - 'updated_at';
  end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_array(v_old -> n.key, n.value)), '{}'::jsonb)
    into v_changed
    from jsonb_each(v_new) as n(key, value)
    where v_old -> n.key is distinct from n.value;

    -- Only updated_at changed (or a no-op update): nothing worth recording.
    if v_changed = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, action, entity, entity_id, changes)
  values (
    (v_row ->> 'org_id')::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    case
      when tg_op = 'UPDATE' then jsonb_build_object('row', v_new, 'changed', v_changed)
      else jsonb_build_object('row', v_row)
    end
  );
  return null;
end;
$$;

revoke all on function private.audit_row() from public;

create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function private.audit_row();
create trigger audit_teams after insert or update or delete on public.teams
  for each row execute function private.audit_row();
create trigger audit_team_members after insert or update or delete on public.team_members
  for each row execute function private.audit_row();
create trigger audit_shift_types after insert or update or delete on public.shift_types
  for each row execute function private.audit_row();
create trigger audit_rotation_patterns after insert or update or delete on public.rotation_patterns
  for each row execute function private.audit_row();
create trigger audit_rotation_pattern_days after insert or update or delete on public.rotation_pattern_days
  for each row execute function private.audit_row();
create trigger audit_schedules after insert or update or delete on public.schedules
  for each row execute function private.audit_row();
create trigger audit_shifts after insert or update or delete on public.shifts
  for each row execute function private.audit_row();

-- Read-only for admins; nobody writes through the API.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

alter table public.audit_log enable row level security;

create policy "audit_log: admins read"
  on public.audit_log for select to authenticated
  using (private.is_org_member(org_id, array['admin']::public.org_role[]));
