"use client";

/**
 * The two-factor screen's interactive half — enrollment (QR + typeable key)
 * and the per-session code check, in one form, because to the person in
 * front of it they are the same action: type the six digits your phone is
 * showing.
 *
 * Same feedback contract as the sign-in form: a persistently mounted
 * `aria-live` region so a screen reader announces a rejected code, a pending
 * state on the button, and `verifyTwoFactorAction` returning a message for
 * every non-redirecting outcome.
 */
import Image from "next/image";
import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAction } from "@/app/[locale]/(auth)/auth/login/_actions";
import { verifyTwoFactorAction, type TwoFactorFormState } from "../_actions";

export interface TwoFactorFormProps {
  callbackUrl: string;
  /** Present only while enrolling — a data-URL PNG of the `otpauth://` QR code. */
  qrCodeDataUrl?: string;
  /** Present only while enrolling — the same secret in typeable form, for a phone that can't scan. */
  manualEntryKey?: string;
}

const INITIAL_STATE: TwoFactorFormState = {};

/** Matches the sign-in form — see its `FIELD_FOCUS_RING` comment. */
const FIELD_FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-0";

export function TwoFactorForm({ callbackUrl, qrCodeDataUrl, manualEntryKey }: TwoFactorFormProps) {
  const [state, formAction, isPending] = useActionState(verifyTwoFactorAction, INITIAL_STATE);
  const errorId = useId();
  const hintId = useId();
  const isEnrolling = Boolean(qrCodeDataUrl);
  const hasError = Boolean(state.error);

  return (
    <div className="flex flex-col gap-6">
      {isEnrolling && qrCodeDataUrl ? (
        <div className="flex flex-col gap-5">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body-sm text-on-surface-variant marker:text-on-surface-variant">
            <li>
              Install an authenticator app on your phone — Google Authenticator, Microsoft
              Authenticator, Authy and 1Password all work.
            </li>
            <li>Open it, choose &ldquo;add account&rdquo;, and scan this square.</li>
            <li>Type the 6-digit code it shows you into the box below.</li>
          </ol>

          {/*
            White plate behind the QR: the page surface is near-black and a
            camera needs the code's own quiet zone to read it. `unoptimized`
            because the source is a data URL the optimiser cannot fetch;
            deliberately not `priority`, which would inline the entire
            base64 PNG a second time as a <link rel="preload"> in the head.
          */}
          <div className="self-center rounded-xl bg-white p-3">
            <Image
              src={qrCodeDataUrl}
              alt="QR code linking this account to your authenticator app."
              width={200}
              height={200}
              unoptimized
              className="size-[200px]"
            />
          </div>

          {manualEntryKey ? (
            <p className="text-center text-body-sm text-on-surface-variant">
              Can&rsquo;t scan it? Type this key into the app instead:{" "}
              <code className="font-mono break-all text-on-surface">{manualEntryKey}</code>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Open the authenticator app on your phone and type the 6-digit code it&rsquo;s showing for
          City Computer Systems.
        </p>
      )}

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
          <Label htmlFor="two-factor-token">6-digit code</Label>
          <Input
            id="two-factor-token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            error={hasError}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${errorId} ${hintId}` : hintId}
            className={`text-center font-mono tracking-[0.4em] ${FIELD_FOCUS_RING}`}
          />
          <p id={hintId} className="text-body-sm text-on-surface-variant">
            Six digits, no spaces. The code changes every 30 seconds.
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Checking…" : isEnrolling ? "Finish setup and continue" : "Continue"}
        </Button>
      </form>

      <form action={signOutAction} className="border-t border-glass-stroke pt-4">
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          Sign out instead
        </Button>
      </form>
    </div>
  );
}
