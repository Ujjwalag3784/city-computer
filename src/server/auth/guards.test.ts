import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

// `guards.ts`'s `requireAdminSession` calls out to `session-state.ts`'s
// Redis-backed `isAdminSessionWithinLimits` — mocked here so this test
// suite never needs a real Redis connection, and so each test can set the
// exact within-limits/expired outcome it wants to exercise.
vi.mock("@/server/auth/session-state", () => ({
  isAdminSessionWithinLimits: vi.fn(),
}));

const { isAdminSessionWithinLimits } = await import("@/server/auth/session-state");
const { isCustomerSession, requireAdminSession, requireSession } = await import("./guards");

function makeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    sessionToken: "test-session-token",
    user: {
      id: "user_1",
      roleKeys: [],
      permissionKeys: [],
      twoFactorEnabled: false,
      twoFactorVerified: true,
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.mocked(isAdminSessionWithinLimits).mockReset();
  vi.mocked(isAdminSessionWithinLimits).mockResolvedValue(true);
});

describe("requireSession", () => {
  it("throws UnauthenticatedError for a null session", () => {
    expect(() => requireSession(null)).toThrow(UnauthenticatedError);
  });

  it("returns the session unchanged when present", () => {
    const session = makeSession();
    expect(requireSession(session)).toBe(session);
  });
});

describe("isCustomerSession", () => {
  it("is false for no session", () => {
    expect(isCustomerSession(null)).toBe(false);
  });

  it("is true for a session with only the CUSTOMER role (or no admin role at all)", () => {
    expect(isCustomerSession(makeSession({ roleKeys: ["CUSTOMER"] }))).toBe(true);
    expect(isCustomerSession(makeSession({ roleKeys: [] }))).toBe(true);
  });

  it("is false for a session holding any admin-ish role", () => {
    expect(isCustomerSession(makeSession({ roleKeys: ["STAFF"] }))).toBe(false);
  });
});

describe("requireAdminSession — the full docs/13 §2/§3 admin-entry check", () => {
  it("throws UnauthenticatedError with no session", async () => {
    await expect(requireAdminSession(null)).rejects.toThrow(UnauthenticatedError);
  });

  it("throws ForbiddenError for a CUSTOMER-only session", async () => {
    const session = makeSession({ roleKeys: ["CUSTOMER"] });
    await expect(requireAdminSession(session)).rejects.toThrow(ForbiddenError);
  });

  it("succeeds for STAFF (no 2FA requirement) within session limits", async () => {
    const session = makeSession({ roleKeys: ["STAFF"] });
    await expect(requireAdminSession(session)).resolves.toBe(session);
  });

  it("throws ForbiddenError for OWNER/MANAGER when 2FA hasn't been verified this session", async () => {
    const session = makeSession({ roleKeys: ["OWNER"], twoFactorVerified: false });
    await expect(requireAdminSession(session)).rejects.toThrow(ForbiddenError);
  });

  it("succeeds for OWNER when 2FA has been verified", async () => {
    const session = makeSession({ roleKeys: ["OWNER"], twoFactorVerified: true });
    await expect(requireAdminSession(session)).resolves.toBe(session);
  });

  it("throws UnauthenticatedError once the session is outside its 8h/30min Redis-tracked limits, even though the role/2FA checks pass", async () => {
    vi.mocked(isAdminSessionWithinLimits).mockResolvedValue(false);
    const session = makeSession({ roleKeys: ["STAFF"] });
    await expect(requireAdminSession(session)).rejects.toThrow(UnauthenticatedError);
  });
});
