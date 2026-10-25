import { describe, expect, it } from "vitest";
import {
  type AuditEvent,
  type AuditNames,
  groupAuditEvents,
} from "@/lib/audit";

const ANA = "u-ana";
const BRUNO = "u-bruno";
const names: AuditNames = {
  people: new Map([
    [ANA, "Ana"],
    [BRUNO, "Bruno"],
  ]),
  schedules: new Map([["s1", "UTI nov"]]),
  teams: new Map([["t1", "UTI"]]),
  patterns: new Map([["p1", "12x36"]]),
};

let nextId = 1;
function event(
  partial: Partial<AuditEvent> & Pick<AuditEvent, "entity" | "action">,
): AuditEvent {
  return {
    id: nextId++,
    entityId: null,
    actorId: ANA,
    txid: 1,
    createdAt: "2026-10-16T01:00:00Z",
    row: {},
    ...partial,
  };
}

describe("groupAuditEvents", () => {
  it("collapses a whole schedule generation into one line", () => {
    const events = [
      ...Array.from({ length: 28 }, () =>
        event({
          entity: "shifts",
          action: "delete",
          row: { schedule_id: "s1" },
        }),
      ),
      ...Array.from({ length: 30 }, () =>
        event({
          entity: "shifts",
          action: "insert",
          row: { schedule_id: "s1" },
        }),
      ),
    ];
    const [entry] = groupAuditEvents(events, names);
    expect(entry.actorName).toBe("Ana");
    expect(entry.lines).toEqual(['Plantões em "UTI nov": +30, −28']);
  });

  it("describes publishing and unpublishing", () => {
    const publish = event({
      entity: "schedules",
      action: "update",
      entityId: "s1",
      txid: 2,
      row: { name: "UTI nov" },
      changed: { status: ["draft", "published"] },
    });
    const unpublish = event({
      entity: "schedules",
      action: "update",
      entityId: "s1",
      txid: 3,
      createdAt: "2026-10-16T02:00:00Z",
      row: { name: "UTI nov" },
      changed: { status: ["published", "draft"] },
    });
    const entries = groupAuditEvents([publish, unpublish], names);
    expect(entries.map((e) => e.lines[0])).toEqual([
      'Voltou a escala "UTI nov" para rascunho',
      'Publicou a escala "UTI nov"',
    ]);
  });

  it("describes membership changes with role labels", () => {
    const entries = groupAuditEvents(
      [
        event({
          entity: "memberships",
          action: "insert",
          txid: 4,
          row: { user_id: BRUNO, role: "member" },
        }),
        event({
          entity: "memberships",
          action: "update",
          txid: 5,
          row: { user_id: BRUNO },
          changed: { role: ["member", "manager"] },
        }),
        event({
          entity: "memberships",
          action: "delete",
          txid: 6,
          actorId: BRUNO,
          row: { user_id: BRUNO },
        }),
      ],
      names,
    );
    expect(entries.flatMap((e) => e.lines).sort()).toEqual([
      "Bruno entrou como membro",
      "Bruno saiu da organização",
      "Papel de Bruno: membro → gestor",
    ]);
  });

  it("hides cascade noise when a schedule is deleted", () => {
    const [entry] = groupAuditEvents(
      [
        event({
          entity: "shifts",
          action: "delete",
          row: { schedule_id: "s9" },
        }),
        event({
          entity: "schedules",
          action: "delete",
          entityId: "s9",
          row: { name: "Antiga" },
        }),
      ],
      names,
    );
    expect(entry.lines).toEqual(['Excluiu a escala "Antiga"']);
  });

  it("recovers names of deleted things from the log itself", () => {
    const entries = groupAuditEvents(
      [
        event({
          entity: "teams",
          action: "insert",
          entityId: "t9",
          txid: 7,
          row: { name: "PS" },
        }),
        event({
          entity: "team_members",
          action: "insert",
          txid: 8,
          row: { team_id: "t9", user_id: BRUNO },
        }),
      ],
      names,
    );
    expect(entries.flatMap((e) => e.lines)).toContain(
      'Adicionou Bruno à equipe "PS"',
    );
  });

  it("reports a cycle-only change of a rotation pattern once", () => {
    const [entry] = groupAuditEvents(
      [
        event({
          entity: "rotation_pattern_days",
          action: "delete",
          row: { pattern_id: "p1" },
        }),
        event({
          entity: "rotation_pattern_days",
          action: "insert",
          row: { pattern_id: "p1" },
        }),
        event({
          entity: "rotation_pattern_days",
          action: "insert",
          row: { pattern_id: "p1" },
        }),
      ],
      names,
    );
    expect(entry.lines).toEqual(['Alterou o ciclo do regime "12x36"']);
  });

  it("describes the time off flow: request, approval, cancellation", () => {
    const row = {
      user_id: BRUNO,
      kind: "vacation",
      start_date: "2026-11-10",
      end_date: "2026-11-20",
    };
    const entries = groupAuditEvents(
      [
        event({
          entity: "time_off",
          action: "insert",
          actorId: BRUNO,
          txid: 20,
          row: { ...row, status: "pending" },
        }),
        event({
          entity: "time_off",
          action: "update",
          txid: 21,
          row: { ...row, status: "approved" },
          changed: { status: ["pending", "approved"] },
        }),
        event({
          entity: "time_off",
          action: "delete",
          actorId: BRUNO,
          txid: 22,
          row: { ...row, kind: "leave", status: "pending" },
        }),
      ],
      names,
    );
    expect(entries.flatMap((e) => e.lines).sort()).toEqual([
      "Aprovou férias de Bruno (10/11/2026 a 20/11/2026)",
      "Bruno cancelou o pedido de licença (10/11/2026 a 20/11/2026)",
      "Bruno pediu férias (10/11/2026 a 20/11/2026)",
    ]);
  });

  it("describes a coverage request from start to approval", () => {
    const EVA = "u-eva";
    const withEva: AuditNames = {
      ...names,
      people: new Map([...names.people, [EVA, "Eva"]]),
      timeZone: "America/Sao_Paulo",
    };
    // 22:30 in São Paulo on Nov 14 is 01:30Z on Nov 15: the local day wins.
    const row = {
      requester_id: BRUNO,
      target_id: EVA,
      offered_starts_at: "2026-11-15T01:30:00Z",
      requested_shift_id: null,
    };
    const entries = groupAuditEvents(
      [
        event({
          entity: "shift_swaps",
          action: "insert",
          actorId: BRUNO,
          txid: 30,
          row,
        }),
        event({
          entity: "shift_swaps",
          action: "update",
          actorId: EVA,
          txid: 31,
          row,
          changed: { status: ["pending_target", "pending_approval"] },
        }),
        event({
          entity: "shifts",
          action: "update",
          txid: 32,
          row: { schedule_id: "s1" },
          changed: { user_id: [BRUNO, EVA] },
        }),
        event({
          entity: "shift_swaps",
          action: "update",
          txid: 32,
          row,
          changed: { status: ["pending_approval", "approved"] },
        }),
      ],
      withEva,
    );
    expect(entries.map((e) => e.lines)).toEqual([
      ["Aprovou: Eva cobre Bruno em 14/11"],
      ["Eva aceitou o pedido de Bruno (14/11)"],
      ["Bruno pediu que Eva cubra o plantão de 14/11"],
    ]);
  });

  it("labels changes without a session as Sistema", () => {
    const [entry] = groupAuditEvents(
      [
        event({
          entity: "teams",
          action: "insert",
          actorId: null,
          row: { name: "UTI" },
        }),
      ],
      names,
    );
    expect(entry.actorName).toBe("Sistema");
  });
});
