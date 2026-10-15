import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths, including query strings", () => {
    expect(safeNextPath("/orgs/123?tab=escalas")).toBe("/orgs/123?tab=escalas");
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["absolute URL", "https://evil.com"],
    ["protocol-relative URL", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["relative path", "orgs"],
  ])("falls back for %s", (_, input) => {
    expect(safeNextPath(input)).toBe("/orgs");
  });

  it("uses a custom fallback", () => {
    expect(safeNextPath(null, "/me")).toBe("/me");
  });
});
