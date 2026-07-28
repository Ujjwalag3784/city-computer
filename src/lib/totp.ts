/**
 * TOTP enrollment/verification and recovery codes, per docs/13-SECURITY.md
 * §2: "TOTP mandatory for OWNER and MANAGER, enforced in middleware. Ten
 * single-use recovery codes, hashed at rest, shown once."
 *
 * Recovery codes are hashed with the same Argon2id primitive as passwords
 * (`lib/password.ts`) rather than a faster digest — they're long-lived
 * secrets that grant account access exactly like a password does, so they
 * get the same at-rest protection. The one-time Argon2id cost at
 * enrollment (hashing ten codes) and at the rare recovery-login is
 * negligible next to the security benefit.
 */
// otplib v13 replaced the old `authenticator` singleton (v12 and earlier)
// with a functional API of standalone, tree-shakeable calls — no class or
// default export to reach for. `generate`/`verify` are async because the
// default (Noble) crypto plugin performs the HMAC via WebCrypto.
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/password";

const RECOVERY_CODE_COUNT = 10;
// 4 groups of 4 base32-ish characters, e.g. "K7H2-9QXM-3B4T-WPLR" — long
// enough to resist guessing, short enough to write down.
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids transcription errors

/** Generates a fresh base32 TOTP secret for enrollment. Store this encrypted (docs/13 §2/§15's `twoFactorSecret`), never the otpauth URI itself. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** Builds the `otpauth://` URI an authenticator app scans — `accountLabel` is typically the user's email, `issuer` the site name. */
export function buildTotpKeyUri(
  secret: string,
  accountLabel: string,
  issuer = "City Computer",
): string {
  return generateURI({ issuer, label: accountLabel, secret });
}

/** Renders the enrollment URI as a PNG data URL for display during setup — never persisted, only shown once during the enrollment flow. */
export async function generateTotpQrCodeDataUrl(keyUri: string): Promise<string> {
  return QRCode.toDataURL(keyUri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

/**
 * Verifies a 6-digit TOTP token against `secret`. otplib's default step
 * (30s) and default verification tolerance absorb ordinary clock drift
 * between the server and the user's phone without materially widening the
 * guessable window.
 */
export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token });
    return result.valid;
  } catch {
    // otplib throws on a structurally invalid token (wrong length, non-digit) —
    // treat that identically to "wrong code" rather than leaking the reason.
    return false;
  }
}

function randomRecoveryCode(): string {
  const bytes = randomBytes(16);
  let code = "";
  for (let i = 0; i < 16; i += 1) {
    // `bytes[i]` is always in range for a 16-byte buffer indexed 0..15 by
    // this same loop — bounded by construction, not user input.
    // eslint-disable-next-line security/detect-object-injection
    const byte = bytes[i] ?? 0;
    code += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
    if (i % 4 === 3 && i !== 15) code += "-";
  }
  return code;
}

export interface GeneratedRecoveryCodes {
  /** The plaintext codes — show these to the user exactly once, then discard. */
  plaintextCodes: string[];
  /** Argon2id hashes to persist — this is the only form that reaches the database. */
  hashedCodes: string[];
}

/** Generates the docs/13 §2 "ten single-use recovery codes" and their hashes in one pass, so a caller can never accidentally persist the plaintext form. */
export async function generateRecoveryCodes(): Promise<GeneratedRecoveryCodes> {
  const plaintextCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomRecoveryCode());
  const hashedCodes = await Promise.all(plaintextCodes.map((code) => hashPassword(code)));
  return { plaintextCodes, hashedCodes };
}

/**
 * Checks `candidate` against a set of stored recovery-code hashes and
 * returns the index of the matching hash (so the caller can delete/mark
 * that one code as spent — recovery codes are single-use), or `null` if
 * none match. Runs the check against every hash rather than
 * short-circuiting on the array's natural order so that timing does not
 * reveal how many codes are already spent.
 */
export async function matchRecoveryCode(
  candidate: string,
  hashedCodes: string[],
): Promise<number | null> {
  const results = await Promise.all(hashedCodes.map((hash) => verifyPassword(hash, candidate)));
  const matchIndex = results.indexOf(true);
  return matchIndex === -1 ? null : matchIndex;
}
