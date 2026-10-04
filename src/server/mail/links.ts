import "server-only";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Absolute links for auth emails. Built from `NEXT_PUBLIC_SITE_URL`, never
 * from the request's Host header — a forged Host would otherwise put an
 * attacker's domain into a password-reset email (host-header poisoning).
 */
export function passwordResetUrl(token: string): string {
  return `${SITE_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

export function verifyEmailUrl(token: string): string {
  return `${SITE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
}
