export const title = "Etapa 4 — escalas e plantões";

async function join(api, admin, org, user) {
  const invite = await api(admin, "POST", `${org}/invitations`, {
    email: user.email,
  });
  return api(
    user,
    "POST",
    `/api/v1/invitations/${invite.json?.data?.token}/accept`,
  );
}

export default async function run({ runId, check, signUp, api }) {
  const [ana, bruno, carla, diego] = await Promise.all(
    ["ana", "bruno", "carla", "diego"].map((name) => signUp(name)),
  );

  // --- Setup: org, members, team, shift types, 12x36 -------------------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Escalas",
    slug: `esc-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  await join(api, ana, org, bruno);
  await join(api, ana, org, carla);

  r = await api(ana, "POST", `${org}/teams`, { name: "UTI" });
  const utiId = r.json?.data?.id;
  r = await api(ana, "POST", `${org}/teams`, { name: "PS" });
  const psId = r.json?.data?.id;
  for (const user of [bruno, carla]) {
    await api(ana, "POST", `${org}/teams/${utiId}/members`, {
      userId: user.userId,
    });
  }

  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "Diurno",
    startTime: "07:00",
    durationMinutes: 720,
    color: "#f59e0b",
  });
  const diurno = r.json?.data;
  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "Noturno",
    startTime: "19:00",
    durationMinutes: 720,
    color: "#4f46e5",
  });
  const noturno = r.json?.data;
  r = await api(ana, "POST", `${org}/rotation-patterns`, {
    name: "12x36",
    days: [diurno?.id, null],
  });
  const patternId = r.json?.data?.id;
  check(
    "setup: org, team of 2, shift types and 12x36",
    orgId && utiId && psId && diurno && noturno && patternId,
  );

  // --- Schedules --------------------------------------------------------------
  r = await api(ana, "POST", `${org}/schedules`, {
    teamId: utiId,
    name: "UTI — novembro de 2026",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
  });
  const scheduleId = r.json?.data?.id;
  const sched = `${org}/schedules/${scheduleId}`;
  check(
    "create schedule → 201 as draft",
    r.status === 201 &&
      r.json.data.status === "draft" &&
      r.json.data.teamName === "UTI",
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", `${org}/schedules`, {
    teamId: utiId,
    name: "Sobreposta",
    periodStart: "2026-11-15",
    periodEnd: "2026-12-14",
  });
  check(
    "overlapping period for the same team → 409",
    r.status === 409 && r.json?.error?.message?.includes("sobrepõe"),
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", `${org}/schedules`, {
    teamId: utiId,
    name: "Longa",
    periodStart: "2027-01-01",
    periodEnd: "2027-03-15",
  });
  check("period over 62 days → 400", r.status === 400, r.status);

  // --- Generate ---------------------------------------------------------------
  r = await api(ana, "POST", `${sched}/generate`, {
    patternId,
    assignments: [
      { userId: bruno.userId, offset: 0 },
      { userId: carla.userId, offset: 1 },
    ],
  });
  check(
    "generate 12x36 A/B for November → 30 shifts",
    r.status === 200 && r.json?.data?.created === 30,
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", sched);
  let detail = r.json?.data;
  const brunoFirst = detail?.shifts?.find((s) => s.userId === bruno.userId);
  check(
    "detail: 30 shifts, 2 people, 07:00 São Paulo = 10:00Z",
    detail?.shifts?.length === 30 &&
      detail.people.length === 2 &&
      brunoFirst?.date === "2026-11-01" &&
      brunoFirst?.startsAt.startsWith("2026-11-01T10:00:00"),
    JSON.stringify(brunoFirst),
  );
  check(
    "every day of November is covered exactly once",
    new Set(detail?.shifts?.map((s) => s.date)).size === 30,
  );

  // --- Cell edits -------------------------------------------------------------
  r = await api(ana, "PUT", `${sched}/cells`, {
    userId: bruno.userId,
    date: "2026-11-02",
    shiftTypeId: noturno.id,
  });
  check(
    "set a night shift on bruno's day off → 204",
    r.status === 204,
    r.status,
  );

  r = await api(ana, "GET", sched);
  const night = r.json?.data?.shifts?.find(
    (s) => s.userId === bruno.userId && s.date === "2026-11-02",
  );
  check(
    "night shift crosses midnight (22:00Z → 10:00Z next day)",
    night?.startsAt.startsWith("2026-11-02T22:00:00") &&
      night?.endsAt.startsWith("2026-11-03T10:00:00"),
    JSON.stringify(night),
  );

  r = await api(ana, "GET", `/orgs/${orgId}/schedules/${scheduleId}`);
  check(
    "grid flags 0h rest (night ends 07:00, next day shift starts 07:00)",
    r.status === 200 && r.text.includes("Descanso abaixo de 11"),
    r.status,
  );

  r = await api(ana, "PUT", `${sched}/cells`, {
    userId: bruno.userId,
    date: "2026-11-02",
    shiftTypeId: null,
  });
  r = await api(ana, "GET", sched);
  check(
    "clearing the day removes the shift",
    r.json?.data?.shifts?.length === 30,
    r.json?.data?.shifts?.length,
  );

  r = await api(ana, "PUT", `${sched}/cells`, {
    userId: bruno.userId,
    date: "2026-12-05",
    shiftTypeId: diurno.id,
  });
  check("date outside the period → 400", r.status === 400, r.status);

  r = await api(ana, "PUT", `${sched}/cells`, {
    userId: diego.userId,
    date: "2026-11-05",
    shiftTypeId: diurno.id,
  });
  check(
    "non-member cannot be scheduled → 400",
    r.status === 400 && r.json?.error?.message?.includes("membros"),
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", `${org}/schedules`, {
    teamId: psId,
    name: "PS — novembro de 2026",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
  });
  const psSched = `${org}/schedules/${r.json?.data?.id}`;
  r = await api(ana, "PUT", `${psSched}/cells`, {
    userId: bruno.userId,
    date: "2026-11-01",
    shiftTypeId: diurno.id,
  });
  check(
    "same person, same time, another team's schedule → 409",
    r.status === 409 && r.json?.error?.message?.includes("Conflito"),
    JSON.stringify(r.json),
  );

  r = await api(ana, "PUT", `${psSched}/cells`, {
    userId: bruno.userId,
    date: "2026-11-02",
    shiftTypeId: diurno.id,
  });
  r = await api(ana, "GET", sched);
  check(
    "covering another team on a free day works; person shows as outsider",
    r.status === 200,
  );
  r = await api(ana, "GET", psSched);
  check(
    "PS schedule lists bruno as 'outside the team'",
    r.json?.data?.people?.some((p) => p.userId === bruno.userId && !p.inTeam),
    JSON.stringify(r.json?.data?.people),
  );

  // --- Members can't see drafts or edit ---------------------------------------
  r = await api(bruno, "GET", `${org}/schedules`);
  check(
    "member does not list draft schedules",
    r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", sched);
  check("member gets 404 for a draft", r.status === 404, r.status);

  r = await api(bruno, "POST", `${sched}/generate`, {
    patternId,
    assignments: [{ userId: bruno.userId, offset: 0 }],
  });
  check("member cannot generate → 403", r.status === 403, r.status);

  r = await api(bruno, "GET", `/orgs/${orgId}/schedules/${scheduleId}`);
  check(
    "member gets the not-found UI for a draft page",
    !r.text.includes("Gerar") && r.text.includes("404"),
    r.status,
  );

  // --- Regenerate, delete -----------------------------------------------------
  r = await api(ana, "POST", `${sched}/generate`, {
    patternId,
    assignments: [{ userId: carla.userId, offset: 0 }],
  });
  r = await api(ana, "GET", sched);
  check(
    "regenerating replaces every shift of the schedule",
    r.json?.data?.shifts?.length === 15 &&
      r.json.data.shifts.every((s) => s.userId === carla.userId),
    r.json?.data?.shifts?.length,
  );

  r = await api(ana, "DELETE", `${org}/teams/${utiId}`);
  check(
    "a team with schedules cannot be deleted → 409",
    r.status === 409 && r.json?.error?.message?.includes("escalas"),
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", `/orgs/${orgId}/schedules`);
  check(
    "schedules page lists both drafts",
    r.status === 200 &&
      r.text.includes("UTI — novembro de 2026") &&
      r.text.includes("Rascunho"),
    r.status,
  );

  r = await api(ana, "DELETE", sched);
  check("delete schedule → 204", r.status === 204, r.status);
}
