import { reviewTimeOffSchema } from "@/lib/validation/time-off";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { deleteTimeOff, reviewTimeOff } from "@/server/services/time-off";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/time-off/[timeOffId]">;

// PATCH { status: "approved" | "rejected" } — managers. The response's
// conflictingShifts counts existing shifts that now fall on days off.
export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, timeOffId } = await ctx.params;
  const auth = await requireApiUser();
  const { status } = await parseJsonBody(request, reviewTimeOffSchema);
  return Response.json({
    data: await reviewTimeOff(auth, orgId, timeOffId, status),
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, timeOffId } = await ctx.params;
  const auth = await requireApiUser();
  await deleteTimeOff(auth, orgId, timeOffId);
  return new Response(null, { status: 204 });
});
