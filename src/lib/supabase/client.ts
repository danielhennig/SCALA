import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublishableKey, supabaseUrl } from "./config";

// Browser client: used only for Supabase Auth (sign in/up/out).
// Domain reads and writes go through Server Components and /api/v1.
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
