import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ValidationError } from "@/lib/errors";
import { hashOpaqueToken } from "@/lib/token";

vi.mock("@/server/db", () => ({
  db: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { db } = await import("@/server/db");
const { verifyEmailToken } = await import("./verify-email");

beforeEach(() => {
  vi.mocked(db.verificationToken.findUnique).mockReset();
  vi.mocked(db.$transaction)
    .mockReset()
    .mockResolvedValue([{ count: 1 }, {}] as never);
});

describe("verifyEmailToken", () => {
  it("marks the matching user's email verified and deletes the token, inside one transaction", async () => {
    const rawToken = "raw-token-value";
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "someone@example.com",
      token: hashOpaqueToken(rawToken),
      expires: new Date(Date.now() + 60_000),
    } as never);

    await verifyEmailToken({ token: rawToken });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("throws for a token that doesn't exist, without revealing that specifically", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null);
    await expect(verifyEmailToken({ token: "nonexistent" })).rejects.toThrow(AppError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("throws the same error for an expired token as for a missing one", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "someone@example.com",
      token: hashOpaqueToken("expired-token"),
      expires: new Date(Date.now() - 60_000),
    } as never);

    let missingError: unknown;
    let expiredError: unknown;
    vi.mocked(db.verificationToken.findUnique).mockResolvedValueOnce(null);
    try {
      await verifyEmailToken({ token: "nonexistent" });
    } catch (error) {
      missingError = error;
    }
    try {
      await verifyEmailToken({ token: "expired-token" });
    } catch (error) {
      expiredError = error;
    }

    expect(missingError).toBeInstanceOf(AppError);
    expect(expiredError).toBeInstanceOf(AppError);
    expect((missingError as AppError).message).toBe((expiredError as AppError).message);
  });

  it("rejects malformed input before ever querying the database", async () => {
    await expect(verifyEmailToken({})).rejects.toThrow(ValidationError);
    expect(db.verificationToken.findUnique).not.toHaveBeenCalled();
  });
});
