import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShiftLabel } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import { isSwapPending } from "@/lib/swaps";
import { listMembers } from "@/server/services/members";
import {
  listSwapCandidates,
  listSwaps,
  type ShiftSwap,
} from "@/server/services/swaps";
import { loadOrg } from "../load-org";
import { SwapForm } from "./swap-form";
import { SwapItem } from "./swap-item";

export const metadata: Metadata = { title: "Trocas · SCALA" };

export default function SwapsPage({
  params,
  searchParams,
}: PageProps<"/orgs/[orgId]/swaps">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <SwapsSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SwapsSection({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const { shift } = await searchParams;
  const isManager = canManageScheduling(role);
  const me = auth.user.id;
  const timeZone = organization.timezone;

  const [swaps, candidates, members] = await Promise.all([
    listSwaps(auth, orgId),
    listSwapCandidates(auth, orgId),
    listMembers(auth, orgId),
  ]);

  const forMe = swaps.filter(
    (s) => s.targetId === me && s.status === "pending_target",
  );
  const awaitingApproval = isManager
    ? swaps.filter((s) => s.status === "pending_approval")
    : [];
  const mine = swaps.filter((s) => s.requesterId === me);
  const shown = new Set([...forMe, ...awaitingApproval, ...mine]);
  const history = swaps.filter((s) => !shown.has(s));

  const activeOffered = new Set(
    mine.filter((s) => isSwapPending(s.status)).map((s) => s.offeredShiftId),
  );
  const apiBase = `/api/v1/orgs/${orgId}/swaps`;
  const action = (
    swap: ShiftSwap,
    name: string,
    label: string,
    confirm?: string,
  ) => (
    <ApiActionButton
      path={`${apiBase}/${swap.id}/${name}`}
      method="POST"
      confirmMessage={confirm}
      variant={name === "accept" || name === "approve" ? "default" : "outline"}
    >
      {label}
    </ApiActionButton>
  );

  return (
    <div className="grid gap-8">
      {forMe.length > 0 && (
        <Section title={`Pedidos para você (${forMe.length})`}>
          {forMe.map((swap) => (
            <SwapItem key={swap.id} swap={swap} timeZone={timeZone}>
              {action(swap, "accept", "Aceitar")}
              {action(swap, "decline", "Recusar")}
            </SwapItem>
          ))}
        </Section>
      )}

      {awaitingApproval.length > 0 && (
        <Section
          title={`Aguardando sua aprovação (${awaitingApproval.length})`}
        >
          {awaitingApproval.map((swap) => (
            <SwapItem key={swap.id} swap={swap} timeZone={timeZone}>
              {action(
                swap,
                "approve",
                "Aprovar",
                swap.warnings.length
                  ? "Esta troca deixa alguém abaixo do descanso mínimo. Aprovar mesmo assim?"
                  : undefined,
              )}
              {action(swap, "reject", "Recusar")}
            </SwapItem>
          ))}
        </Section>
      )}

      <Section title="Seus pedidos" empty="Você ainda não pediu trocas.">
        {mine.map((swap) => (
          <SwapItem key={swap.id} swap={swap} timeZone={timeZone}>
            {isSwapPending(swap.status) &&
              action(swap, "cancel", "Cancelar", "Cancelar este pedido?")}
          </SwapItem>
        ))}
      </Section>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Pedir troca ou cobertura</CardTitle>
        </CardHeader>
        <CardContent>
          <SwapForm
            orgId={orgId}
            myShifts={candidates.mine
              .filter((s) => !activeOffered.has(s.id))
              .map((s) => ({ id: s.id, label: formatShiftLabel(s, timeZone) }))}
            colleagues={members
              .filter((m) => m.userId !== me)
              .map(({ userId, fullName }) => ({ userId, fullName }))}
            colleagueShifts={candidates.colleagues.map((s) => ({
              id: s.id,
              userId: s.userId,
              label: formatShiftLabel(s, timeZone),
            }))}
            preselectedShiftId={typeof shift === "string" ? shift : undefined}
          />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Section title="Histórico">
          {history.map((swap) => (
            <SwapItem key={swap.id} swap={swap} timeZone={timeZone} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border">{children}</ul>
      )}
    </section>
  );
}
