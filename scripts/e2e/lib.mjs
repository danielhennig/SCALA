// Shared helpers for the end-to-end suites. They drive the real app over HTTP
// and create real users in Supabase, so they only run against a local stack.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createServerClient } = require("@supabase/ssr");

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the shell instead.
}

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function assertLocalTarget() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  const host = new URL(SUPABASE_URL).hostname;
  if (
    !["127.0.0.1", "localhost"].includes(host) &&
    process.env.E2E_ALLOW_REMOTE !== "1"
  ) {
    throw new Error(
      `Refusing to create test users in ${SUPABASE_URL}. ` +
        "Point .env.local at the local Supabase (npx supabase status), " +
        "or set E2E_ALLOW_REMOTE=1 if you really mean it.",
    );
  }
}

/** Fresh helpers per suite: unique e-mails, own pass/fail counters. */
export function createContext() {
  const runId = randomUUID().slice(0, 8);
  let passed = 0;
  let failed = 0;

  function check(label, condition, extra = "") {
    if (condition) {
      passed++;
      console.log(`  PASS  ${label}`);
    } else {
      failed++;
      console.log(`  FAIL  ${label}  ${extra}`);
    }
  }

  /**
   * Signs up `${name}-${runId}@example.com` (local Supabase auto-confirms
   * e-mails) and returns the session cookies the app expects.
   */
  async function signUp(
    name,
    fullName = name[0].toUpperCase() + name.slice(1),
  ) {
    const email = `${name}-${runId}@example.com`;
    const jar = new Map();
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
        setAll: (cookies) =>
          cookies.forEach(({ name: n, value }) =>
            value ? jar.set(n, value) : jar.delete(n),
          ),
      },
    });
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "senha-forte-123",
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        "Sign-up returned no session: e-mail confirmation must be disabled (local Supabase).",
      );
    }
    return {
      email,
      userId: data.user.id,
      cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; "),
    };
  }

  /**
   * Calls the app as `user` (or anonymously with null). Objects are sent as
   * JSON; strings are sent verbatim (to test malformed bodies). Redirects are
   * not followed so tests can assert on them.
   */
  async function api(user, method, path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      redirect: "manual",
      headers: {
        ...(user ? { cookie: user.cookie } : {}),
        "content-type": "application/json",
      },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
    // Make page text match what users see: React's SSR separates adjacent
    // text and values with <!-- --> markers ("de <!-- -->11 h") and escapes
    // quotes in text nodes (&quot;).
    const text = (await res.text())
      .replaceAll("<!-- -->", "")
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // HTML page
    }
    return {
      status: res.status,
      json,
      text,
      location: res.headers.get("location"),
    };
  }

  return {
    runId,
    check,
    signUp,
    api,
    results: () => ({ passed, failed }),
  };
}
