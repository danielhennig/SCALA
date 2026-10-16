import "server-only";
import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

// Server client bound to the request's cookies, so every query runs as the
// signed-in user and RLS applies.
export async function createClient() {
  // 1) cookies(): request-time API; build-time prerenders bail out here.
  const cookieStore = await cookies();
  // 2) io(): supabase-js reads the clock (Date.now) as soon as the client is
  // created, to check token expiry. Prerenders that do include cookies (the
  // session-aware App Shell prefetch) forbid that under Cache Components; io()
  // suspends there and resolves immediately on real requests.
  await io();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's expected: proxy.ts
          // refreshes the session and writes the cookies on every request.
        }
      },
    },
  });
}
