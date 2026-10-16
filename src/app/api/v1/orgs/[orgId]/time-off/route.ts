import type { NextRequest } from "next/server";
import { addDays, isIsoDate } from "@/domain/scheduling/dates";
import { createTimeOffSchema } from "@/lib/validation/time-off";
import { requireApiUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { createTimeOff, listTimeOff } from "@/server/services/time-off";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/time-off">;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 31 days to next year).
// Members get only their own entries (RLS).
export const GET = withErrorHandling(async (request: NextRequest, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const params = request.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = params.get("from") ?? addDays(today, -31);
  const to = params.get("to") ?? addDays(today, 366);
  if (!isIsoDate(from) || !isIsoDate(to)) {
    throw new AppError("BAD_REQUEST", "Use datas no formato AAAA-MM-DD.");
  }
  return Response.json({ data: await listTimeOff(auth, orgId, { from, to }) });
});

// Managers: approved entry for any member. Members: pending request for self.
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, createTimeOffSchema);
  return Response.json(
    { data: await createTimeOff(auth, orgId, input) },
    { status: 201 },
  );
});
