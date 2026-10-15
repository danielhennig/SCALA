import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  DEFAULT_TIMEZONE,
} from "@/lib/validation/organizations";

describe("createOrganizationSchema", () => {
  it("trims, lowercases the slug and defaults the timezone", () => {
    const result = createOrganizationSchema.parse({
      name: "  Hospital Central ",
      slug: " Hospital-Central ",
    });
    expect(result).toEqual({
      name: "Hospital Central",
      slug: "hospital-central",
      timezone: DEFAULT_TIMEZONE,
    });
  });

  it.each([
    "ab",
    "com espaço",
    "-inicio",
    "fim-",
    "duplo--hifen",
    "acentuação",
  ])("rejects invalid slug %j", (slug) => {
    expect(
      createOrganizationSchema.safeParse({ name: "Org", slug }).success,
    ).toBe(false);
  });

  it("rejects names shorter than 2 characters after trimming", () => {
    expect(
      createOrganizationSchema.safeParse({ name: " a ", slug: "org" }).success,
    ).toBe(false);
  });

  it("accepts Brazilian timezones and rejects unknown ones", () => {
    const base = { name: "Org", slug: "org" };
    expect(
      createOrganizationSchema.safeParse({
        ...base,
        timezone: "America/Manaus",
      }).success,
    ).toBe(true);
    expect(
      createOrganizationSchema.safeParse({ ...base, timezone: "Mars/Olympus" })
        .success,
    ).toBe(false);
  });
});
