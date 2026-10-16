export const title = "Etapa 6 — férias e afastamentos";

const DAY_MS = 24 * 60 * 60 * 1000;
const START_MS = Date.now();
/** Calendar date `n` days after today (UTC), as YYYY-MM-DD. */
const day = (n) => new Date(START_MS + n * DAY_MS).toISOString().slice(0, 10);

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
  const [ana, carla, bruno, eva] = await Promise.all(
    ["ana", "carla", "bruno", "eva"].map((name) => signUp(name)),
  );

  // --- Setup ------------------------------------------------------------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Férias",
    slug: `ferias-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  await join(api, ana, org, carla, "manager");
  await join(api, ana, org, bruno);
  await join(api, ana, org, eva);
  const team = (await api(ana, "POST", `${org}/teams`, { name: "UTI" })).json
    ?.data?.id;
  for (const user of [bruno, eva]) {
    await api(ana, "POST", `${org}/teams/${team}/members`, {
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
  const scheduleId = (
    await api(carla, "POST", `${org}/schedules`, {
      teamId: team,
      name: "UTI — 4 semanas",
      periodStart: day(0),
      periodEnd: day(27),
    })
  ).json?.data?.id;
  const sched = `${org}/schedules/${scheduleId}`;
  check(
    "setup: org, team of 2, 12x36 and a 28-day schedule",
    orgId && team && patternId && scheduleId,
  );

  // --- Register / request -----------------------------------------------------
  r = await api(carla, "POST", `${org}/time-off`, {
    userId: bruno.userId,
    kind: "vacation",
    startDate: day(4),
    endDate: day(9),
  });
  const brunoVacation = r.json?.data;
  check(
    "manager registers vacation → approved right away",
    r.status === 201 &&
      brunoVacation?.status === "approved" &&
      brunoVacation?.fullName === "Bruno",
    JSON.stringify(r.json),
  );

  r = await api(carla, "POST", `${org}/time-off`, {
    userId: bruno.userId,
    kind: "medical",
    startDate: day(8),
    endDate: day(12),
  });
  check("overlapping time off → 409", r.status === 409, r.status);

  r = await api(eva, "POST", `${org}/time-off`, {
    kind: "leave",
    startDate: day(10),
    endDate: day(12),
  });
  const evaLeave = r.json?.data;
  check(
    "member requests for herself → pending",
    r.status === 201 && evaLeave?.status === "pending",
    JSON.stringify(r.json),
  );

  r = await api(eva, "POST", `${org}/time-off`, {
    userId: bruno.userId,
    kind: "vacation",
    startDate: day(20),
    endDate: day(21),
  });
  check(
    "member cannot request for someone else → 403",
    r.status === 403,
    r.status,
  );

  r = await api(bruno, "GET", `${org}/time-off`);
  check(
    "members see only their own entries",
    r.json?.data?.length === 1 && r.json.data[0].userId === bruno.userId,
    JSON.stringify(r.json),
  );

  r = await api(carla, "GET", `${org}/time-off`);
  check(
    "managers see everyone's entries",
    r.json?.data?.length === 2,
    r.json?.data?.length,
  );

  r = await api(eva, "PATCH", `${org}/time-off/${evaLeave?.id}`, {
    status: "approved",
  });
  check("member cannot approve → 403", r.status === 403, r.status);

  r = await api(carla, "PATCH", `${org}/time-off/${evaLeave?.id}`, {
    status: "approved",
  });
  check(
    "manager approves (no shifts yet → 0 conflicts)",
    r.status === 200 &&
      r.json?.data?.timeOff?.status === "approved" &&
      r.json.data.conflictingShifts === 0,
    JSON.stringify(r.json),
  );

  // --- Generation skips days off ----------------------------------------------
  r = await api(carla, "POST", `${sched}/generate`, {
    patternId,
    assignments: [
      { userId: bruno.userId, offset: 0 },
      { userId: eva.userId, offset: 1 },
    ],
  });
  check(
    "generator skips days off: 24 created, 4 skipped",
    r.json?.data?.created === 24 && r.json.data.skippedForTimeOff === 4,
    JSON.stringify(r.json),
  );

  r = await api(carla, "GET", sched);
  const shifts = r.json?.data?.shifts ?? [];
  check(
    "no shift for bruno during his vacation",
    !shifts.some(
      (s) => s.userId === bruno.userId && s.date >= day(4) && s.date <= day(9),
    ),
  );
  check(
    "detail carries approved time off for the grid",
    r.json?.data?.timeOff?.length === 2,
    r.json?.data?.timeOff?.length,
  );

  r = await api(carla, "PUT", `${sched}/cells`, {
    userId: bruno.userId,
    date: day(5),
    shiftTypeId: diurno.id,
  });
  check(
    "assigning a shift during time off → 409",
    r.status === 409 && r.json?.error?.message?.includes("afastada"),
    JSON.stringify(r.json),
  );

  r = await api(carla, "PUT", `${sched}/cells`, {
    userId: bruno.userId,
    date: day(3),
    shiftTypeId: diurno.id,
  });
  check("the day before time off is fine", r.status === 204, r.status);

  // --- Approval over existing shifts -----------------------------------------
  r = await api(eva, "POST", `${org}/time-off`, {
    kind: "other",
    startDate: day(21),
    endDate: day(21),
  });
  r = await api(carla, "PATCH", `${org}/time-off/${r.json?.data?.id}`, {
    status: "approved",
  });
  check(
    "approving over an existing shift is allowed and reports 1 conflict",
    r.status === 200 && r.json?.data?.conflictingShifts === 1,
    JSON.stringify(r.json),
  );

  r = await api(carla, "GET", `/orgs/${orgId}/schedules/${scheduleId}`);
  check(
    "grid lists the shift that falls on time off",
    r.status === 200 && r.text.includes("Plantões durante afastamento (1)"),
    r.status,
  );

  r = await api(carla, "GET", `/orgs/${orgId}/time-off`);
  check(
    "time off page flags the conflict for the manager",
    r.status === 200 && r.text.includes("1 plantão cai neste afastamento"),
    r.status,
  );

  // --- Cancel / delete ----------------------------------------------------------
  r = await api(bruno, "POST", `${org}/time-off`, {
    kind: "leave",
    startDate: day(25),
    endDate: day(25),
  });
  r = await api(bruno, "DELETE", `${org}/time-off/${r.json?.data?.id}`);
  check(
    "member cancels their own pending request → 204",
    r.status === 204,
    r.status,
  );

  r = await api(bruno, "DELETE", `${org}/time-off/${brunoVacation?.id}`);
  check(
    "member cannot delete an approved entry → 404",
    r.status === 404,
    r.status,
  );

  r = await api(bruno, "GET", `/orgs/${orgId}/time-off`);
  check(
    "member page shows only their own entries",
    r.status === 200 &&
      r.text.includes("Seus afastamentos") &&
      r.text.includes("Férias") &&
      !r.text.includes("Eva"),
    r.status,
  );

  // --- Audit --------------------------------------------------------------------
  r = await api(ana, "GET", `/orgs/${orgId}/audit`);
  check(
    "audit describes registration, request and approval",
    r.text.includes("Registrou férias de Bruno") &&
      r.text.includes("Eva pediu licença") &&
      r.text.includes("Aprovou licença de Eva") &&
      r.text.includes("Bruno cancelou o pedido de licença"),
    r.status,
  );
}
