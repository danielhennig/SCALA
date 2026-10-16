export const title = "Etapa 5 — publicação, Minha escala e auditoria";

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

async function join(api, admin, org, user, role = "member") {
  const invite = await api(admin, "POST", `${org}/invitations`, {
    email: user.email,
    role,
  });
  return api(
    user,
    "POST",
    `/api/v1/invitations/${invite.json?.data?.token}/accept`,
  );
}

export default async function run({ runId, check, signUp, api }) {
  const [ana, bruno, carla] = await Promise.all(
    ["ana", "bruno", "carla"].map((name) => signUp(name)),
  );

  // --- Setup ------------------------------------------------------------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Pronto-Socorro E2E",
    slug: `ps-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  await join(api, ana, org, bruno);
  await join(api, ana, org, carla, "manager");

  const uti = (await api(ana, "POST", `${org}/teams`, { name: "UTI" })).json
    ?.data?.id;
  const ps = (await api(ana, "POST", `${org}/teams`, { name: "PS" })).json?.data
    ?.id;
  for (const user of [bruno, carla]) {
    await api(ana, "POST", `${org}/teams/${uti}/members`, {
      userId: user.userId,
    });
  }
  const diurno = (
    await api(ana, "POST", `${org}/shift-types`, {
      name: "Diurno",
      startTime: "07:00",
      durationMinutes: 720,
      color: "#f59e0b",
    })
  ).json?.data;
  const patternId = (
    await api(ana, "POST", `${org}/rotation-patterns`, {
      name: "12x36",
      days: [diurno?.id, null],
    })
  ).json?.data?.id;

  // A 28-day period starting today keeps "Minha escala" (next 30 days) populated.
  const start = isoDay(Date.now());
  const end = isoDay(Date.now() + 27 * DAY_MS);
  r = await api(carla, "POST", `${org}/schedules`, {
    teamId: uti,
    name: "UTI — próximas 4 semanas",
    periodStart: start,
    periodEnd: end,
  });
  const scheduleId = r.json?.data?.id;
  const sched = `${org}/schedules/${scheduleId}`;
  check(
    "setup: manager creates a 28-day schedule",
    r.status === 201,
    JSON.stringify(r.json),
  );

  // --- Publish ----------------------------------------------------------------
  r = await api(carla, "POST", `${sched}/publish`);
  check(
    "publishing an empty schedule → 400",
    r.status === 400 && r.json?.error?.message?.includes("não tem plantões"),
    JSON.stringify(r.json),
  );

  r = await api(carla, "POST", `${sched}/generate`, {
    patternId,
    assignments: [
      { userId: bruno.userId, offset: 0 },
      { userId: carla.userId, offset: 1 },
    ],
  });
  check(
    "generate 28 shifts",
    r.json?.data?.created === 28,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", `${org}/schedules`);
  check(
    "draft is invisible to the member",
    r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${sched}/publish`);
  check("member cannot publish → 403", r.status === 403, r.status);

  r = await api(carla, "POST", `${sched}/publish`);
  check(
    "manager publishes → status published",
    r.status === 200 && r.json?.data?.status === "published",
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", `${org}/schedules`);
  check(
    "member now lists the schedule",
    r.json?.data?.length === 1,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", sched);
  check(
    "member reads the published grid (read-only)",
    r.status === 200 && r.json?.data?.shifts?.length === 28,
    r.status,
  );

  r = await api(bruno, "GET", `/orgs/${orgId}/schedules/${scheduleId}`);
  check(
    "member's page has no editing controls",
    r.status === 200 &&
      !r.text.includes("Gerar") &&
      !r.text.includes("Publicar"),
    r.status,
  );

  // --- Minha escala -----------------------------------------------------------
  const range = `from=${start}T00:00:00Z&to=${isoDay(Date.now() + 29 * DAY_MS)}T00:00:00Z`;
  r = await api(bruno, "GET", `/api/v1/me/shifts?${range}`);
  const mine = r.json?.data ?? [];
  check(
    "my shifts: bruno gets only his 14 shifts, with org and team",
    mine.length === 14 &&
      mine.every(
        (s) => s.orgName === "Pronto-Socorro E2E" && s.teamName === "UTI",
      ),
    `${mine.length} ${JSON.stringify(mine[0])}`,
  );

  r = await api(ana, "GET", `/api/v1/me/shifts?${range}`);
  check(
    "admin without shifts gets an empty list",
    r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  // A draft shift (other schedule) must not show up, even for a manager.
  r = await api(carla, "POST", `${org}/schedules`, {
    teamId: ps,
    name: "PS — rascunho",
    periodStart: start,
    periodEnd: end,
  });
  const draftSched = `${org}/schedules/${r.json?.data?.id}`;
  r = await api(carla, "PUT", `${draftSched}/cells`, {
    userId: carla.userId,
    date: start,
    shiftTypeId: diurno.id,
  });
  r = await api(carla, "GET", `/api/v1/me/shifts?${range}`);
  check(
    "drafts are excluded from my shifts, even for managers",
    r.json?.data?.length === 14,
    r.json?.data?.length,
  );

  r = await api(
    bruno,
    "GET",
    "/api/v1/me/shifts?from=2026-01-01T00:00:00Z&to=2027-06-01T00:00:00Z",
  );
  check("ranges over 93 days → 400", r.status === 400, r.status);

  r = await api(bruno, "GET", "/me");
  check(
    "/me page lists upcoming shifts",
    r.status === 200 &&
      r.text.includes("Minha escala") &&
      r.text.includes("Pronto-Socorro E2E"),
    r.status,
  );

  r = await api(carla, "POST", `${sched}/unpublish`);
  check(
    "back to draft → 200",
    r.status === 200 && r.json?.data?.status === "draft",
    r.status,
  );

  r = await api(bruno, "GET", `/api/v1/me/shifts?${range}`);
  check(
    "unpublished shifts disappear from my shifts",
    r.json?.data?.length === 0,
    r.json?.data?.length,
  );

  await api(carla, "POST", `${sched}/publish`);

  // --- Audit ------------------------------------------------------------------
  r = await api(ana, "GET", `${org}/audit?limit=500`);
  const events = r.json?.data ?? [];
  check(
    "admin reads raw audit events",
    r.status === 200 &&
      events.some(
        (e) =>
          e.entity === "schedules" &&
          e.changed?.status?.[1] === "published" &&
          e.actorId === carla.userId,
      ),
    r.status,
  );

  r = await api(carla, "GET", `${org}/audit`);
  check("manager cannot read the audit log → 403", r.status === 403, r.status);

  r = await api(bruno, "GET", `${org}/audit`);
  check("member cannot read the audit log → 403", r.status === 403, r.status);

  r = await api(ana, "GET", `/orgs/${orgId}/audit`);
  check(
    "audit page describes actions in plain language",
    r.status === 200 &&
      r.text.includes('Publicou a escala "UTI — próximas 4 semanas"') &&
      r.text.includes('Plantões em "UTI — próximas 4 semanas": +28') &&
      r.text.includes("Bruno entrou como membro"),
    r.status,
  );

  r = await api(ana, "GET", `/orgs/${orgId}`);
  check("admin sees the Auditoria tab", r.text.includes("Auditoria"), r.status);

  r = await api(carla, "GET", `/orgs/${orgId}`);
  check(
    "manager does not see the Auditoria tab",
    !r.text.includes("Auditoria"),
    r.status,
  );
}
