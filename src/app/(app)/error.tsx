"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta página.
        {error.digest && <> Código: {error.digest}</>}
      </p>
      <Button variant="outline" onClick={() => retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}
