import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_KEYS,
  TWO_FACTOR_MANDATORY_ROLE_KEYS,
  isAdminRoleKey,
  permissionSetHas,
  requirePermission,
  requiresTwoFactor,
} from "./permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

describe("isAdminRoleKey", () => {
  it("accepts every seeded non-CUSTOMER role (prisma/seed/core.ts's ROLES)", () => {
    for (const key of ADMIN_ROLE_KEYS) {
      expect(isAdminRoleKey(key)).toBe(true);
    }
  });

  it("rejects CUSTOMER and anything unrecognised", () => {
    expect(isAdminRoleKey("CUSTOMER")).toBe(false);
    expect(isAdminRoleKey("NOT_A_ROLE")).toBe(false);
  });
});

describe("requiresTwoFactor", () => {
  it("is true for OWNER and MANAGER (docs/13 §2: 'TOTP mandatory for OWNER and MANAGER')", () => {
    for (const key of TWO_FACTOR_MANDATORY_ROLE_KEYS) {
      expect(requiresTwoFactor([key])).toBe(true);
    }
  });

  it("is false for every other role, including other admin roles", () => {
    expect(requiresTwoFactor(["STAFF"])).toBe(false);
    expect(requiresTwoFactor(["CONTENT_EDITOR"])).toBe(false);
    expect(requiresTwoFactor(["SUPPORT"])).toBe(false);
    expect(requiresTwoFactor(["TECHNICIAN"])).toBe(false);
    expect(requiresTwoFactor(["CUSTOMER"])).toBe(false);
    expect(requiresTwoFactor([])).toBe(false);
  });

  it("is true if ANY held role requires it, even alongside roles that don't", () => {
    expect(requiresTwoFactor(["STAFF", "OWNER"])).toBe(true);
  });
});

describe("permissionSetHas", () => {
  it("finds a permission that's present", () => {
    expect(permissionSetHas(["order:view", "order:refund"], "order:refund")).toBe(true);
  });

  it("is false for a permission that isn't present", () => {
    expect(permissionSetHas(["order:view"], "order:refund")).toBe(false);
  });

  it("is false against an empty permission set", () => {
    expect(permissionSetHas([], "order:refund")).toBe(false);
  });
});

describe("requirePermission — the docs/13 §3 enforcement primitive", () => {
  it("throws UnauthenticatedError when there's no session at all", () => {
    expect(() => requirePermission(null, "order:refund")).toThrow(UnauthenticatedError);
    expect(() => requirePermission(undefined, "order:refund")).toThrow(UnauthenticatedError);
  });

  it("throws ForbiddenError when the session lacks the permission", () => {
    const claims = { permissionKeys: ["order:view"] };
    expect(() => requirePermission(claims, "order:refund")).toThrow(ForbiddenError);
  });

  it("returns the claims unchanged when the permission is present", () => {
    const claims = { permissionKeys: ["order:view", "order:refund"] };
    expect(requirePermission(claims, "order:refund")).toBe(claims);
  });

  it("never conflates the two failure cases (docs/13 §2 enumeration resistance: the two errors are distinct types, but neither reveals *why* beyond auth-vs-authz)", () => {
    const authError = (() => {
      try {
        requirePermission(null, "order:refund");
      } catch (error) {
        return error;
      }
    })();
    const permError = (() => {
      try {
        requirePermission({ permissionKeys: [] }, "order:refund");
      } catch (error) {
        return error;
      }
    })();

    expect(authError).toBeInstanceOf(UnauthenticatedError);
    expect(permError).toBeInstanceOf(ForbiddenError);
    expect(authError).not.toBeInstanceOf(ForbiddenError);
  });
});
