import { localDate } from "@/domain/scheduling/zoned";
import { formatDateRange, formatShortDate } from "./format";
import { type OrgRole, ROLE_LABELS } from "./roles";
import { TIME_OFF_KIND_LABELS, type TimeOffKind } from "./time-off";

/** One row of public.audit_log, as the API returns it. */
export type AuditEvent = {
  id: number;
  action: "insert" | "update" | "delete";
  entity: string;
  entityId: string | null;
  actorId: string | null;
  txid: number;
  createdAt: string;
  row: Record<string, unknown>;
  changed?: Record<string, [unknown, unknown]>;
};

export type AuditNames = {
  people: Map<string, string>;
  schedules: Map<string, string>;
  teams: Map<string, string>;
  patterns: Map<string, string>;
  /** Organization time zone, to show shift dates as local days. */
  timeZone?: string;
};

/** One transaction by one person, described in plain Portuguese. */
export type AuditEntry = {
  key: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  lines: string[];
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const roleLabel = (value: unknown) =>
  ROLE_LABELS[value as OrgRole]?.toLowerCase() ?? str(value);

function counts(added: number, removed: number) {
  return [added && `+${added}`, removed && `−${removed}`]
    .filter(Boolean)
    .join(", ");
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** Names of deleted/renamed things are recovered from the log itself. */
function harvestNames(events: AuditEvent[], names: AuditNames): AuditNames {
  const result = {
    people: new Map(names.people),
    schedules: new Map(names.schedules),
    teams: new Map(names.teams),
    patterns: new Map(names.patterns),
    timeZone: names.timeZone,
  };
  const target: Record<string, Map<string, string>> = {
    schedules: result.schedules,
    teams: result.teams,
    rotation_patterns: result.patterns,
  };
  for (const event of events) {
    const map = target[event.entity];
    const name = str(event.row.name);
    if (map && event.entityId && name && !map.has(event.entityId)) {
      map.set(event.entityId, name);
    }
  }
  return result;
}

function describeGroup(events: AuditEvent[], names: AuditNames): string[] {
  const person = (id: unknown) => names.people.get(str(id)) ?? "Ex-membro";
  const lines: string[] = [];

  const deletedSchedules = new Set<string>();
  const deletedTeams = new Set<string>();
  const removedMembers = new Set<string>();
  const touchedPatterns = new Set<string>();
  for (const e of events) {
    if (e.action !== "delete") continue;
    if (e.entity === "schedules" && e.entityId)
      deletedSchedules.add(e.entityId);
    if (e.entity === "teams" && e.entityId) deletedTeams.add(e.entityId);
    if (e.entity === "memberships") removedMembers.add(str(e.row.user_id));
  }

  const shifts = new Map<string, { added: number; removed: number }>();
  const teamMembers = new Map<string, { added: string[]; removed: string[] }>();
  const patternDays = new Set<string>();

  for (const e of events) {
    const name = str(e.row.name);
    switch (e.entity) {
      case "schedules":
        if (e.action === "insert") lines.push(`Criou a escala "${name}"`);
        if (e.action === "delete") lines.push(`Excluiu a escala "${name}"`);
        if (e.action === "update") {
          const status = e.changed?.status;
          if (status) {
            lines.push(
              status[1] === "published"
                ? `Publicou a escala "${name}"`
                : `Voltou a escala "${name}" para rascunho`,
            );
          }
          const rename = e.changed?.name;
          if (rename) {
            lines.push(
              `Renomeou a escala "${str(rename[0])}" para "${str(rename[1])}"`,
            );
          }
        }
        break;

      case "shifts": {
        // Updates only come from approved swaps, described by the swap line.
        if (e.action === "update") break;
        const scheduleId = str(e.row.schedule_id);
        if (deletedSchedules.has(scheduleId)) break; // cascade noise
        const c = shifts.get(scheduleId) ?? { added: 0, removed: 0 };
        if (e.action === "insert") c.added++;
        if (e.action === "delete") c.removed++;
        shifts.set(scheduleId, c);
        break;
      }

      case "memberships": {
        const who = person(e.row.user_id);
        if (e.action === "insert") {
          lines.push(`${who} entrou como ${roleLabel(e.row.role)}`);
        } else if (e.action === "update" && e.changed?.role) {
          const [from, to] = e.changed.role;
          lines.push(`Papel de ${who}: ${roleLabel(from)} → ${roleLabel(to)}`);
        } else if (e.action === "delete") {
          lines.push(
            e.actorId === str(e.row.user_id)
              ? `${who} saiu da organização`
              : `Removeu ${who} da organização`,
          );
        }
        break;
      }

      case "teams":
        if (e.action === "insert") lines.push(`Criou a equipe "${name}"`);
        if (e.action === "delete") lines.push(`Excluiu a equipe "${name}"`);
        if (e.action === "update" && e.changed?.name) {
          lines.push(
            `Renomeou a equipe "${str(e.changed.name[0])}" para "${str(e.changed.name[1])}"`,
          );
        }
        break;

      case "team_members": {
        const teamId = str(e.row.team_id);
        const userId = str(e.row.user_id);
        if (deletedTeams.has(teamId)) break;
        if (e.action === "delete" && removedMembers.has(userId)) break;
        const c = teamMembers.get(teamId) ?? { added: [], removed: [] };
        if (e.action === "insert") c.added.push(person(userId));
        if (e.action === "delete") c.removed.push(person(userId));
        teamMembers.set(teamId, c);
        break;
      }

      case "shift_types":
        lines.push(
          `${e.action === "insert" ? "Criou" : e.action === "delete" ? "Excluiu" : "Alterou"} o tipo de turno "${name}"`,
        );
        break;

      case "rotation_patterns":
        if (e.entityId) touchedPatterns.add(e.entityId);
        lines.push(
          `${e.action === "insert" ? "Criou" : e.action === "delete" ? "Excluiu" : "Alterou"} o regime "${name}"`,
        );
        break;

      case "rotation_pattern_days":
        patternDays.add(str(e.row.pattern_id));
        break;

      case "shift_swaps": {
        if (e.action === "delete") break; // cascades from deleted shifts
        const requester = person(e.row.requester_id);
        const target = person(e.row.target_id);
        const timeZone = names.timeZone ?? "America/Sao_Paulo";
        const offered = formatShortDate(
          localDate(str(e.row.offered_starts_at), timeZone),
        );
        const requested = e.row.requested_shift_id
          ? formatShortDate(localDate(str(e.row.requested_starts_at), timeZone))
          : null;

        if (e.action === "insert") {
          lines.push(
            requested
              ? `${requester} propôs trocar o plantão de ${offered} pelo de ${target} em ${requested}`
              : `${requester} pediu que ${target} cubra o plantão de ${offered}`,
          );
          break;
        }
        switch (e.changed?.status?.[1]) {
          case "pending_approval":
            lines.push(
              `${target} aceitou o pedido de ${requester} (${offered})`,
            );
            break;
          case "declined":
            lines.push(
              `${target} recusou o pedido de ${requester} (${offered})`,
            );
            break;
          case "approved":
            lines.push(
              requested
                ? `Aprovou a troca entre ${requester} e ${target} (${offered} ↔ ${requested})`
                : `Aprovou: ${target} cobre ${requester} em ${offered}`,
            );
            break;
          case "rejected":
            lines.push(
              `Recusou a troca entre ${requester} e ${target} (${offered})`,
            );
            break;
          case "cancelled":
            lines.push(`${requester} cancelou o pedido de troca (${offered})`);
            break;
        }
        break;
      }

      case "time_off": {
        const who = person(e.row.user_id);
        const kind = (
          TIME_OFF_KIND_LABELS[e.row.kind as TimeOffKind] ?? "afastamento"
        ).toLowerCase();
        const period = `(${formatDateRange(str(e.row.start_date), str(e.row.end_date))})`;
        if (e.action === "insert") {
          lines.push(
            e.row.status === "pending"
              ? `${who} pediu ${kind} ${period}`
              : `Registrou ${kind} de ${who} ${period}`,
          );
        } else if (e.action === "update") {
          const status = e.changed?.status?.[1];
          lines.push(
            status === "approved"
              ? `Aprovou ${kind} de ${who} ${period}`
              : status === "rejected"
                ? `Recusou ${kind} de ${who} ${period}`
                : `Alterou ${kind} de ${who} ${period}`,
          );
        } else {
          lines.push(
            e.actorId === str(e.row.user_id) && e.row.status === "pending"
              ? `${who} cancelou o pedido de ${kind} ${period}`
              : `Excluiu ${kind} de ${who} ${period}`,
          );
        }
        break;
      }

      default:
        lines.push(`${e.action} em ${e.entity}`);
    }
  }

  for (const [scheduleId, c] of shifts) {
    const schedule = names.schedules.get(scheduleId) ?? "escala";
    lines.push(`Plantões em "${schedule}": ${counts(c.added, c.removed)}`);
  }
  for (const [teamId, c] of teamMembers) {
    const team = names.teams.get(teamId) ?? "equipe";
    if (c.added.length)
      lines.push(`Adicionou ${listNames(c.added)} à equipe "${team}"`);
    if (c.removed.length)
      lines.push(`Tirou ${listNames(c.removed)} da equipe "${team}"`);
  }
  for (const patternId of patternDays) {
    if (touchedPatterns.has(patternId)) continue;
    lines.push(
      `Alterou o ciclo do regime "${names.patterns.get(patternId) ?? "regime"}"`,
    );
  }
  return lines;
}

/**
 * Groups events by transaction + actor (newest first) and turns each group
 * into readable lines. "Generate schedule" (hundreds of shift rows) becomes a
 * single "Plantões em …: +30, −28".
 */
export function groupAuditEvents(
  events: readonly AuditEvent[],
  names: AuditNames,
): AuditEntry[] {
  const resolved = harvestNames([...events], names);
  const groups = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const key = `${event.txid}:${event.actorId ?? "system"}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return (
    [...groups.entries()]
      .map(([key, group]) => {
        const chronological = [...group].sort((a, b) => a.id - b.id);
        const latest = chronological.at(-1)!;
        return {
          entry: {
            key,
            createdAt: latest.createdAt,
            actorId: latest.actorId,
            actorName: latest.actorId
              ? (resolved.people.get(latest.actorId) ?? "Ex-membro")
              : "Sistema",
            lines: describeGroup(chronological, resolved),
          },
          latestId: latest.id,
        };
      })
      .filter(({ entry }) => entry.lines.length > 0)
      // Newest first; ties (same timestamp) broken by the sequential event id.
      .sort(
        (a, b) =>
          b.entry.createdAt.localeCompare(a.entry.createdAt) ||
          b.latestId - a.latestId,
      )
      .map(({ entry }) => entry)
  );
}
