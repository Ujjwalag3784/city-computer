/**
 * Completes the "register → verification email → verify → login" flow's
 * `verify` step (docs/07-API-DESIGN.md §4.1).
 */
import "server-only";
import { db } from "@/server/db";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { hashOpaqueToken } from "@/lib/token";
import { AppError, validationErrorFromZodIssues } from "@/lib/errors";

export async function verifyEmailToken(input: unknown): Promise<void> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const hashedToken = hashOpaqueToken(parsed.data.token);
  const record = await db.verificationToken.findUnique({ where: { token: hashedToken } });

  // Same error for "no such token" and "expired token" — docs/13 §2's
  // enumeration-resistance principle applied to link validity, not just
  // to login.
  if (!record || record.expires < new Date()) {
    throw new AppError("VALIDATION_FAILED", "This verification link is invalid or has expired.");
  }

  await db.$transaction([
    db.user.updateMany({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    }),
    db.verificationToken.delete({ where: { token: hashedToken } }),
  ]);
}
