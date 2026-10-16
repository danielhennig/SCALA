import { z } from "zod";

export const MAX_CYCLE_DAYS = 28;

/** Palette offered in the UI; any #rrggbb is accepted by the API and DB. */
export const SHIFT_COLORS = [
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#f59e0b",
  "#16a34a",
  "#0d9488",
  "#475569",
] as const;

const nameSchema = z
  .string()
  .trim()
  .min(2, "O nome precisa ter pelo menos 2 caracteres.")
  .max(60, "O nome pode ter no máximo 60 caracteres.");

export const shiftTypeSchema = z.object({
  name: nameSchema,
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM)."),
  durationMinutes: z
    .number("Informe a duração.")
    .int("A duração precisa ser em minutos inteiros.")
    .min(15, "A duração mínima é 15 minutos.")
    .max(1440, "A duração máxima é 24 horas."),
  color: z
    .string()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "Cor inválida."),
});

export type ShiftTypeData = z.output<typeof shiftTypeSchema>;

export const rotationPatternSchema = z.object({
  name: nameSchema,
  /** One entry per cycle day: shift type id, or null for a day off. */
  days: z
    .array(z.uuid("Tipo de turno inválido.").nullable())
    .min(1, "O ciclo precisa ter pelo menos 1 dia.")
    .max(MAX_CYCLE_DAYS, `O ciclo pode ter no máximo ${MAX_CYCLE_DAYS} dias.`)
    .refine(
      (days) => days.some((day) => day !== null),
      "O ciclo precisa de pelo menos um dia de trabalho.",
    ),
});

export type RotationPatternData = z.output<typeof rotationPatternSchema>;
