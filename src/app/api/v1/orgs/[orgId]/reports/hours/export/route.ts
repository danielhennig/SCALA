import type { NextRequest } from "next/server";
import { hoursReportQuerySchema } from "@/lib/validation/reports";
import { requireApiUser } from "@/server/auth";
import { parseSearchParams, withErrorHandling } from "@/server/http";
import { getHoursReport, hoursReportCsv } from "@/server/services/reports";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/reports/hours/export">;

// GET: the same report as CSV (";" separated, UTF-8 with BOM).
export const GET = withErrorHandling(async (request: NextRequest, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const query = parseSearchParams(
    request.nextUrl.searchParams,
    hoursReportQuerySchema,
  );
  const { filename, csv } = hoursReportCsv(
    await getHoursReport(auth, orgId, query),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
