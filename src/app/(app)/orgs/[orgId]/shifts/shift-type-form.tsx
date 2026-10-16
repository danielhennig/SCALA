"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { shiftWindowLabel } from "@/domain/scheduling/time";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { SHIFT_COLORS, shiftTypeSchema } from "@/lib/validation/scheduling";

export type ShiftTypeValues = {
  id?: string;
  name: string;
  startTime: string;
  durationMinutes: number;
  color: string;
};

const MINUTE_OPTIONS = [0, 15, 30, 45];

export function ShiftTypeForm({
  orgId,
  initial,
  onDone,
}: {
  orgId: string;
  /** Present when editing an existing shift type. */
  initial?: ShiftTypeValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "07:00");
  const [hours, setHours] = useState(
    initial ? Math.floor(initial.durationMinutes / 60) : 12,
  );
  const [minutes, setMinutes] = useState(
    initial ? initial.durationMinutes % 60 : 0,
  );
  const [color, setColor] = useState<string>(initial?.color ?? SHIFT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const durationMinutes = hours * 60 + minutes;
  const idPrefix = initial?.id ?? "new";
  const parsed = shiftTypeSchema.safeParse({
    name,
    startTime,
    durationMinutes,
    color,
  });
  const preview =
    /^\d{2}:\d{2}$/.test(startTime) &&
    durationMinutes >= 15 &&
    durationMinutes <= 1440
      ? shiftWindowLabel(startTime, durationMinutes)
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(
        initial?.id
          ? `/api/v1/orgs/${orgId}/shift-types/${initial.id}`
          : `/api/v1/orgs/${orgId}/shift-types`,
        {
          method: initial?.id ? "PATCH" : "POST",
          body: JSON.stringify(parsed.data),
        },
      );
      if (!initial) setName("");
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Nome</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Diurno"
          maxLength={60}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-start`}>Início</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="w-28"
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Duração</legend>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Horas"
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">h</span>
            <NativeSelect
              aria-label="Minutos"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="w-20"
            >
              {MINUTE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {String(option).padStart(2, "0")}
                </option>
              ))}
            </NativeSelect>
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </fieldset>
      </div>

      {preview && (
        <p className="text-sm text-muted-foreground">Horário: {preview}</p>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {SHIFT_COLORS.map((option) => (
            <label key={option} className="cursor-pointer">
              <input
                type="radio"
                name={`${idPrefix}-color`}
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
                className="peer sr-only"
              />
              <span
                className="block size-7 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                style={{ backgroundColor: option }}
              />
              <span className="sr-only">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : initial ? "Salvar" : "Criar tipo de turno"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
