/**
 * Transactional email delivery through Resend's HTTP API
 * (docs/03-TECHNOLOGY-STACK.md names Resend; `RESEND_API_KEY` /
 * `MAIL_FROM_TRANSACTIONAL` have been in `env-core.ts` since Phase 1 with
 * nothing reading them).
 *
 * Plain `fetch`, no SDK: one POST is the whole integration, and a new
 * dependency for it is not worth the install/audit surface.
 *
 * NEVER THROWS. Every caller is an auth flow that has already done its real
 * work (token stored, account created). A mail outage must not turn that
 * into a 500 — and, for password reset, a thrown error would also leak
 * "this account exists" through a different response. Failures are logged
 * and reported through the return value instead.
 *
 * With no `RESEND_API_KEY` set (local dev, or a deploy that has not
 * configured mail yet) this logs that mail is not configured and returns
 * `{ sent: false }`. It deliberately does not log the message body, since
 * reset and verification links are credentials.
 */
import "server-only";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import type { EmailContent } from "./templates";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export interface SendResult {
  sent: boolean;
}

export async function sendTransactionalEmail(
  to: string,
  content: EmailContent,
): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM_TRANSACTIONAL ?? env.MAIL_FROM;

  if (!apiKey || !from) {
    logger.warn(
      { subject: content.subject },
      "sendTransactionalEmail: RESEND_API_KEY / MAIL_FROM_TRANSACTIONAL not set — email not sent",
    );
    return { sent: false };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: content.subject,
        text: content.text,
        html: content.html,
        ...(env.MAIL_REPLY_TO ? { reply_to: env.MAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Resend's error body names the problem (unverified domain, bad key)
      // without echoing the message, so it is safe and useful to log.
      const detail = await response.text().catch(() => "");
      logger.error(
        { status: response.status, detail: detail.slice(0, 500), subject: content.subject },
        "sendTransactionalEmail: Resend rejected the message",
      );
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error), subject: content.subject },
      "sendTransactionalEmail: request to Resend failed",
    );
    return { sent: false };
  }
}
