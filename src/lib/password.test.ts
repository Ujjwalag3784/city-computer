import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPasswordLength, hashPassword, isPasswordBreached, verifyPassword } from "./password";
import { ValidationError } from "./errors";

/** Mirrors the SHA-1 k-anonymity split `isPasswordBreached` performs internally, so the fake API response in these tests is always consistent with whatever password string is used. */
function sha1PrefixAndSuffix(password: string): { prefix: string; suffix: string } {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefix: sha1.slice(0, 5), suffix: sha1.slice(5) };
}

describe("assertPasswordLength", () => {
  it("accepts a password at the docs/13 §2 floor of 10 characters", () => {
    expect(() => assertPasswordLength("1234567890")).not.toThrow();
  });

  it("rejects anything shorter", () => {
    expect(() => assertPasswordLength("short")).toThrow(ValidationError);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips: a hash verifies against the password it was made from", async () => {
    const hash = await hashPassword("a reasonably long passphrase");
    await expect(verifyPassword(hash, "a reasonably long passphrase")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-password-here");
    await expect(verifyPassword(hash, "wrong-password-here")).resolves.toBe(false);
  });

  it("produces an Argon2id hash (docs/13 §2: never bcrypt, never MD5/SHA)", async () => {
    const hash = await hashPassword("another passphrase");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("never throws on a malformed/legacy hash — treats it as a non-match", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});

describe("isPasswordBreached", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the HIBP range response contains a matching suffix", async () => {
    const { suffix } = sha1PrefixAndSuffix("password");
    const fakeResponse = new Response(
      `${suffix}:3861493\r\nOTHERSUFFIX0000000000000000000000000:1`,
      {
        status: 200,
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse),
    );

    await expect(isPasswordBreached("password")).resolves.toBe(true);
  });

  it("returns false when no suffix in the response matches", async () => {
    const fakeResponse = new Response("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1", { status: 200 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse),
    );

    await expect(isPasswordBreached("a-genuinely-unique-passphrase-x7q9")).resolves.toBe(false);
  });

  it("fails open to the offline denylist when the breach-corpus API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      }),
    );

    await expect(isPasswordBreached("password123")).resolves.toBe(true);
    await expect(isPasswordBreached("a-genuinely-unique-passphrase-x7q9")).resolves.toBe(false);
  });
});
