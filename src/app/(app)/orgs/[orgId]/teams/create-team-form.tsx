"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { teamNameSchema } from "@/lib/validation/teams";

export function CreateTeamForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = teamNameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const team = await apiFetch<{ id: string }>(
        `/api/v1/orgs/${orgId}/teams`,
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      router.push(`/orgs/${orgId}/teams/${team.id}`);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="team-name">Nome</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="UTI Adulto"
          maxLength={80}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Criando…" : "Criar equipe"}
      </Button>
    </form>
  );
}
