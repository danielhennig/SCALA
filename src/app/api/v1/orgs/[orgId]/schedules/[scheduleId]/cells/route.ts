import { setScheduleCellSchema } from "@/lib/validation/schedules";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { setScheduleCell } from "@/server/services/schedules";

// PUT { userId, date, shiftTypeId | null }: the person's shift on that local
// day becomes exactly this (or none). Idempotent.
export const PUT = withErrorHandling(
  async (
    request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]/cells">,
  ) => {
    const { orgId, scheduleId } = await ctx.params;
    const auth = await requireApiUser();
    const input = await parseJsonBody(request, setScheduleCellSchema);
    await setScheduleCell(auth, orgId, scheduleId, input);
    return new Response(null, { status: 204 });
  },
);
