import { z } from "zod";
import { ORG_ROLES } from "@/lib/roles";

export const roleSchema = z.enum(ORG_ROLES, "Papel inválido.");

export const updateMemberRoleSchema = z.object({ role: roleSchema });

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mail muito longo.")
    .pipe(z.email("E-mail inválido.")),
  role: roleSchema.default("member"),
});

export type CreateInvitationInput = z.input<typeof createInvitationSchema>;
export type CreateInvitationData = z.output<typeof createInvitationSchema>;

/** Invitation tokens are 32 random bytes, hex-encoded. */
export const INVITATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
