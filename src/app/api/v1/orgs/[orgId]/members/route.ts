import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { listMembers } from "@/server/services/members";

export const GET = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/members">,
  ) => {
    const { orgId } = await ctx.params;
    const auth = await requireApiUser();
    return Response.json({ data: await listMembers(auth, orgId) });
  },
);
