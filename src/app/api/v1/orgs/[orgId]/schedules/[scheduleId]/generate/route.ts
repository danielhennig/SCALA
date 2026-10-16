import { generateScheduleSchema } from "@/lib/validation/schedules";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { generateSchedule } from "@/server/services/schedules";

// Replaces ALL shifts of the schedule with the rotation pattern's expansion.
export const POST = withErrorHandling(
  async (
    request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]/generate">,
  ) => {
    const { orgId, scheduleId } = await ctx.params;
    const auth = await requireApiUser();
    const input = await parseJsonBody(request, generateScheduleSchema);
    return Response.json({
      data: await generateSchedule(auth, orgId, scheduleId, input),
    });
  },
);
