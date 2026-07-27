# 14 — Performance

Budgets, caching architecture, and database tuning — calibrated for a mid-range Android phone on Kathmandu 4G, not a developer's laptop.

**Depends on:** `03`, `05`, `06`, `11 §8`. **Feeds into:** `15`, `16`.

---

## 1. The operating reality

> **ASSUMPTION:** Most traffic is mid-range Android on 4G in the Kathmandu Valley, with meaningful 3G outside it. Validate against GA4 device and connection data within 30 days of launch and revise these budgets accordingly.

| Constraint | Consequence |
|---|---|
| No CDN point of presence in Nepal for most providers | Every cache miss crosses to Singapore or Mumbai: 60–120 ms RTT before any work begins. **Cache-hit ratio is the single most important performance lever.** |
| Mid-range Android CPU | JavaScript parse + execute costs 4–6× a developer machine. A bundle that feels instant locally can cost 800 ms of main-thread time here. |
| Mobile data is a real cost | Page weight is a commercial barrier, not just a metric |
| Variable connectivity | Every network call needs a timeout, a retry and a visible failure state |

---

## 2. Budgets

### Core Web Vitals — field, p75, mobile

| Metric | Target | Hard fail |
|---|---|---|
| LCP | ≤ 2.0 s | > 2.5 s |
| INP | ≤ 180 ms | > 200 ms |
| CLS | ≤ 0.05 | > 0.10 |
| TTFB | ≤ 600 ms | > 800 ms |
| FCP | ≤ 1.5 s | > 1.8 s |

Deliberately tighter than Google's thresholds: lab results that merely meet the threshold produce field data that fails it.

### Per-route budgets — enforced in CI

| Route | JS (gzip) | CSS | Total transfer | DOM nodes | Server p95 |
|---|---|---|---|---|---|
| `/` | 180 KB | 25 KB | 900 KB | 1,200 | 200 ms |
| `/c/[...slug]` | 180 KB | 25 KB | 800 KB | 1,500 | 250 ms |
| `/p/[slug]` | 200 KB | 25 KB | 950 KB | 1,500 | 250 ms |
| `/search` | 180 KB | 25 KB | 700 KB | 1,200 | 300 ms |
| `/build` | 280 KB | 30 KB | 1.1 MB | 2,000 | 300 ms |
| `/cart` | 160 KB | 25 KB | 600 KB | 800 | 200 ms |
| `/checkout` | 200 KB | 25 KB | 700 KB | 1,000 | 300 ms |
| `/blog/[slug]` | 150 KB | 25 KB | 700 KB | 1,000 | 200 ms |
| `/admin/*` | 400 KB | 30 KB | 1.2 MB | 2,500 | 400 ms |

A regression greater than 5% against the recorded baseline fails the build.

### API latency

| Endpoint class | p50 | p95 | p99 |
|---|---|---|---|
| Cached reads | 20 ms | 80 ms | 200 ms |
| Product list with facets | 60 ms | 250 ms | 500 ms |
| Autocomplete | 30 ms | 100 ms | 200 ms |
| Builder validate | 80 ms | 300 ms | 600 ms |
| Builder part query | 60 ms | 200 ms | 400 ms |
| Checkout place | 200 ms | 800 ms | 1.5 s |
| Admin list | 100 ms | 400 ms | 800 ms |

---

## 3. Rendering strategy

The most consequential performance decision is choosing the right rendering mode per route.

| Route | Mode | Revalidation |
|---|---|---|
| `/` | Static + ISR | 300 s + on-demand tag |
| `/c/[...slug]` (no filters) | Static + ISR | 300 s + on-demand |
| `/c/[...slug]?filter=…` | Dynamic, cached at the edge | 60 s |
| `/p/[slug]` | Static + ISR, top 200 products pre-rendered at build | 300 s + on-demand on any product change |
| `/b/[slug]` | Static + ISR | 600 s |
| `/blog/*`, `/pages/*`, `/stores/*` | Static + ISR | 600–3600 s |
| `/build/[shortId]` | Static + ISR | 3600 s + on-demand |
| `/search` | Dynamic | 60 s edge |
| `/build`, `/cart`, `/checkout`, `/account/*`, `/admin/*` | Dynamic, `no-store` | — |

### Server Components discipline

| Rule | Reason |
|---|---|
| `"use client"` is the exception, pushed as deep as possible | Every client boundary drags its subtree into the bundle |
| Data fetching in Server Components only | No client-side waterfalls for above-the-fold content |
| Heavy client-only libraries dynamically imported | Charts, the Tiptap editor, the PDF viewer, the map embed |
| Never pass large objects across the RSC boundary | Serialisation cost; select only the fields the client needs |
| `<Suspense>` around slow independent sections | Streaming: the buy box must not wait for reviews |
| Parallel data fetching | `Promise.all`, never sequential awaits |

### Streaming and priority

The PDP streams in this order: shell and navigation → gallery and buy box (the LCP region) → specifications → reviews → related products. The customer can decide to buy before the page has finished loading.

---

## 4. Caching architecture

```
┌─ Browser ────────────────────────────────────────────────┐
│ HTTP cache · immutable static assets (1 y) ·             │
│ Next.js Router Cache · in-memory query cache             │
└───────────────────┬──────────────────────────────────────┘
                    ▼
┌─ Cloudflare edge ────────────────────────────────────────┐
│ Static assets (immutable) · HTML with s-maxage + SWR ·   │
│ Images · Tiered caching · ~85% hit ratio target          │
└───────────────────┬──────────────────────────────────────┘
                    ▼
┌─ Next.js ────────────────────────────────────────────────┐
│ Full Route Cache (ISR) · Data Cache (fetch + unstable_   │
│ cache) · React `cache()` request memoisation             │
└───────────────────┬──────────────────────────────────────┘
                    ▼
┌─ Redis ──────────────────────────────────────────────────┐
│ Expensive query results · facet counts · settings ·      │
│ menus · builder rules and part specs · session store ·   │
│ rate-limit counters · idempotency keys                   │
└───────────────────┬──────────────────────────────────────┘
                    ▼
┌─ PostgreSQL ─────────────────────────────────────────────┐
│ Materialised views · prepared statements · pgbouncer     │
└──────────────────────────────────────────────────────────┘
```

### Cache keys and invalidation

A **cache tag registry** in `lib/cache.ts` is the single source of tag strings — ad-hoc tag literals are a lint error.

| Entity change | Tags revalidated |
|---|---|
| Product updated | `product:{id}`, `product:list`, `category:{id}`, `brand:{id}`, `sitemap:products` |
| Price or stock changed | `product:{id}`, `product:list` (stock also busts the availability endpoint) |
| Category changed | `category:{id}`, `category:tree`, `nav`, `sitemap:categories` |
| Post published | `post:{id}`, `post:list`, `sitemap:posts` |
| Setting changed | `settings`, and `nav` if navigation-related |
| Builder rule changed | `builder:rules`, `builder:engine-version` (bumps the version, invalidating validation caches) |
| Menu changed | `nav` |

**Rules:** never cache anything user-specific at a shared layer. Never cache `Set-Cookie` responses. Cart, checkout, account and admin are always `no-store`. Cached data always carries a TTL as a backstop — tag invalidation is an optimisation, not a guarantee.

### Cloudflare configuration

| Asset class | Cache-Control |
|---|---|
| `/_next/static/*` | `public, max-age=31536000, immutable` |
| Fonts | `public, max-age=31536000, immutable` |
| Images via CDN | `public, max-age=31536000, immutable` (content-hashed keys) |
| HTML (ISR routes) | `public, s-maxage=300, stale-while-revalidate=600` |
| API reads | Per `07 §2` |
| Anything authenticated | `private, no-store` |

`stale-while-revalidate` matters more here than usual: a Nepali user should never wait for a revalidation round-trip to Singapore.

---

## 5. Database performance

| Technique | Application |
|---|---|
| **Connection pooling** | pgbouncer in transaction mode (or the provider's pooler). Serverless without pooling will exhaust connections — this is not optional on the Vercel path. |
| **Index coverage** | Every query in a hot path has a supporting index (`06 §11`). `pg_stat_statements` is reviewed monthly. |
| **N+1 elimination** | Prisma `include`/`select` with explicit relation loading. A Prisma query-event logger in development warns on repeated identical queries within one request. |
| **Select only what is needed** | No `SELECT *` via unbounded `include`. The product list query returns ~12 columns, not the full row plus every relation. |
| **Materialised views** | `product_sales_30d`, `category_product_counts`, `brand_product_counts`, `low_stock_summary`. Refreshed nightly, `CONCURRENTLY`. |
| **Denormalisation** | `Product.ratingAverage`, `ratingCount`, `viewCount`; `Customer.totalOrders`, `totalSpentPaisa`; `Build.totalPaisa`, `estimatedWatts`. Maintained by triggers or jobs, never computed per request. |
| **Facet counts** | The expensive part of a filtered catalogue page. Computed once per category per filter-combination and cached in Redis for 300 s; approximated above a cardinality threshold rather than counted exactly. |
| **Statement timeout** | 5 s for web requests, 60 s for background jobs. A runaway query must never hold a connection. |
| **Batch writes** | Bulk imports use `createMany`/`updateMany` in chunks of 500 inside a transaction. |
| **Read replicas** | Not in v1. The escape hatch is documented: route admin reports and sitemap generation to a replica if write contention appears. |
| **`EXPLAIN ANALYZE`** | Required in the PR description for any new query expected to touch more than 1,000 rows. |

---

## 6. Frontend performance

### JavaScript

| Technique | Application |
|---|---|
| Route-based splitting | Automatic in App Router; verified with `@next/bundle-analyzer` on every release |
| Dynamic imports | Charts, Tiptap, PDF preview, map embed, the compare table, the builder's part picker |
| Tree shaking | `import { Camera } from 'lucide-react'`, never a namespace import. `optimizePackageImports` configured for `lucide-react`, `date-fns` and `recharts`. |
| No moment.js, no lodash | Native `Intl` and targeted `date-fns` functions only |
| Third-party scripts | GTM loaded via `next/script` with `strategy="afterInteractive"`, and only after consent. Nothing else is third-party. |
| Polyfills | Modern baseline only; no legacy transpilation |

### CSS

Tailwind purges to the used surface. One stylesheet. Critical CSS is inlined by Next.js. No CSS-in-JS runtime. `content-visibility: auto` on long below-the-fold sections (spec tables, review lists, the builder's part list).

### Fonts

Three families, self-hosted via `next/font`, `display: swap`, subset to `latin` (plus `devanagari` for Inter). The two families used above the fold are preloaded; JetBrains Mono is not. Fallback metrics are matched with `size-adjust` so the swap causes no layout shift. **The Material Symbols webfont is removed entirely.**

### Images

Full specification in `11 §7`. The performance-critical rules: exactly one `priority` image per route; explicit `sizes` on every image; AVIF first; blur placeholders from stored `blurDataUrl`; and a hard 2400px source ceiling.

### The design's paint costs

Per `11 §8.4`: keep `backdrop-filter` on the sticky nav only; flatten glass panels inside scrolling lists (and whenever `prefers-reduced-transparency` is set); prefer border-colour transitions to glow shadows on hover; **delete the cursor-follow radial glow entirely**; apply `will-change` only during an active hover.

---

## 7. Runtime and infrastructure

| Technique | Application |
|---|---|
| Compression | Brotli at the edge, gzip fallback |
| HTTP/3 | Enabled at Cloudflare — meaningful on lossy mobile networks |
| Early Hints / preconnect | `preconnect` to the CDN origin; `dns-prefetch` for GTM |
| Priority hints | `fetchpriority="high"` on the LCP image; `low` on below-the-fold media |
| Job offloading | Anything over ~1 s (PDF generation, CSV import, email, image derivatives, analytics dispatch) runs in a background job, never in the request |
| Payload size | API responses trimmed to what the client renders. The product list returns summaries, not full records. |
| Prefetch | Next.js `<Link>` prefetch on viewport entry for product cards; disabled on the admin (bandwidth) and on `/checkout` |

---

## 8. Measurement and enforcement

| Layer | Tool | Gate |
|---|---|---|
| **Lab** | Lighthouse CI on every PR — mobile preset, 4× CPU throttle, Slow 4G — across `/`, a category, a PDP, `/build`, `/checkout` | Performance ≥ 90, SEO ≥ 95, Accessibility = 100, Best Practices ≥ 95 |
| **Bundle** | `scripts/check-bundle-budget.ts` against the per-route table | > 5% regression fails |
| **Field** | `web-vitals` → GA4 + a first-party endpoint, segmented by route, device class and connection | Weekly review |
| **Server** | Pino request timings → Better Stack; p95 per route | Alert on p95 > 2× target |
| **Database** | `pg_stat_statements`, slow-query log (> 500 ms) | Monthly review |
| **Cache** | Cloudflare analytics hit ratio; Redis hit ratio | Alert below 80% edge hit ratio |
| **Load** | k6 before launch and before any major release | See §9 |
| **Real user** | CrUX + Search Console Core Web Vitals | Monthly |

**Performance is a release gate, not a follow-up ticket.** A PR that breaches a budget does not merge.

---

## 9. Load testing

Executed with k6 against staging with production-shaped data.

| Scenario | Profile | Pass criteria |
|---|---|---|
| Baseline browse | 50 concurrent users, 10 min, home → category → PDP | p95 < 500 ms, 0 errors |
| Peak browse | 200 concurrent, 10 min | p95 < 1 s, error rate < 0.1% |
| Flash sale | 500 concurrent hitting one product, 5 min | No overselling, p95 < 2 s |
| Checkout | 50 concurrent placing orders | No duplicate orders, no lost reservations, correct stock decrements |
| Builder | 100 concurrent validating builds | p95 < 500 ms |
| Search | 100 concurrent, varied terms | p95 < 400 ms |
| Admin | 5 concurrent on order and product lists with 10,000 orders | p95 < 1 s |
| Sustained | 100 concurrent, 1 hour | No memory growth, no connection-pool exhaustion |

**Inventory correctness under concurrency is the highest-value test here** — overselling a laptop is worse than a slow page.

---

## 10. Scale headroom

| Metric | Launch | Designed for | First bottleneck | Response |
|---|---|---|---|---|
| Products | ~150 | 50,000 | Facet counts | Meilisearch (already interfaced) |
| Orders/day | ~10 | 5,000 | Admin list queries | Partitioning + a read replica |
| Concurrent users | ~20 | 1,000 | Compute | Horizontal scale (stateless app) |
| Builder parts | ~500 | 20,000 | Part query + validation | Precomputed compatibility bitmaps |
| Media | ~1,000 | 100,000 | None (object storage) | — |
| DB size | < 1 GB | 100 GB | Backup window | Incremental backups, table partitioning |

The application is stateless — sessions, cart and cache all live in Redis or Postgres — so horizontal scaling requires no code change. That property must be preserved: **no in-memory state that outlives a request.**

---

## 11. Performance checklist per feature

Applied before any feature is considered done.

- [ ] Rendered as a Server Component unless interactivity genuinely requires otherwise
- [ ] No new client-side data waterfall above the fold
- [ ] All images use `next/image` with `sizes` and correct dimensions
- [ ] Any new dependency over 30 KB gzipped is justified in the PR
- [ ] New queries have supporting indexes and an `EXPLAIN ANALYZE` in the PR if they touch > 1,000 rows
- [ ] Cacheable responses carry an appropriate `Cache-Control` and cache tags
- [ ] Anything over 1 s runs as a background job
- [ ] Loading skeletons match final layout dimensions (no CLS)
- [ ] Lighthouse CI passes for every affected route
- [ ] Bundle budget not breached
