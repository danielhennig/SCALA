import { BASE_URL } from "./lib.mjs";

export const title = "Etapa 8 — feed iCal, CSV e impressão";

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

/** The lib's api() decodes text (dropping the BOM); this keeps raw bytes and headers. */
async function raw(user, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: user ? { cookie: user.cookie } : {},
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  return {
    status: res.status,
    headers: res.headers,
    bytes,
    text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes),
  };
}

const countEvents = (ics) => ics.split("BEGIN:VEVENT").length - 1;

export default async function run({ runId, check, signUp, api }) {
  const [ana, bruno, eva] = await Promise.all([
    signUp("ana"),
    signUp("bruno"),
    // A name a spreadsheet would run as a formula.
    signUp("eva", "=Eva"),
  ]);

  // --- Setup: published 12x36 (bruno odd days, eva even days) --------------
  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Export",
    slug: `export-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  for (const user of [bruno, eva]) await join(api, ana, org, user);
  const team = (await api(ana, "POST", `${org}/teams`, { name: "UTI, Ala B" }))
    .json?.data?.id;
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
    await api(ana, "POST", `${org}/schedules`, {
      teamId: team,
      name: "UTI — exportação",
      periodStart: day(1),
      periodEnd: day(28),
    })
  ).json?.data?.id;
  const sched = `${org}/schedules/${scheduleId}`;
  await api(ana, "POST", `${sched}/generate`, {
    patternId,
    assignments: [
      { userId: bruno.userId, offset: 0 },
      { userId: eva.userId, offset: 1 },
    ],
  });
  r = await api(ana, "POST", `${sched}/publish`);
  check(
    "setup: published 28-day 12x36 for bruno and eva",
    r.json?.data?.status === "published",
    JSON.stringify(r.json),
  );

  // --- Calendar feed ----------------------------------------------------------
  r = await api(null, "POST", "/api/v1/me/calendar-feed");
  check("creating a feed requires a session → 401", r.status === 401, r.status);

  r = await api(bruno, "GET", "/api/v1/me/calendar-feed");
  check(
    "no feed at first",
    r.status === 200 && r.json?.data === null,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", "/api/v1/me/calendar-feed");
  const firstUrl = r.json?.data?.url ?? "";
  const firstPath = firstUrl.replace(/^https?:\/\/[^/]+/, "");
  check(
    "POST returns the feed URL once → 201",
    r.status === 201 &&
      /^\/api\/v1\/calendar\/[0-9a-f]{64}\.ics$/.test(firstPath),
    JSON.stringify(r.json),
  );

  let feed = await raw(null, firstPath);
  check(
    "the feed opens without a session, as text/calendar",
    feed.status === 200 &&
      feed.headers.get("content-type")?.startsWith("text/calendar") &&
      feed.text.startsWith("BEGIN:VCALENDAR\r\n"),
    `${feed.status} ${feed.headers.get("content-type")}`,
  );
  check(
    "it has bruno's 14 shifts and none of eva's",
    countEvents(feed.text) === 14,
    countEvents(feed.text),
  );
  check(
    "events carry type and team, escaped",
    feed.text.includes("SUMMARY:Diurno · UTI\\, Ala B"),
    feed.text.slice(0, 600),
  );

  await api(ana, "POST", `${sched}/unpublish`);
  feed = await raw(null, firstPath);
  check(
    "a schedule back in draft leaves the feed",
    feed.status === 200 && countEvents(feed.text) === 0,
    countEvents(feed.text),
  );
  await api(ana, "POST", `${sched}/publish`);

  r = await api(bruno, "GET", "/me");
  check(
    "Minha escala shows the active feed",
    r.text.includes("Assinar no calendário") &&
      r.text.includes("Link ativo desde"),
    r.status,
  );

  r = await api(bruno, "POST", "/api/v1/me/calendar-feed");
  const secondPath = (r.json?.data?.url ?? "").replace(/^https?:\/\/[^/]+/, "");
  check(
    "a new link invalidates the old one",
    (await raw(null, firstPath)).status === 404 &&
      (await raw(null, secondPath)).status === 200,
  );

  check(
    "malformed tokens → 404",
    (await raw(null, "/api/v1/calendar/abc.ics")).status === 404 &&
      (await raw(null, `/api/v1/calendar/${"0".repeat(64)}.ics`)).status ===
        404,
  );

  r = await api(bruno, "DELETE", "/api/v1/me/calendar-feed");
  check(
    "revoking → 204, and the URL stops working",
    r.status === 204 && (await raw(null, secondPath)).status === 404,
    r.status,
  );

  // --- CSV --------------------------------------------------------------------
  const csv = await raw(ana, `${sched}/export`);
  // text keeps the BOM (one UTF-16 unit); the check below asserts its bytes.
  const lines = csv.text.slice(1).trimEnd().split("\r\n");
  check(
    "CSV download: text/csv attachment with a UTF-8 BOM",
    csv.status === 200 &&
      csv.headers.get("content-type")?.startsWith("text/csv") &&
      /^attachment; filename="escala-uti-exportacao\.csv"$/.test(
        csv.headers.get("content-disposition") ?? "",
      ) &&
      csv.bytes[0] === 0xef &&
      csv.bytes[1] === 0xbb &&
      csv.bytes[2] === 0xbf,
    `${csv.status} ${csv.headers.get("content-disposition")}`,
  );
  check(
    "header + one row per shift (28)",
    lines[0] === "Data;Dia;Pessoa;Turno;Início;Fim;Horas" &&
      lines.length === 29,
    `${lines[0]} (${lines.length})`,
  );
  check(
    "rows have local date/time and hours",
    lines.some((l) =>
      /^\d{2}\/\d{2}\/\d{4};[a-zé]{3}\.;Bruno;Diurno;\d{2}\/\d{2}\/\d{4} 07:00;\d{2}\/\d{2}\/\d{4} 19:00;12$/.test(
        l,
      ),
    ),
    lines[1],
  );
  check(
    "formula-like names are neutralized",
    lines.some((l) => l.includes(";'=Eva;")),
    lines.find((l) => l.includes("Eva")),
  );

  r = await api(null, "GET", `${sched}/export`);
  check("export requires a session → 401", r.status === 401, r.status);

  const draftId = (
    await api(ana, "POST", `${org}/schedules`, {
      teamId: team,
      name: "Rascunho",
      periodStart: day(40),
      periodEnd: day(50),
    })
  ).json?.data?.id;
  r = await api(eva, "GET", `${org}/schedules/${draftId}/export`);
  check("members cannot export drafts → 404", r.status === 404, r.status);

  // --- Print ------------------------------------------------------------------
  r = await api(bruno, "GET", `/orgs/${orgId}/schedules/${scheduleId}`);
  check(
    "schedule page links to print and CSV",
    r.text.includes("Imprimir / PDF") && r.text.includes("Exportar CSV"),
    r.status,
  );
  r = await api(bruno, "GET", `/orgs/${orgId}/schedules/${scheduleId}/print`);
  check(
    "print view renders the sheet",
    r.status === 200 &&
      r.text.includes("Imprimir / salvar PDF") &&
      r.text.includes("Hospital Export · UTI — exportação") &&
      r.text.includes("Diurno (07:00 – 19:00)") &&
      r.text.includes("Gerado em"),
    r.status,
  );
  r = await api(eva, "GET", `/orgs/${orgId}/schedules/${draftId}/print`);
  check(
    "members cannot print drafts",
    r.status === 404 || !r.text.includes("Imprimir / salvar PDF"),
    r.status,
  );
}
