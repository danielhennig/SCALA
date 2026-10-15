/**
 * Returns `next` only if it's a same-origin path; otherwise `fallback`.
 * Prevents open redirects via ?next=https://evil.com or ?next=//evil.com.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/orgs",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  return next;
}
