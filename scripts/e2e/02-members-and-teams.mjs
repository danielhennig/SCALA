export const title = "Etapa 2 — membros, convites e equipes";

export default async function run({ runId, check, signUp, api }) {
  const [ana, bruno, carla, diego] = await Promise.all(
    ["ana", "bruno", "carla", "diego"].map((name) => signUp(name)),
  );

  let r = await api(ana, "POST", "/api/v1/orgs", {
    name: "Hospital E2E",
    slug: `hosp-${runId}`,
  });
  const orgId = r.json?.data?.id;
  check("setup: ana creates org", r.status === 201, r.status);
  const org = `/api/v1/orgs/${orgId}`;

  // --- Invitations ----------------------------------------------------------
  r = await api(ana, "POST", `${org}/invitations`, {
    email: bruno.email.toUpperCase(),
  });
  const brunoToken = r.json?.data?.token;
  check(
    "admin invites (e-mail normalized, role defaults to member)",
    r.status === 201 &&
      r.json.data.email === bruno.email &&
      r.json.data.role === "member",
    JSON.stringify(r.json),
  );
  check(
    "token returned once, 64 hex chars",
    /^[0-9a-f]{64}$/.test(brunoToken ?? ""),
    brunoToken,
  );

  r = await api(ana, "POST", `${org}/invitations`, {
    email: carla.email,
    role: "manager",
  });
  const carlaInvitationId = r.json?.data?.id;
  check("admin invites a manager", r.status === 201, r.status);

  r = await api(ana, "POST", `${org}/invitations`, { email: "invalido" });
  check(
    "invalid e-mail → 400",
    r.status === 400 && r.json?.error?.code === "VALIDATION_ERROR",
    r.status,
  );

  r = await api(ana, "GET", `${org}/invitations`);
  check(
    "pending invitations listed, no token or hash leaked",
    r.json?.data?.length === 2 && !JSON.stringify(r.json).includes("token"),
    JSON.stringify(r.json),
  );

  r = await api(null, "GET", `/invite/${brunoToken}`);
  check(
    "anon invite page offers login/signup preserving next",
    r.status === 200 &&
      r.text.includes(`/login?next=%2Finvite%2F${brunoToken}`),
    r.status,
  );

  r = await api(bruno, "GET", `/login?next=/invite/${brunoToken}`);
  check(
    "logged-in /login?next=… redirects to the invite",
    r.status === 307 && r.location?.endsWith(`/invite/${brunoToken}`),
    `${r.status} ${r.location}`,
  );

  r = await api(bruno, "GET", `/invite/${brunoToken}`);
  check(
    "invitee sees org name and accept button",
    r.text.includes("Hospital E2E") && r.text.includes("Aceitar convite"),
    r.status,
  );

  r = await api(diego, "POST", `/api/v1/invitations/${brunoToken}/accept`);
  check(
    "another user cannot accept → 403",
    r.status === 403 && r.json?.error?.message?.includes("outro e-mail"),
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `/api/v1/invitations/${brunoToken}/accept`);
  check(
    "invitee accepts → orgId",
    r.status === 200 && r.json?.data?.orgId === orgId,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `/api/v1/invitations/${brunoToken}/accept`);
  check("token cannot be reused → 400", r.status === 400, r.status);

  r = await api(bruno, "GET", "/api/v1/orgs");
  check(
    "bruno now lists the org as member",
    r.json?.data?.[0]?.role === "member",
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${org}/invitations`, {
    email: "x@example.com",
  });
  check("member cannot invite → 403", r.status === 403, r.status);

  r = await api(ana, "DELETE", `${org}/invitations/${carlaInvitationId}`);
  check("admin revokes an invitation → 204", r.status === 204, r.status);

  r = await api(ana, "GET", `${org}/invitations`);
  check(
    "no pending invitations left",
    r.json?.data?.length === 0,
    JSON.stringify(r.json),
  );

  // --- Members --------------------------------------------------------------
  r = await api(ana, "GET", `${org}/members`);
  check(
    "members list has names and roles",
    r.json?.data?.length === 2 &&
      r.json.data.some((m) => m.fullName === "Bruno" && m.role === "member"),
    JSON.stringify(r.json),
  );

  r = await api(diego, "GET", `${org}/members`);
  check("outsider → 404", r.status === 404, r.status);

  r = await api(bruno, "PATCH", `${org}/members/${bruno.userId}`, {
    role: "admin",
  });
  check("member cannot change roles → 403", r.status === 403, r.status);

  r = await api(ana, "PATCH", `${org}/members/${ana.userId}`, {
    role: "member",
  });
  check(
    "last admin cannot step down → 409",
    r.status === 409 && r.json?.error?.message?.includes("administrador"),
    JSON.stringify(r.json),
  );

  // --- Teams ----------------------------------------------------------------
  r = await api(bruno, "POST", `${org}/teams`, { name: "Plantão Noturno" });
  check("member cannot create teams → 403", r.status === 403, r.status);

  r = await api(ana, "POST", `${org}/teams`, { name: "UTI Adulto" });
  const teamId = r.json?.data?.id;
  check("admin creates a team → 201", r.status === 201, r.status);

  r = await api(ana, "POST", `${org}/teams`, { name: "uti adulto" });
  check(
    "duplicate team name (case-insensitive) → 409",
    r.status === 409,
    r.status,
  );

  r = await api(ana, "POST", `${org}/teams/${teamId}/members`, {
    userId: bruno.userId,
  });
  check("admin adds a member to the team → 204", r.status === 204, r.status);

  r = await api(ana, "POST", `${org}/teams/${teamId}/members`, {
    userId: diego.userId,
  });
  check(
    "non-member cannot join a team → 400",
    r.status === 400 && r.json?.error?.message?.includes("não é membro"),
    JSON.stringify(r.json),
  );

  r = await api(ana, "PATCH", `${org}/members/${bruno.userId}`, {
    role: "manager",
  });
  check(
    "admin promotes bruno to manager",
    r.status === 200 && r.json?.data?.role === "manager",
    JSON.stringify(r.json),
  );

  r = await api(bruno, "POST", `${org}/teams`, { name: "Pronto-Socorro" });
  check("manager can create teams → 201", r.status === 201, r.status);

  r = await api(ana, "GET", `${org}/teams/${teamId}`);
  check(
    "team detail lists Bruno",
    r.json?.data?.members?.[0]?.fullName === "Bruno",
    JSON.stringify(r.json),
  );

  r = await api(ana, "GET", `${org}/teams`);
  check(
    "teams list has member counts",
    r.json?.data?.find((t) => t.id === teamId)?.memberCount === 1,
    JSON.stringify(r.json),
  );

  r = await api(bruno, "DELETE", `${org}/members/${bruno.userId}`);
  check("bruno leaves the organization → 204", r.status === 204, r.status);

  r = await api(ana, "GET", `${org}/teams/${teamId}`);
  check(
    "leaving the org removed bruno from the team",
    r.json?.data?.members?.length === 0,
    JSON.stringify(r.json),
  );

  // --- Pages ----------------------------------------------------------------
  r = await api(ana, "GET", `/orgs/${orgId}/members`);
  check(
    "members page renders the invite form for admins",
    r.status === 200 && r.text.includes("Convidar pessoa"),
    r.status,
  );

  r = await api(ana, "GET", `/orgs/${orgId}/teams/${teamId}`);
  check(
    "team page renders",
    r.status === 200 && r.text.includes("UTI Adulto"),
    r.status,
  );

  r = await api(diego, "GET", `/orgs/${orgId}/teams`);
  check(
    "outsider gets the not-found UI on the teams page",
    !r.text.includes("UTI Adulto") && r.text.includes("404"),
    r.status,
  );
}
