import { z } from "zod";

export const teamNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(80, "O nome pode ter no máximo 80 caracteres."),
});

export type TeamNameData = z.output<typeof teamNameSchema>;

export const addTeamMemberSchema = z.object({
  userId: z.uuid("Selecione um membro."),
});
