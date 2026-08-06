"use client";

/**
 * The sign-in form itself.
 *
 * Three things here exist because the first version of this page gave the
 * operator no way to tell "wrong password" from "the page is broken":
 *
 *  1. `isPending` drives both the button label and its disabled state, so a
 *     submit is visibly acknowledged the instant it starts.
 *  2. The error region is a *persistently mounted* `aria-live` container
 *     rather than a conditionally mounted `<Alert>`. A live region has to
 *     exist in the accessibility tree before its contents change for a
 *     screen reader to announce them; mounting the whole region at the same
 *     moment its text appears is the classic way to get silence.
 *  3. `signInAction` is total — every outcome returns a message or
 *     navigates (see its header) — so `state.error` is the complete picture
 *     of "the submit came back and did not work".
 */
import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type SignInFormState } from "../_actions";

export interface LoginFormProps {
  /** Already validated server-side by `safeInternalPath` before being rendered here; re-validated in the action, since a client can post anything. */
  callbackUrl: string;
}

const INITIAL_STATE: SignInFormState = {};

/**
 * docs/05 §7 requires a visible focus-visible state on every interactive
 * element. `Button` has a ring built in; `Input` only changes its border and
 * adds a glow, which is easy to miss against the card's own stroke, so the
 * auth fields opt into the same ring the buttons use.
 */
const FIELD_FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-0";

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL_STATE);
  const errorId = useId();
  const hasError = Boolean(state.error);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div aria-live="polite" aria-atomic="true">
        {state.error ? (
          <Alert id={errorId} variant="destructive">
            <AlertDescription className="text-danger">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-identifier">Email or phone number</Label>
        <Input
          id="login-identifier"
          name="identifier"
          type="text"
          // Not `type="email"`: `authorize()` accepts a Nepali phone number
          // here too (docs/07 §4.1), and the browser would reject one.
          inputMode="email"
          autoComplete="username email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          error={hasError}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={FIELD_FOCUS_RING}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={hasError}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={FIELD_FOCUS_RING}
        />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
