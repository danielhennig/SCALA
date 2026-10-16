"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  findRestViolations,
  totalMinutesByUser,
} from "@/domain/scheduling/analysis";
import { weekdayOf } from "@/domain/scheduling/dates";
import { formatDuration } from "@/domain/scheduling/time";
import { localDate, localTime } from "@/domain/scheduling/zoned";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import {
  formatShortDate,
  formatWeekdayDate,
  WEEKDAY_LETTERS,
} from "@/lib/format";

type ShiftTypeOption = { id: string; name: string; color: string };

type GridShift = {
  id: string;
  userId: string;
  shiftTypeId: string | null;
  startsAt: string;
  endsAt: string;
  date: string;
};

type Person = { userId: string; fullName: string; inTeam: boolean };

const cellKey = (userId: string, date: string) => `${userId}|${date}`;

export function ScheduleGrid({
  orgId,
  scheduleId,
  dates,
  people,
  shifts,
  shiftTypes,
  canEdit,
  minRestHours,
  timeZone,
}: {
  orgId: string;
  scheduleId: string;
  dates: string[];
  people: Person[];
  shifts: GridShift[];
  shiftTypes: ShiftTypeOption[];
  canEdit: boolean;
  minRestHours: number;
  timeZone: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    userId: string;
    date: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typesById = new Map(shiftTypes.map((st) => [st.id, st]));
  const namesById = new Map(people.map((p) => [p.userId, p.fullName]));
  const shiftsByCell = new Map<string, GridShift[]>();
  for (const shift of shifts) {
    const key = cellKey(shift.userId, shift.date);
    shiftsByCell.set(key, [...(shiftsByCell.get(key) ?? []), shift]);
  }

  const violations = findRestViolations(shifts, minRestHours * 60);
  const flagged = new Set(
    violations.flatMap((v) => [
      cellKey(v.userId, v.before.date),
      cellKey(v.userId, v.after.date),
    ]),
  );
  const totals = totalMinutesByUser(shifts);

  async function apply(shiftTypeId: string | null) {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/orgs/${orgId}/schedules/${scheduleId}/cells`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, shiftTypeId }),
      });
      router.refresh();
      // Move to the next day for fast data entry.
      const next = dates[dates.indexOf(selected.date) + 1];
      setSelected(next ? { userId: selected.userId, date: next } : null);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  const describe = (shift: GridShift) => {
    const type = shift.shiftTypeId ? typesById.get(shift.shiftTypeId) : null;
    return `${type?.name ?? "Plantão"} ${localTime(shift.startsAt, timeZone)}–${localTime(shift.endsAt, timeZone)}`;
  };

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ninguém na equipe ainda. Adicione pessoas à equipe para montar a escala.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {canEdit && (
        <div
          className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border bg-background p-2"
          aria-live="polite"
        >
          {selected ? (
            <>
              <span className="mr-2 text-sm">
                <strong>{namesById.get(selected.userId)}</strong> ·{" "}
                {formatWeekdayDate(selected.date)}
              </span>
              {shiftTypes.map((st) => (
                <Button
                  key={st.id}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => apply(st.id)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: st.color }}
                  />
                  {st.name}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => apply(null)}
              >
                Folga
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                Fechar
              </Button>
              {error && (
                <span role="alert" className="text-sm text-destructive">
                  {error}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Clique em um dia da grade para escalar ou dar folga.
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-36 bg-background p-2 text-left font-medium"
              >
                Pessoa
              </th>
              {dates.map((date) => {
                const weekday = weekdayOf(date);
                return (
                  <th
                    key={date}
                    scope="col"
                    className={cn(
                      "min-w-9 p-1 text-center font-normal",
                      (weekday === 0 || weekday === 6) && "bg-muted",
                    )}
                  >
                    <div className="font-medium">{date.slice(8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {WEEKDAY_LETTERS[weekday]}
                    </div>
                  </th>
                );
              })}
              <th scope="col" className="p-2 text-right font-medium">
                Horas
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.userId} className="border-t">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-44 truncate bg-background p-2 text-left font-normal"
                >
                  {person.fullName}
                  {!person.inTeam && (
                    <span className="block text-xs text-muted-foreground">
                      fora da equipe
                    </span>
                  )}
                </th>
                {dates.map((date) => {
                  const key = cellKey(person.userId, date);
                  const cellShifts = shiftsByCell.get(key) ?? [];
                  const first = cellShifts[0];
                  const type = first?.shiftTypeId
                    ? typesById.get(first.shiftTypeId)
                    : undefined;
                  const isSelected =
                    selected?.userId === person.userId &&
                    selected.date === date;
                  const label = `${person.fullName}, ${formatWeekdayDate(date)}: ${
                    cellShifts.length
                      ? cellShifts.map(describe).join(", ")
                      : "folga"
                  }`;
                  const weekday = weekdayOf(date);
                  const box = (
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded text-xs font-medium",
                        first ? "text-white" : "text-muted-foreground",
                        flagged.has(key) && "ring-2 ring-amber-500",
                        isSelected &&
                          "outline-2 outline-offset-1 outline-foreground",
                      )}
                      style={
                        first
                          ? { backgroundColor: type?.color ?? "#475569" }
                          : undefined
                      }
                    >
                      {first ? (type?.name[0] ?? "•") : "·"}
                      {cellShifts.length > 1 && "+"}
                    </span>
                  );
                  return (
                    <td
                      key={date}
                      className={cn(
                        "p-0.5 text-center",
                        (weekday === 0 || weekday === 6) && "bg-muted/50",
                      )}
                    >
                      {canEdit ? (
                        <button
                          type="button"
                          title={label}
                          aria-label={label}
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelected({ userId: person.userId, date })
                          }
                          className="rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {box}
                        </button>
                      ) : (
                        <span
                          title={label}
                          aria-label={label}
                          className="inline-block"
                        >
                          {box}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="p-2 text-right tabular-nums">
                  {formatDuration(totals.get(person.userId) ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {shiftTypes.map((st) => (
          <li key={st.id} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: st.color }}
            />
            {st.name}
          </li>
        ))}
      </ul>

      {violations.length > 0 && (
        <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="font-medium">
            Descanso abaixo de {minRestHours} h ({violations.length})
          </h3>
          <ul className="grid gap-1">
            {violations.map((v) => (
              <li key={`${v.before.id}-${v.after.id}`}>
                {namesById.get(v.userId)}:{" "}
                {v.restMinutes < 0
                  ? `plantões sobrepostos`
                  : `${formatDuration(v.restMinutes)} de descanso`}{" "}
                entre {formatShortDate(localDate(v.before.endsAt, timeZone))}{" "}
                {localTime(v.before.endsAt, timeZone)} e{" "}
                {formatShortDate(v.after.date)}{" "}
                {localTime(v.after.startsAt, timeZone)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
