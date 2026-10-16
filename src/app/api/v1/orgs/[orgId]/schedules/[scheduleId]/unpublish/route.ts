import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { setScheduleStatus } from "@/server/services/schedules";

// Back to draft: hidden from members again.
export const POST = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]/unpublish">,
  ) => {
    const { orgId, scheduleId } = await ctx.params;
    const auth = await requireApiUser();
    return Response.json({
      data: await setScheduleStatus(auth, orgId, scheduleId, "draft"),
    });
  },
);
