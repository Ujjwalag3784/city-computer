/**
 * Newsletter double opt-in (docs/17 Phase 10, `NewsletterSubscriber` —
 * docs/06 §10, already schema'd with `PENDING|CONFIRMED|UNSUBSCRIBED`).
 *
 * Reuses the exact token machinery `auth/verify-email.ts` already uses for
 * email verification (`generateOpaqueToken`/`hashOpaqueToken` from
 * `lib/token.ts`, stored in the generic `VerificationToken` table keyed by
 * a free-text `identifier`) rather than inventing a second token store —
 * `identifier` is namespaced `newsletter:<email>` so it can never collide
 * with an auth verification token for the same address.
 *
 * No real email provider exists anywhere in this codebase (PROGRESS.md's
 * Phase 7/9 sections both flag this as a known, deliberate gap — Mailpit
 * is wired in `docker-compose.yml` but nothing in application code sends
 * through it). `queueConfirmationNotification` below logs what *would* be
 * sent — the confirm link itself — through the structured logger, the same
 * honest "log what would happen, don't fake sending it" pattern this
 * sandbox has used since `isPasswordBreached`'s offline fallback. A real
 * transport is future work, not simulated here.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, NewsletterStatus } from "@/generated/prisma/client";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/token";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function identifierFor(email: string): string {
  return `newsletter:${email.trim().toLowerCase()}`;
}

/** Logs the confirmation link that would be emailed — see this file's own doc comment for why this isn't a real send. */
function queueConfirmationNotification(email: string, token: string): void {
  const confirmUrl = `/newsletter/confirm?token=${token}`;
  logger.info(
    { email, confirmUrl },
    "newsletter: confirmation link generated (no email provider configured — logging instead of sending)",
  );
}

export interface SubscribeResult {
  status: NewsletterStatus;
}

/**
 * Idempotent: re-subscribing an already-`CONFIRMED` address is a silent
 * success (never reveals whether an address was already on the list to an
 * anonymous caller — the same enumeration-resistance principle
 * `auth/register.ts` applies to signup). A `PENDING` or `UNSUBSCRIBED`
 * address gets a fresh confirmation link.
 */
export async function subscribeToNewsletter(
  email: string,
  locale: Locale = Locale.EN,
  source?: string,
): Promise<SubscribeResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.newsletterSubscriber.findUnique({ where: { email: normalizedEmail } });
  if (existing?.status === NewsletterStatus.CONFIRMED) {
    return { status: NewsletterStatus.CONFIRMED };
  }

  await db.newsletterSubscriber.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      locale,
      source: source ?? null,
      status: NewsletterStatus.PENDING,
    },
    update: { status: NewsletterStatus.PENDING, source: source ?? existing?.source ?? null },
  });

  const rawToken = generateOpaqueToken();
  const identifier = identifierFor(normalizedEmail);
  // One live confirm link per address — clears any stale one first, same
  // "invalidate on re-request" rule `auth/password-reset.ts` follows.
  await db.verificationToken.deleteMany({ where: { identifier } });
  await db.verificationToken.create({
    data: {
      identifier,
      token: hashOpaqueToken(rawToken),
      expires: new Date(Date.now() + CONFIRM_TOKEN_TTL_MS),
    },
  });

  queueConfirmationNotification(normalizedEmail, rawToken);

  return { status: NewsletterStatus.PENDING };
}

/** Same "same error for not-found and expired" enumeration-resistance rule as `auth/verify-email.ts`. */
export async function confirmNewsletterSubscription(rawToken: string): Promise<void> {
  const hashedToken = hashOpaqueToken(rawToken);
  const record = await db.verificationToken.findUnique({ where: { token: hashedToken } });

  if (!record || record.expires < new Date() || !record.identifier.startsWith("newsletter:")) {
    throw new AppError("VALIDATION_FAILED", "This confirmation link is invalid or has expired.");
  }

  const email = record.identifier.slice("newsletter:".length);

  await db.$transaction([
    db.newsletterSubscriber.update({
      where: { email },
      data: { status: NewsletterStatus.CONFIRMED, confirmedAt: new Date() },
    }),
    db.verificationToken.delete({ where: { token: hashedToken } }),
  ]);
}

/**
 * Unsubscribe by email address alone — a deliberate, flagged simplification
 * (no per-address unsubscribe token, unlike the confirm flow above). Low
 * severity: the only thing an attacker with someone else's email address
 * can do is opt them OUT of marketing email, never read anything or opt
 * them in. A real send-per-email unsubscribe link is a follow-up if this
 * ever needs a stronger guarantee.
 */
export async function unsubscribeFromNewsletter(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await db.newsletterSubscriber.updateMany({
    where: { email: normalizedEmail },
    data: { status: NewsletterStatus.UNSUBSCRIBED, unsubscribedAt: new Date() },
  });
}
