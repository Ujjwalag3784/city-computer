/**
 * docs/11-SEO-STRATEGY.md §5.5/§10.3 — environment-aware `robots.txt`.
 *
 * Non-production (exact quote): "on any non-production host it emits
 * `User-agent: * / Disallow: /`" — §10.3 adds that this alone isn't
 * sufficient for staging ("A meta tag alone is not enough"); the edge-
 * level `X-Robots-Tag`/Basic-auth half of that belongs to infra
 * configuration, not this file, which only owns the one thing Next.js
 * itself can serve: the `/robots.txt` response.
 *
 * Production emits the doc's own §5.5 block verbatim, plus its AI-crawler
 * policy note: `> DECISION REQUIRED: Owner sign-off on whether AI
 * training crawlers (GPTBot, Applebot-Extended, Google-Extended) are
 * permitted, separately from AI search crawlers. Default proposal: allow
 * search crawlers, block pure-training crawlers.` This file implements
 * that stated *default proposal* (search/answer-engine crawlers allowed,
 * pure-training crawlers blocked) rather than inventing its own policy —
 * flagged here and in PROGRESS.md as still pending real owner sign-off,
 * the same pattern `lib/seo/site.ts`'s `ORG_INFO` placeholders already
 * use for other DECISION REQUIRED items.
 */
import type { MetadataRoute } from "next";
import { env } from "@/env";
import { SITE_URL } from "@/lib/seo/site";

const TRAINING_ONLY_CRAWLERS = [
  "GPTBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
];

export default function robots(): MetadataRoute.Robots {
  if (env.APP_ENV !== "production") {
    // docs/11 §5.5: staging/preview/local must never be discoverable.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og/", "/_next/static/", "/_next/image"],
        disallow: [
          "/admin",
          "/api/",
          "/cart",
          "/checkout",
          "/account",
          "/order/",
          "/service/status/",
          "/compare",
          "/search",
          "/*?*sort=",
          "/*?*orderby=",
          "/*?*view=",
          "/*?*perPage=",
          "/*?*add-to-cart=",
          "/*?*wc-ajax=",
          "/*?*replytocom=",
          "/*?*s=",
          "/wp-admin/",
          "/wp-content/",
          "/wp-json/",
          "/*/feed/",
        ],
      },
      // AI/answer-engine crawlers that drive referral traffic — allowed
      // explicitly rather than left to the `*` rule, so a future
      // narrower `*` policy can't accidentally sweep these up.
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      // Pure AI-training crawlers — blocked per the doc's own default
      // proposal, pending real owner sign-off (see doc comment above).
      ...TRAINING_ONLY_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
