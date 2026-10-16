import { describe, expect, it } from "vitest";
import {
  canInvite,
  canManageMembers,
  canManageScheduling,
  canManageTeams,
  invitableRoles,
} from "@/lib/roles";

describe("role permissions (mirror of RLS)", () => {
  it("only admins manage members", () => {
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("manager")).toBe(false);
    expect(canManageMembers("member")).toBe(false);
  });

  it("admins and managers manage teams and scheduling", () => {
    expect(canManageTeams("admin")).toBe(true);
    expect(canManageTeams("manager")).toBe(true);
    expect(canManageTeams("member")).toBe(false);
    expect(canManageScheduling("manager")).toBe(true);
    expect(canManageScheduling("member")).toBe(false);
  });

  it("admins invite any role; managers only members; members nobody", () => {
    expect(invitableRoles("admin")).toEqual(["member", "manager", "admin"]);
    expect(canInvite("manager", "member")).toBe(true);
    expect(canInvite("manager", "manager")).toBe(false);
    expect(canInvite("member")).toBe(false);
  });
});
