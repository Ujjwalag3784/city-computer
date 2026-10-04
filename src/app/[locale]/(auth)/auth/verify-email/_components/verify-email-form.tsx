"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { verifyEmailAction, type VerifyEmailFormState } from "../_actions";

const INITIAL_STATE: VerifyEmailFormState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(verifyEmailAction, INITIAL_STATE);

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite" aria-atomic="true">
        {state.verified ? (
          <Alert variant="success" role="status">
            <AlertDescription>Your email is confirmed. Thanks!</AlertDescription>
          </Alert>
        ) : state.error ? (
          <Alert variant="destructive">
            <AlertDescription className="text-danger">{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {state.verified || state.error ? (
        <Button asChild size="lg" className="w-full">
          <Link href="/account">Go to my account</Link>
        </Button>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Confirming…" : "Confirm my email"}
          </Button>
        </form>
      )}
    </div>
  );
}
