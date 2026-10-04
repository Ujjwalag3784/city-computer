"use client";

import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction, type ForgotPasswordFormState } from "../_actions";

const INITIAL_STATE: ForgotPasswordFormState = {};

const FIELD_FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-0";

/**
 * Same pattern as `login-form.tsx`: a persistently mounted live region, and
 * a pending state on the button so a submit is acknowledged immediately.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, INITIAL_STATE);
  const errorId = useId();
  const hasError = Boolean(state.error);

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" aria-atomic="true">
        {state.sent ? (
          <Alert variant="success" role="status">
            <AlertDescription>
              If there&apos;s an account with that email address, we&apos;ve sent a link to reset
              the password. It expires in 60 minutes. Check your spam folder if it hasn&apos;t
              arrived in a few minutes.
            </AlertDescription>
          </Alert>
        ) : state.error ? (
          <Alert id={errorId} variant="destructive">
            <AlertDescription className="text-danger">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {!state.sent && (
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="forgot-identifier">Email address</Label>
            <Input
              id="forgot-identifier"
              name="identifier"
              type="email"
              inputMode="email"
              autoComplete="email"
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

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </div>
  );
}
