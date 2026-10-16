import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "./errors";
import { createClient, type Supabase } from "./supabase";

export type CurrentUser = { id: string; email: string | null };

export type AuthContext = { supabase: Supabase; user: CurrentUser };

// getClaims() verifies the JWT, unlike auth.getSession(), which trusts the
// cookie as-is. Memoized per request so every component shares one client and
// one AuthContext (which also lets getMyOrganization's cache hit).
export const getSession = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub, email } = data.claims;
  return {
    supabase,
    user: { id: sub, email: typeof email === "string" ? email : null },
  };
});

/** For pages and layouts: redirects to /login when there's no session. */
export async function requireUser(): Promise<AuthContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For Route Handlers: throws a 401 instead of redirecting. */
export async function requireApiUser(): Promise<AuthContext> {
  const session = await getSession();
  if (!session)
    throw new AppError("UNAUTHENTICATED", "Faça login para continuar.");
  return session;
}
