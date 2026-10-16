import "server-only";
import { canManageMembers, type OrgRole } from "@/lib/roles";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyRole } from "./organizations";

export type Member = {
  userId: string;
  fullName: string;
  role: OrgRole;
  joinedAt: string;
};

export async function listMembers(
  auth: AuthContext,
  orgId: string,
): Promise<Member[]> {
  await getMyRole(auth, orgId); // 404 for non-members

  const { data, error } = await auth.supabase
    .from("memberships")
    .select("user_id, role, created_at, profile:profiles!inner(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw fromPostgrestError(error);
  return data.map((row) => ({
    userId: row.user_id,
    fullName: row.profile.full_name,
    role: row.role,
    joinedAt: row.created_at,
  }));
}

export async function updateMemberRole(
  auth: AuthContext,
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<Pick<Member, "userId" | "role">> {
  if (!canManageMembers(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores podem alterar papéis.",
    );
  }
  assertUuid(userId, "Membro não encontrado.");

  const { data, error } = await auth.supabase
    .from("memberships")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select("user_id, role")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Membro não encontrado.");
  return { userId: data.user_id, role: data.role };
}

/** Admins remove anyone; any member can remove themselves (leave). */
export async function removeMember(
  auth: AuthContext,
  orgId: string,
  userId: string,
): Promise<void> {
  const myRole = await getMyRole(auth, orgId);
  if (userId !== auth.user.id && !canManageMembers(myRole)) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores podem remover membros.",
    );
  }
  assertUuid(userId, "Membro não encontrado.");

  const { data, error } = await auth.supabase
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Membro não encontrado.");
}
