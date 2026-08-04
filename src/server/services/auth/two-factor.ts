/**
 * TOTP 2FA enrollment and per-session verification — docs/13-SECURITY.md
 * §2: "TOTP mandatory for OWNER and MANAGER, enforced in middleware."
 *
 * KNOWN GAP, deliberately not worked around: the ten single-use recovery
 * codes docs/13 §2 also calls for ("hashed at rest, shown once") have
 * nowhere to live. The schema (`prisma/schema/auth.prisma`) has no
 * `RecoveryCode` model, and adding one needs `prisma generate`, which
 * needs network access to Prisma's engine-binary CDN that this sandbox's
 * policy blocks (see PROGRESS.md, and `session-state.ts`'s header for the
 * same constraint hit for a different reason). Unlike the admin-session
 * timing problem, this one genuinely isn't solvable with Redis instead —
 * recovery codes are a durable secret a user might not use for months;
 * Redis is a cache, not the right place to be the *only* copy of the one
 * thing that gets someone back into their account. `lib/totp.ts`'s
 * `generateRecoveryCodes`/`matchRecoveryCode` are already written and
 * unit-tested, so wiring this up is a small, well-tested addition once
 * that migration exists — tracked as a follow-up rather than faked here.
 * Enrollment below only persists the TOTP secret; no recovery codes are
 * generated or shown yet.
 */
import "server-only";
import { db } from "@/server/db";
import { totpVerifySchema } from "@/lib/validation/auth";
import {
  buildTotpKeyUri,
  generateTotpQrCodeDataUrl,
  generateTotpSecret,
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
