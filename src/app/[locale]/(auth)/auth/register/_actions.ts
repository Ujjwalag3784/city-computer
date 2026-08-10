"use server";

/**
 * The registration Server Action behind `/auth/register`.
 *
 * `registerUser` (`server/services/auth/register.ts`) already existed —
 * rate limiting, password policy, Nepali phone normalisation, and
 * account-enumeration resistance were all built and unit-tested, just
 * never called from anywhere. This is that missing call site (remediation
 * audit, `docs/AUDIT.md`: no customer registration flow existed at all).
 *
 * After a successful `registerUser`, this signs the new account in
 * immediately via the same `signIn("credentials", ...)` path
 * `signInAction` uses, rather than bouncing to `/auth/login` and making
 * someone type the password they just chose a second time. `registerUser`
 * itself never creates a session — it's a pure account-creation call — so
 * without this, "register" would silently leave the visitor logged out.
 *
 * Deliberately does NOT distinguish "email already registered" from
 * "account created" in what it shows the visitor, for the same
 * enumeration-resistance reason `registerUser`'s own doc comment states:
 * both cases end at "check your details and sign in" copy. Since
 * verification email sending isn't wired up yet (same doc comment), the
 * post-signIn redirect is the only signal of success either way — which
 * is fine, since login not working is exactly the failure this needs to
 * surface.
 */
import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/services/auth/register";
import { safeInternalPath } from "@/lib/safe-redirect";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { AppError } from "@/lib/errors";
import { signInFailureMessage, SIGN_IN_UNAVAILABLE_MESSAGE } from "@/lib/auth/sign-in-error";

export interface RegisterFormState {
  /** General, non-field-specific error (rate limited, or the post-registration sign-in itself failing). */
  error?: string;
  /** Per-field messages, keyed by `AppErrorFieldIssue.field` — same shape `validationErrorFromZodIssues` already produces everywhere else in this app. */
  fieldErrors?: Record<string, string>;
}

export async function registerAction(
  _previousState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    password: formData.get("password"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".") || "root";
      // First message per field wins — good enough for a form with one
      // constraint per field; nothing here has two independent rules on
      // the same field that both need to be shown at once.
      // eslint-disable-next-line security/detect-object-injection -- `field` is a dotted path built from this same Zod schema's own `issue.path`, not arbitrary input; `fieldErrors` is a plain return-value object, never a prototype-bearing target.
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors };
  }

  const callbackUrl = safeInternalPath(formData.get("callbackUrl")?.toString(), "/account");
  const ip = await getRequestIpFromHeaders();

  try {
    await registerUser(parsed.data, ip);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "RATE_LIMITED") {
        return { error: "Too many attempts. Please try again in a few minutes." };
      }
      if (error.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          fieldErrors[issue.field] ??= issue.message;
        }
        return { fieldErrors };
      }
      return { error: error.detail ?? error.message };
    }
    throw error;
  }

  // registerUser() is a pure account-creation call — no session exists yet.
  // Sign the new account in immediately, same code path signInAction uses,
  // so "register" doesn't silently leave the visitor logged out.
  const identifier = parsed.data.email ?? parsed.data.phone;
  if (!identifier) {
    // registerSchema's own .refine() already guarantees one of the two is
    // present — unreachable in practice, kept as a typed fallback rather
    // than a non-null assertion so a future schema change fails loudly
    // here instead of passing `undefined` to signIn.
    return { error: SIGN_IN_UNAVAILABLE_MESSAGE };
  }

  try {
    await signIn("credentials", {
      identifier,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: signInFailureMessage(error) };
    }
    throw error;
  }

  return { error: SIGN_IN_UNAVAILABLE_MESSAGE };
}
