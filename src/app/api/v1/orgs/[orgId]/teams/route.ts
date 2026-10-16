import { teamNameSchema } from "@/lib/validation/teams";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { createTeam, listTeams } from "@/server/services/teams";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/teams">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listTeams(auth, orgId) });
});

export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, teamNameSchema);
  return Response.json(
    { data: await createTeam(auth, orgId, input) },
    { status: 201 },
  );
});
