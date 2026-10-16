import { z } from "zod";
import { daysBetween, isIsoDate } from "@/domain/scheduling/dates";
import { TIME_OFF_KINDS } from "@/lib/time-off";
import { isoDate } from "./schedules";

export const MAX_TIME_OFF_DAYS = 366;

const bothValid = (a: string, b: string) => isIsoDate(a) && isIsoDate(b);

export const createTimeOffSchema = z
  .object({
    /** Omitted: the caller requests time off for themselves. */
    userId: z.uuid("Selecione uma pessoa.").optional(),
    kind: z.enum(TIME_OFF_KINDS, "Tipo inválido."),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine(
    ({ startDate, endDate }) =>
      !bothValid(startDate, endDate) || daysBetween(startDate, endDate) >= 0,
    {
      message: "O fim precisa ser no mesmo dia ou depois do início.",
      path: ["endDate"],
    },
  )
  .refine(
    ({ startDate, endDate }) =>
      !bothValid(startDate, endDate) ||
      daysBetween(startDate, endDate) < MAX_TIME_OFF_DAYS,
    { message: "O período pode ter no máximo 1 ano.", path: ["endDate"] },
  );

export type CreateTimeOffData = z.output<typeof createTimeOffSchema>;

export const reviewTimeOffSchema = z.object({
  status: z.enum(["approved", "rejected"], "Decisão inválida."),
});
