import type { Database } from "@/types/database";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export const ORG_ROLES = [
  "admin",
  "manager",
  "member",
] as const satisfies readonly OrgRole[];

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  member: "Membro",
};

// These mirror the RLS policies and SQL functions. The database is the real
// enforcement; these only decide what the UI offers and give clearer 403s.

export function canManageMembers(role: OrgRole): boolean {
  return role === "admin";
}

export function canManageTeams(role: OrgRole): boolean {
  return role === "admin" || role === "manager";
}

/** Roles that `role` may hand out in an invitation. */
export function invitableRoles(role: OrgRole): OrgRole[] {
  if (role === "admin") return ["member", "manager", "admin"];
  if (role === "manager") return ["member"];
  return [];
}

export function canInvite(
  role: OrgRole,
  inviteRole: OrgRole = "member",
): boolean {
  return invitableRoles(role).includes(inviteRole);
}
