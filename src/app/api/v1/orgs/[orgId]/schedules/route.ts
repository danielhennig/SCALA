import { createScheduleSchema } from "@/lib/validation/schedules";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { createSchedule, listSchedules } from "@/server/services/schedules";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/schedules">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listSchedules(auth, orgId) });
});

export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, createScheduleSchema);
  return Response.json(
    { data: await createSchedule(auth, orgId, input) },
    { status: 201 },
  );
});
