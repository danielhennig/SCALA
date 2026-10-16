import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getMyOrganization } from "@/server/services/organizations";

/**
 * Shared by the org layout and its pages: session + org + caller's role,
 * rendering the 404 page for non-members. Both calls are memoized per request.
 */
export async function loadOrg(params: Promise<{ orgId: string }>) {
  const { orgId } = await params;
  const auth = await requireUser();
  try {
    const { organization, role } = await getMyOrganization(auth, orgId);
    return { auth, orgId, organization, role };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
