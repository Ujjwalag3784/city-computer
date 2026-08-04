"use server";

/**
 * The sign-in Server Action behind `/auth/login`.
 *
 * `middleware.ts` and `(admin)/layout.tsx` have redirected unauthenticated
 * visitors to `/auth/login` since Phase 3, but no page ever existed there —
 * every admin redirect landed on a 404, which is why `/admin` was
 * unreachable even once a staff account existed. This is that page's action.
 *
 * Every credential check that matters already lives in
 * `server/auth/config.ts`'s Credentials `authorize()`: the rate limits
 * (docs/13 §2's "5 attempts / 15 min per IP and per identifier"), the
 * Argon2id verify, the dummy-hash timing normalisation, and the
 * ACTIVE/locked-until checks. This action deliberately adds no checks of its
 * own — it parses the form, hands it to `signIn`, and turns any failure into
 * one indistinguishable message, per docs/13 §2's enumeration-resistance
 * rule ("Registration, login and reset return identical messages").
 */
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";
import { loginSchema } from "@/lib/validation/auth";
import { safeInternalPath } from "@/lib/safe-redirect";

export interface SignInFormState {
  error?: string;
}

/**
 * One message for every failure mode — wrong password, no such account, a
 * suspended account, a locked account, or a tripped rate limit. The
 * rate-limit hint is included unconditionally rather than only when the
 * limit actually fired, precisely so its presence never reveals which case
 * this was.
 */
const SIGN_IN_FAILED =
  "That email/phone and password combination didn't work. Check them and try again — after several failed attempts you may need to wait 15 minutes.";

export async function signInAction(
  _previousState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email or phone number, and your password." };
  }

  // Never trust `?callbackUrl=` — see `lib/safe-redirect.ts`. `/admin` is the
  // fallback because every existing redirect into this page comes from the
  // admin gate.
  const callbackUrl = safeInternalPath(formData.get("callbackUrl")?.toString(), "/admin");

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: callbackUrl });
  } catch (error) {
    // `signIn` signals success by throwing Next.js's NEXT_REDIRECT — it must
    // reach the framework, so only `AuthError` is swallowed here.
    if (error instanceof AuthError) {
      return { error: SIGN_IN_FAILED };
    }
    throw error;
  }

  return {};
}

/**
 * Sign out. Exported from here (rather than duplicated under
 * `(admin-auth)/`) so both the sign-in page and the two-factor page share one
 * definition. Goes through Auth.js's `signOut`, which calls the wrapped
 * adapter's `deleteSession` and therefore `clearSessionState` — the database
 * row and every Redis-tracked flag for the session are dropped together.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/auth/login" });
}
