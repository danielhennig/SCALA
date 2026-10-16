"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function AddTeamMemberForm({
  path,
  candidates,
}: {
  path: string;
  candidates: { userId: string; fullName: string }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError("Selecione um membro.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setUserId("");
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
    <form onSubmit={handleSubmit} className="grid gap-2">
      <div className="flex gap-2">
        <NativeSelect
          aria-label="Membro"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">Selecione…</option>
          {candidates.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.fullName}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={pending}>
          Adicionar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
