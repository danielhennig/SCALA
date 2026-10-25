import { createSwapSchema } from "@/lib/validation/swaps";
import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import { createSwap, listSwaps } from "@/server/services/swaps";

type Ctx = RouteContext<"/api/v1/orgs/[orgId]/swaps">;

// Requests the caller is part of (managers: all), newest first.
export const GET = withErrorHandling(async (_request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  return Response.json({ data: await listSwaps(auth, orgId) });
});

// { offeredShiftId, targetId, requestedShiftId? } — omit requestedShiftId to
// ask for coverage.
export const POST = withErrorHandling(async (request: Request, ctx: Ctx) => {
  const { orgId } = await ctx.params;
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, createSwapSchema);
  return Response.json(
    { data: await createSwap(auth, orgId, input) },
    { status: 201 },
  );
});
