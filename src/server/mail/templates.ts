/**
 * Plain, dependency-free transactional email bodies. Pure functions so they
 * are unit-testable without a mail provider; `send.ts` does the delivery.
 *
 * Every message ships a text part as well as HTML: some Nepali ISP webmail
 * clients and every screen reader handle plain text better, and a
 * text-only fallback keeps the message deliverable if the HTML is stripped.
 */

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const SHOP_NAME = "City Computer Systems";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(heading: string, paragraphs: string[], action: { label: string; url: string }) {
  const safeUrl = escapeHtml(action.url);
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#18181b">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <p style="margin:0 0 24px;font-weight:600">${SHOP_NAME}</p>
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
        ${body}
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="display:inline-block;background:#0f5f6b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(action.label)}</a>
        </p>
        <p style="margin:0;font-size:13px;color:#52525b">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${safeUrl}</span></p>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#71717a">You're getting this because someone used this email address on ${SHOP_NAME}. If that wasn't you, you can ignore this email.</p>
    </div>
  </body>
</html>`;
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  const heading = "Reset your password";
  const paragraphs = [
    "We got a request to reset the password for your account.",
    "This link works once and expires in 60 minutes. If you didn't ask for this, ignore this email and your password stays the same.",
  ];
  return {
    subject: `Reset your ${SHOP_NAME} password`,
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nReset your password: ${resetUrl}\n`,
    html: layout(heading, paragraphs, { label: "Choose a new password", url: resetUrl }),
  };
}

export function verifyEmailEmail(verifyUrl: string): EmailContent {
  const heading = "Confirm your email address";
  const paragraphs = [
    "Thanks for creating an account. Confirm this is your email address so we can send you order updates and let you reset your password if you ever need to.",
    "This link expires in 60 minutes.",
  ];
  return {
    subject: `Confirm your email for ${SHOP_NAME}`,
    text: `${heading}\n\n${paragraphs.join("\n\n")}\n\nConfirm your email: ${verifyUrl}\n`,
    html: layout(heading, paragraphs, { label: "Confirm my email", url: verifyUrl }),
  };
}
