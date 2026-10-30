-- Etapa 8: personal calendar feed (iCal subscription).
--
-- Calendar apps (Google, Apple, Outlook) fetch the feed URL on their own and
-- can't send the session cookie, so the URL carries a secret token. As with
-- invitations, only its SHA-256 is stored: the plain token is shown once, and
-- generating a new one invalidates the old URL.

create table public.calendar_feeds (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

-- token_hash is deliberately left out of the grants.
revoke all on public.calendar_feeds from anon, authenticated;
grant select (user_id, created_at) on public.calendar_feeds to authenticated;
grant delete on public.calendar_feeds to authenticated;

alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds: owner reads"
  on public.calendar_feeds for select to authenticated
  using (user_id = (select auth.uid()));

create policy "calendar_feeds: owner revokes"
  on public.calendar_feeds for delete to authenticated
  using (user_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- Creates the caller's feed, or replaces its token, and returns the plain
-- token once.
create function public.rotate_calendar_feed()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.calendar_feeds (user_id, token_hash)
  values (v_user_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (user_id) do update
    set token_hash = excluded.token_hash,
        created_at = now();

  return v_token;
end;
$$;

-- What the feed URL serves, called without a session (anon): the token owner's
-- shifts in published schedules of organizations they still belong to, from
-- 30 days ago to 180 days ahead. Same rule as "Minha escala". Raises P0002 for
-- an unknown or revoked token, so the route can answer 404 instead of an empty
-- calendar.
create function public.calendar_feed_shifts(p_token text)
returns table (
  shift_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  shift_type_name text,
  team_name text,
  schedule_name text,
  org_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select f.user_id into v_user_id
  from public.calendar_feeds f
  where f.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_user_id is null then
    raise exception 'calendar feed not found' using errcode = 'P0002';
  end if;

  return query
  select sh.id, sh.starts_at, sh.ends_at, st.name, t.name, s.name, o.name
  from public.shifts sh
  join public.schedules s on s.id = sh.schedule_id
  join public.teams t on t.id = s.team_id
  join public.organizations o on o.id = sh.org_id
  join public.memberships m on m.org_id = sh.org_id and m.user_id = sh.user_id
  left join public.shift_types st on st.id = sh.shift_type_id
  where sh.user_id = v_user_id
    and s.status = 'published'
    and sh.starts_at >= now() - interval '30 days'
    and sh.starts_at < now() + interval '180 days'
  order by sh.starts_at;
end;
$$;

revoke all on function public.rotate_calendar_feed() from public, anon;
revoke all on function public.calendar_feed_shifts(text) from public;
grant execute on function public.rotate_calendar_feed() to authenticated;
grant execute on function public.calendar_feed_shifts(text) to anon, authenticated;
