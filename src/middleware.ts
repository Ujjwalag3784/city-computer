/**
 * docs/04-REPOSITORY-STRUCTURE.md: "middleware.ts — locale, auth guard,
 * security headers, admin allowlist." Now implements two of those four:
 * locale routing (new, Phase 4) and the auth guard/admin allowlist
 * (Phase 3). The full nonce-based CSP and the rest of docs/13 §6's
 * security headers table are still not wired up — that's a broader,
 * separate piece of work (every response needs a per-request nonce
 * threaded into `<script>` tags) than either pass covers; flagged as a
 * follow-up, not silently folded in halfway.
 *
 * Two middlewares, composed by path rather than chained, on purpose:
 * `auth()`'s wrapper looks up the session (a database read via the
 * adapter, plus Redis reads for the 2FA/idle-window flags) on every
 * matched request. Running that on *every* storefront page load — just
 * to decide a locale — would add a real, needless round trip to every
 * anonymous product-page view. So `/admin/*` gets the full
 * session-aware `adminMiddleware`; everything else gets the lightweight,
 * session-free `next-intl` locale middleware. The matcher below still
 * has to cover both, since `next-intl` needs to run for the entire
 * storefront route tree.
 *
 * Runtime: Node.js, not the Edge default, for the whole file — even the
 * intl branch — because `server/auth/config.ts`'s Credentials provider
 * and `session-state.ts` depend on `argon2` (native binding) and
 * `ioredis` (Node `net` sockets), neither of which runs on the Edge
 * runtime, and a single `middleware.ts` has one runtime for all of its
 * matched paths. Next.js's Node.js Middleware support (stable since
 * 15.2) is what makes this possible; verify `pnpm dev` actually respects
 * `runtime: "nodejs"` below on a real machine, since the sandbox this was
 * written in can't run `next dev` far enough to confirm it (see
 * PROGRESS.md's `next build` font-fetch wall).
 *
 * docs/13 §3: "`/admin/*` is gated in middleware.ts before any route code
 * runs. Optional IP allowlist via ADMIN_IP_ALLOWLIST." — every check in
 * `adminMiddleware` fails closed: any ambiguity (no session, wrong role,
 * un-satisfied 2FA, expired session-state window, disallowed IP)
 * redirects to sign-in or returns 404, never falls through to the
 * requested admin route.
 *
 * Known gap: the layout/commerce components built in Phase 2 (SiteHeader,
 * SiteFooter, MobileNav, etc.) link internally via plain `next/link`, not
 * the locale-aware `Link` from `src/i18n/navigation.ts` — under
 * `localePrefix: "as-needed"` this is harmless for English (no prefix to
 * lose) but means a Nepali-locale visitor clicking any nav link currently
 * bounces back to the unprefixed (English) URL instead of staying on
 * `/ne/...`. Retrofitting every existing component's internal links is a
 * larger, separate pass — flagged rather than silently left unmentioned,
 * and lower-priority today since no product content has Nepali
 * translations seeded yet either (see PROGRESS.md).
 */
import type { NextFetchEvent } from "next/server";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/server/auth";
import { routing } from "@/i18n/routing";
import { getRequestIp } from "@/lib/request-ip";
import { env } from "@/env";
import { isAdminRoleKey, requiresTwoFactor } from "@/server/auth/permissions";
import { isAdminSessionWithinLimits, touchAdminSessionActivity } from "@/server/auth/session-state";

export const config = {
  // Everything except: API routes, Next.js internals, the non-localized
  // `/design` internal showcase, and any request for a literal file
  // (favicon.ico, robots.txt, images — anything with a dot in the last
  // path segment). This single matcher has to cover both the admin
  // subtree and the entire localized storefront tree, since the two
  // middlewares below are dispatched by path, not by separate matchers.
  matcher: ["/((?!api|_next|_vercel|design|.*\\..*).*)"],
  runtime: "nodejs",
};

const intlMiddleware = createIntlMiddleware(routing);

/** `src/app/(admin-auth)/admin/verify-2fa/page.tsx`. Named once so the redirect target and the loop guard below can never drift apart. */
const TWO_FACTOR_PATH = "/admin/verify-2fa";

function isIpAllowed(ip: string): boolean {
  const allowlist = env.ADMIN_IP_ALLOWLIST?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  // No allowlist configured (the default) means the control is off, not
  // "deny everything" — docs/13 §3 calls it "optional."
  if (!allowlist || allowlist.length === 0) return true;
  return allowlist.includes(ip);
}

// `auth()`'s type is an intersection of overloads, one of which wraps App
// Router Route Handlers ((req, ctx: { params }) => ...) and one of which
// wraps Middleware ((req, event: NextFetchEvent) => ...). Both accept a
// single-argument callback structurally, and the route-handler overload
// comes first in that intersection, so a loosely-typed `async (request) =>
// {}` callback resolves against it instead — producing an `adminMiddleware`
// typed to expect a route `{ params }` context object as its second
// argument, not the `NextFetchEvent` the dispatcher below actually passes.
// Annotating both parameters explicitly (even though `event` is unused)
// makes the callback's type incompatible with the route-handler overload's
// `AppRouteHandlerFnContext`, forcing TS to match the middleware overload
// instead.
const adminMiddleware = auth(async (request: NextAuthRequest, _event: NextFetchEvent) => {
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

  // The 2FA screen itself is the one admin path this redirect must not fire
  // for, or a session that hasn't satisfied 2FA would be redirected to
  // /admin/verify-2fa from /admin/verify-2fa, forever. This is a loop guard,
  // not a relaxation: a request for this path still has to pass every other
  // check in this function (allowed IP, real session, admin role, and both
  // session windows below), and the page itself re-checks the session and
  // role and bounces anyone who doesn't actually need this step. The only
  // thing that ever sets `twoFactorVerified` is a correct TOTP code reaching
  // `session-state.ts`'s Redis flag.
  const isTwoFactorPath = nextUrl.pathname === TWO_FACTOR_PATH;
  if (
    !isTwoFactorPath &&
    requiresTwoFactor(session.user.roleKeys) &&
    !session.user.twoFactorVerified
  ) {
    const verifyUrl = new URL(TWO_FACTOR_PATH, nextUrl);
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

/**
 * The dispatcher Next.js actually calls. `adminMiddleware` is typed to
 * expect a `NextAuthRequest` (the `auth()` wrapper's own contract) — at
 * runtime Next.js always calls this file's default export with a plain
 * `NextRequest`, and `auth()` itself is what populates `.auth` before
 * invoking the callback above, so accepting `NextAuthRequest` here and
 * forwarding it is accurate for the admin branch and simply unused for
 * the intl branch (which only needs the `NextRequest` fields `intlMiddleware`
 * itself relies on).
 */
export default function middleware(request: NextAuthRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return adminMiddleware(request, event);
  }
  return intlMiddleware(request);
}
