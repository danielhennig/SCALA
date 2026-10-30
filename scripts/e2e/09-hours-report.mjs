export const title = "Etapa 9 — relatório de horas";

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

const MARCH = "from=2030-03-01&to=2030-03-31";

export default async function run({ runId, check, signUp, api }) {
  const [ana, carla, bruno, eva, diego] = await Promise.all(
    ["ana", "carla", "bruno", "eva", "diego"].map((name) => signUp(name)),
  );

  // --- Setup (America/Sao_Paulo; 2030-03-01 is a Friday) ---------------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Horas",
    slug: `horas-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  await join(api, ana, org, carla, "manager");
  for (const user of [bruno, eva, diego]) await join(api, ana, org, user);

  const uti = (await api(ana, "POST", `${org}/teams`, { name: "UTI" })).json
    ?.data?.id;
  const ps = (await api(ana, "POST", `${org}/teams`, { name: "PS" })).json?.data
    ?.id;
  for (const user of [bruno, eva]) {
    await api(ana, "POST", `${org}/teams/${uti}/members`, {
      userId: user.userId,
    });
  }
  await api(ana, "POST", `${org}/teams/${ps}/members`, {
    userId: diego.userId,
  });

  const type = async (name, startTime) =>
    (
      await api(ana, "POST", `${org}/shift-types`, {
        name,
        startTime,
        durationMinutes: 720,
        color: "#475569",
      })
    ).json?.data?.id;
  const diurno = await type("Diurno", "07:00");
  const noturno = await type("Noturno", "19:00");

  async function schedule(teamId, name, periodStart, periodEnd, cells) {
    const id = (
      await api(carla, "POST", `${org}/schedules`, {
        teamId,
        name,
        periodStart,
        periodEnd,
      })
    ).json?.data?.id;
    for (const [user, date, shiftTypeId] of cells) {
      await api(carla, "PUT", `${org}/schedules/${id}/cells`, {
        userId: user.userId,
        date,
        shiftTypeId,
      });
    }
    return id;
  }

  // Published March: bruno Fri + Sat day shifts; eva Fri night (→ Sat 07:00).
  const marchId = await schedule(uti, "UTI março", "2030-03-01", "2030-03-31", [
    [bruno, "2030-03-01", diurno],
    [bruno, "2030-03-02", diurno],
    [eva, "2030-03-01", noturno],
  ]);
  await api(carla, "POST", `${org}/schedules/${marchId}/publish`);
  // Published February: bruno's Feb 28 night ends in March but starts in Feb.
  const febId = await schedule(
    uti,
    "UTI fevereiro",
    "2030-02-01",
    "2030-02-28",
    [[bruno, "2030-02-28", noturno]],
  );
  await api(carla, "POST", `${org}/schedules/${febId}/publish`);
  // Draft: never counted.
  await schedule(ps, "PS março", "2030-03-01", "2030-03-31", [
    [diego, "2030-03-05", diurno],
  ]);

  await api(carla, "POST", `${org}/time-off`, {
    userId: bruno.userId,
    kind: "vacation",
    startDate: "2030-03-20",
    endDate: "2030-03-25",
  });
  await api(carla, "POST", `${org}/time-off`, {
    userId: eva.userId,
    kind: "leave",
    startDate: "2030-03-30",
    endDate: "2030-04-02",
  });

  // --- API --------------------------------------------------------------------
  r = await api(carla, "GET", `${org}/reports/hours?${MARCH}`);
  const rows = r.json?.data?.rows ?? [];
  const row = (user) => rows.find((x) => x.userId === user.userId);
  check(
    "manager gets one row per member, sorted by name",
    r.status === 200 &&
      rows.map((x) => x.fullName).join(",") === "Ana,Bruno,Carla,Diego,Eva" &&
      r.json?.data?.days === 31,
    JSON.stringify(r.json).slice(0, 300),
  );
  check(
    "bruno: 2 shifts, 24h, 12h on Saturday, 6 days of vacation",
    JSON.stringify(row(bruno)) ===
      JSON.stringify({
        userId: bruno.userId,
        fullName: "Bruno",
        shifts: 2,
        totalMinutes: 1440,
        nightMinutes: 0,
        weekendMinutes: 720,
        timeOffDays: 6,
      }),
    JSON.stringify(row(bruno)),
  );
  check(
    "eva: one 19–07 shift = 7h night and 7h weekend; leave clipped to March",
    row(eva)?.shifts === 1 &&
      row(eva)?.totalMinutes === 720 &&
      row(eva)?.nightMinutes === 420 &&
      row(eva)?.weekendMinutes === 420 &&
      row(eva)?.timeOffDays === 2,
    JSON.stringify(row(eva)),
  );
  check(
    "drafts do not count",
    row(diego)?.shifts === 0 && row(diego)?.totalMinutes === 0,
    JSON.stringify(row(diego)),
  );

  r = await api(carla, "GET", `${org}/reports/hours?${MARCH}&teamId=${uti}`);
  check(
    "team filter keeps only that team",
    r.json?.data?.rows?.map((x) => x.fullName).join(",") === "Bruno,Eva",
    JSON.stringify(r.json?.data?.rows?.map((x) => x.fullName)),
  );

  r = await api(bruno, "GET", `${org}/reports/hours?${MARCH}`);
  check("members cannot see it → 403", r.status === 403, r.status);
  r = await api(null, "GET", `${org}/reports/hours?${MARCH}`);
  check("requires a session → 401", r.status === 401, r.status);
  r = await api(
    carla,
    "GET",
    `${org}/reports/hours?from=2030-03-31&to=2030-03-01`,
  );
  check("reversed period → 400", r.status === 400, r.status);
  r = await api(
    carla,
    "GET",
    `${org}/reports/hours?from=2030-01-01&to=2030-06-30`,
  );
  check("more than 93 days → 400", r.status === 400, r.status);
  r = await api(
    carla,
    "GET",
    `${org}/reports/hours?${MARCH}&teamId=00000000-0000-4000-8000-000000000000`,
  );
  check("unknown team → 404", r.status === 404, r.status);

  // --- CSV --------------------------------------------------------------------
  r = await api(carla, "GET", `${org}/reports/hours/export?${MARCH}`);
  const lines = r.text.trimEnd().split("\r\n");
  check(
    "CSV: header and decimal hours",
    r.status === 200 &&
      lines[0] ===
        "Pessoa;Plantões;Horas;Horas noturnas (22h-5h);Horas em fim de semana;Dias de afastamento;Média semanal (h)" &&
      lines.includes("Bruno;2;24;0;12;6;5,42"),
    lines.slice(0, 3).join(" | "),
  );

  // --- Page -------------------------------------------------------------------
  r = await api(carla, "GET", `/orgs/${orgId}/reports?month=2030-03`);
  check(
    "report page shows the month",
    r.status === 200 &&
      r.text.includes("Relatório de horas") &&
      r.text.includes("março de 2030") &&
      r.text.includes("6 dias") &&
      r.text.includes(`reports/hours/export?${MARCH}`),
    r.status,
  );
  r = await api(bruno, "GET", `/orgs/${orgId}/reports`);
  check(
    "members get a notice instead of the report",
    r.text.includes("Apenas administradores e gestores veem o relatório"),
    r.status,
  );
  const managerNav = await api(carla, "GET", `/orgs/${orgId}`);
  const memberNav = await api(bruno, "GET", `/orgs/${orgId}`);
  check(
    "the Horas tab is only shown to managers",
    managerNav.text.includes(`href="/orgs/${orgId}/reports"`) &&
      !memberNav.text.includes(`href="/orgs/${orgId}/reports"`),
  );
}
