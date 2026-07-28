/**
 * Shared Zod schemas for every auth flow — docs/04-REPOSITORY-STRUCTURE.md
 * places shared validation schemas under `lib/validation/`. Imported by
 * both `server/services/auth/*` (server-side enforcement, the only place
 * that actually matters per docs/13 §3) and, later, client-side forms —
 * one schema, never two definitions that can drift apart.
 *
 * Deliberately loose on the email/password shape here beyond length —
 * `lib/password.ts`'s `assertPasswordPolicy` does the breach-corpus check,
 * which is async and talks to the network, so it can't live inside a
 * synchronous Zod refinement. Schemas here validate *shape*; services
 * validate *policy*.
 */
import { z } from "zod";
import { isValidNepalPhone } from "@/lib/nepal";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

const phoneSchema = z
  .string()
  .trim()
  .refine(isValidNepalPhone, "Enter a valid Nepali mobile number.");

/** docs/13 §2: length is the only composition rule; the breach-corpus check happens in `assertPasswordPolicy`, not here. */
const passwordShapeSchema = z.string().min(10, "Password must be at least 10 characters.");

/** Registration accepts email OR phone (not neither) — docs/06 §12 #7's `CHECK (email IS NOT NULL OR phone IS NOT NULL)` mirrored at the input layer so a malformed request never reaches the database constraint. */
export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordShapeSchema,
    name: z.string().trim().min(1, "Enter your name.").max(200),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Enter an email address or a phone number.",
    path: ["email"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email or phone — the Credentials provider's `authorize()` decides which. */
  identifier: z.string().trim().min(1, "Enter your email or phone number."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number."),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordShapeSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** docs/13 §2: phone OTP is 6 digits — blocked at runtime until an SMS provider is contracted (docs/19 D3), but the shape is defined now so the flow can be wired up later without a schema change. */
export const requestPhoneOtpSchema = z.object({
  phone: phoneSchema,
});

export type RequestPhoneOtpInput = z.infer<typeof requestPhoneOtpSchema>;

export const verifyPhoneOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;

export const totpVerifySchema = z.object({
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;

export const recoveryCodeSchema = z.object({
  code: z.string().trim().min(1, "Enter a recovery code."),
});

export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordShapeSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
