"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { monthPeriod } from "@/domain/scheduling/dates";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMonth } from "@/lib/format";
import { createScheduleSchema } from "@/lib/validation/schedules";

export function CreateScheduleForm({
  orgId,
  teams,
  defaultMonth,
}: {
  orgId: string;
  teams: { id: string; name: string }[];
  /** "YYYY-MM" */
  defaultMonth: string;
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [customName, setCustomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const teamName = teams.find((t) => t.id === teamId)?.name ?? "";
  const validMonth = /^\d{4}-\d{2}$/.test(month);
  const suggestedName = validMonth
    ? `${teamName} — ${formatMonth(month)}`
    : teamName;
  const name = customName ?? suggestedName;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validMonth) {
      setError("Escolha o mês.");
      return;
    }
    const { start, end } = monthPeriod(month);
    const parsed = createScheduleSchema.safeParse({
      teamId,
      name,
      periodStart: start,
      periodEnd: end,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const schedule = await apiFetch<{ id: string }>(
        `/api/v1/orgs/${orgId}/schedules`,
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      router.push(`/orgs/${orgId}/schedules/${schedule.id}`);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="schedule-team">Equipe</Label>
          <NativeSelect
            id="schedule-team"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="schedule-month">Mês</Label>
          <Input
            id="schedule-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="schedule-name">Nome</Label>
        <Input
          id="schedule-name"
          value={name}
          onChange={(event) => setCustomName(event.target.value)}
          maxLength={80}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Criando…" : "Criar escala"}
      </Button>
    </form>
  );
}
