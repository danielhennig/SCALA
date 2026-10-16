"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const { orgId } = await apiFetch<{ orgId: string }>(
        `/api/v1/invitations/${token}/accept`,
        { method: "POST" },
      );
      router.push(`/orgs/${orgId}`);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? "Entrando…" : "Aceitar convite"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
