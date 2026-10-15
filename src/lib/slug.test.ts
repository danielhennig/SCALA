import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("removes accents and punctuation", () => {
    expect(slugify("Hospital São José — UTI")).toBe("hospital-sao-jose-uti");
  });

  it("collapses repeated separators and trims hyphens", () => {
    expect(slugify("  --3º  Batalhão!!  ")).toBe("3o-batalhao");
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugify("—!!—")).toBe("");
  });

  it("caps length at 50 without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(49)} b`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("always produces values accepted by the DB pattern", () => {
    for (const input of [
      "Pronto-Socorro Central",
      "UPA 24h",
      "Delegacia nº 5",
    ]) {
      expect(slugify(input)).toMatch(SLUG_PATTERN);
    }
  });
});
