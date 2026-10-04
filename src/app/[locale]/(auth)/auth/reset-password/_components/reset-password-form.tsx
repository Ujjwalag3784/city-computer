"use client";

import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { resetPasswordAction, type ResetPasswordFormState } from "../_actions";

const INITIAL_STATE: ResetPasswordFormState = {};

const FIELD_FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-0";

export interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, INITIAL_STATE);
  const passwordErrorId = useId();
  const confirmErrorId = useId();
  const passwordError = state.fieldErrors?.password;
  const confirmError = state.fieldErrors?.confirmPassword;

  if (state.linkInvalid) {
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="destructive">
          <AlertDescription className="text-danger">
            {state.error ?? "This reset link is invalid or has expired."} Links work once and expire
            after 60 minutes.
          </AlertDescription>
        </Alert>
        <Button asChild size="lg" className="w-full">
          <Link href="/auth/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />

      <div aria-live="polite" aria-atomic="true">
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription className="text-danger">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          error={Boolean(passwordError)}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordErrorId}
          className={FIELD_FOCUS_RING}
        />
        <p
          id={passwordErrorId}
          className={
            passwordError ? "text-body-sm text-danger" : "text-body-sm text-on-surface-variant"
          }
        >
          {passwordError ?? "At least 10 characters."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-confirm-password">Type it again</Label>
        <Input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          error={Boolean(confirmError)}
          aria-invalid={Boolean(confirmError)}
          aria-describedby={confirmError ? confirmErrorId : undefined}
          className={FIELD_FOCUS_RING}
        />
        {confirmError ? (
          <p id={confirmErrorId} className="text-body-sm text-danger">
            {confirmError}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
