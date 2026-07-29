/**
 * Best-effort client IP extraction from proxy headers. Shared by
 * `server/auth/config.ts` (per-IP login rate limiting) and `middleware.ts`
 * (the admin IP allowlist, docs/13 §3) so both trust the same header in
 * the same order rather than two independent, potentially-divergent
 * implementations.
 *
 * `x-forwarded-for` is attacker-controllable on any request that doesn't
 * go through a trusted reverse proxy that overwrites it — this is safe
 * here because docs/12 §... / docs/15's deployment target (Vercel, or
 * Cloudflare in front of a VPS) always terminates and rewrites this
 * header before the app ever sees the request, per docs/13 §12 ("The
 * origin IP is never exposed in DNS" / Cloudflare proxy on every record).
 * Never trust this value for anything beyond coarse rate limiting and an
 * allowlist that a real attacker forging the header would already be
 * blocked from spoofing at the WAF.
 */
export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Same header-trust reasoning as `getRequestIp` above, for Server Actions
 * — which have no raw `Request` object to hand that function, only
 * `next/headers`'s `headers()`. Promoted here (Phase 10) once a third
 * Server-Action file needed the identical few lines
 * `order/[orderNumber]/_actions.ts` already duplicated inline with a
 * comment explaining why it wasn't worth refactoring "mid-Phase-7" — that
 * reasoning no longer applies now that contact/newsletter/service-booking
 * all need the same lookup for the same reason (per-IP rate limiting on a
 * public, unauthenticated form).
 */
export async function getRequestIpFromHeaders(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}
