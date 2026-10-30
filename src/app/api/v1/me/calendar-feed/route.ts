import type { NextRequest } from "next/server";
import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import {
  getCalendarFeedStatus,
  revokeCalendarFeed,
  rotateCalendarFeed,
} from "@/server/services/calendar";

// GET: { data: { createdAt } | null } — whether the caller has a feed.
export const GET = withErrorHandling(async () => {
  const auth = await requireApiUser();
  return Response.json({ data: await getCalendarFeedStatus(auth) });
});

// POST: creates the feed or replaces its URL. The URL is only shown here,
// once; the database keeps just a hash of the token.
export const POST = withErrorHandling(async (request: NextRequest) => {
  const auth = await requireApiUser();
  const { token } = await rotateCalendarFeed(auth);
  const url = new URL(`/api/v1/calendar/${token}.ics`, request.nextUrl.origin);
  return Response.json({ data: { url: url.toString() } }, { status: 201 });
});

export const DELETE = withErrorHandling(async () => {
  const auth = await requireApiUser();
  await revokeCalendarFeed(auth);
  return new Response(null, { status: 204 });
});
