"use server";

/**
 * The "forgot password" Server Action behind `/auth/forgot-password`.
 *
 * docs/13 §2: reset must return an identical message whether or not the
 * account exists. So every non-error outcome returns the same `sent` state —
 * a real verified-email account, an unknown address, and a phone-only
 * account all look the same to the visitor.
 *
 * The email is sent with `after()`, i.e. once the response has gone out, so
 * the extra round trip to Resend does not make "account exists" measurably
 * slower than "no such account" (the timing half of the same rule).
 */
import { after } from "next/server";
import { AppError } from "@/lib/errors";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { requestPasswordReset } from "@/server/services/auth/password-reset";
import { sendTransactionalEmail } from "@/server/mail/send";
import { passwordResetEmail } from "@/server/mail/templates";
import { passwordResetUrl } from "@/server/mail/links";

export interface ForgotPasswordFormState {
  sent?: boolean;
  error?: string;
}

export async function requestPasswordResetAction(
  _previousState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const identifier = formData.get("identifier")?.toString() ?? "";
  if (!identifier.trim()) {
    return { error: "Enter the email address on your account." };
  }

  const ip = await getRequestIpFromHeaders();

  try {
    const { resetToken, email } = await requestPasswordReset({ identifier }, ip);
    if (resetToken && email) {
      after(async () => {
        await sendTransactionalEmail(email, passwordResetEmail(passwordResetUrl(resetToken)));
      });
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") {
      return { error: "Too many attempts. Please wait 15 minutes and try again." };
    }
    if (error instanceof AppError && error.code === "VALIDATION_FAILED") {
      return { error: "Enter the email address on your account." };
    }
    return { error: "We couldn't send that just now. Please try again in a moment." };
  }

  return { sent: true };
}
