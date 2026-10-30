import "server-only";
import { buildICalendar } from "@/lib/ical";
import type { AuthContext } from "../auth";
import { fromPostgrestError } from "../errors";
import { createAnonClient } from "../supabase";

/** 32 random bytes, hex (see rotate_calendar_feed). */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export type CalendarFeedStatus = { createdAt: string } | null;

/** Whether the caller has an active feed (the token itself is never stored). */
export async function getCalendarFeedStatus({
  supabase,
  user,
}: AuthContext): Promise<CalendarFeedStatus> {
  const { data, error } = await supabase
    .from("calendar_feeds")
    .select("created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  return data ? { createdAt: data.created_at } : null;
}

/** Creates the feed or replaces its token; the old URL stops working. */
export async function rotateCalendarFeed({
  supabase,
}: AuthContext): Promise<{ token: string }> {
  const { data, error } = await supabase.rpc("rotate_calendar_feed");
  if (error) throw fromPostgrestError(error);
  return { token: data };
}

export async function revokeCalendarFeed({
  supabase,
  user,
}: AuthContext): Promise<void> {
  const { error } = await supabase
    .from("calendar_feeds")
    .delete()
    .eq("user_id", user.id);
  if (error) throw fromPostgrestError(error);
}

/**
 * The .ics served at the feed URL, or null for an unknown/revoked token.
 * Runs without a session: the token is the credential, checked in the DB.
 */
export async function buildCalendarFeed(token: string): Promise<string | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const supabase = await createAnonClient();
  const { data, error } = await supabase.rpc("calendar_feed_shifts", {
    p_token: token,
  });
  if (error) {
    if (error.code === "P0002") return null;
    throw fromPostgrestError(error);
  }

  return buildICalendar({
    name: "SCALA · Meus plantões",
    now: new Date(),
    events: data.map((row) => ({
      uid: `${row.shift_id}@scala`,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      // Null when the shift type was deleted (left join; the generated type
      // doesn't know that).
      summary: `${row.shift_type_name ?? "Plantão"} · ${row.team_name}`,
      description: `${row.org_name}\nEscala: ${row.schedule_name}`,
    })),
  });
}
