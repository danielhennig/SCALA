import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { addDays } from "@/domain/scheduling/dates";
import { formatDuration } from "@/domain/scheduling/time";
import { localDate, localTime } from "@/domain/scheduling/zoned";
import { formatWeekdayDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listMyShifts, type MyShift } from "@/server/services/me";

export const metadata: Metadata = { title: "Minha escala · SCALA" };

const HOUR_MS = 60 * 60 * 1000;
const DAYS_AHEAD = 30;

export default function MyShiftsPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Minha escala</h1>
        <p className="text-sm text-muted-foreground">
          Seus plantões publicados nos próximos {DAYS_AHEAD} dias, em todas as
          organizações.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
      >
        <UpcomingShifts />
      </Suspense>
    </div>
  );
}

async function UpcomingShifts() {
  const auth = await requireUser();
  const now = new Date();
  const shifts = (
    await listMyShifts(auth, {
      from: new Date(now.getTime() - 24 * HOUR_MS),
      to: new Date(now.getTime() + DAYS_AHEAD * 24 * HOUR_MS),
    })
  ).filter((shift) => new Date(shift.endsAt) > now); // drop finished ones

  if (shifts.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Nenhum plantão publicado para você nos próximos {DAYS_AHEAD} dias. Se
        você esperava ver algo aqui, a escala pode ainda estar em rascunho.{" "}
        <Link href="/orgs" className="underline">
          Ver organizações
        </Link>
      </p>
    );
  }

  const totalMinutes = shifts.reduce(
    (sum, s) =>
      sum +
      (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60_000,
    0,
  );

  // Group by the local date each shift starts on (in its org's time zone).
  const groups = new Map<string, MyShift[]>();
  for (const shift of shifts) {
    const date = localDate(shift.startsAt, shift.timeZone);
    groups.set(date, [...(groups.get(date) ?? []), shift]);
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm">
        <strong>{shifts.length}</strong>{" "}
        {shifts.length === 1 ? "plantão" : "plantões"} ·{" "}
        <strong>{formatDuration(totalMinutes)}</strong> no período
      </p>
      {[...groups.entries()].map(([date, dayShifts]) => (
        <section key={date} className="grid gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {dayLabel(date, dayShifts[0].timeZone, now)}
          </h2>
          <ul className="grid gap-2">
            {dayShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                now={now}
                isNext={shift.id === shifts[0].id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function dayLabel(date: string, timeZone: string, now: Date) {
  const today = localDate(now, timeZone);
  if (date === today) return "Hoje";
  if (date === addDays(today, 1)) return "Amanhã";
  return formatWeekdayDate(date);
}

function ShiftCard({
  shift,
  now,
  isNext,
}: {
  shift: MyShift;
  now: Date;
  isNext: boolean;
}) {
  const inProgress = new Date(shift.startsAt) <= now;
  const endsNextDay =
    localDate(shift.endsAt, shift.timeZone) !==
    localDate(shift.startsAt, shift.timeZone);

  return (
    <li
      className={`flex overflow-hidden rounded-lg border ${isNext ? "ring-2 ring-foreground/20" : ""}`}
    >
      <span
        aria-hidden="true"
        className="w-1.5 shrink-0"
        style={{ backgroundColor: shift.color ?? "#475569" }}
      />
      <div className="grid flex-1 gap-1 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {localTime(shift.startsAt, shift.timeZone)} –{" "}
            {localTime(shift.endsAt, shift.timeZone)}
            {endsNextDay && (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                (+1)
              </span>
            )}
          </span>
          {inProgress ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              Agora
            </span>
          ) : (
            isNext && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                Próximo
              </span>
            )
          )}
        </div>
        <div className="text-sm">{shift.shiftTypeName ?? "Plantão"}</div>
        <div className="text-sm text-muted-foreground">
          {shift.orgName} · {shift.teamName} ·{" "}
          <Link
            href={`/orgs/${shift.orgId}/schedules/${shift.scheduleId}`}
            className="underline-offset-4 hover:underline"
          >
            {shift.scheduleName}
          </Link>
        </div>
      </div>
    </li>
  );
}
