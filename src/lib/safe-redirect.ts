/**
 * Open-redirect protection for the `?callbackUrl=` parameter the sign-in
 * and two-factor pages round-trip.
 *
 * `middleware.ts` puts the originally-requested admin path into
 * `?callbackUrl=` before redirecting to `/auth/login`, and the sign-in
 * action sends the browser there afterwards. That parameter is entirely
 * attacker-controllable — anyone can mail a link to
 * `/auth/login?callbackUrl=https://evil.example/harvest` — so it must never
 * be handed to `redirect()` or Auth.js's `redirectTo` unvalidated.
 *
 * Kept pure and in `lib/` so it can be unit-tested without a request.
 */

/** Highest code point treated as "control character or space" (0x20 is the space itself). */
const MAX_CONTROL_OR_SPACE_CODE_POINT = 0x20;
/** DEL. */
const DELETE_CODE_POINT = 0x7f;

/**
 * True if `value` contains any C0 control character, space, or DEL.
 *
 * Written as a code-point scan rather than a regex character class on
 * purpose: an inline control-character class is the kind of thing that gets
 * silently mangled by a tool in the middle of an editing chain, and this
 * version is impossible to get subtly wrong. Rejecting these outright stops
 * values that try to smuggle a scheme past a normaliser — a tab inside
 * "javascript:", or a newline used for response splitting.
 */
function hasControlCharacterOrSpace(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= MAX_CONTROL_OR_SPACE_CODE_POINT || codePoint === DELETE_CODE_POINT) {
      return true;
    }
  }
  return false;
}

/**
 * Returns `candidate` only if it is a safe same-origin path, otherwise
 * `fallback`.
 *
 * Accepted: a path beginning with a single `/`, e.g. `/admin/orders?status=paid`.
 * Rejected, each for a specific reason:
 *   - absolute URLs (`https://evil.example`, `HTTP://...`) — a different origin
 *   - protocol-relative URLs (`//evil.example`) — browsers treat these as
 *     absolute, which is the classic bypass for a naive `startsWith("/")` check
 *   - `\\evil.example` and `/\evil.example` — some browsers normalise
 *     backslashes to forward slashes, making these protocol-relative too
 *   - scheme-ish strings without a leading slash (`javascript:alert(1)`,
 *     `mailto:`) — not paths at all
 *   - anything containing a control character or a space
 */
export function safeInternalPath(candidate: string | undefined | null, fallback: string): string {
  if (typeof candidate !== "string") return fallback;

  const trimmed = candidate.trim();
  if (trimmed.length === 0) return fallback;

  // Reject outright rather than trying to normalise something already
  // suspicious.
  if (hasControlCharacterOrSpace(trimmed)) return fallback;

  // Must be a path, not a URL or a bare scheme.
  if (!trimmed.startsWith("/")) return fallback;

  // Protocol-relative, including the backslash variants browsers normalise.
  const secondCharacter = trimmed.charAt(1);
  if (secondCharacter === "/" || secondCharacter === "\\") return fallback;

  return trimmed;
}
