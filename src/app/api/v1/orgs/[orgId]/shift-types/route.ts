import { shiftTypeSchema } from "@/lib/validation/scheduling";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { createShiftType, listShiftTypes } from "@/server/services/shift-types";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/shift-types">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listShiftTypes(auth, orgId) });
});

export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, shiftTypeSchema);
  return Response.json(
    { data: await createShiftType(auth, orgId, input) },
    { status: 201 },
  );
});
