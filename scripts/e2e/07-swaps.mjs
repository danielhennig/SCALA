export const title = "Etapa 7 — trocas de plantão";

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
  const [ana, carla, bruno, eva, diego] = await Promise.all(
    ["ana", "carla", "bruno", "eva", "diego"].map((name) => signUp(name)),
  );

  // --- Setup: published 12x36 (bruno odd days, eva even days) --------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Trocas",
    slug: `trocas-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  await join(api, ana, org, carla, "manager");
  for (const user of [bruno, eva, diego]) await join(api, ana, org, user);
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
  const noturno = (
    await api(ana, "POST", `${org}/shift-types`, {
      name: "Noturno",
      startTime: "19:00",
      durationMinutes: 720,
      color: "#4f46e5",
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
      name: "UTI — trocas",
      periodStart: day(1),
      periodEnd: day(28),
    })
  ).json?.data?.id;
  const sched = `${org}/schedules/${scheduleId}`;
  await api(carla, "POST", `${sched}/generate`, {
    patternId,
    assignments: [
      { userId: bruno.userId, offset: 0 },
      { userId: eva.userId, offset: 1 },
    ],
  });
  r = await api(carla, "POST", `${sched}/publish`);
  check(
    "setup: published 28-day 12x36 for bruno and eva",
    r.json?.data?.status === "published",
    JSON.stringify(r.json),
  );

  const shifts = async () =>
    (await api(carla, "GET", sched)).json?.data?.shifts ?? [];
  let all = await shifts();
  const shiftOf = (user, n) =>
    all.find((s) => s.userId === user.userId && s.date === day(n))?.id;

  r = await api(bruno, "GET", `/orgs/${orgId}/swaps`);
  check(
    "swaps page offers the request form",
    r.status === 200 && r.text.includes("Pedir troca ou cobertura"),
    r.status,
  );

  // --- Coverage ---------------------------------------------------------------
  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 3),
    targetId: eva.userId,
  });
  const coverId = r.json?.data?.id;
  check(
    "bruno asks eva to cover → 201",
    r.status === 201 && coverId,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 3),
    targetId: diego.userId,
  });
  check("one active request per shift → 409", r.status === 409, r.status);

  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(eva, 4),
    targetId: diego.userId,
  });
  check(
    "cannot offer someone else's shift",
    r.status === 400 || r.status === 404,
    r.status,
  );

  r = await api(eva, "GET", `${org}/swaps`);
  check(
    "eva sees the request addressed to her",
    r.json?.data?.length === 1,
    JSON.stringify(r.json),
  );
  r = await api(diego, "GET", `${org}/swaps`);
  check(
    "other members do not",
    r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  r = await api(eva, "GET", `/orgs/${orgId}`);
  check(
    "the Trocas tab shows eva a pending badge",
    r.text.includes('aria-label="1 pendente"'),
    r.status,
  );

  r = await api(eva, "POST", `${org}/swaps/${coverId}/accept`);
  check(
    "eva accepts → awaiting manager",
    r.json?.data?.status === "pending_approval",
    JSON.stringify(r.json),
  );
  r = await api(eva, "POST", `${org}/swaps/${coverId}/accept`);
  check("answering twice → 409", r.status === 409, r.status);
  r = await api(bruno, "POST", `${org}/swaps/${coverId}/approve`);
  check("members cannot approve → 403", r.status === 403, r.status);

  r = await api(carla, "POST", `${org}/swaps/${coverId}/approve`);
  all = await shifts();
  check(
    "manager approves: day 3 now belongs to eva",
    r.json?.data?.status === "approved" &&
      all.find((s) => s.date === day(3))?.userId === eva.userId,
    JSON.stringify(r.json),
  );

  // --- Exchange ---------------------------------------------------------------
  const b7 = shiftOf(bruno, 7);
  const e8 = shiftOf(eva, 8);
  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: b7,
    targetId: eva.userId,
    requestedShiftId: e8,
  });
  const exchangeId = r.json?.data?.id;
  await api(eva, "POST", `${org}/swaps/${exchangeId}/accept`);
  await api(carla, "POST", `${org}/swaps/${exchangeId}/approve`);
  all = await shifts();
  check(
    "an exchange reassigns both shifts",
    all.find((s) => s.id === b7)?.userId === eva.userId &&
      all.find((s) => s.id === e8)?.userId === bruno.userId,
  );

  // --- Rest warning for the manager ---------------------------------------
  await api(carla, "PUT", `${sched}/cells`, {
    userId: eva.userId,
    date: day(5),
    shiftTypeId: noturno.id,
  });
  all = await shifts();
  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 5),
    targetId: eva.userId,
  });
  const tiredId = r.json?.data?.id;
  await api(eva, "POST", `${org}/swaps/${tiredId}/accept`);
  r = await api(carla, "GET", `${org}/swaps`);
  const tired = r.json?.data?.find((s) => s.id === tiredId);
  check(
    "manager sees the rest warning (eva: day 07–19, then night 19–07)",
    tired?.warnings?.some((w) => w.includes("Eva ficaria com 0h de descanso")),
    JSON.stringify(tired?.warnings),
  );
  r = await api(carla, "POST", `${org}/swaps/${tiredId}/reject`);
  check(
    "manager rejects it",
    r.json?.data?.status === "rejected",
    JSON.stringify(r.json),
  );

  // --- Decline, cancel ----------------------------------------------------------
  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 9),
    targetId: diego.userId,
  });
  r = await api(diego, "POST", `${org}/swaps/${r.json?.data?.id}/decline`);
  check(
    "colleague declines",
    r.json?.data?.status === "declined",
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 11),
    targetId: eva.userId,
  });
  const cancelId = r.json?.data?.id;
  r = await api(bruno, "POST", `${org}/swaps/${cancelId}/cancel`);
  check(
    "requester cancels",
    r.json?.data?.status === "cancelled",
    JSON.stringify(r.json),
  );
  r = await api(bruno, "POST", `${org}/swaps/${cancelId}/cancel`);
  check("cancelling twice → 409", r.status === 409, r.status);

  // --- Time off blocks the approval ------------------------------------------
  await api(carla, "POST", `${org}/time-off`, {
    userId: eva.userId,
    kind: "vacation",
    startDate: day(13),
    endDate: day(13),
  });
  r = await api(bruno, "POST", `${org}/swaps`, {
    offeredShiftId: shiftOf(bruno, 13),
    targetId: eva.userId,
  });
  const vacationId = r.json?.data?.id;
  await api(eva, "POST", `${org}/swaps/${vacationId}/accept`);
  r = await api(carla, "POST", `${org}/swaps/${vacationId}/approve`);
  check(
    "cannot hand a shift to someone on vacation → 409",
    r.status === 409 && r.json?.error?.message?.includes("afastada"),
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", "/me");
  check(
    "Minha escala links each shift to a swap request",
    r.text.includes("Pedir troca"),
    r.status,
  );

  // --- Audit --------------------------------------------------------------------
  r = await api(ana, "GET", `/orgs/${orgId}/audit`);
  check(
    "audit tells the swap stories",
    r.text.includes("Bruno pediu que Eva cubra o plantão de") &&
      r.text.includes("Aprovou: Eva cobre Bruno em") &&
      r.text.includes("Aprovou a troca entre Bruno e Eva") &&
      r.text.includes("Diego recusou o pedido de Bruno") &&
      r.text.includes("Bruno cancelou o pedido de troca"),
    r.status,
  );
}
