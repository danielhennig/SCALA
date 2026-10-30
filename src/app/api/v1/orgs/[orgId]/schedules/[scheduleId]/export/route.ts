import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { exportScheduleCsv } from "@/server/services/schedule-export";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]/export">;

// GET: the schedule as CSV (";" separated, UTF-8 with BOM, for Excel pt-BR).
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, scheduleId } = await ctx.params;
  const auth = await requireApiUser();
  const { filename, csv } = await exportScheduleCsv(auth, orgId, scheduleId);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
