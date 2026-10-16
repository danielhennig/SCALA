import type { Metadata } from "next";
import { Suspense } from "react";
import { canManageMembers } from "@/lib/roles";
import { listAuditEntries, MAX_AUDIT_EVENTS } from "@/server/services/audit";
import { loadOrg } from "../load-org";

export const metadata: Metadata = { title: "Auditoria · SCALA" };

export default function AuditPage({
  params,
}: PageProps<"/orgs/[orgId]/audit">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <AuditSection params={params} />
    </Suspense>
  );
}

async function AuditSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);

  if (!canManageMembers(role)) {
    return (
      <p className="text-sm">Apenas administradores podem ver a auditoria.</p>
    );
  }

  const entries = await listAuditEntries(auth, orgId);
  const formatTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: organization.timezone,
  });

  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Auditoria</h2>
        <p className="text-sm text-muted-foreground">
          Quem mudou o quê, registrado pelo banco de dados. Últimos{" "}
          {MAX_AUDIT_EVENTS} registros; ninguém consegue editar ou apagar este
          histórico pelo sistema.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <li key={entry.key} className="grid gap-1 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{entry.actorName}</span>
                <time
                  dateTime={entry.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {formatTime.format(new Date(entry.createdAt))}
                </time>
              </div>
              <ul className="grid gap-0.5 text-muted-foreground">
                {entry.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
