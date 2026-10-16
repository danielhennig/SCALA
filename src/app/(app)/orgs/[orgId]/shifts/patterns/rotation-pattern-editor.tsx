"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CycleStrip } from "@/components/cycle-strip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  averageWeeklyHours,
  type CycleDay,
  minimumRestMinutes,
  ROTATION_PRESETS,
} from "@/domain/scheduling/cycle";
import { formatDuration } from "@/domain/scheduling/time";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import {
  MAX_CYCLE_DAYS,
  rotationPatternSchema,
} from "@/lib/validation/scheduling";

type ShiftTypeOption = {
  id: string;
  name: string;
  color: string;
  startTime: string;
  durationMinutes: number;
};

const hoursFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

export function RotationPatternEditor({
  orgId,
  shiftTypes,
  minRestHours,
  initial,
}: {
  orgId: string;
  shiftTypes: ShiftTypeOption[];
  minRestHours: number;
  /** Present when editing. */
  initial?: { id: string; name: string; days: CycleDay<string>[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [days, setDays] = useState<CycleDay<string>[]>(
    initial?.days ?? [shiftTypes[0]?.id ?? null, null],
  );
  const [presetShiftTypeId, setPresetShiftTypeId] = useState(
    shiftTypes[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const byId = new Map(shiftTypes.map((st) => [st.id, st]));
  const resolved = days.map((id) => (id ? (byId.get(id) ?? null) : null));
  const weeklyHours = averageWeeklyHours(resolved);
  const minRest = minimumRestMinutes(resolved);

  function resize(length: number) {
    const clamped = Math.min(Math.max(length, 1), MAX_CYCLE_DAYS);
    setDays((current) =>
      clamped <= current.length
        ? current.slice(0, clamped)
        : [...current, ...Array(clamped - current.length).fill(null)],
    );
  }

  function setDay(index: number, value: string) {
    setDays((current) =>
      current.map((day, i) => (i === index ? value || null : day)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = rotationPatternSchema.safeParse({ name, days });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(
        initial
          ? `/api/v1/orgs/${orgId}/rotation-patterns/${initial.id}`
          : `/api/v1/orgs/${orgId}/rotation-patterns`,
        { method: initial ? "PUT" : "POST", body: JSON.stringify(parsed.data) },
      );
      router.push(`/orgs/${orgId}/shifts`);
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-2xl gap-6" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="pattern-name">Nome</Label>
        <Input
          id="pattern-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="12x36 diurno"
          maxLength={60}
        />
      </div>

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          Começar de um modelo
        </legend>
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="preset-shift">Turno usado nos dias de trabalho</Label>
          <NativeSelect
            id="preset-shift"
            value={presetShiftTypeId}
            onChange={(event) => setPresetShiftTypeId(event.target.value)}
          >
            {shiftTypes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({formatDuration(st.durationMinutes)})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROTATION_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              title={preset.description}
              onClick={() => {
                setDays(preset.build(presetShiftTypeId || null));
                if (!name) setName(preset.label);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          O modelo substitui o ciclo abaixo; depois você pode ajustar dia a dia.
        </p>
      </fieldset>

      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <Label htmlFor="cycle-length">Dias no ciclo</Label>
          <Input
            id="cycle-length"
            type="number"
            min={1}
            max={MAX_CYCLE_DAYS}
            value={days.length}
            onChange={(event) => resize(Number(event.target.value))}
            className="w-20"
          />
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {days.map((day, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-sm text-muted-foreground">
                Dia {index + 1}
              </span>
              <NativeSelect
                aria-label={`Dia ${index + 1}`}
                value={day ?? ""}
                onChange={(event) => setDay(index, event.target.value)}
              >
                <option value="">Folga</option>
                {shiftTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </NativeSelect>
            </li>
          ))}
        </ol>
      </div>

      <section
        className="grid gap-2 rounded-lg bg-muted p-4"
        aria-live="polite"
      >
        <CycleStrip days={resolved} />
        <p className="text-sm">
          Média de <strong>{hoursFormat.format(weeklyHours)} h/semana</strong>
          {minRest !== null && (
            <>
              {" "}
              · menor descanso entre plantões:{" "}
              <strong>
                {minRest < 0
                  ? `sobreposição de ${formatDuration(-minRest)}`
                  : formatDuration(minRest)}
              </strong>
            </>
          )}
        </p>
        {minRest !== null && minRest < minRestHours * 60 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {minRest < 0
              ? "Há plantões que se sobrepõem neste ciclo."
              : `Abaixo do descanso mínimo da organização (${minRestHours} h).`}{" "}
            Você pode salvar mesmo assim.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : initial ? "Salvar regime" : "Criar regime"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/orgs/${orgId}/shifts`)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
