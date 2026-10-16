import "server-only";
import { canManageTeams } from "@/lib/roles";
import type { TeamNameData } from "@/lib/validation/teams";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyRole } from "./organizations";

export type TeamSummary = { id: string; name: string; memberCount: number };

export type TeamMember = { userId: string; fullName: string };

export type TeamDetail = { id: string; name: string; members: TeamMember[] };

async function requireTeamManager(auth: AuthContext, orgId: string) {
  if (!canManageTeams(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores podem gerenciar equipes.",
    );
  }
}

const duplicateName = () =>
  new AppError("CONFLICT", "Já existe uma equipe com esse nome.");

export async function listTeams(
  auth: AuthContext,
  orgId: string,
): Promise<TeamSummary[]> {
  await getMyRole(auth, orgId);

  const { data, error } = await auth.supabase
    .from("teams")
    .select("id, name, team_members(count)")
    .eq("org_id", orgId)
    .order("name");

  if (error) throw fromPostgrestError(error);
  return data.map((team) => ({
    id: team.id,
    name: team.name,
    memberCount: team.team_members[0]?.count ?? 0,
  }));
}

export async function getTeam(
  auth: AuthContext,
  orgId: string,
  teamId: string,
): Promise<TeamDetail> {
  await getMyRole(auth, orgId);
  assertUuid(teamId, "Equipe não encontrada.");

  const { data, error } = await auth.supabase
    .from("teams")
    .select(
      "id, name, team_members(user_id, membership:memberships!inner(profile:profiles!inner(full_name)))",
    )
    .eq("id", teamId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Equipe não encontrada.");

  return {
    id: data.id,
    name: data.name,
    members: data.team_members
      .map((row) => ({
        userId: row.user_id,
        fullName: row.membership.profile.full_name,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
  };
}

export async function createTeam(
  auth: AuthContext,
  orgId: string,
  { name }: TeamNameData,
): Promise<TeamSummary> {
  await requireTeamManager(auth, orgId);

  const { data, error } = await auth.supabase
    .from("teams")
    .insert({ org_id: orgId, name })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") throw duplicateName();
    throw fromPostgrestError(error);
  }
  return { ...data, memberCount: 0 };
}

export async function renameTeam(
  auth: AuthContext,
  orgId: string,
  teamId: string,
  { name }: TeamNameData,
): Promise<{ id: string; name: string }> {
  await requireTeamManager(auth, orgId);
  assertUuid(teamId, "Equipe não encontrada.");

  const { data, error } = await auth.supabase
    .from("teams")
    .update({ name })
    .eq("id", teamId)
    .eq("org_id", orgId)
    .select("id, name")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw duplicateName();
    throw fromPostgrestError(error);
  }
  if (!data) throw new AppError("NOT_FOUND", "Equipe não encontrada.");
  return data;
}

export async function deleteTeam(
  auth: AuthContext,
  orgId: string,
  teamId: string,
): Promise<void> {
  await requireTeamManager(auth, orgId);
  assertUuid(teamId, "Equipe não encontrada.");

  const { data, error } = await auth.supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      throw new AppError(
        "CONFLICT",
        "A equipe tem escalas. Exclua as escalas antes de excluir a equipe.",
      );
    }
    throw fromPostgrestError(error);
  }
  if (!data) throw new AppError("NOT_FOUND", "Equipe não encontrada.");
}

export async function addTeamMember(
  auth: AuthContext,
  orgId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  await requireTeamManager(auth, orgId);
  assertUuid(teamId, "Equipe não encontrada.");

  const { error } = await auth.supabase
    .from("team_members")
    .insert({ team_id: teamId, org_id: orgId, user_id: userId });

  if (!error) return;
  if (error.code === "23505") {
    throw new AppError("CONFLICT", "Essa pessoa já está na equipe.");
  }
  if (error.code === "23503") {
    // The composite FKs tell us which side is missing.
    throw error.message.includes("team_members_team_id_org_id_fkey")
      ? new AppError("NOT_FOUND", "Equipe não encontrada.")
      : new AppError(
          "VALIDATION_ERROR",
          "Essa pessoa não é membro da organização.",
        );
  }
  throw fromPostgrestError(error);
}

export async function removeTeamMember(
  auth: AuthContext,
  orgId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  await requireTeamManager(auth, orgId);
  assertUuid(teamId, "Equipe não encontrada.");
  assertUuid(userId, "Membro não encontrado.");

  const { data, error } = await auth.supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Membro não está na equipe.");
}
