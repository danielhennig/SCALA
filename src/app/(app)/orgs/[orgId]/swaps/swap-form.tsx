"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiClientError, apiFetch } from "@/lib/api-client";

type Option = { id: string; label: string };

export function SwapForm({
  orgId,
  myShifts,
  colleagues,
  colleagueShifts,
  preselectedShiftId,
}: {
  orgId: string;
  myShifts: Option[];
  colleagues: { userId: string; fullName: string }[];
  /** Colleagues' future shifts the viewer can see (for exchanges). */
  colleagueShifts: (Option & { userId: string })[];
  preselectedShiftId?: string;
}) {
  const router = useRouter();
  const [offeredShiftId, setOfferedShiftId] = useState(
    myShifts.some((s) => s.id === preselectedShiftId)
      ? preselectedShiftId!
      : (myShifts[0]?.id ?? ""),
  );
  const [targetId, setTargetId] = useState(colleagues[0]?.userId ?? "");
  const [mode, setMode] = useState<"cover" | "exchange">("cover");
  const [requestedShiftId, setRequestedShiftId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const targetShifts = colleagueShifts.filter((s) => s.userId === targetId);

  if (myShifts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Você não tem plantões futuros em escalas publicadas desta organização.
      </p>
    );
  }
  if (colleagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Não há outros membros para trocar.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (mode === "exchange" && !requestedShiftId) {
      setError("Escolha o plantão do colega.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/orgs/${orgId}/swaps`, {
        method: "POST",
        body: JSON.stringify({
          offeredShiftId,
          targetId,
          requestedShiftId: mode === "exchange" ? requestedShiftId : null,
        }),
      });
      setSuccess(
        "Pedido enviado. O colega precisa aceitar e depois um gestor aprova.",
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
      <div className="grid gap-2">
        <Label htmlFor="swap-offered">Seu plantão</Label>
        <NativeSelect
          id="swap-offered"
          value={offeredShiftId}
          onChange={(event) => setOfferedShiftId(event.target.value)}
        >
          {myShifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="swap-target">Colega</Label>
        <NativeSelect
          id="swap-target"
          value={targetId}
          onChange={(event) => {
            setTargetId(event.target.value);
            setRequestedShiftId("");
          }}
        >
          {colleagues.map((colleague) => (
            <option key={colleague.userId} value={colleague.userId}>
              {colleague.fullName}
            </option>
          ))}
        </NativeSelect>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Tipo</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="swap-mode"
            checked={mode === "cover"}
            onChange={() => setMode("cover")}
          />
          Cobertura: o colega assume meu plantão
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="swap-mode"
            checked={mode === "exchange"}
            onChange={() => setMode("exchange")}
          />
          Troca: fico com um plantão do colega
        </label>
      </fieldset>

      {mode === "exchange" && (
        <div className="grid gap-2">
          <Label htmlFor="swap-requested">Plantão do colega</Label>
          {targetShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você não vê plantões futuros desse colega (ele pode ser de outra
              equipe). Peça cobertura ou escolha outro colega.
            </p>
          ) : (
            <NativeSelect
              id="swap-requested"
              value={requestedShiftId}
              onChange={(event) => setRequestedShiftId(event.target.value)}
            >
              <option value="">Selecione…</option>
              {targetShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      )}

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
        {pending ? "Enviando…" : "Enviar pedido"}
      </Button>
    </form>
  );
}
