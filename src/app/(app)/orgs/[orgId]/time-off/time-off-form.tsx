"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import {
  TIME_OFF_KIND_LABELS,
  TIME_OFF_KINDS,
  type TimeOffKind,
} from "@/lib/time-off";
import { createTimeOffSchema } from "@/lib/validation/time-off";

export function TimeOffForm({
  orgId,
  members,
  defaultDate,
}: {
  orgId: string;
  /** Managers pick the person; null for members (request for themselves). */
  members: { userId: string; fullName: string }[] | null;
  defaultDate: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(members?.[0]?.userId ?? "");
  const [kind, setKind] = useState<TimeOffKind>("vacation");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    const parsed = createTimeOffSchema.safeParse({
      ...(members ? { userId } : {}),
      kind,
      startDate,
      endDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/orgs/${orgId}/time-off`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setSuccess(
        members
          ? "Afastamento registrado."
          : "Pedido enviado. Um gestor vai aprovar ou recusar.",
      );
      router.refresh();
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
      {members && (
        <div className="grid gap-2">
          <Label htmlFor="time-off-person">Pessoa</Label>
          <NativeSelect
            id="time-off-person"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.fullName}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="time-off-kind">Tipo</Label>
        <NativeSelect
          id="time-off-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as TimeOffKind)}
        >
          {TIME_OFF_KINDS.map((option) => (
            <option key={option} value={option}>
              {TIME_OFF_KIND_LABELS[option]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="time-off-start">Início</Label>
          <Input
            id="time-off-start"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (event.target.value > endDate) setEndDate(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="time-off-end">Fim (inclusive)</Label>
          <Input
            id="time-off-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Não é preciso informar o motivo. Não registre diagnósticos ou detalhes
        de saúde.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {success}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Enviando…" : members ? "Registrar" : "Pedir afastamento"}
      </Button>
    </form>
  );
}
