/**
 * TOTP 2FA enrollment and per-session verification — docs/13-SECURITY.md
 * §2: "TOTP mandatory for OWNER and MANAGER, enforced in middleware."
 *
 * Recovery codes (docs/13 §2: ten single-use codes, "hashed at rest, shown
 * once") live in the `RecoveryCode` table. `ensureRecoveryCodes` issues a
 * fresh set whenever an account that has just passed a 2FA step has none
 * left — that covers first enrollment, accounts that enrolled before codes
 * existed, and someone who has just spent their last one.
 */
import "server-only";
import { db } from "@/server/db";
import { recoveryCodeSchema, totpVerifySchema } from "@/lib/validation/auth";
import {
  buildTotpKeyUri,
  generateRecoveryCodes,
  generateTotpQrCodeDataUrl,
  generateTotpSecret,
  matchRecoveryCode,
  verifyTotpToken,
} from "@/lib/totp";
import { AppError, NotFoundError, validationErrorFromZodIssues } from "@/lib/errors";
import {
  forgetPendingTwoFactorSecret,
  markTwoFactorVerified,
  readPendingTwoFactorSecret,
  rememberPendingTwoFactorSecret,
} from "@/server/auth/session-state";

export interface TwoFactorEnrollmentStart {
  /** Not persisted until `confirmTwoFactorEnrollment` succeeds — an abandoned setup never leaves `twoFactorSecret` set-but-unverified. */
  secret: string;
  qrCodeDataUrl: string;
}

/** Step 1: generate a candidate secret and its scannable QR code. Caller must hold the secret (e.g. in a short-lived signed form field) to pass back into `confirmTwoFactorEnrollment`. */
export async function startTwoFactorEnrollment(userId: string): Promise<TwoFactorEnrollmentStart> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User");

  const secret = generateTotpSecret();
  const keyUri = buildTotpKeyUri(secret, user.email ?? user.phone ?? userId);
  const qrCodeDataUrl = await generateTotpQrCodeDataUrl(keyUri);
  return { secret, qrCodeDataUrl };
}

/** Step 2: the user enters a live code from their app, proving they actually scanned it before this account is committed to requiring 2FA going forward. */
export async function confirmTwoFactorEnrollment(
  userId: string,
  secret: string,
  input: unknown,
): Promise<void> {
  const parsed = totpVerifySchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const valid = await verifyTotpToken(secret, parsed.data.token);
  if (!valid) {
    throw new AppError("VALIDATION_FAILED", "That code didn't match. Please try again.");
  }

  // docs/13 §15: "twoFactorSecret additionally application-encrypted." No
  // application-layer encryption helper exists yet in this codebase —
  // flagged rather than silently stored in cleartext-in-column without
  // comment. Everything downstream (verifyTwoFactorForSession) reads this
  // same column, so wiring encryption in later is a single-file change.
  await db.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
}

/**
 * The per-login "second step": called after a password (or OAuth) sign-in
 * succeeds but before `guards.ts`'s `requireAdminSession` will let an
 * OWNER/MANAGER session through. Marks `session-state.ts`'s Redis flag on
 * success — nothing else about the session changes.
 */
export async function verifyTwoFactorForSession(
  sessionToken: string,
  userId: string,
  input: unknown,
): Promise<void> {
  const parsed = totpVerifySchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Two-factor authentication is not enabled for this account.",
    );
  }

  const valid = await verifyTotpToken(user.twoFactorSecret, parsed.data.token);
  if (!valid) {
    throw new AppError("VALIDATION_FAILED", "That code didn't match. Please try again.");
  }

  await markTwoFactorVerified(sessionToken);
}

/** What `/admin/verify-2fa` needs to render an enrollment screen. Deliberately does NOT include a session-independent handle to the secret — the secret itself lives in Redis, keyed by session token. */
export interface TwoFactorEnrollmentPrompt {
  qrCodeDataUrl: string;
  /** The same secret in typeable form, for a phone whose camera can't scan. Shown once, during enrollment, to the account's own owner — the standard TOTP fallback. */
  manualEntryKey: string;
}

/**
 * The session-scoped wrapper `/admin/verify-2fa` actually calls, layered on
 * `startTwoFactorEnrollment` above.
 *
 * The difference that matters: `startTwoFactorEnrollment` hands the caller a
 * brand-new secret every time and makes stashing it somewhere the caller's
 * problem. This one pins the *first* candidate for a session in Redis (see
 * `rememberPendingTwoFactorSecret`) and renders the QR for whatever is
 * pinned, so refreshing the enrollment page — or React rendering it twice —
 * cannot leave the operator holding a QR code that no longer matches what
 * the server will verify against.
 */
export async function beginTwoFactorEnrollmentForSession(
  userId: string,
  sessionToken: string,
): Promise<TwoFactorEnrollmentPrompt> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User");

  const candidate = generateTotpSecret();
  const secret = await rememberPendingTwoFactorSecret(sessionToken, candidate);

  const keyUri = buildTotpKeyUri(secret, user.email ?? user.phone ?? userId);
  const qrCodeDataUrl = await generateTotpQrCodeDataUrl(keyUri);
  return { qrCodeDataUrl, manualEntryKey: secret };
}

/**
 * Commits an enrollment started by `beginTwoFactorEnrollmentForSession` and
 * marks the current session 2FA-satisfied in one step, so the operator isn't
 * asked for a second code immediately after proving they hold the first.
 *
 * A missing pending secret is an error, never a pass: it means the 15-minute
 * window elapsed or the enrollment was started in a different session, and
 * the only safe response is "start again."
 */
export async function confirmTwoFactorEnrollmentForSession(
  userId: string,
  sessionToken: string,
  input: unknown,
): Promise<void> {
  const secret = await readPendingTwoFactorSecret(sessionToken);
  if (!secret) {
    throw new AppError(
      "VALIDATION_FAILED",
      "This setup step expired. Reload the page to get a fresh QR code.",
    );
  }

  await confirmTwoFactorEnrollment(userId, secret, input);
  await markTwoFactorVerified(sessionToken);
  await forgetPendingTwoFactorSecret(sessionToken);
}

/**
 * Replaces every recovery code for `userId` with a fresh set of ten and
 * returns the plaintext — the only time it ever exists outside the user's
 * own copy. Old codes (used or not) stop working immediately.
 */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);
  return plaintextCodes;
}

/**
 * Called after a successful 2FA step. Returns a new set of codes to show
 * the user when they have none left, or `null` when they still have some.
 */
export async function ensureRecoveryCodes(userId: string): Promise<string[] | null> {
  const remaining = await db.recoveryCode.count({ where: { userId, usedAt: null } });
  if (remaining > 0) return null;
  return issueRecoveryCodes(userId);
}

/**
 * The "lost my phone" path on `/admin/verify-2fa`: a valid unused recovery
 * code satisfies 2FA for this session, exactly like a TOTP code, and is
 * spent in the process.
 *
 * Spending is a conditional update (`usedAt: null` in the WHERE), so two
 * simultaneous submissions of the same code cannot both succeed.
 */
export async function verifyRecoveryCodeForSession(
  sessionToken: string,
  userId: string,
  input: unknown,
): Promise<void> {
  const parsed = recoveryCodeSchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Two-factor authentication is not enabled for this account.",
    );
  }

  const unused = await db.recoveryCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });
  const candidate = normaliseRecoveryCode(parsed.data.code);
  const matchIndex = await matchRecoveryCode(
    candidate,
    unused.map((code) => code.codeHash),
  );
  const matched = matchIndex === null ? undefined : unused.at(matchIndex);
  if (!matched) {
    throw new AppError(
      "VALIDATION_FAILED",
      "That backup code didn't match, or it's already been used.",
    );
  }

  const spent = await db.recoveryCode.updateMany({
    where: { id: matched.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (spent.count !== 1) {
    throw new AppError(
      "VALIDATION_FAILED",
      "That backup code didn't match, or it's already been used.",
    );
  }

  await markTwoFactorVerified(sessionToken);
}

/**
 * Codes are issued and hashed as `XXXX-XXXX-XXXX-XXXX` (lib/totp.ts). Accept
 * them typed in any case, with spaces, or with the dashes left out, and
 * rebuild the exact issued form before comparing.
 */
export function normaliseRecoveryCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 16) return value.trim().toUpperCase();
  return compact.match(/.{4}/g)!.join("-");
}
