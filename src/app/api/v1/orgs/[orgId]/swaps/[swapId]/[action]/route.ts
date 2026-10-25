import { swapActionSchema } from "@/lib/validation/swaps";
import { requireApiUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { withErrorHandling } from "@/server/http";
import { actOnSwap } from "@/server/services/swaps";

// POST /swaps/:id/accept | decline   (colleague asked)
//                 /cancel            (requester)
//                 /approve | reject  (admin/manager; approve reassigns shifts)
export const POST = withErrorHandling(
  async (
    _request: Request,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/swaps/[swapId]/[action]">,
  ) => {
    const { orgId, swapId, action } = await ctx.params;
    const parsed = swapActionSchema.safeParse(action);
    if (!parsed.success) {
      throw new AppError("NOT_FOUND", "Ação desconhecida.");
    }
    const auth = await requireApiUser();
    return Response.json({
      data: await actOnSwap(auth, orgId, swapId, parsed.data),
    });
  },
);
