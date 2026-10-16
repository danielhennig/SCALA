import { renameScheduleSchema } from "@/lib/validation/schedules";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  deleteSchedule,
  getScheduleDetail,
  renameSchedule,
} from "@/server/services/schedules";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/schedules/[scheduleId]">;

/** Schedule with its shifts and the people shown as rows. */
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, scheduleId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({
    data: await getScheduleDetail(auth, orgId, scheduleId),
  });
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, scheduleId } = await ctx.params;
  const auth = await requireApiUser();
  const { name } = await parseJsonBody(request, renameScheduleSchema);
  return Response.json({
    data: await renameSchedule(auth, orgId, scheduleId, name),
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, scheduleId } = await ctx.params;
  const auth = await requireApiUser();
  await deleteSchedule(auth, orgId, scheduleId);
  return new Response(null, { status: 204 });
});
