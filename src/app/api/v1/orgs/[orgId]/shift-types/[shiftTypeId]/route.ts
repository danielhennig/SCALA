import { shiftTypeSchema } from "@/lib/validation/scheduling";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  deleteShiftType,
  updateShiftType,
} from "@/server/services/shift-types";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/shift-types/[shiftTypeId]">;

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, shiftTypeId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, shiftTypeSchema);
  return Response.json({
    data: await updateShiftType(auth, orgId, shiftTypeId, input),
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, shiftTypeId } = await ctx.params;
  const auth = await requireApiUser();
  await deleteShiftType(auth, orgId, shiftTypeId);
  return new Response(null, { status: 204 });
});
