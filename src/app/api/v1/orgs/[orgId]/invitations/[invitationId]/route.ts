import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { revokeInvitation } from "@/server/services/invitations";

export const DELETE = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/invitations/[invitationId]">,
  ) => {
    const { orgId, invitationId } = await ctx.params;
    const auth = await requireApiUser();
    await revokeInvitation(auth, orgId, invitationId);
    return new Response(null, { status: 204 });
  },
);
