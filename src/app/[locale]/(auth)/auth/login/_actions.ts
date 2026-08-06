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
 * own — it parses the form, hands it to `signIn`, and maps the outcome to a
 * message via `lib/auth/sign-in-error.ts`, which owns docs/13 §2's
 * enumeration-resistance rule ("Registration, login and reset return
 * identical messages") and is unit-tested against it.
 *
 * The contract this file has to hold up, because the page it serves shipped
 * without it: **every** path out of `signInAction` either navigates or
 * returns a non-empty `error`. `useActionState` renders whatever comes back
 * and nothing else; an outcome that returns `{}` without redirecting is a
 * form that visibly does nothing, which is precisely how this page failed.
 */
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";
import { loginSchema } from "@/lib/validation/auth";
import { safeInternalPath } from "@/lib/safe-redirect";
import { signInFailureMessage, SIGN_IN_UNAVAILABLE_MESSAGE } from "@/lib/auth/sign-in-error";

export interface SignInFormState {
  error?: string;
}

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
    // `signIn` signals *success* by calling `redirect()`, which throws
    // Next.js's NEXT_REDIRECT — that has to reach the framework or the
    // browser never moves, so only `AuthError` is swallowed here.
    if (error instanceof AuthError) {
      return { error: signInFailureMessage(error) };
    }
    throw error;
  }

  // Not reachable while `signIn` is called with `redirect` left at its
  // default of true: it always ends in either NEXT_REDIRECT or an AuthError.
  // Kept as a message rather than `return {}` so that if a future Auth.js
  // ever does return here, the operator sees *something* instead of the
  // silent form this page launched with.
  return { error: SIGN_IN_UNAVAILABLE_MESSAGE };
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
