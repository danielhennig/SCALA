import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { acceptInvitation } from "@/server/services/invitations";

export const POST = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/invitations/[token]/accept">,
  ) => {
    const { token } = await ctx.params;
    const auth = await requireApiUser();
    return Response.json({ data: await acceptInvitation(auth, token) });
  },
);
