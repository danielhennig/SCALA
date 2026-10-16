"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CycleStrip } from "@/components/cycle-strip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { CycleDay } from "@/domain/scheduling/cycle";
import { suggestOffsets } from "@/domain/scheduling/generate";
import { ApiClientError, apiFetch } from "@/lib/api-client";

type ShiftTypeOption = {
  id: string;
  name: string;
  color: string;
  startTime: string;
  durationMinutes: number;
};

type PatternOption = { id: string; name: string; days: CycleDay<string>[] };

type Person = { userId: string; fullName: string };

function initialRows(people: Person[], cycleLength: number) {
  return new Map(
    suggestOffsets(
      people.map((p) => p.userId),
      cycleLength,
    ).map(({ userId, offset }) => [userId, { include: true, offset }]),
  );
}

export function GeneratePanel({
  orgId,
  scheduleId,
  patterns,
  shiftTypes,
  people,
  hasShifts,
}: {
  orgId: string;
  scheduleId: string;
  patterns: PatternOption[];
  shiftTypes: ShiftTypeOption[];
  /** Team members (default rows). */
  people: Person[];
  hasShifts: boolean;
}) {
  const router = useRouter();
  const [patternId, setPatternId] = useState(patterns[0]?.id ?? "");
  const pattern = patterns.find((p) => p.id === patternId);
  const cycleLength = pattern?.days.length ?? 1;
  const [rows, setRows] = useState(() => initialRows(people, cycleLength));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const byId = new Map(shiftTypes.map((st) => [st.id, st]));
  const cycle = (pattern?.days ?? []).map((id) =>
    id ? (byId.get(id) ?? null) : null,
  );

  function choosePattern(id: string) {
    setPatternId(id);
    const length = patterns.find((p) => p.id === id)?.days.length ?? 1;
    setRows(initialRows(people, length));
  }

  function updateRow(
    userId: string,
    change: Partial<{ include: boolean; offset: number }>,
  ) {
    setRows((current) => {
      const next = new Map(current);
      next.set(userId, { ...current.get(userId)!, ...change });
      return next;
    });
  }

  async function handleGenerate() {
    const assignments = people
      .filter((p) => rows.get(p.userId)?.include)
      .map((p) => ({ userId: p.userId, offset: rows.get(p.userId)!.offset }));
    if (assignments.length === 0) {
      setError("Selecione pelo menos uma pessoa.");
      return;
    }
    if (
      hasShifts &&
      !window.confirm(
        "Gerar substitui TODOS os plantões atuais desta escala. Continuar?",
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/orgs/${orgId}/schedules/${scheduleId}/generate`, {
        method: "POST",
        body: JSON.stringify({ patternId, assignments }),
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  if (patterns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crie um regime em{" "}
        <a href={`/orgs/${orgId}/shifts`} className="underline">
          Turnos e regimes
        </a>{" "}
        para gerar a escala automaticamente.
      </p>
    );
  }

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Adicione pessoas à equipe para gerar a escala.
      </p>
    );
  }

  return (
    <details className="group rounded-lg border p-4" open={!hasShifts}>
      <summary className="cursor-pointer font-medium">
        Gerar pelo regime
      </summary>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="generate-pattern">Regime</Label>
          <NativeSelect
            id="generate-pattern"
            value={patternId}
            onChange={(event) => choosePattern(event.target.value)}
          >
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <CycleStrip days={cycle} />

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Quem entra e em que dia do ciclo começa
          </legend>
          <p className="text-xs text-muted-foreground">
            O &quot;dia do ciclo&quot; é onde a pessoa está no primeiro dia da
            escala. Em 12x36, dias diferentes formam as turmas A e B.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {people.map((person) => {
              const row = rows.get(person.userId) ?? {
                include: true,
                offset: 0,
              };
              return (
                <li key={person.userId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`gen-${person.userId}`}
                    checked={row.include}
                    onChange={(event) =>
                      updateRow(person.userId, {
                        include: event.target.checked,
                      })
                    }
                    className="size-4"
                  />
                  <label
                    htmlFor={`gen-${person.userId}`}
                    className="min-w-0 flex-1 truncate text-sm"
                  >
                    {person.fullName}
                  </label>
                  <NativeSelect
                    aria-label={`Dia do ciclo de ${person.fullName}`}
                    value={row.offset}
                    disabled={!row.include}
                    onChange={(event) =>
                      updateRow(person.userId, {
                        offset: Number(event.target.value),
                      })
                    }
                    className="w-40"
                  >
                    {cycle.map((day, index) => (
                      <option key={index} value={index}>
                        Dia {index + 1} ({day ? day.name : "folga"})
                      </option>
                    ))}
                  </NativeSelect>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="justify-self-start"
        >
          {pending ? "Gerando…" : hasShifts ? "Gerar de novo" : "Gerar escala"}
        </Button>
      </div>
    </details>
  );
}
