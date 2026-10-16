import { updateMemberRoleSchema } from "@/lib/validation/members";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { removeMember, updateMemberRole } from "@/server/services/members";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/members/[userId]">;

export const PATCH = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId, userId } = await ctx.params;
  const auth = await requireApiUser();
  const { role } = await parseJsonBody(request, updateMemberRoleSchema);
  return Response.json({
    data: await updateMemberRole(auth, orgId, userId, role),
  });
});

export const DELETE = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId, userId } = await ctx.params;
  const auth = await requireApiUser();
  await removeMember(auth, orgId, userId);
  return new Response(null, { status: 204 });
});
