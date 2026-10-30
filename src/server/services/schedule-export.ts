import "server-only";
import { localDate, localTime } from "@/domain/scheduling/zoned";
import { toCsv } from "@/lib/csv";
import { formatDate, formatWeekday } from "@/lib/format";
import { slugify } from "@/lib/slug";
import type { AuthContext } from "../auth";
import { getMyOrganization } from "./organizations";
import { getScheduleDetail } from "./schedules";
import { listShiftTypes } from "./shift-types";

const hours = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * One row per shift, in the organization's time zone, for spreadsheets.
 * Visibility follows the schedule page (RLS: members only see published
 * schedules of their teams).
 */
export async function exportScheduleCsv(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
): Promise<{ filename: string; csv: string }> {
  const [{ organization }, { schedule, people, shifts }, shiftTypes] =
    await Promise.all([
      getMyOrganization(auth, orgId),
      getScheduleDetail(auth, orgId, scheduleId),
      listShiftTypes(auth, orgId),
    ]);
  const timeZone = organization.timezone;
  const names = new Map(people.map((p) => [p.userId, p.fullName]));
  const types = new Map(shiftTypes.map((st) => [st.id, st.name]));
  const dateTime = (instant: string) =>
    `${formatDate(localDate(instant, timeZone))} ${localTime(instant, timeZone)}`;

  const rows = [...shifts]
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        (names.get(a.userId) ?? "").localeCompare(
          names.get(b.userId) ?? "",
          "pt-BR",
        ),
    )
    .map((shift) => [
      formatDate(shift.date),
      formatWeekday(shift.date),
      names.get(shift.userId) ?? "Ex-membro",
      (shift.shiftTypeId && types.get(shift.shiftTypeId)) || "Plantão",
      dateTime(shift.startsAt),
      dateTime(shift.endsAt),
      hours.format(
        (new Date(shift.endsAt).getTime() -
          new Date(shift.startsAt).getTime()) /
          3_600_000,
      ),
    ]);

  return {
    filename: `escala-${slugify(schedule.name) || "plantoes"}.csv`,
    csv: toCsv([
      ["Data", "Dia", "Pessoa", "Turno", "Início", "Fim", "Horas"],
      ...rows,
    ]),
  };
}
