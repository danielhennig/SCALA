import { z } from "zod";
import { daysBetween, isIsoDate } from "@/domain/scheduling/dates";
import { isoDate } from "./schedules";

export const MAX_REPORT_DAYS = 93;

const bothDates = (from: string, to: string) =>
  isIsoDate(from) && isIsoDate(to);

export const hoursReportQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    teamId: z.uuid("Equipe inválida.").optional(),
  })
  .refine(
    ({ from, to }) => !bothDates(from, to) || daysBetween(from, to) >= 0,
    {
      message: "O fim precisa ser depois do início.",
      path: ["to"],
    },
  )
  .refine(
    ({ from, to }) =>
      !bothDates(from, to) || daysBetween(from, to) < MAX_REPORT_DAYS,
    {
      message: `O período pode ter no máximo ${MAX_REPORT_DAYS} dias.`,
      path: ["to"],
    },
  );

export type HoursReportQuery = z.output<typeof hoursReportQuerySchema>;
