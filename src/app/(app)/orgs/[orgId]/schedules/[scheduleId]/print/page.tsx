import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { totalMinutesByUser } from "@/domain/scheduling/analysis";
import { eachDate, weekdayOf } from "@/domain/scheduling/dates";
import { formatDuration, shiftWindowLabel } from "@/domain/scheduling/time";
import { localDate, localTime } from "@/domain/scheduling/zoned";
import { formatDate, WEEKDAY_LETTERS } from "@/lib/format";
import {
  TIME_OFF_KIND_LABELS,
  TIME_OFF_KIND_LETTERS,
  type TimeOffKind,
} from "@/lib/time-off";
import { AppError } from "@/server/errors";
import { getScheduleDetail } from "@/server/services/schedules";
import { listShiftTypes } from "@/server/services/shift-types";
import { loadOrg } from "../../../load-org";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir escala · SCALA" };

// One A4 landscape sheet: people × days. The browser's "Save as PDF" makes
// the PDF, so no server-side renderer is needed.
const PAGE_CSS = "@page { size: A4 landscape; margin: 10mm; }";

const cellKey = (userId: string, date: string) => `${userId}|${date}`;

export default function PrintSchedulePage({
  params,
}: PageProps<"/orgs/[orgId]/schedules/[scheduleId]/print">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <PrintableSchedule params={params} />
    </Suspense>
  );
}

async function PrintableSchedule({
  params,
}: {
  params: Promise<{ orgId: string; scheduleId: string }>;
}) {
  const { scheduleId } = await params;
  const { auth, orgId, organization } = await loadOrg(params);
  const timeZone = organization.timezone;

  let detail;
  try {
    detail = await getScheduleDetail(auth, orgId, scheduleId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { schedule, people, shifts, timeOff } = detail;
  const shiftTypes = await listShiftTypes(auth, orgId);

  const dates = eachDate(schedule.periodStart, schedule.periodEnd);
  const typesById = new Map(shiftTypes.map((st) => [st.id, st]));
  const shiftsByCell = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = cellKey(shift.userId, shift.date);
    shiftsByCell.set(key, [...(shiftsByCell.get(key) ?? []), shift]);
  }
  const timeOffByCell = new Map<string, TimeOffKind>();
  for (const range of timeOff) {
    for (const date of dates) {
      if (range.startDate <= date && date <= range.endDate) {
        timeOffByCell.set(cellKey(range.userId, date), range.kind);
      }
    }
  }
  const totals = totalMinutesByUser(shifts);
  const usedTypes = shiftTypes.filter((st) =>
    shifts.some((s) => s.shiftTypeId === st.id),
  );
  // Past loadOrg (session read), so reading the clock is allowed here.
  const now = new Date();

  return (
    <div className="grid gap-4 print:gap-2">
      <style>{PAGE_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/orgs/${orgId}/schedules/${schedule.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Voltar para a escala
        </Link>
        <PrintButton />
      </div>

      <header className="grid gap-0.5">
        <h2 className="text-lg font-semibold">
          {organization.name} · {schedule.name}
          {schedule.status === "draft" && (
            <span className="ml-2 rounded border px-1.5 py-0.5 align-middle text-xs font-medium">
              RASCUNHO
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground print:text-black">
          {schedule.teamName} · {formatDate(schedule.periodStart)} a{" "}
          {formatDate(schedule.periodEnd)} · {shifts.length} plantões
        </p>
      </header>

      <table
        className="w-full table-fixed border-collapse text-[10px] leading-tight"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <colgroup>
          <col className="w-28" />
          {dates.map((date) => (
            <col key={date} />
          ))}
          <col className="w-12" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="border p-1 text-left font-medium">
              Pessoa
            </th>
            {dates.map((date) => {
              const weekday = weekdayOf(date);
              return (
                <th
                  key={date}
                  scope="col"
                  className={`border p-0.5 text-center font-normal ${weekday === 0 || weekday === 6 ? "bg-muted" : ""}`}
                >
                  <div className="font-medium">{date.slice(8)}</div>
                  <div>{WEEKDAY_LETTERS[weekday]}</div>
                </th>
              );
            })}
            <th scope="col" className="border p-1 text-right font-medium">
              Horas
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.userId} className="break-inside-avoid">
              <th
                scope="row"
                className="truncate border p-1 text-left font-normal"
              >
                {person.fullName}
              </th>
              {dates.map((date) => {
                const key = cellKey(person.userId, date);
                const cellShifts = shiftsByCell.get(key) ?? [];
                const first = cellShifts[0];
                const type = first?.shiftTypeId
                  ? typesById.get(first.shiftTypeId)
                  : undefined;
                const offKind = timeOffByCell.get(key);
                const weekday = weekdayOf(date);
                return (
                  <td
                    key={date}
                    className={`border p-0 text-center font-medium ${first ? "text-white" : ""} ${!first && (weekday === 0 || weekday === 6) ? "bg-muted" : ""}`}
                    style={
                      first
                        ? { backgroundColor: type?.color ?? "#475569" }
                        : undefined
                    }
                    title={
                      first
                        ? `${type?.name ?? "Plantão"} ${localTime(first.startsAt, timeZone)}–${localTime(first.endsAt, timeZone)}`
                        : undefined
                    }
                  >
                    {first
                      ? `${type?.name[0] ?? "•"}${cellShifts.length > 1 ? "+" : ""}`
                      : offKind
                        ? TIME_OFF_KIND_LETTERS[offKind]
                        : ""}
                  </td>
                );
              })}
              <td className="border p-1 text-right tabular-nums">
                {formatDuration(totals.get(person.userId) ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-[10px]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {usedTypes.map((st) => (
            <li key={st.id} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-flex size-3.5 items-center justify-center rounded-sm font-medium text-white"
                style={{
                  backgroundColor: st.color,
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              >
                {st.name[0]}
              </span>
              {st.name} ({shiftWindowLabel(st.startTime, st.durationMinutes)})
            </li>
          ))}
          {[...new Set(timeOffByCell.values())].map((kind) => (
            <li key={kind}>
              {TIME_OFF_KIND_LETTERS[kind]} = {TIME_OFF_KIND_LABELS[kind]}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground print:text-black">
          Gerado em {formatDate(localDate(now, timeZone))} às{" "}
          {localTime(now, timeZone)} · SCALA
        </p>
      </footer>
    </div>
  );
}
