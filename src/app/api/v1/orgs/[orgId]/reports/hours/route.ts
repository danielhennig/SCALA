import type { NextRequest } from "next/server";
import { hoursReportQuerySchema } from "@/lib/validation/reports";
import { requireApiUser } from "@/server/auth";
import { parseSearchParams, withErrorHandling } from "@/server/http";
import { getHoursReport } from "@/server/services/reports";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/reports/hours">;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&teamId=] — admins and managers.
// Published schedules only; each shift counts on the day it starts.
export const GET = withErrorHandling(async (request: NextRequest, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const query = parseSearchParams(
    request.nextUrl.searchParams,
    hoursReportQuerySchema,
  );
  return Response.json({ data: await getHoursReport(auth, orgId, query) });
});
