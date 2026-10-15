import { z } from "zod";

// Must match auth.minimum_password_length in supabase/config.toml and the
// remote project's Auth settings.
export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Informe seu nome.")
    .max(120, "O nome pode ter no máximo 120 caracteres."),
  email: z.email("E-mail inválido."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    ),
});
