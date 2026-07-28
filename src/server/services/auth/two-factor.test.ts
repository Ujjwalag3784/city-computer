import { generate } from "otplib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateTotpSecret } from "@/lib/totp";

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/auth/session-state", () => ({
  markTwoFactorVerified: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { markTwoFactorVerified } = await import("@/server/auth/session-state");
const { confirmTwoFactorEnrollment, startTwoFactorEnrollment, verifyTwoFactorForSession } =
  await import("./two-factor");

beforeEach(() => {
  vi.mocked(db.user.findUnique).mockReset();
  vi.mocked(db.user.update)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(markTwoFactorVerified).mockReset().mockResolvedValue(undefined);
});

describe("startTwoFactorEnrollment", () => {
  it("returns a secret and a QR code for an existing user", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
    } as never);

    const result = await startTwoFactorEnrollment("u1");

    expect(result.secret.length).toBeGreaterThan(0);
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    // Nothing is persisted at this step -- see two-factor.ts's header.
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundError for a nonexistent user", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await expect(startTwoFactorEnrollment("ghost")).rejects.toThrow(NotFoundError);
  });
});

describe("confirmTwoFactorEnrollment", () => {
  it("persists the secret once a live code proves the user scanned it", async () => {
    const secret = generateTotpSecret();
    const validToken = await generate({ secret });

    await confirmTwoFactorEnrollment("u1", secret, { token: validToken });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { twoFactorSecret: secret },
    });
  });

  it("rejects a wrong code and persists nothing", async () => {
    const secret = generateTotpSecret();
    await expect(confirmTwoFactorEnrollment("u1", secret, { token: "000000" })).rejects.toThrow(
      AppError,
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects malformed input before ever checking the code", async () => {
    const secret = generateTotpSecret();
    await expect(confirmTwoFactorEnrollment("u1", secret, { token: "abc" })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("verifyTwoFactorForSession", () => {
  it("marks the session verified in session-state.ts on a correct code", async () => {
    const secret = generateTotpSecret();
    const validToken = await generate({ secret });
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", twoFactorSecret: secret } as never);

    await verifyTwoFactorForSession("session-token-1", "u1", { token: validToken });

    expect(markTwoFactorVerified).toHaveBeenCalledWith("session-token-1");
  });

  it("throws for an account with no 2FA enrolled, without touching session-state", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", twoFactorSecret: null } as never);

    await expect(
      verifyTwoFactorForSession("session-token-1", "u1", { token: "123456" }),
    ).rejects.toThrow(AppError);
    expect(markTwoFactorVerified).not.toHaveBeenCalled();
  });

  it("throws for a wrong code and does not mark the session verified", async () => {
    const secret = generateTotpSecret();
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", twoFactorSecret: secret } as never);

    await expect(
      verifyTwoFactorForSession("session-token-1", "u1", { token: "000000" }),
    ).rejects.toThrow(AppError);
    expect(markTwoFactorVerified).not.toHaveBeenCalled();
  });
});
