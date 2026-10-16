import "server-only";
import { cache } from "react";
import type { OrgRole } from "@/lib/roles";
import type { CreateOrganizationData } from "@/lib/validation/organizations";
import type { Database } from "@/types/database";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  minRestHours: number;
  createdAt: string;
};

export type OrganizationSummary = Pick<Organization, "id" | "name" | "slug"> & {
  role: OrgRole;
};

// Explicit mapping keeps DB-only columns (created_by, updated_at) out of API responses.
function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    minRestHours: row.min_rest_hours,
    createdAt: row.created_at,
  };
}

export async function listMyOrganizations({
  supabase,
  user,
}: AuthContext): Promise<OrganizationSummary[]> {
  // RLS also returns co-members' memberships, so filter to the caller's own rows.
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organization:organizations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw fromPostgrestError(error);
  return data.map(({ role, organization }) => ({ ...organization, role }));
}

// Memoized per request (React cache): layouts, pages and permission checks
// can all call it without repeating the query.
export const getMyOrganization = cache(async function getMyOrganization(
  { supabase, user }: AuthContext,
  orgId: string,
): Promise<{ organization: Organization; role: OrgRole }> {
  assertUuid(orgId, "Organização não encontrada.");

  const { data, error } = await supabase
    .from("memberships")
    .select("role, organization:organizations!inner(*)")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Organização não encontrada.");
  return { organization: toOrganization(data.organization), role: data.role };
});

/** Resolves the caller's role in the org, or 404 if they're not a member. */
export async function getMyRole(
  auth: AuthContext,
  orgId: string,
): Promise<OrgRole> {
  return (await getMyOrganization(auth, orgId)).role;
}

export async function createOrganization(
  { supabase }: AuthContext,
  { name, slug, timezone }: CreateOrganizationData,
): Promise<Organization> {
  const { data, error } = await supabase
    .rpc("create_organization", {
      p_name: name,
      p_slug: slug,
      p_timezone: timezone,
    })
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "CONFLICT",
        "Já existe uma organização com esse identificador.",
      );
    }
    throw fromPostgrestError(error);
  }
  return toOrganization(data);
}
