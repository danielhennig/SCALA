export const title = "Etapa 1 — autenticação e organizações";

export default async function run({ runId, check, signUp, api }) {
  // --- Anonymous ------------------------------------------------------------
  let r = await api(null, "GET", "/api/v1/orgs");
  check("GET /api/v1/orgs without session → 401", r.status === 401, r.status);
  check(
    "401 uses the standard error shape",
    r.json?.error?.code === "UNAUTHENTICATED",
    JSON.stringify(r.json),
  );

  r = await api(null, "GET", "/orgs");
  check(
    "GET /orgs without session → redirect to /login?next=/orgs",
    r.status === 307 && r.location?.endsWith("/login?next=%2Forgs"),
    `${r.status} ${r.location}`,
  );

  r = await api(null, "GET", "/login");
  check("GET /login without session → 200", r.status === 200, r.status);

  // --- Ana creates an organization -----------------------------------------
  const ana = await signUp("ana", "Ana Admin");

  r = await api(ana, "GET", "/login");
  check(
    "GET /login with session → redirect to /orgs",
    r.status === 307 && r.location?.endsWith("/orgs"),
    `${r.status} ${r.location}`,
  );

  r = await api(ana, "POST", "/api/v1/orgs", "{not json");
  check(
    "POST invalid JSON → 400 BAD_REQUEST",
    r.status === 400 && r.json?.error?.code === "BAD_REQUEST",
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", "/api/v1/orgs", { name: "x", slug: "Not Valid" });
  check(
    "POST invalid fields → 400 with fieldErrors",
    r.status === 400 &&
      r.json?.error?.details?.fieldErrors?.name &&
      r.json?.error?.details?.fieldErrors?.slug,
    JSON.stringify(r.json),
  );

  const slug = `hospital-${runId}`;
  r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital Central",
    slug,
  });
  const orgId = r.json?.data?.id;
  check("POST valid → 201", r.status === 201, JSON.stringify(r.json));
  check(
    "response is camelCase and hides DB-only columns",
    r.json?.data?.minRestHours === 11 &&
      !("created_by" in r.json.data) &&
      !("updated_at" in r.json.data),
    JSON.stringify(r.json),
  );

  r = await api(ana, "POST", "/api/v1/orgs", { name: "Outro", slug });
  check(
    "duplicate slug → 409",
    r.status === 409 && r.json?.error?.code === "CONFLICT",
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", "/api/v1/orgs");
  check(
    "list has the org with role admin",
    r.json?.data?.length === 1 &&
      r.json.data[0].id === orgId &&
      r.json.data[0].role === "admin",
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", "/orgs");
  check(
    "/orgs page renders the org",
    r.status === 200 && r.text.includes("Hospital Central"),
    r.status,
  );

  r = await api(ana, "GET", `/orgs/${orgId}`);
  check(
    "/orgs/[id] renders details for the admin",
    r.status === 200 &&
      r.text.includes("America/Sao_Paulo") &&
      /administrador/i.test(r.text),
    r.status,
  );

  // --- Bruno, an outsider ---------------------------------------------------
  const bruno = await signUp("bruno");

  r = await api(bruno, "GET", "/api/v1/orgs");
  check(
    "outsider sees no organizations",
    r.status === 200 && r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "GET", `/orgs/${orgId}`);
  check(
    "outsider gets the not-found UI",
    !r.text.includes("America/Sao_Paulo") && r.text.includes("404"),
    r.status,
  );

  r = await api(ana, "GET", "/orgs/not-a-uuid");
  check(
    "invalid org id → not-found UI (not a 500)",
    r.status !== 500 && r.text.includes("404"),
    r.status,
  );
}
