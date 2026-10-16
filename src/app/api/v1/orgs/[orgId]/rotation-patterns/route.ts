import { rotationPatternSchema } from "@/lib/validation/scheduling";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  listRotationPatterns,
  saveRotationPattern,
} from "@/server/services/rotation-patterns";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/rotation-patterns">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listRotationPatterns(auth, orgId) });
});

export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, rotationPatternSchema);
  return Response.json(
    { data: await saveRotationPattern(auth, orgId, null, input) },
    { status: 201 },
  );
});
