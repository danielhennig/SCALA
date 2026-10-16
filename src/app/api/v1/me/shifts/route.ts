import type { NextRequest } from "next/server";
import { requireApiUser } from "@/server/auth";
import { withErrorHandling } from "@/server/http";
import { listMyShifts } from "@/server/services/me";

const HOUR_MS = 60 * 60 * 1000;

// GET /api/v1/me/shifts?from=ISO&to=ISO
// Defaults: from 12h ago (to include a shift in progress) to 31 days ahead.
export const GET = withErrorHandling(async (request: NextRequest) => {
  const auth = await requireApiUser();
  const params = request.nextUrl.searchParams;
  const now = Date.now();
  const from = new Date(params.get("from") ?? now - 12 * HOUR_MS);
  const to = new Date(params.get("to") ?? now + 31 * 24 * HOUR_MS);
  return Response.json({ data: await listMyShifts(auth, { from, to }) });
});
