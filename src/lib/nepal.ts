/**
 * Nepal-specific domain helpers: phone normalisation, provinces, wards.
 * See docs/06-DATA-MODEL.md §3 (Address) and docs/07-API-DESIGN.md §8.
 */

export const NEPAL_PROVINCES = [
  "KOSHI",
  "MADHESH",
  "BAGMATI",
  "GANDAKI",
  "LUMBINI",
  "KARNALI",
  "SUDURPASHCHIM",
] as const;

export type NepalProvince = (typeof NEPAL_PROVINCES)[number];

export function isNepalProvince(value: string): value is NepalProvince {
  return (NEPAL_PROVINCES as readonly string[]).includes(value);
}

/** Ward numbers in Nepali municipalities run 1–35 depending on the local body. */
export function isValidWard(ward: number): boolean {
  return Number.isInteger(ward) && ward >= 1 && ward <= 35;
}

// Anchored with fixed-width digit groups (`\d{8}`) and no nested/overlapping
// quantifiers — linear-time matching, not susceptible to catastrophic
// backtracking despite the plugin's generic ReDoS heuristic.
// eslint-disable-next-line security/detect-unsafe-regex
const PHONE_INPUT_PATTERN = /^(?:\+?977[-\s]?)?(9[678]\d{8})$/;

/**
 * Normalises a Nepali mobile number to E.164 (`+9779XXXXXXXXX`).
 * Accepts `98XXXXXXXX`, `+977 98XXXXXXXX`, `977-98XXXXXXXX`, with or
 * without spaces/hyphens. Returns null if the input is not a recognisable
 * Nepali mobile number.
 */
export function normalizeNepalPhone(input: string): string | null {
  const stripped = input.replace(/[()\s.]/g, "");
  const match = PHONE_INPUT_PATTERN.exec(stripped);
  if (!match) return null;
  return `+977${match[1]}`;
}

/** True if `input` is (or normalises to) a valid Nepali mobile number. */
export function isValidNepalPhone(input: string): boolean {
  return normalizeNepalPhone(input) !== null;
}

/** Formats an E.164 Nepali number for display: "+977 98-XXXX-XXXX". */
export function formatNepalPhoneForDisplay(e164: string): string {
  const normalized = normalizeNepalPhone(e164);
  if (!normalized) return e164;
  const digits = normalized.slice(4); // strip +977
  return `+977 ${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
}

/** Returns the last 4 digits of a Nepali phone number, for ticket-lookup verification (docs/06 §9). */
export function lastFourDigits(phoneOrE164: string): string | null {
  const normalized = normalizeNepalPhone(phoneOrE164);
  if (!normalized) return null;
  return normalized.slice(-4);
}
