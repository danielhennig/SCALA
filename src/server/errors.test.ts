import { describe, expect, it } from "vitest";
import { fromPostgrestError } from "@/server/errors";

describe("fromPostgrestError", () => {
  it.each([
    ["23505", 409, "CONFLICT"],
    ["23P01", 409, "CONFLICT"],
    ["23514", 400, "VALIDATION_ERROR"],
    ["22023", 400, "VALIDATION_ERROR"],
    ["42501", 403, "FORBIDDEN"],
    ["PGRST116", 404, "NOT_FOUND"],
    ["23503", 400, "VALIDATION_ERROR"],
    ["SC001", 409, "CONFLICT"],
    ["SC002", 400, "BAD_REQUEST"],
    ["SC003", 403, "FORBIDDEN"],
    ["SC004", 409, "CONFLICT"],
  ])("maps %s to %i %s", (code, status, appCode) => {
    const error = fromPostgrestError({ code, message: "db error" });
    expect(error.status).toBe(status);
    expect(error.code).toBe(appCode);
  });

  it("maps unknown codes to 500 and keeps the original as cause", () => {
    const original = { code: "XX000", message: "boom" };
    const error = fromPostgrestError(original);
    expect(error.status).toBe(500);
    expect(error.cause).toBe(original);
  });
});
