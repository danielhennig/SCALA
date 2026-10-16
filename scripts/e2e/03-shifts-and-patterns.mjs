export const title = "Etapa 3 — tipos de turno e regimes";

const MISSING_ID = "3f6c2a7e-8b1d-4c5e-9f0a-1b2c3d4e5f60";

export default async function run({ runId, check, signUp, api }) {
  const [ana, bruno] = await Promise.all([signUp("ana"), signUp("bruno")]);

  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "UPA E2E",
    slug: `upa-${runId}`,
  });
  const orgId = r.json?.data?.id;
  const org = `/api/v1/orgs/${orgId}`;
  check("setup: org created", r.status === 201, r.status);

  // --- Shift types ----------------------------------------------------------
  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "Noturno",
    startTime: "19:00",
    durationMinutes: 720,
    color: "#4F46E5",
  });
  const noturno = r.json?.data;
  check(
    "create night shift → 201, color lowercased",
    r.status === 201 &&
      noturno?.color === "#4f46e5" &&
      noturno?.startTime === "19:00",
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "Diurno",
    startTime: "07:00",
    durationMinutes: 720,
    color: "#f59e0b",
  });
  const diurno = r.json?.data;
  check("create day shift → 201", r.status === 201, r.status);

  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "diurno",
    startTime: "08:00",
    durationMinutes: 480,
    color: "#16a34a",
  });
  check("duplicate name → 409", r.status === 409, r.status);

  r = await api(ana, "POST", `${org}/shift-types`, {
    name: "Longo",
    startTime: "08:00",
    durationMinutes: 2000,
    color: "#16a34a",
  });
  check(
    "duration > 24h → 400 with field error",
    r.status === 400 && r.json?.error?.details?.fieldErrors?.durationMinutes,
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", `${org}/shift-types`);
  check(
    "list ordered by start time",
    r.json?.data?.map((s) => s.name).join(",") === "Diurno,Noturno",
    JSON.stringify(r.json),
  );

  r = await api(ana, "PATCH", `${org}/shift-types/${noturno.id}`, {
    name: "Noturno",
    startTime: "19:00",
    durationMinutes: 660,
    color: "#4f46e5",
  });
  check(
    "edit shift type → 200",
    r.status === 200 && r.json?.data?.durationMinutes === 660,
    JSON.stringify(r.json),
  );

  // --- Rotation patterns ----------------------------------------------------
  r = await api(ana, "POST", `${org}/rotation-patterns`, {
    name: "12x36",
    days: [diurno.id, null],
  });
  const patternId = r.json?.data?.id;
  check(
    "create 12x36 → 201",
    r.status === 201 && patternId,
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", `${org}/rotation-patterns/${patternId}`);
  check(
    "pattern has the full cycle with the day off",
    r.json?.data?.cycleLength === 2 &&
      r.json.data.days[0] === diurno.id &&
      r.json.data.days[1] === null,
    JSON.stringify(r.json),
  );

  r = await api(ana, "PUT", `${org}/rotation-patterns/${patternId}`, {
    name: "12x36 alternado",
    days: [diurno.id, null, noturno.id, null],
  });
  check("replace cycle with PUT → 200", r.status === 200, r.status);

  r = await api(ana, "GET", `${org}/rotation-patterns`);
  const listed = r.json?.data?.[0];
  check(
    "list reflects the new 4-day cycle",
    listed?.name === "12x36 alternado" &&
      listed.days.length === 4 &&
      listed.days[2] === noturno.id,
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", `${org}/rotation-patterns`, {
    name: "Só folga",
    days: [null, null],
  });
  check("cycle without shifts → 400", r.status === 400, r.status);

  r = await api(ana, "POST", `${org}/rotation-patterns`, {
    name: "Fantasma",
    days: [MISSING_ID],
  });
  check(
    "unknown shift type → 400",
    r.status === 400 && r.json?.error?.message === "Tipo de turno inválido.",
    JSON.stringify(r.json),
  );

  r = await api(ana, "PUT", `${org}/rotation-patterns/${MISSING_ID}`, {
    name: "Inexistente",
    days: [diurno.id],
  });
  check("PUT missing pattern → 404", r.status === 404, r.status);

  r = await api(ana, "DELETE", `${org}/shift-types/${diurno.id}`);
  check(
    "deleting a shift type in use → 409",
    r.status === 409 && r.json?.error?.message?.includes("regime"),
    JSON.stringify(r.json),
  );

  // --- Member (read-only) ---------------------------------------------------
  r = await api(ana, "POST", `${org}/invitations`, { email: bruno.email });
  r = await api(
    bruno,
    "POST",
    `/api/v1/invitations/${r.json?.data?.token}/accept`,
  );
  check("setup: bruno joins as member", r.status === 200, r.status);

  r = await api(bruno, "GET", `${org}/shift-types`);
  check(
    "member reads shift types",
    r.json?.data?.length === 2,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${org}/shift-types`, {
    name: "Meu",
    startTime: "08:00",
    durationMinutes: 480,
    color: "#16a34a",
  });
  check("member cannot create shift types → 403", r.status === 403, r.status);

  r = await api(bruno, "PUT", `${org}/rotation-patterns/${patternId}`, {
    name: "Hack",
    days: [diurno.id],
  });
  check("member cannot edit patterns → 403", r.status === 403, r.status);

  // --- Pages ----------------------------------------------------------------
  r = await api(ana, "GET", `/orgs/${orgId}/shifts`);
  check(
    "shifts page lists types and patterns with weekly hours",
    r.status === 200 &&
      r.text.includes("12x36 alternado") &&
      r.text.includes("h/semana") &&
      r.text.includes("19:00 – 06:00 (+1)"),
    r.status,
  );

  r = await api(ana, "GET", `/orgs/${orgId}/shifts/patterns/${patternId}`);
  check(
    "pattern editor pre-fills the name",
    r.status === 200 && r.text.includes('value="12x36 alternado"'),
    r.status,
  );

  r = await api(ana, "GET", `/orgs/${orgId}/shifts/patterns/new`);
  check(
    "new pattern page shows presets",
    r.status === 200 &&
      r.text.includes("Começar de um modelo") &&
      r.text.includes("24x72"),
    r.status,
  );

  r = await api(bruno, "GET", `/orgs/${orgId}/shifts`);
  check(
    "member sees the page without management controls",
    r.status === 200 &&
      r.text.includes("12x36 alternado") &&
      !r.text.includes("Novo regime"),
    r.status,
  );

  // --- Cleanup through the API ----------------------------------------------
  r = await api(ana, "DELETE", `${org}/rotation-patterns/${patternId}`);
  check("delete pattern → 204", r.status === 204, r.status);

  r = await api(ana, "DELETE", `${org}/shift-types/${diurno.id}`);
  check("unused shift type can be deleted → 204", r.status === 204, r.status);
}
