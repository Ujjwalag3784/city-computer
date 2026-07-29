import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { NewsletterStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    newsletterSubscriber: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { db } = await import("@/server/db");
const { subscribeToNewsletter, confirmNewsletterSubscription, unsubscribeFromNewsletter } =
  await import("./newsletter");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(async (ops: unknown) =>
    Promise.all(ops as Promise<unknown>[]),
  );
});

describe("subscribeToNewsletter", () => {
  it("is a silent success (no token issued) for an already-confirmed address", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      status: NewsletterStatus.CONFIRMED,
    } as never);

    const result = await subscribeToNewsletter("already@example.com");

    expect(result.status).toBe(NewsletterStatus.CONFIRMED);
    expect(db.newsletterSubscriber.upsert).not.toHaveBeenCalled();
    expect(db.verificationToken.create).not.toHaveBeenCalled();
  });

  it("upserts a PENDING subscriber and issues a fresh confirm token for a new address", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.newsletterSubscriber.upsert).mockResolvedValue({} as never);
    vi.mocked(db.verificationToken.deleteMany).mockResolvedValue({} as never);
    vi.mocked(db.verificationToken.create).mockResolvedValue({} as never);

    const result = await subscribeToNewsletter("New@Example.com", undefined, "footer");

    expect(result.status).toBe(NewsletterStatus.PENDING);
    expect(db.newsletterSubscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "new@example.com" } }),
    );
    expect(db.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "newsletter:new@example.com" },
    });
    expect(db.verificationToken.create).toHaveBeenCalled();
  });

  it("re-issues a token for a previously-unsubscribed address", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      status: NewsletterStatus.UNSUBSCRIBED,
      source: "footer",
    } as never);
    vi.mocked(db.newsletterSubscriber.upsert).mockResolvedValue({} as never);

    const result = await subscribeToNewsletter("back@example.com");

    expect(result.status).toBe(NewsletterStatus.PENDING);
    expect(db.newsletterSubscriber.upsert).toHaveBeenCalled();
  });
});

describe("confirmNewsletterSubscription", () => {
  it("rejects a token that doesn't exist", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue(null as never);
    await expect(confirmNewsletterSubscription("bad-token")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects an expired token", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "newsletter:a@b.com",
      token: "hashed",
      expires: new Date(Date.now() - 1000),
    } as never);
    await expect(confirmNewsletterSubscription("expired-token")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a well-formed but non-newsletter token (e.g. an email-verification token)", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "a@b.com",
      token: "hashed",
      expires: new Date(Date.now() + 1000 * 60),
    } as never);
    await expect(confirmNewsletterSubscription("some-token")).rejects.toBeInstanceOf(AppError);
  });

  it("marks the subscriber CONFIRMED and deletes the token on success", async () => {
    vi.mocked(db.verificationToken.findUnique).mockResolvedValue({
      identifier: "newsletter:a@b.com",
      token: "hashed",
      expires: new Date(Date.now() + 1000 * 60),
    } as never);

    await confirmNewsletterSubscription("good-token");

    expect(db.$transaction).toHaveBeenCalled();
  });
});

describe("unsubscribeFromNewsletter", () => {
  it("normalises the email and marks the subscriber UNSUBSCRIBED", async () => {
    vi.mocked(db.newsletterSubscriber.updateMany).mockResolvedValue({ count: 1 } as never);

    await unsubscribeFromNewsletter("Someone@Example.com");

    expect(db.newsletterSubscriber.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "someone@example.com" } }),
    );
  });
});
