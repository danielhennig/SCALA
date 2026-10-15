// NEXT_PUBLIC_* vars must be referenced literally so Next.js can inline them
// into the client bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.",
  );
}

export const supabaseUrl = url;
export const supabasePublishableKey = publishableKey;
