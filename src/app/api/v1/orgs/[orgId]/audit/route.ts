import type { NextRequest } from "next/server";
import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { listAuditEvents, MAX_AUDIT_EVENTS } from "@/server/services/audit";

// GET /api/v1/orgs/:orgId/audit?limit=200 — raw events, newest first (admins).
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    ctx: RouteContext<"/api/v1/orgs/[orgId]/audit">,
  ) => {
    const { orgId } = await ctx.params;
    const auth = await requireApiUser();
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 200);
    return Response.json({
      data: await listAuditEvents(
        auth,
        orgId,
        Number.isInteger(limit) ? limit : 200,
      ),
      meta: { maxLimit: MAX_AUDIT_EVENTS },
    });
  },
);
