import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ValidationError } from "@/lib/errors";
import { hashOpaqueToken } from "@/lib/token";

vi.mock("@/server/db", () => ({
  db: {
    user: { findFirst: vi.fn(), update: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/rate-limit-store", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/auth/revoke-sessions", () => ({
  revokeAllSessionsForUser: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { revokeAllSessionsForUser } = await import("@/server/auth/revoke-sessions");
const { requestPasswordReset, resetPassword } = await import("./password-reset");

beforeEach(() => {
  vi.mocked(db.user.findFirst).mockReset();
  vi.mocked(db.verificationToken.create)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(db.verificationToken.findUnique).mockReset();
  vi.mocked(db.$transaction)
    .mockReset()
    .mockResolvedValue([{}, {}] as never);
  vi.mocked(revokeAllSessionsForUser).mockReset().mockResolvedValue(undefined);
});

describe("requestPasswordReset — enumeration resistance (docs/13 §2)", () => {
  it("issues a token for an account with a verified email", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      emailVerified: new Date(),
    } as never);

    const result = await requestPasswordReset({ identifier: "owner@example.com" }, "203.0.113.4");

    expect(db.verificationToken.create).toHaveBeenCalled();
    expect(result.resetToken).toBeTypeOf("string");
  });

  it("silently no-ops for an account with no email at all", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "user_1", email: null } as never);

    const result = await requestPasswordReset({ identifier: "9812345678" }, "203.0.113.4");

    expect(db.verificationToken.create).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("silently no-ops for an account whose email isn't verified yet — same response shape as no account", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "user_1",
      email: "unverified@example.com",
      emailVerified: null,
    } as never);

    const result = await requestPasswordReset(
      { identifier: "unverified@example.com" },
      "203.0.113.4",
    );
    expect(result).toEqual({});
  });

  it("silently no-ops when there's no matching account at all", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);
    const result = await requestPasswordReset({ identifier: "nobody@example.com" }, "203.0.113.4");
    expect(result).toEqual({});
  });
});

describe("resetPassword", () => {
  it("updates the password, deletes the token, and revokes every session for the user", async () => {
    const rawToken = "reset-token-value";
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "owner@example.com",
      token: hashOpaqueToken(rawToken),
      expires: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

    await resetPassword({ token: rawToken, password: "a-brand-new-passphrase" });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(revokeAllSessionsForUser).toHaveBeenCalledWith("user_1");
  });

  it("throws for an expired token and never revokes sessions", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "owner@example.com",
      token: hashOpaqueToken("expired"),
      expires: new Date(Date.now() - 60_000),
    } as never);

    await expect(
      resetPassword({ token: "expired", password: "a-brand-new-passphrase" }),
    ).rejects.toThrow(AppError);
    expect(revokeAllSessionsForUser).not.toHaveBeenCalled();
  });

  it("rejects a new password shorter than the docs/13 §2 floor before ever looking up the token", async () => {
    await expect(resetPassword({ token: "whatever", password: "short" })).rejects.toThrow(
      ValidationError,
    );
    expect(db.verificationToken.findUnique).not.toHaveBeenCalled();
  });
});
