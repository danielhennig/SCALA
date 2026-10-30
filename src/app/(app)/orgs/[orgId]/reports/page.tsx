import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { addDays, monthPeriod } from "@/domain/scheduling/dates";
import { formatDuration } from "@/domain/scheduling/time";
import { localDate } from "@/domain/scheduling/zoned";
import { formatMonth } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import {
  getHoursReport,
  weeklyAverageMinutes,
} from "@/server/services/reports";
import { listTeams } from "@/server/services/teams";
import { loadOrg } from "../load-org";

export const metadata: Metadata = { title: "Horas · SCALA" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function HoursReportPage({
  params,
  searchParams,
}: PageProps<"/orgs/[orgId]/reports">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <HoursReportSection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function HoursReportSection({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  if (!canManageScheduling(role)) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        Apenas administradores e gestores veem o relatório de horas.
      </p>
    );
  }

  const { month, team } = await searchParams;
  const teams = await listTeams(auth, orgId);
  const selectedMonth =
    typeof month === "string" && MONTH.test(month)
      ? month
      : localDate(new Date(), organization.timezone).slice(0, 7);
  const teamId =
    typeof team === "string" && teams.some((t) => t.id === team)
      ? team
      : undefined;
  const { start, end } = monthPeriod(selectedMonth);
  const report = await getHoursReport(auth, orgId, {
    from: start,
    to: end,
    teamId,
  });

  const base = `/orgs/${orgId}/reports`;
  const monthHref = (m: string) =>
    `${base}?${new URLSearchParams({ month: m, ...(teamId ? { team: teamId } : {}) })}`;
  const exportHref = `/api/v1/orgs/${orgId}/reports/hours/export?${new URLSearchParams(
    { from: start, to: end, ...(teamId ? { teamId } : {}) },
  )}`;
  const sum = (
    key: "shifts" | "totalMinutes" | "nightMinutes" | "weekendMinutes",
  ) => report.rows.reduce((total, row) => total + row[key], 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Relatório de horas</h2>
        <p className="text-sm text-muted-foreground">
          Plantões de escalas publicadas que começam no período, no fuso da
          organização. Horas noturnas são horas de relógio entre 22h e 5h (sem a
          hora noturna reduzida da CLT). Feriados ainda não são considerados.
        </p>
      </div>

      <form
        method="get"
        action={base}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="grid gap-2">
          <Label htmlFor="report-month">Mês</Label>
          <Input
            id="report-month"
            type="month"
            name="month"
            defaultValue={selectedMonth}
            required
            className="w-44"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="report-team">Equipe</Label>
          <NativeSelect
            id="report-team"
            name="team"
            defaultValue={teamId ?? ""}
            className="w-52"
          >
            <option value="">Todas as equipes</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" size="sm">
          Ver relatório
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={monthHref(addDays(start, -1).slice(0, 7))}
            className="text-muted-foreground hover:underline"
          >
            ← Anterior
          </Link>
          <span className="font-medium capitalize">
            {formatMonth(selectedMonth)}
          </span>
          <Link
            href={monthHref(addDays(end, 1).slice(0, 7))}
            className="text-muted-foreground hover:underline"
          >
            Próximo →
          </Link>
        </div>
        {/* A download, not a page: plain <a> so Next doesn't prefetch it. */}
        <a
          href={exportHref}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Exportar CSV
        </a>
      </div>

      {report.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ninguém nessa equipe ainda.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="p-2 font-medium">
                  Pessoa
                </th>
                <Th>Plantões</Th>
                <Th>Horas</Th>
                <Th>Noturnas</Th>
                <Th>Fim de semana</Th>
                <Th>Afastamento</Th>
                <Th>Média semanal</Th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={row.userId}
                  className={`border-t ${row.shifts === 0 ? "text-muted-foreground" : ""}`}
                >
                  <th scope="row" className="p-2 text-left font-normal">
                    {row.fullName}
                  </th>
                  <Td>{row.shifts}</Td>
                  <Td>{formatDuration(row.totalMinutes)}</Td>
                  <Td>{formatDuration(row.nightMinutes)}</Td>
                  <Td>{formatDuration(row.weekendMinutes)}</Td>
                  <Td>
                    {row.timeOffDays > 0
                      ? `${row.timeOffDays} ${row.timeOffDays === 1 ? "dia" : "dias"}`
                      : "—"}
                  </Td>
                  <Td>
                    {formatDuration(weeklyAverageMinutes(row, report.days))}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <th scope="row" className="p-2 text-left">
                  Total
                </th>
                <Td>{sum("shifts")}</Td>
                <Td>{formatDuration(sum("totalMinutes"))}</Td>
                <Td>{formatDuration(sum("nightMinutes"))}</Td>
                <Td>{formatDuration(sum("weekendMinutes"))}</Td>
                <Td />
                <Td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="p-2 text-right font-medium whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="p-2 text-right tabular-nums">{children}</td>;
}
