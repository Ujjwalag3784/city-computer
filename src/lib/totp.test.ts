import { generate } from "otplib";
import { describe, expect, it } from "vitest";
import {
  buildTotpKeyUri,
  generateRecoveryCodes,
  generateTotpQrCodeDataUrl,
  generateTotpSecret,
  matchRecoveryCode,
  verifyTotpToken,
} from "./totp";

describe("generateTotpSecret", () => {
  it("returns a non-empty base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("returns a different secret on each call", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("buildTotpKeyUri", () => {
  it("produces an otpauth:// URI carrying the issuer and account label", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpKeyUri(secret, "owner@citycomputer.com.np", "City Computer");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("City Computer"));
    expect(uri).toContain(encodeURIComponent("owner@citycomputer.com.np"));
  });
});

describe("generateTotpQrCodeDataUrl", () => {
  it("renders the key URI as a PNG data URL", async () => {
    const secret = generateTotpSecret();
    const uri = buildTotpKeyUri(secret, "owner@citycomputer.com.np");
    const dataUrl = await generateTotpQrCodeDataUrl(uri);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

describe("verifyTotpToken", () => {
  it("accepts the current valid token for the secret", async () => {
    const secret = generateTotpSecret();
    const token = await generate({ secret });
    await expect(verifyTotpToken(secret, token)).resolves.toBe(true);
  });

  it("rejects an incorrect token", async () => {
    const secret = generateTotpSecret();
    await expect(verifyTotpToken(secret, "000000")).resolves.toBe(false);
  });

  it("rejects a structurally invalid token rather than throwing", async () => {
    const secret = generateTotpSecret();
    await expect(verifyTotpToken(secret, "not-a-token")).resolves.toBe(false);
  });
});

describe("generateRecoveryCodes / matchRecoveryCode", () => {
  it("generates docs/13 §2's ten single-use recovery codes", async () => {
    const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();
    expect(plaintextCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);
    // Every code is unique.
    expect(new Set(plaintextCodes).size).toBe(10);
  });

  it("hashes codes rather than storing them in plaintext form", async () => {
    const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();
    expect(hashedCodes).toHaveLength(plaintextCodes.length);
    for (const hashed of hashedCodes) {
      expect(plaintextCodes).not.toContain(hashed);
      expect(hashed).toMatch(/^\$argon2id\$/);
    }
  });

  it("matches a valid recovery code to its index", async () => {
    const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();
    const targetCode = plaintextCodes[3];
    if (!targetCode) throw new Error("test setup: expected 10 generated codes");

    const matchIndex = await matchRecoveryCode(targetCode, hashedCodes);
    expect(matchIndex).toBe(3);
  });

  it("returns null for a code that doesn't match any hash", async () => {
    const { hashedCodes } = await generateRecoveryCodes();
    const matchIndex = await matchRecoveryCode("WRNG-CODE-0000-0000", hashedCodes);
    expect(matchIndex).toBeNull();
  });
});
