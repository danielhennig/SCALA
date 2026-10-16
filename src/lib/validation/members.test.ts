import { describe, expect, it } from "vitest";
import {
  createInvitationSchema,
  INVITATION_TOKEN_PATTERN,
  updateMemberRoleSchema,
} from "@/lib/validation/members";

describe("createInvitationSchema", () => {
  it("normalizes the e-mail and defaults the role to member", () => {
    expect(
      createInvitationSchema.parse({ email: "  Eva.Souza@Hospital.ORG " }),
    ).toEqual({ email: "eva.souza@hospital.org", role: "member" });
  });

  it.each(["", "sem-arroba", "a@b", "a b@c.com"])(
    "rejects invalid e-mail %j",
    (email) => {
      expect(createInvitationSchema.safeParse({ email }).success).toBe(false);
    },
  );

  it("rejects unknown roles", () => {
    expect(
      createInvitationSchema.safeParse({ email: "a@b.com", role: "owner" })
        .success,
    ).toBe(false);
  });
});

describe("updateMemberRoleSchema", () => {
  it("accepts the three roles only", () => {
    for (const role of ["admin", "manager", "member"]) {
      expect(updateMemberRoleSchema.safeParse({ role }).success).toBe(true);
    }
    expect(updateMemberRoleSchema.safeParse({ role: "root" }).success).toBe(
      false,
    );
  });
});

describe("INVITATION_TOKEN_PATTERN", () => {
  it("matches 64 lowercase hex chars only", () => {
    expect(INVITATION_TOKEN_PATTERN.test("a".repeat(64))).toBe(true);
    expect(INVITATION_TOKEN_PATTERN.test("A".repeat(64))).toBe(false);
    expect(INVITATION_TOKEN_PATTERN.test("a".repeat(63))).toBe(false);
  });
});
