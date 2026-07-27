# 03 — Technology Stack

Every dependency, with the reason it was chosen and the alternative it beat. Nothing not listed here may be added without amending this document.

**Depends on:** `02`. **Feeds into:** `04`, `15`.

---

## 1. Governing principles

1. **One repository, one deploy target, one language.** A two-person maintenance reality cannot support a microservice estate.
2. **Boring, well-documented technology.** Claude Sonnet will implement this; obscure libraries produce hallucinated APIs.
3. **Server-first rendering.** SEO is the acquisition channel, and the median device is a mid-range Android.
4. **Escape hatches over frameworks.** Prefer a library we can delete over a platform we are married to.
5. **Portability.** Nothing that welds us to one host. If Vercel becomes untenable, `docker compose up` must still work.

---

## 2. Core stack

| Layer | Choice | Version | Why | Rejected alternatives |
|---|---|---|---|---|
| **Language** | TypeScript | 5.6+, `strict` | Type safety across the whole stack; one mental model | JS (no), Go/Python backend (splits the stack) |
| **Framework** | **Next.js (App Router)** | 15.x | RSC gives SEO-grade SSR with a small client bundle; ISR fits a catalogue that changes hourly, not per-second; Route Handlers and Server Actions remove the need for a separate API service | Remix (smaller ecosystem, weaker ISR story), Astro (weak for a stateful builder + admin), NestJS + separate SPA (1.5–2× the build, two deploys, worse SEO) |
| **UI** | React | 19 | Bundled with Next 15 | — |
| **Styling** | **Tailwind CSS v4** | 4.x | The Stitch prototypes are already Tailwind; CSS-variable-driven `@theme` maps the Obsidian Peak tokens 1:1 | CSS Modules (no token story), styled-components (runtime cost, RSC friction) |
| **Component primitives** | **shadcn/ui** (Radix + Tailwind) | latest | Source-in-repo, not a dependency — we restyle rather than fight defaults; Radix gives real accessibility for comboboxes, dialogs, and the builder's picker drawer | MUI/Chakra (theme fight, bundle size), hand-rolled (a11y debt) |
| **Icons** | `lucide-react` | latest | Tree-shaken SVG; direct replacement for every Material Symbol used in the designs; removes a webfont | Material Symbols webfont (FOIT, ligature hack) |
| **Fonts** | `next/font` — Geist (display), Inter (body), JetBrains Mono (specs) | — | Self-hosted, zero layout shift, no third-party request | Google Fonts `<link>` (extra RTT, privacy) |
| **Database** | **PostgreSQL** | 16 | Relational integrity for orders and inventory is non-negotiable; JSONB for product specs; `tsvector` FTS + `pg_trgm` fuzzy search means no separate search service in v1; `pgvector` available later for semantic build recommendations | MySQL (weaker JSONB/FTS), MongoDB (wrong shape for commerce) |
| **ORM** | **Prisma** | 6.x | Best-in-class TS types, migration story, and the ORM Claude Sonnet writes most reliably. Escape hatch: `$queryRaw` for the handful of heavy catalogue queries | Drizzle (better SQL control, thinner ecosystem — reconsider only if Prisma's query planning becomes a measured bottleneck), TypeORM (no) |
| **Cache / rate limit / queue backing** | **Redis 7** | 7.x | Query cache, rate limiting, session revocation, BullMQ backing store, cart TTLs, idempotency keys | In-memory (breaks with >1 instance), Postgres-only (fine to start, but rate limiting wants Redis semantics) |
| **Background jobs** | **BullMQ** | latest | Reliable retries for payment reconciliation, email, webhooks, nightly rollups, sitemap regeneration. On serverless hosting, replaced by Vercel Cron + a queue table — see §9 | `node-cron` in-process (lost on redeploy), Inngest/Trigger.dev (extra vendor) |
| **Auth** | **Auth.js v5 (NextAuth)** | 5.x | First-class App Router support, database sessions, credentials + OAuth + email; we control the user table | Clerk/Auth0 (per-MAU cost, data offshore, overkill), hand-rolled (security risk) |
| **Validation** | **Zod** | 3.x | One schema for form validation, API input, env vars, and TS types | Yup (weaker inference), Valibot (smaller but less ubiquitous) |
| **Forms** | `react-hook-form` + `@hookform/resolvers` | latest | Uncontrolled by default, low re-render cost, integrates with Zod and Server Actions | Formik (heavier) |
| **Client state** | **Zustand** | 5.x | Only for the cart and the PC builder. Everything else is server state via RSC + `searchParams`. | Redux (ceremony), Jotai (fine, less common) |
| **Server-state fetching (client islands)** | **TanStack Query** | 5.x | Admin tables, builder part lists, autocomplete | SWR (fine; Query has better mutation/invalidations for admin) |
| **URL state** | `nuqs` | latest | Filter/sort/pagination state belongs in the URL for SEO and shareability | Hand-rolled `useSearchParams` juggling |
| **Tables** | TanStack Table | 8.x | Admin data grids | AG Grid (licence, weight) |
| **Charts** | Recharts | 2.x | Admin dashboards; small and declarative | Chart.js (imperative), D3 direct (overkill) |
| **Rich text** | **Tiptap** | 2.x | Blog and CMS editor. Outputs JSON, rendered server-side and sanitised — never `dangerouslySetInnerHTML` on raw user HTML | TinyMCE/CKEditor (licence, weight), raw Markdown (too technical for P1) |
| **PDF** | **`@react-pdf/renderer`** server-side | latest | Invoices, quotations, build sheets, shipping labels — generated on the server so they are identical every time and not dependent on the browser | jsPDF client-side (the reference app's approach; fragile, unstyled, no server copy) |
| **Email** | **Resend** + React Email | latest | Simple API, good deliverability, React templates. Abstracted behind a `MailProvider` interface so SMTP is a config change | SendGrid/Mailgun (heavier onboarding), raw SMTP only (deliverability risk) |
| **Object storage** | **S3-compatible** — Cloudflare R2 (cloud) or MinIO (VPS) | — | Zero egress on R2 matters when serving product photography from Nepal; MinIO gives the identical API self-hosted | Local disk (no redundancy, breaks multi-instance) |
| **Images** | `next/image` + `sharp`, AVIF→WebP→JPEG | — | Build-time and request-time optimisation, blur placeholders, responsive `srcset` | Cloudinary/imgix (recurring cost for a small catalogue) |
| **Search (v1)** | Postgres `tsvector` + `pg_trgm` + weighted ranking | — | ~150–2,000 products does not justify a search service. Typo tolerance via trigram similarity. | Algolia (cost), Elasticsearch (ops weight) |
| **Search (Phase 12+)** | **Meilisearch** self-hosted | 1.x | Typo tolerance, instant faceting, Nepali tokenisation, one small container. Behind a `SearchProvider` interface so the swap is a config change. | Typesense (comparable; Meilisearch has simpler ops), Algolia (cost) |
| **Logging** | **Pino** → stdout JSON | 9.x | Structured, fast, ships anywhere | Winston (slower), `console.log` (no) |
| **Error tracking** | **Sentry** | latest | Source-mapped errors, RSC + Route Handler support, release tracking, session replay (with strict PII scrubbing) | Bugsnag/Rollbar (equivalent; Sentry's Next.js SDK is the most complete) |
| **Uptime & log aggregation** | **Better Stack** (Logtail + Uptime) | — | Generous free tier, log search, status page, on-call alerts | Datadog/New Relic (cost) |
| **Analytics** | GA4 + GTM, Meta Pixel + CAPI, TikTok Pixel, Microsoft Clarity | — | See `12` | — |
| **CDN / WAF / DNS** | **Cloudflare** | — | Non-negotiable regardless of host: TLS, WAF, bot management, rate limiting at the edge, cache, and meaningfully better latency to Nepal than an origin alone | — |
| **Testing** | Vitest · Testing Library · Playwright · MSW · `@axe-core/playwright` · k6 | — | See `16` | Jest (slower with ESM/TS), Cypress (Playwright is faster and better for multi-context) |
| **Lint/format** | ESLint 9 flat config + Prettier + `eslint-plugin-security` + `eslint-plugin-jsx-a11y` | — | | Biome (fast, but weaker plugin ecosystem today) |
| **Package manager** | **pnpm** | 9.x | Fast, strict, disk-efficient; enables a workspace if we ever split packages | npm (slow), yarn (no advantage) |
| **Containers** | Docker + Docker Compose | — | Identical local, CI, and (optionally) production environments | — |
| **CI/CD** | GitHub Actions | — | See `15` | GitLab CI (only if the repo moves) |
| **Runtime** | Node.js | 22 LTS | | Bun (not yet worth the risk on a payment-handling system) |

---

## 3. Notable *non*-choices

| Not using | Reason |
|---|---|
| A headless commerce engine (Medusa, Saleor, Vendure) | It would hand us cart/order/inventory for free, but we would inherit its data model and its admin UI. The Dad Mode requirement is the single hardest constraint in this project, and it is precisely the thing a generic commerce admin cannot satisfy. We would end up rebuilding the admin anyway, on top of someone else's schema. |
| A headless CMS (Sanity, Payload, Strapi) | A second admin, a second login, a second permission model for a non-technical owner. Content lives in our Postgres, edited in our admin. |
| GraphQL | A single first-party client. REST + typed Server Actions is less machinery, better caching, and simpler for the implementing agent. `07` documents a GraphQL migration path if a mobile app ever appears. |
| tRPC | Server Actions cover the same ground natively in App Router. |
| A separate admin SPA | Route group `(admin)` inside the same app: shared types, shared auth, one deploy. |
| Micro-frontends / microservices | Wrong scale by two orders of magnitude. |
| Kubernetes | Wrong scale. |
| Stripe / Razorpay / PayPal | **Not available to Nepal-registered merchants.** See `10`. |

---

## 4. Dependency budget

Hard limits, enforced in CI.

| Metric | Budget |
|---|---|
| Direct production dependencies | ≤ 45 |
| Client JS, storefront route, gzipped | ≤ 180 KB |
| Client JS, PDP, gzipped | ≤ 200 KB |
| Client JS, builder route, gzipped | ≤ 280 KB |
| Client JS, admin route, gzipped | ≤ 400 KB (not SEO-critical, but the owner may be on 4G) |
| New dependency > 30 KB gzipped | Requires written justification in the PR |
| Any dependency unmaintained > 18 months in a security-relevant path | Prohibited |

---

## 5. Environment variables

All validated by Zod at boot (`src/env.ts`); the app **must refuse to start** if any required variable is missing or malformed. Never accessed via bare `process.env` outside that module.

| Group | Variables |
|---|---|
| Core | `NODE_ENV`, `APP_ENV`, `NEXT_PUBLIC_SITE_URL`, `PORT` |
| Database | `DATABASE_URL`, `DIRECT_DATABASE_URL` (migrations/pooling) |
| Redis | `REDIS_URL` |
| Auth | `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_CDN_URL` |
| Email | `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_FROM_TRANSACTIONAL`, `MAIL_REPLY_TO` |
| Payments | `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET`, `ESEWA_BASE_URL`, `KHALTI_SECRET_KEY`, `KHALTI_BASE_URL`, `FONEPAY_MERCHANT_CODE`, `FONEPAY_SECRET`, `CONNECTIPS_*` |
| Analytics | `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GA4_ID`, `GA4_API_SECRET`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`, `NEXT_PUBLIC_CLARITY_ID` |
| Observability | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `LOG_LEVEL`, `LOGTAIL_TOKEN` |
| Search | `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_SEARCH_KEY` |
| Ops | `CRON_SECRET`, `REVALIDATE_SECRET`, `ADMIN_IP_ALLOWLIST` (optional) |
| SMS | `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` — provider TBD, see `19` |

**Rule:** `NEXT_PUBLIC_*` is the only prefix that reaches the browser. Any secret accidentally given that prefix is a CI failure.

---

## 6. Third-party service inventory

| Service | Purpose | Failure mode | Fallback |
|---|---|---|---|
| Cloudflare | CDN, WAF, DNS | Site unreachable | DNS TTL kept low; origin reachable directly |
| Postgres host | Data | Total outage | PITR restore; read-only maintenance page |
| Redis | Cache, rate limit, queue | Degraded | App must function without Redis: cache misses go to DB, rate limiting falls back to in-memory per-instance, jobs queue in the DB table |
| R2 / MinIO | Images | Broken images | `next/image` fallback placeholder; CDN cache masks short outages |
| Resend | Email | No emails | Queue retries with backoff; SMTP fallback provider configured |
| eSewa / Khalti / Fonepay | Payment | Cannot pay | Per-gateway health flag in settings; failing gateway hidden from checkout; COD and bank transfer always available |
| Sentry | Errors | Blind | Pino logs still ship to Better Stack |
| GA4 / Meta / TikTok | Analytics | Data gap | Never blocks rendering; all loaded via GTM after consent |
| Meilisearch | Search | Search broken | Automatic fallback to Postgres FTS |

**Rule:** no third-party script may block first paint. No third-party outage may prevent a customer completing an order.

---

## 7. Browser and device support

| Target | Support |
|---|---|
| Chrome / Edge | Last 2 versions |
| Safari (iOS + macOS) | Last 2 versions |
| Firefox | Last 2 versions |
| Android WebView / Chrome Android | Last 2 versions |
| Baseline | ES2022; no IE; no Opera Mini |
| Reference device for performance | Mid-range Android (≈ Moto G-class), 4G, Kathmandu |
| Accessibility | WCAG 2.2 AA |

---

## 8. Data residency and compliance posture

> **ASSUMPTION:** No Nepali law currently mandates local data residency for a retail e-commerce site. This has **not** been legally verified and MUST be confirmed before choosing a host. See `19`.

Customer PII (name, phone, address) and order data will reside wherever the database is hosted. Payment card data is never touched — all card handling is delegated to the acquiring bank's hosted page. See `13`.

---

## 9. Hosting decision — OPEN

> **DECISION REQUIRED:** This must be resolved before Phase 1 exits. It affects the job runner, the storage provider, the CI deploy step, and the backup strategy.

### Option A — Managed cloud (Vercel + Neon + Upstash + R2)

| | |
|---|---|
| **Cost** | ~USD 20–70/month at expected volume (Vercel Pro $20/user, Neon ~$19, Upstash pay-as-you-go, R2 ~$1) |
| **Ops burden** | Near zero. No patching, no backups to configure, no uptime to own. |
| **Deploy** | `git push` → preview URL per PR → promote to production |
| **Latency to Nepal** | Vercel edge + Cloudflare in front; origin functions likely Singapore (`sin1`). Acceptable. |
| **Constraints** | No long-running processes → **BullMQ is not viable**; background work becomes Vercel Cron + a `Job` table + a queue-drain endpoint. Serverless function timeouts cap PDF generation and CSV imports (chunk them). Cold starts on low-traffic routes. |
| **Lock-in** | Moderate. ISR, `next/image`, and cron are Vercel-flavoured but standard Next.js. |
| **Best when** | The team is one or two people and developer time is worth more than USD 50/month. |

### Option B — Single VPS with Docker Compose (Hetzner/DigitalOcean)

| | |
|---|---|
| **Cost** | ~USD 15–30/month for a CX32-class box (4 vCPU / 8 GB) running app, Postgres, Redis, MinIO, Meilisearch, Caddy |
| **Ops burden** | Real. You own OS patching, Postgres backups and PITR, TLS renewal, log rotation, disk monitoring, and 3 a.m. restarts. |
| **Deploy** | GitHub Actions → build image → push to GHCR → SSH → `docker compose pull && up -d` with a health-gated swap |
| **Latency to Nepal** | Hetzner Germany is poor (~150–250 ms RTT); Singapore or Mumbai is materially better. Cloudflare caching hides most of it for anonymous traffic but not for checkout. |
| **Constraints** | Single point of failure unless you add a second node. Vertical scaling only. |
| **Advantages** | BullMQ works properly. No function timeouts. Full control. Cheapest at scale. |
| **Best when** | Someone competent will actually own the server. |

### Option C — Hosted in Nepal

| | |
|---|---|
| **Cost** | Typically higher per unit of compute than international VPS |
| **Latency** | Best in-country |
| **Risks** | Provider reliability, backup discipline, DDoS protection, and Docker/modern-runtime support all vary widely. Must be evaluated against a specific provider, not in the abstract. |
| **Justified only if** | A data-residency requirement is confirmed, or in-country latency is a stated business priority. |

### Recommendation

**Option A (managed cloud) for launch, with the codebase kept Option-B-ready.**

Reasoning: the binding constraint on this project is maintenance capacity, not hosting cost. The delta is roughly USD 30/month — less than one hour of developer time. Meanwhile Option B's failure mode (an unpatched box with no tested restore) is the most common way small e-commerce sites die.

To keep the door open, the following are **mandatory** regardless of which option is chosen:

- [ ] A working `docker-compose.yml` that runs the full stack locally and could run it in production.
- [ ] All background work expressed through a `JobQueue` abstraction with two drivers: `bullmq` and `cron-table`. No business logic imports BullMQ directly.
- [ ] Storage accessed only through an `S3` client configured by env — never a Vercel- or R2-specific SDK.
- [ ] No use of Vercel-proprietary APIs beyond `next/*` and cron.
- [ ] Database accessed only through Prisma with a standard `postgresql://` URL.

Migration from A to B then costs a day, not a rewrite.

---

## 10. Cost model (indicative, monthly USD)

| Item | Option A | Option B |
|---|---|---|
| Compute | 20 | 20 |
| Postgres | 19 | (included) |
| Redis | 5 | (included) |
| Object storage | 2 | (included) |
| Cloudflare | 0–20 | 0–20 |
| Email (Resend) | 0–20 | 0–20 |
| Sentry | 0–26 | 0–26 |
| Better Stack | 0–10 | 0–10 |
| Meilisearch | 10 (small container) | (included) |
| Domain + TLS | ~1 | ~1 |
| **Total** | **~57–123** | **~41–97** |

> **ASSUMPTION:** Free tiers apply at launch traffic. Re-cost at 10× traffic.
