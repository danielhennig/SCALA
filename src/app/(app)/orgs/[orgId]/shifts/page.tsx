import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { CycleStrip } from "@/components/cycle-strip";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { averageWeeklyHours } from "@/domain/scheduling/cycle";
import { canManageScheduling } from "@/lib/roles";
import { listRotationPatterns } from "@/server/services/rotation-patterns";
import { listShiftTypes } from "@/server/services/shift-types";
import { loadOrg } from "../load-org";
import { ShiftTypeForm } from "./shift-type-form";
import { ShiftTypeRow } from "./shift-type-row";

export const metadata: Metadata = { title: "Turnos e regimes · SCALA" };

export default function ShiftsPage({
  params,
}: PageProps<"/orgs/[orgId]/shifts">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <ShiftsSection params={params} />
    </Suspense>
  );
}

const hoursFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

async function ShiftsSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, role } = await loadOrg(params);
  const canManage = canManageScheduling(role);
  const [shiftTypes, patterns] = await Promise.all([
    listShiftTypes(auth, orgId),
    listRotationPatterns(auth, orgId),
  ]);
  const shiftTypesById = new Map(shiftTypes.map((st) => [st.id, st]));

  return (
    <div className="grid gap-10">
      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Tipos de turno</h2>
          <p className="text-sm text-muted-foreground">
            Horário e duração de cada plantão. Um noturno das 19h às 7h é só
            &quot;início 19:00, duração 12h&quot;.
          </p>
        </div>
        {shiftTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum tipo de turno ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shiftTypes.map((shiftType) => (
              <ShiftTypeRow
                key={shiftType.id}
                orgId={orgId}
                shiftType={shiftType}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
        {canManage && (
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Novo tipo de turno</CardTitle>
            </CardHeader>
            <CardContent>
              <ShiftTypeForm orgId={orgId} />
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">Regimes</h2>
            <p className="text-sm text-muted-foreground">
              O ciclo que se repete: 12x36, 24x72, 6x1 ou um personalizado.
            </p>
          </div>
          {canManage && shiftTypes.length > 0 && (
            <Link
              href={`/orgs/${orgId}/shifts/patterns/new`}
              className={buttonVariants()}
            >
              Novo regime
            </Link>
          )}
        </div>

        {canManage && shiftTypes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Crie um tipo de turno antes de montar um regime.
          </p>
        )}

        {patterns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum regime ainda.</p>
        ) : (
          <ul className="grid gap-3">
            {patterns.map((pattern) => {
              const days = pattern.days.map((id) =>
                id ? (shiftTypesById.get(id) ?? null) : null,
              );
              return (
                <li
                  key={pattern.id}
                  className="grid gap-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{pattern.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Ciclo de {pattern.cycleLength}{" "}
                        {pattern.cycleLength === 1 ? "dia" : "dias"} · média de{" "}
                        {hoursFormat.format(averageWeeklyHours(days))} h/semana
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-start gap-2">
                        <Link
                          href={`/orgs/${orgId}/shifts/patterns/${pattern.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Editar
                        </Link>
                        <ApiActionButton
                          path={`/api/v1/orgs/${orgId}/rotation-patterns/${pattern.id}`}
                          confirmMessage={`Excluir o regime ${pattern.name}?`}
                          variant="destructive"
                        >
                          Excluir
                        </ApiActionButton>
                      </div>
                    )}
                  </div>
                  <CycleStrip days={days} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
