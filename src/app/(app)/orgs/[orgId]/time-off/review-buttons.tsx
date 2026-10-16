"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function ReviewButtons({ path }: { path: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: "approved" | "rejected") {
    setPending(true);
    setError(null);
    try {
      await apiFetch(path, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      // If approval creates conflicts with existing shifts, the list shows
      // them on the approved entry after the refresh.
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => review("approved")}>
          Aprovar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => review("rejected")}
        >
          Recusar
        </Button>
      </span>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
