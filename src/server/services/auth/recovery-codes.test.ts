import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";

vi.mock("@/server/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    recoveryCode: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn((args: unknown) => ({ op: "deleteMany", args })),
      createMany: vi.fn((args: unknown) => ({ op: "createMany", args })),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/server/auth/session-state", () => ({
  markTwoFactorVerified: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { markTwoFactorVerified } = await import("@/server/auth/session-state");
const {
  ensureRecoveryCodes,
  issueRecoveryCodes,
  normaliseRecoveryCode,
  verifyRecoveryCodeForSession,
} = await import("./two-factor");

const CODE = "ABCD-EFGH-JKLM-NPQR";

beforeEach(() => {
  vi.mocked(db.user.findUnique)
    .mockReset()
    .mockResolvedValue({
      id: "u1",
      twoFactorSecret: "SECRET",
    } as never);
  vi.mocked(db.recoveryCode.count).mockReset();
  vi.mocked(db.recoveryCode.findMany).mockReset();
  vi.mocked(db.recoveryCode.updateMany)
    .mockReset()
    .mockResolvedValue({ count: 1 } as never);
  vi.mocked(db.$transaction).mockClear();
  vi.mocked(markTwoFactorVerified).mockReset().mockResolvedValue(undefined);
});

describe("normaliseRecoveryCode", () => {
  it("rebuilds the issued XXXX-XXXX-XXXX-XXXX form from loose typing", () => {
    expect(normaliseRecoveryCode("abcd efgh jklm npqr")).toBe(CODE);
    expect(normaliseRecoveryCode("ABCDEFGHJKLMNPQR")).toBe(CODE);
    expect(normaliseRecoveryCode("  abcd-efgh-jklm-npqr ")).toBe(CODE);
  });

  it("leaves a wrong-length input recognisably wrong rather than padding it", () => {
    expect(normaliseRecoveryCode("abc")).toBe("ABC");
  });
});

describe("issueRecoveryCodes", () => {
  it("replaces old codes with ten new hashed ones and returns the plaintext once", async () => {
    const codes = await issueRecoveryCodes("u1");

    expect(codes).toHaveLength(10);
    for (const code of codes) {
      const groups = code.split("-");
      expect(groups).toHaveLength(4);
      for (const group of groups) expect(group).toMatch(/^[A-Z2-9]{4}$/);
    }
    expect(db.recoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });

    const created = vi.mocked(db.recoveryCode.createMany).mock.calls.at(-1)![0] as {
      data: { userId: string; codeHash: string }[];
    };
    expect(created.data).toHaveLength(10);
    for (const row of created.data) {
      expect(row.userId).toBe("u1");
      expect(codes).not.toContain(row.codeHash);
    }
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  }, 30_000);
});

describe("ensureRecoveryCodes", () => {
  it("does nothing while unused codes remain", async () => {
    vi.mocked(db.recoveryCode.count).mockResolvedValue(3 as never);
    await expect(ensureRecoveryCodes("u1")).resolves.toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("issues a fresh set when none are left", async () => {
    vi.mocked(db.recoveryCode.count).mockResolvedValue(0 as never);
    const codes = await ensureRecoveryCodes("u1");
    expect(codes).toHaveLength(10);
  }, 30_000);
});

describe("verifyRecoveryCodeForSession", () => {
  it("accepts a matching unused code, spends it, and marks the session verified", async () => {
    const codeHash = await hashPassword(CODE);
    vi.mocked(db.recoveryCode.findMany).mockResolvedValue([{ id: "rc1", codeHash }] as never);

    await verifyRecoveryCodeForSession("sess", "u1", { code: "abcd efgh jklm npqr" });

    expect(db.recoveryCode.updateMany).toHaveBeenCalledWith({
      where: { id: "rc1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(markTwoFactorVerified).toHaveBeenCalledWith("sess");
  }, 30_000);

  it("rejects a code that matches nothing, without verifying the session", async () => {
    const codeHash = await hashPassword(CODE);
    vi.mocked(db.recoveryCode.findMany).mockResolvedValue([{ id: "rc1", codeHash }] as never);

    await expect(
      verifyRecoveryCodeForSession("sess", "u1", { code: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" }),
    ).rejects.toThrow(AppError);
    expect(db.recoveryCode.updateMany).not.toHaveBeenCalled();
    expect(markTwoFactorVerified).not.toHaveBeenCalled();
  }, 30_000);

  it("rejects when a concurrent request already spent the same code", async () => {
    const codeHash = await hashPassword(CODE);
    vi.mocked(db.recoveryCode.findMany).mockResolvedValue([{ id: "rc1", codeHash }] as never);
    vi.mocked(db.recoveryCode.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(verifyRecoveryCodeForSession("sess", "u1", { code: CODE })).rejects.toThrow(
      AppError,
    );
    expect(markTwoFactorVerified).not.toHaveBeenCalled();
  }, 30_000);

  it("refuses an account without 2FA enabled", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", twoFactorSecret: null } as never);
    await expect(verifyRecoveryCodeForSession("sess", "u1", { code: CODE })).rejects.toThrow(
      AppError,
    );
    expect(markTwoFactorVerified).not.toHaveBeenCalled();
  });
});
