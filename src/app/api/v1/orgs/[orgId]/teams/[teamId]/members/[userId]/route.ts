import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { removeTeamMember } from "@/server/services/teams";

export const DELETE = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/teams/[teamId]/members/[userId]">,
  ) => {
    const { orgId, teamId, userId } = await ctx.params;
    const auth = await requireApiUser();
    await removeTeamMember(auth, orgId, teamId, userId);
    return new Response(null, { status: 204 });
  },
);
