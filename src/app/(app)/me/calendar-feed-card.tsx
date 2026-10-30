"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const PATH = "/api/v1/me/calendar-feed";

/**
 * Subscribe "Minha escala" in Google/Apple/Outlook. The feed URL is shown
 * only right after it's generated (the server keeps just a hash).
 */
export function CalendarFeedCard({
  activeSince,
}: {
  /** Local date the current URL was generated, or null without a feed. */
  activeSince: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  const generate = () => {
    if (
      activeSince &&
      !window.confirm(
        "Gerar um novo link? O link atual para de funcionar e será preciso assinar de novo no calendário.",
      )
    ) {
      return;
    }
    return run(async () => {
      const feed = await apiFetch<{ url: string }>(PATH, { method: "POST" });
      setUrl(feed.url);
      setCopied(false);
    });
  };

  const revoke = () => {
    if (
      !window.confirm(
        "Desativar o link? Os calendários que o assinaram deixam de receber seus plantões.",
      )
    ) {
      return;
    }
    return run(async () => {
      await apiFetch(PATH, { method: "DELETE" });
      setUrl(null);
    });
  };

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(
        "Não foi possível copiar. Selecione o link e copie manualmente.",
      );
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 className="font-medium">Assinar no calendário</h2>
        <p className="text-sm text-muted-foreground">
          Seus plantões publicados aparecem no Google Agenda, no calendário do
          celular ou no Outlook, e se atualizam sozinhos quando a escala muda.
        </p>
      </div>

      {url ? (
        <div
          role="status"
          className="grid gap-2 rounded-lg bg-muted p-3 text-sm"
        >
          <p>
            Este link só aparece agora. Quem tiver o link vê seus plantões,
            então não o compartilhe.
          </p>
          <Input readOnly value={url} onFocus={(e) => e.target.select()} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copy}
            className="justify-self-start"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>
              <strong>Google Agenda</strong> (no computador): Outras agendas → +
              → Do URL → cole o link. O Google atualiza a cada poucas horas.
            </li>
            <li>
              <strong>iPhone</strong>: Ajustes → Calendário → Contas → Adicionar
              Conta → Outra → Adicionar Calendário Assinado.
            </li>
            <li>
              <strong>Outlook</strong>: Adicionar calendário → Assinar da web.
            </li>
          </ul>
        </div>
      ) : (
        activeSince && (
          <p className="text-sm">
            Link ativo desde {formatDate(activeSince)}. Perdeu o link? Gere um
            novo (o atual deixa de funcionar).
          </p>
        )
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeSince ? "outline" : "default"}
          disabled={pending}
          onClick={generate}
        >
          {activeSince ? "Gerar novo link" : "Gerar link do calendário"}
        </Button>
        {activeSince && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={revoke}
          >
            Desativar
          </Button>
        )}
      </div>
    </section>
  );
}
