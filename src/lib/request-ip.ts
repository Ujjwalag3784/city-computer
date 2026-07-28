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
