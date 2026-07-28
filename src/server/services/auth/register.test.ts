import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/errors";

// register.ts talks to Prisma and the Redis-backed rate limiter directly —
// neither is available in this sandbox, so both are mocked. The point of
// these tests is the *business logic* (enumeration resistance, which
// fields get written, when a verification token is/isn't issued), not
// exercising a real database.
vi.mock("@/server/db", () => ({
  db: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    customer: { create: vi.fn() },
    role: { findUnique: vi.fn() },
    userRole: { create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}));

vi.mock("@/server/rate-limit-store", () => ({
  rateLimit: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { rateLimit } = await import("@/server/rate-limit-store");
const { registerUser } = await import("./register");

const CUSTOMER_ROLE = { id: "role_customer" };

beforeEach(() => {
  vi.mocked(db.user.findFirst).mockReset().mockResolvedValue(null);
  vi.mocked(db.user.create)
    .mockReset()
    .mockResolvedValue({ id: "user_new" } as never);
  vi.mocked(db.customer.create)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(db.role.findUnique)
    .mockReset()
    .mockResolvedValue(CUSTOMER_ROLE as never);
  vi.mocked(db.userRole.create)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(db.verificationToken.create)
    .mockReset()
    .mockResolvedValue({} as never);
  vi.mocked(rateLimit).mockReset().mockResolvedValue(undefined);
});

const VALID_INPUT = {
  email: "new.customer@example.com",
  password: "a-perfectly-fine-passphrase",
  name: "New Customer",
};

describe("registerUser — happy path", () => {
  it("creates a user, a customer row, assigns the CUSTOMER role, and issues a verification token", async () => {
    const result = await registerUser(VALID_INPUT, "203.0.113.4");

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "new.customer@example.com", status: "ACTIVE" }),
      }),
    );
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user_new" }) }),
    );
    expect(db.userRole.create).toHaveBeenCalledWith({
      data: { userId: "user_new", roleId: CUSTOMER_ROLE.id },
    });
    expect(db.verificationToken.create).toHaveBeenCalled();
    expect(result.userId).toBe("user_new");
    expect(result.verificationToken).toBeTypeOf("string");
  });

  it("rate-limits by IP before doing anything else", async () => {
    await registerUser(VALID_INPUT, "203.0.113.4");
    expect(rateLimit).toHaveBeenCalledWith("auth", "ip:203.0.113.4");
  });

  it("issues no verification token for a phone-only registration (no email to send it to)", async () => {
    const result = await registerUser(
      { phone: "9812345678", password: "a-perfectly-fine-passphrase", name: "Phone Only" },
      "203.0.113.4",
    );

    expect(db.verificationToken.create).not.toHaveBeenCalled();
    expect(result.verificationToken).toBeUndefined();
  });
});

describe("registerUser — enumeration resistance (docs/13 §2)", () => {
  it("returns the existing user's id and no verification token, without creating a duplicate", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "user_existing" } as never);

    const result = await registerUser(VALID_INPUT, "203.0.113.4");

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.verificationToken.create).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: "user_existing" });
  });
});

describe("registerUser — validation", () => {
  it("rejects a password shorter than the docs/13 §2 floor before touching the database", async () => {
    await expect(
      registerUser({ ...VALID_INPUT, password: "short" }, "203.0.113.4"),
    ).rejects.toThrow(ValidationError);
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("rejects input with neither an email nor a phone number", async () => {
    await expect(
      registerUser({ password: "a-perfectly-fine-passphrase", name: "Nobody" }, "203.0.113.4"),
    ).rejects.toThrow(ValidationError);
  });
});

describe("registerUser — missing seed data", () => {
  it("still creates the account when the CUSTOMER role hasn't been seeded, rather than failing registration", async () => {
    vi.mocked(db.role.findUnique).mockResolvedValue(null);

    const result = await registerUser(VALID_INPUT, "203.0.113.4");

    expect(db.userRole.create).not.toHaveBeenCalled();
    expect(result.userId).toBe("user_new");
  });
});
