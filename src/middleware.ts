/**
 * docs/04-REPOSITORY-STRUCTURE.md: "middleware.ts — locale, auth guard,
 * security headers, admin allowlist." This is deliberately a *partial*
 * implementation of that line: only the auth guard and admin IP
 * allowlist are here. Locale routing is out of scope — no `[locale]`
 * segment or next-intl routing exists in this codebase yet (Phase 4+
 * territory; see PROGRESS.md), so there is nothing for a locale guard to
 * do. The full nonce-based CSP and the rest of docs/13 §6's security
 * headers table are also not wired up here yet — that's a broader,
 * separate piece of work (every response needs a per-request nonce
 * threaded into `<script>` tags) than this auth-focused pass covers;
 * flagged as a follow-up, not silently folded in halfway.
 *
 * Runtime: Node.js, not the Edge default. `server/auth/config.ts`'s
 * Credentials provider and this file's own session checks depend on
 * `argon2` (native binding) and `ioredis` (Node `net` sockets) via
 * `session-state.ts` — neither runs on the Edge runtime. Next.js's
 * Node.js Middleware support (stable since 15.2) is what makes this
 * possible; verify `pnpm dev` actually respects `runtime: "nodejs"` below
 * on a real machine, since the sandbox this was written in can't run
 * `next dev` far enough to confirm it (see PROGRESS.md's `next build`
 * font-fetch wall).
 *
 * docs/13 §3: "`/admin/*` is gated in middleware.ts before any route code
 * runs. Optional IP allowlist via ADMIN_IP_ALLOWLIST." — every check
 * below fails closed: any ambiguity (no session, wrong role, un-satisfied
 * 2FA, expired session-state window, disallowed IP) redirects to sign-in
 * or returns 404, never falls through to the requested admin route.
 */
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getRequestIp } from "@/lib/request-ip";
import { env } from "@/env";
import { isAdminRoleKey, requiresTwoFactor } from "@/server/auth/permissions";
import { isAdminSessionWithinLimits, touchAdminSessionActivity } from "@/server/auth/session-state";

export const config = {
  matcher: ["/admin/:path*"],
  runtime: "nodejs",
};

function isIpAllowed(ip: string): boolean {
  const allowlist = env.ADMIN_IP_ALLOWLIST?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  // No allowlist configured (the default) means the control is off, not
  // "deny everything" — docs/13 §3 calls it "optional."
  if (!allowlist || allowlist.length === 0) return true;
  return allowlist.includes(ip);
}

export default auth(async (request) => {
  const { nextUrl } = request;
  const session = request.auth;

  // A disallowed IP gets a 404, not a 403 — matching the "don't render
  // then deny" principle (docs/13 §3) one step further back: don't even
  // confirm an admin surface exists at this address.
  if (!isIpAllowed(getRequestIp(request))) {
    return new NextResponse(null, { status: 404 });
  }

  if (!session) {
    const signInUrl = new URL("/auth/login", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  const isAdmin = session.user.roleKeys.some(isAdminRoleKey);
  if (!isAdmin) {
    // A CUSTOMER session hitting /admin doesn't get told the area exists
    // and they lack permission — it 404s, exactly like a disallowed IP.
    return new NextResponse(null, { status: 404 });
  }

  if (requiresTwoFactor(session.user.roleKeys) && !session.user.twoFactorVerified) {
    const verifyUrl = new URL("/admin/verify-2fa", nextUrl);
    verifyUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(verifyUrl);
  }

  const withinLimits = await isAdminSessionWithinLimits(session.sessionToken);
  if (!withinLimits) {
    const signInUrl = new URL("/auth/login", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    signInUrl.searchParams.set("reason", "session-expired");
    return NextResponse.redirect(signInUrl);
  }

  // Every allowed admin request resets the 30-minute idle clock —
  // `markAdminSessionIssued`'s 8h absolute clock (set once, at sign-in)
  // is deliberately untouched here.
  await touchAdminSessionActivity(session.sessionToken);

  return NextResponse.next();
});
