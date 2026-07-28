/**
 * Password reset — docs/13-SECURITY.md §2: "Single-use token, 60-minute
 * TTL, hashed at rest, invalidated on use, sent only to a verified
 * address. Reset invalidates all sessions." And: "Registration, login and
 * reset return identical messages and are timing-normalised" — the
 * enumeration resistance requirement applied to this flow specifically.
 *
 * Email delivery isn't wired up yet (see register.ts's header for why) —
 * `requestPasswordReset` creates and returns the token exactly as the real
 * flow needs; nothing is actually emailed today.
 */
import "server-only";
import { db } from "@/server/db";
import { requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { assertPasswordPolicy, hashPassword } from "@/lib/password";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/token";
import { rateLimit } from "@/server/rate-limit-store";
import { AppError, validationErrorFromZodIssues } from "@/lib/errors";
import { normalizeNepalPhone } from "@/lib/nepal";
import { logger } from "@/lib/logger";
import { revokeAllSessionsForUser } from "@/server/auth/revoke-sessions";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface RequestPasswordResetResult {
  /** Only present when a real, verified-email account was matched. Absent in every other case (no account, phone-only account) — see the enumeration-resistance note on why a caller must not treat this as an error. */
  resetToken?: string;
}

export async function requestPasswordReset(
  input: unknown,
  ip: string,
): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const { identifier } = parsed.data;
  await rateLimit("auth", `ip:${ip}`);
  await rateLimit("auth", `identifier:${identifier.toLowerCase()}`);

  const normalizedPhone = normalizeNepalPhone(identifier);
  const user = await db.user.findFirst({
    where: normalizedPhone
      ? { OR: [{ email: identifier.toLowerCase() }, { phone: normalizedPhone }] }
      : { email: identifier.toLowerCase() },
  });

  // docs/13 §2: "sent only to a verified address" — a phone-only account,
  // or one whose email is unverified, gets the identical no-op response a
  // nonexistent account gets. Reset-by-SMS is blocked anyway until an SMS
  // provider is contracted (docs/19 D3), same as OTP login.
  if (!user?.email || !user.emailVerified) {
    logger.info(
      "requestPasswordReset: no eligible verified-email account for this identifier — silent no-op",
    );
    return {};
  }

  const rawToken = generateOpaqueToken();
  await db.verificationToken.create({
    data: {
      identifier: user.email,
      token: hashOpaqueToken(rawToken),
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return { resetToken: rawToken };
}

export async function resetPassword(input: unknown): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const { token, password } = parsed.data;
  await assertPasswordPolicy(password);

  const hashedToken = hashOpaqueToken(token);
  const record = await db.verificationToken.findUnique({ where: { token: hashedToken } });

  if (!record || record.expires < new Date()) {
    throw new AppError("VALIDATION_FAILED", "This reset link is invalid or has expired.");
  }

  const user = await db.user.findFirst({ where: { email: record.identifier } });
  if (!user) {
    throw new AppError("VALIDATION_FAILED", "This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    db.verificationToken.delete({ where: { token: hashedToken } }),
  ]);

  // docs/13 §2: "Reset invalidates all sessions."
  await revokeAllSessionsForUser(user.id);
}
