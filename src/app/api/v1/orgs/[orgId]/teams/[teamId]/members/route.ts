import { addTeamMemberSchema } from "@/lib/validation/teams";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { addTeamMember } from "@/server/services/teams";

export const POST = withErrorHandling(
  async (
    request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/teams/[teamId]/members">,
  ) => {
    const { orgId, teamId } = await ctx.params;
    const auth = await requireApiUser();
    const { userId } = await parseJsonBody(request, addTeamMemberSchema);
    await addTeamMember(auth, orgId, teamId, userId);
    return new Response(null, { status: 204 });
  },
);
