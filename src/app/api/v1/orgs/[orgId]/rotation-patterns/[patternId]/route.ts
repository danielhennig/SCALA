import { rotationPatternSchema } from "@/lib/validation/scheduling";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  deleteRotationPattern,
  getRotationPattern,
  saveRotationPattern,
} from "@/server/services/rotation-patterns";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/rotation-patterns/[patternId]">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, patternId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({
    data: await getRotationPattern(auth, orgId, patternId),
  });
});

// PUT: replaces the name and the whole cycle.
export const PUT = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, patternId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, rotationPatternSchema);
  return Response.json({
    data: await saveRotationPattern(auth, orgId, patternId, input),
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, patternId } = await ctx.params;
  const auth = await requireApiUser();
  await deleteRotationPattern(auth, orgId, patternId);
  return new Response(null, { status: 204 });
});
