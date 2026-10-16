"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

type Props = {
  path: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Asks for confirmation before calling the API. */
  confirmMessage?: string;
  /** Navigate here on success; otherwise the current route is refreshed. */
  redirectTo?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  children: React.ReactNode;
};

/** A button that calls one /api/v1 endpoint and refreshes server data. */
export function ApiActionButton({
  path,
  method = "DELETE",
  body,
  confirmMessage,
  redirectTo,
  variant = "outline",
  size = "sm",
  children,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (redirectTo) router.push(redirectTo);
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
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={pending}
      >
        {children}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
