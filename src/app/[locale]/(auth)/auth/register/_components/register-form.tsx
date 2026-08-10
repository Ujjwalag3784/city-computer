"use client";

/**
 * The registration form. Mirrors `login-form.tsx`'s established contract
 * (persistently-mounted `aria-live` region, `isPending` driving both the
 * button label and its disabled state) with one deliberate difference:
 * `registerAction` returns *field-level* errors (`fieldErrors`), not one
 * generic message — unlike sign-in, which collapses every failure into an
 * identical message on purpose (docs/13 §2's enumeration-resistance rule),
 * registration failures (a name left blank, a password that's too short)
 * are about *this form's own input*, not about whether an account exists,
 * so there's no security reason to hide which field is wrong.
 */
import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type RegisterFormState } from "../_actions";

export interface RegisterFormProps {
  /** Already validated server-side by `safeInternalPath` before being rendered here; re-validated in the action, since a client can post anything. */
  callbackUrl: string;
}

const INITIAL_STATE: RegisterFormState = {};

const FIELD_FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-0";

export function RegisterForm({ callbackUrl }: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(registerAction, INITIAL_STATE);
  const errorId = useId();
  const fieldErrors = state.fieldErrors ?? {};
  const nameError = fieldErrors.name;
  const emailError = fieldErrors.email;
  const passwordError = fieldErrors.password;

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
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          error={Boolean(nameError)}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "register-name-error" : undefined}
          className={FIELD_FOCUS_RING}
        />
        {nameError && (
          <p id="register-name-error" className="text-body-sm text-danger">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-email">Email or phone number</Label>
        <Input
          id="register-email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          error={Boolean(emailError)}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "register-email-error" : undefined}
          className={FIELD_FOCUS_RING}
        />
        {emailError && (
          <p id="register-email-error" className="text-body-sm text-danger">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={Boolean(passwordError)}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? "register-password-error" : undefined}
          className={FIELD_FOCUS_RING}
        />
        {passwordError && (
          <p id="register-password-error" className="text-body-sm text-danger">
            {passwordError}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
