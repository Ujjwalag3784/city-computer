"use server";

/**
 * The `/admin/verify-2fa` Server Action — one entry point covering both
 * halves of the TOTP step, because from the operator's side they are the same
 * screen: type the 6-digit code your authenticator app is showing.
 *
 *   - Account has never enrolled  -> `confirmTwoFactorEnrollmentForSession`
 *     commits the candidate secret pinned in Redis and marks this session
 *     verified in one go.
 *   - Account already enrolled    -> `verifyTwoFactorForSession` checks the
 *     code against the stored secret and marks this session verified.
 *
 * Both paths end at the same place: `session-state.ts`'s Redis 2FA flag,
 * which is the *only* thing `middleware.ts` and `guards.ts` accept. Nothing
 * here can shortcut that flag, and nothing here loosens the requirement.
 */
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { isAdminRoleKey } from "@/server/auth/permissions";
import { rateLimit } from "@/server/rate-limit-store";
import { safeInternalPath } from "@/lib/safe-redirect";
import { toSafeAppError } from "@/lib/errors";
import {
  confirmTwoFactorEnrollmentForSession,
  verifyTwoFactorForSession,
} from "@/server/services/auth/two-factor";

export interface TwoFactorFormState {
  error?: string;
}

/**
 * Every failure below has to come back as a sentence someone can act on —
 * this screen sits between a correct password and the admin console, so a
 * blank response here is as much of a dead end as the sign-in form's was.
 *
 * `toSafeAppError` alone was not enough: it returns the RFC 9457 `detail`
 * field, which for a tripped rate limit is the machine-facing
 * "Retry after 900 seconds." and for a Zod failure is the generic "One or
 * more fields are invalid." Both are technically non-empty and neither
 * tells the operator what to do.
 */
function twoFactorErrorMessage(error: unknown): string {
  const safe = toSafeAppError(error);

  if (safe.code === "RATE_LIMITED") {
    return "Too many code attempts. For security, this is paused for up to 15 minutes — please try again after that.";
  }

  // A validation failure carries the per-field message from
  // `totpVerifySchema` ("Enter the 6-digit code from your authenticator
  // app."), which is the useful one.
  const firstIssue = safe.issues?.[0]?.message;
  if (firstIssue) return firstIssue;

  return safe.detail ?? safe.message;
}

export async function verifyTwoFactorAction(
  _previousState: TwoFactorFormState,
  formData: FormData,
): Promise<TwoFactorFormState> {
  const target = safeInternalPath(formData.get("callbackUrl")?.toString(), "/admin");

  try {
    const session = await auth();
    if (!session) {
      return { error: "Your session has expired. Sign in again to continue." };
    }
    if (!session.user.roleKeys.some(isAdminRoleKey)) {
      // Mirrors middleware's "don't confirm the admin surface exists"
      // posture: a non-staff session gets nothing useful back.
      return { error: "Your session has expired. Sign in again to continue." };
    }

    // Code-guessing needs its own limit — the sign-in rate limit was spent on
    // the password step and says nothing about attempts here. Same preset as
    // sign-in (docs/13 §2: 5 attempts / 15 minutes), keyed per account.
    await rateLimit("auth", `2fa:${session.user.id}`);

    const input = { token: formData.get("token")?.toString() ?? "" };

    if (session.user.twoFactorEnabled) {
      await verifyTwoFactorForSession(session.sessionToken, session.user.id, input);
    } else {
      await confirmTwoFactorEnrollmentForSession(session.user.id, session.sessionToken, input);
    }
  } catch (error) {
    return { error: twoFactorErrorMessage(error) };
  }

  // Outside the try/catch on purpose: `redirect` works by throwing
  // NEXT_REDIRECT, which must reach Next.js rather than being reported as a
  // failed verification.
  redirect(target);
}
