import { teamNameSchema } from "@/lib/validation/teams";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { deleteTeam, getTeam, renameTeam } from "@/server/services/teams";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/teams/[teamId]">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, teamId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await getTeam(auth, orgId, teamId) });
});

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, teamId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, teamNameSchema);
  return Response.json({ data: await renameTeam(auth, orgId, teamId, input) });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, teamId } = await ctx.params;
  const auth = await requireApiUser();
  await deleteTeam(auth, orgId, teamId);
  return new Response(null, { status: 204 });
});
