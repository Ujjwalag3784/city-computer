"use server";

/**
 * Confirms an email-verification link (docs/07 §4.1: register → verification
 * email → verify → login). `verifyEmailToken` owns the token rules.
 */
import { AppError } from "@/lib/errors";
import { verifyEmailToken } from "@/server/services/auth/verify-email";

export interface VerifyEmailFormState {
  verified?: boolean;
  error?: string;
}

export async function verifyEmailAction(
  _previousState: VerifyEmailFormState,
  formData: FormData,
): Promise<VerifyEmailFormState> {
  const token = formData.get("token")?.toString() ?? "";

  try {
    await verifyEmailToken({ token });
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION_FAILED") {
      return {
        error:
          "This link is invalid or has expired. If you already confirmed your email, you're all set.",
      };
    }
    return { error: "We couldn't confirm your email just now. Please try again in a moment." };
  }

  return { verified: true };
}
