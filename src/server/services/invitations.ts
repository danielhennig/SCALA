import "server-only";
import { canInvite, type OrgRole } from "@/lib/roles";
import {
  type CreateInvitationData,
  INVITATION_TOKEN_PATTERN,
} from "@/lib/validation/members";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyRole } from "./organizations";

export type Invitation = {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
};

/** Returned only at creation time: the token is never stored in plain text. */
export type CreatedInvitation = Omit<Invitation, "createdAt"> & {
  token: string;
};

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

export type InvitationPreview = {
  organizationName: string;
  role: OrgRole;
  email: string;
  status: InvitationStatus;
};

export async function listPendingInvitations(
  auth: AuthContext,
  orgId: string,
): Promise<Invitation[]> {
  if (!canInvite(await getMyRole(auth, orgId))) {
    throw new AppError("FORBIDDEN", "Sem permissão para ver convites.");
  }

  const { data, error } = await auth.supabase
    .from("invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw fromPostgrestError(error);
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function createInvitation(
  auth: AuthContext,
  orgId: string,
  { email, role }: CreateInvitationData,
): Promise<CreatedInvitation> {
  if (!canInvite(await getMyRole(auth, orgId), role)) {
    throw new AppError(
      "FORBIDDEN",
      "Você não pode convidar alguém com esse papel.",
    );
  }

  const { data, error } = await auth.supabase
    .rpc("create_invitation", { p_org_id: orgId, p_email: email, p_role: role })
    .single();

  if (error) throw fromPostgrestError(error);
  return {
    id: data.invitation_id,
    email: data.invitation_email,
    role: data.invitation_role,
    expiresAt: data.invitation_expires_at,
    token: data.token,
  };
}

export async function revokeInvitation(
  auth: AuthContext,
  orgId: string,
  invitationId: string,
): Promise<void> {
  await getMyRole(auth, orgId);
  assertUuid(invitationId, "Convite não encontrado.");

  // RLS limits managers to member invitations; a filtered-out row means 404.
  const { data, error } = await auth.supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Convite não encontrado.");
}

export async function getInvitationPreview(
  auth: AuthContext,
  token: string,
): Promise<InvitationPreview | null> {
  if (!INVITATION_TOKEN_PATTERN.test(token)) return null;

  const { data, error } = await auth.supabase
    .rpc("get_invitation", { p_token: token })
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) return null;
  return {
    organizationName: data.organization_name,
    role: data.role,
    email: data.email,
    status: data.status as InvitationStatus,
  };
}

export async function acceptInvitation(
  auth: AuthContext,
  token: string,
): Promise<{ orgId: string }> {
  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    throw new AppError("BAD_REQUEST", "Convite inválido ou expirado.");
  }

  const { data, error } = await auth.supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) throw fromPostgrestError(error);
  return { orgId: data };
}
