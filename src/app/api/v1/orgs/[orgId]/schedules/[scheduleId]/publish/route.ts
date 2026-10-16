import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { setScheduleStatus } from "@/server/services/schedules";

// Makes the schedule visible to its team.
export const POST = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]/publish">,
  ) => {
    const { orgId, scheduleId } = await ctx.params;
    const auth = await requireApiUser();
    return Response.json({
      data: await setScheduleStatus(auth, orgId, scheduleId, "published"),
    });
  },
);
