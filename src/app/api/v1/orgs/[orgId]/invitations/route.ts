import { createInvitationSchema } from "@/lib/validation/members";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  createInvitation,
  listPendingInvitations,
} from "@/server/services/invitations";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/invitations">;

export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listPendingInvitations(auth, orgId) });
});

// The response carries the plain token exactly once; the client builds the
// invite link from it.
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, createInvitationSchema);
  return Response.json(
    { data: await createInvitation(auth, orgId, input) },
    { status: 201 },
  );
});
