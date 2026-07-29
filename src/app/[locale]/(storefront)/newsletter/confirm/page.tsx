import type { Metadata } from "next";
import { confirmNewsletterSubscription } from "@/server/services/content/newsletter";

export const metadata: Metadata = { title: "Confirm your subscription — City Computer Systems" };

/** The double opt-in confirmation link's landing page (docs/17 Phase 10). No email provider is wired in this codebase yet — see `content/newsletter.ts`'s own doc comment — so this link is only reachable today via the logged confirm URL, not an actual inbox. */
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let confirmed = false;
  let error: string | null = null;

  if (!token) {
    error = "This confirmation link is missing its token.";
  } else {
    try {
      await confirmNewsletterSubscription(token);
      confirmed = true;
    } catch {
      error = "This confirmation link is invalid or has expired.";
    }
  }

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-headline-lg text-on-surface">
        {confirmed ? "You're subscribed" : "Confirmation failed"}
      </h1>
      <p className="text-body-md text-on-surface-variant">
        {confirmed
          ? "Thanks — you'll now get restock alerts and deals by email."
          : (error ?? "Something went wrong.")}
      </p>
    </div>
  );
}
