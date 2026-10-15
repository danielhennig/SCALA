import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(100, "O nome pode ter no máximo 100 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O identificador precisa ter pelo menos 3 caracteres.")
    .max(50, "O identificador pode ter no máximo 50 caracteres.")
    .regex(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens."),
  timezone: z
    .string()
    .refine(isValidTimeZone, "Fuso horário inválido.")
    .default(DEFAULT_TIMEZONE),
});

/** What the form/API client sends (timezone optional). */
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
/** Validated data the service layer receives. */
export type CreateOrganizationData = z.output<typeof createOrganizationSchema>;
