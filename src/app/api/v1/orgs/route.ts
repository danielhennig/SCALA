import { requireApiUser } from "@/server/auth";
import { parseJsonBody, withErrorHandling } from "@/server/http";
import {
  createOrganization,
  listMyOrganizations,
} from "@/server/services/organizations";
import { createOrganizationSchema } from "@/lib/validation/organizations";

export const GET = withErrorHandling(async () => {
  const auth = await requireApiUser();
  const organizations = await listMyOrganizations(auth);
  return Response.json({ data: organizations });
});

export const POST = withErrorHandling(async (request: Request) => {
  const auth = await requireApiUser();
  const input = await parseJsonBody(request, createOrganizationSchema);
  const organization = await createOrganization(auth, input);
  return Response.json({ data: organization }, { status: 201 });
});
