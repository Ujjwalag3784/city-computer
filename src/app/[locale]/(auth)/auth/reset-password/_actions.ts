"use server";

/**
 * The Server Action behind `/auth/reset-password`, the page a reset email
 * links to. `resetPassword` (server/services/auth/password-reset.ts) owns
 * every rule: single-use hashed token, 60-minute expiry, the password
 * policy including the breach-corpus check, and revoking every existing
 * session (docs/13 §2). This only parses the form and maps outcomes to
 * messages.
 */
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { resetPassword } from "@/server/services/auth/password-reset";

export interface ResetPasswordFormState {
  error?: string;
  /** Set when the link itself is bad, so the page can offer a fresh one instead of the form. */
  linkInvalid?: boolean;
  fieldErrors?: { password?: string; confirmPassword?: string };
}

export async function resetPasswordAction(
  _previousState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const token = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (!token) {
    return { linkInvalid: true, error: "This reset link is invalid or has expired." };
  }
  // Both sides are the visitor's own two typings of the same new password;
  // there is no stored secret on either side for timing to reveal.
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password !== confirmPassword) {
    return { fieldErrors: { confirmPassword: "The two passwords don't match." } };
  }

  try {
    await resetPassword({ token, password });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.issues?.length) {
        const passwordIssue = error.issues.find((issue) => issue.field === "password");
        if (passwordIssue) return { fieldErrors: { password: passwordIssue.message } };
        return { linkInvalid: true, error: "This reset link is invalid or has expired." };
      }
      if (error.code === "VALIDATION_FAILED") {
        const message = error.detail ?? error.message;
        // `resetPassword` uses VALIDATION_FAILED both for a dead link and for
        // the password policy (too common / breached). Tell them apart by
        // the one message the link check uses.
        if (/link is invalid or has expired/i.test(message)) {
          return { linkInvalid: true, error: message };
        }
        return { fieldErrors: { password: message } };
      }
      if (error.code === "RATE_LIMITED") {
        return { error: "Too many attempts. Please wait a few minutes and try again." };
      }
    }
    return { error: "We couldn't reset your password just now. Please try again in a moment." };
  }

  redirect("/auth/login?reset=done");
}
