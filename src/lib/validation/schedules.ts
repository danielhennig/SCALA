import { z } from "zod";
import { daysBetween, isIsoDate } from "@/domain/scheduling/dates";
import { MAX_CYCLE_DAYS } from "./scheduling";

export const MAX_PERIOD_DAYS = 62;

const isoDate = z.string().refine(isIsoDate, "Data inválida (use AAAA-MM-DD).");

export const createScheduleSchema = z
  .object({
    teamId: z.uuid("Selecione uma equipe."),
    name: z
      .string()
      .trim()
      .min(2, "O nome precisa ter pelo menos 2 caracteres.")
      .max(80, "O nome pode ter no máximo 80 caracteres."),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine(
    ({ periodStart, periodEnd }) =>
      !isIsoDate(periodStart) ||
      !isIsoDate(periodEnd) ||
      daysBetween(periodStart, periodEnd) >= 0,
    { message: "O fim precisa ser depois do início.", path: ["periodEnd"] },
  )
  .refine(
    ({ periodStart, periodEnd }) =>
      !isIsoDate(periodStart) ||
      !isIsoDate(periodEnd) ||
      daysBetween(periodStart, periodEnd) < MAX_PERIOD_DAYS,
    {
      message: `O período pode ter no máximo ${MAX_PERIOD_DAYS} dias.`,
      path: ["periodEnd"],
    },
  );

export type CreateScheduleData = z.output<typeof createScheduleSchema>;

export const renameScheduleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(80, "O nome pode ter no máximo 80 caracteres."),
});

export const generateScheduleSchema = z.object({
  patternId: z.uuid("Selecione um regime."),
  assignments: z
    .array(
      z.object({
        userId: z.uuid(),
        offset: z
          .number()
          .int()
          .min(0)
          .max(MAX_CYCLE_DAYS - 1),
      }),
    )
    .min(1, "Selecione pelo menos uma pessoa.")
    .max(500)
    .refine(
      (list) => new Set(list.map((a) => a.userId)).size === list.length,
      "A mesma pessoa aparece mais de uma vez.",
    ),
});

export type GenerateScheduleData = z.output<typeof generateScheduleSchema>;

/** One person, one day: set a shift type, or null to clear the day. */
export const setScheduleCellSchema = z.object({
  userId: z.uuid(),
  date: isoDate,
  shiftTypeId: z.uuid().nullable(),
});

export type SetScheduleCellData = z.output<typeof setScheduleCellSchema>;
