import "server-only";
import {
  type AuditEntry,
  type AuditEvent,
  groupAuditEvents,
} from "@/lib/audit";
import { canManageMembers } from "@/lib/roles";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { getMyOrganization, getMyRole } from "./organizations";
import { listRotationPatterns } from "./rotation-patterns";
import { listSchedules } from "./schedules";
import { listTeams } from "./teams";

export const MAX_AUDIT_EVENTS = 500;

type ChangesJson = {
  row?: Record<string, unknown>;
  changed?: Record<string, [unknown, unknown]>;
};

/** Raw audit events, newest first. Admins only (also enforced by RLS). */
export async function listAuditEvents(
  auth: AuthContext,
  orgId: string,
  limit = 200,
): Promise<AuditEvent[]> {
  if (!canManageMembers(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores podem ver a auditoria.",
    );
  }

  const { data, error } = await auth.supabase
    .from("audit_log")
    .select(
      "id, action, entity, entity_id, actor_id, txid, created_at, changes",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_AUDIT_EVENTS));

  if (error) throw fromPostgrestError(error);
  return data.map((row) => {
    const changes = (row.changes ?? {}) as ChangesJson;
    return {
      id: row.id,
      action: row.action as AuditEvent["action"],
      entity: row.entity,
      entityId: row.entity_id,
      actorId: row.actor_id,
      txid: row.txid,
      createdAt: row.created_at,
      row: changes.row ?? {},
      ...(changes.changed ? { changed: changes.changed } : {}),
    };
  });
}

/** Audit events grouped per transaction and described for the UI. */
export async function listAuditEntries(
  auth: AuthContext,
  orgId: string,
): Promise<AuditEntry[]> {
  const events = await listAuditEvents(auth, orgId, MAX_AUDIT_EVENTS);

  const userIds = new Set<string>();
  for (const event of events) {
    if (event.actorId) userIds.add(event.actorId);
    for (const key of ["user_id", "requester_id", "target_id"]) {
      const value = event.row[key];
      if (typeof value === "string") userIds.add(value);
    }
  }

  const [{ organization }, profiles, schedules, teams, patterns] =
    await Promise.all([
      getMyOrganization(auth, orgId),
      userIds.size
        ? auth.supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", [...userIds])
        : Promise.resolve({ data: [], error: null }),
      listSchedules(auth, orgId),
      listTeams(auth, orgId),
      listRotationPatterns(auth, orgId),
    ]);
  if (profiles.error) throw fromPostgrestError(profiles.error);

  return groupAuditEvents(events, {
    // Profiles of people no longer sharing an org aren't readable: "Ex-membro".
    people: new Map(profiles.data.map((p) => [p.id, p.full_name])),
    schedules: new Map(schedules.map((s) => [s.id, s.name])),
    teams: new Map(teams.map((t) => [t.id, t.name])),
    patterns: new Map(patterns.map((p) => [p.id, p.name])),
    timeZone: organization.timezone,
  });
}
