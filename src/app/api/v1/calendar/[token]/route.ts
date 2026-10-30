import { AppError } from "@/server/errors";
import { withErrorHandling } from "@/server/http";
import { buildCalendarFeed } from "@/server/services/calendar";

type Ctx = RouteContext<"/api/v1/calendar/[token]">;

// GET /api/v1/calendar/{token}.ics — public: calendar apps fetch it without a
// session. The token is the credential (see rotate_calendar_feed).
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const ics = await buildCalendarFeed(token.replace(/\.ics$/, ""));
  if (ics === null) {
    throw new AppError("NOT_FOUND", "Calendário não encontrado.");
  }
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="scala.ics"',
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
});
