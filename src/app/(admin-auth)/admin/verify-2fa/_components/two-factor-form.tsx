"use client";

import Image from "next/image";
import { useActionState } from "react";
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

export function TwoFactorForm({ callbackUrl, qrCodeDataUrl, manualEntryKey }: TwoFactorFormProps) {
  const [state, formAction, isPending] = useActionState(verifyTwoFactorAction, INITIAL_STATE);
  const isEnrolling = Boolean(qrCodeDataUrl);

  return (
    <div className="flex flex-col gap-6">
      {isEnrolling && qrCodeDataUrl ? (
        <div className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body-sm text-on-surface-variant">
            <li>
              Install an authenticator app on your phone — Google Authenticator, Microsoft
              Authenticator, Authy and 1Password all work.
            </li>
            <li>Open it, choose &ldquo;add account&rdquo;, and scan this square.</li>
            <li>Type the 6-digit code it shows you into the box below.</li>
          </ol>

          <div className="self-center rounded-lg bg-white p-3">
            <Image
              src={qrCodeDataUrl}
              alt="Scan this QR code with your authenticator app to finish setting up two-factor sign-in."
              width={240}
              height={240}
              unoptimized
              priority
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

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {state.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="token">6-digit code</Label>
          <Input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="font-mono tracking-[0.4em]"
          />
        </div>

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Checking..." : isEnrolling ? "Finish setup and continue" : "Continue"}
        </Button>
      </form>

      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          Sign out instead
        </Button>
      </form>
    </div>
  );
}
