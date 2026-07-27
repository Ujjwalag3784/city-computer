# 11 — SEO Strategy

Technical SEO blueprint for the `citycomputer` rebuild (City Computer Systems, New Road, Kathmandu). This document specifies URL architecture, canonicalisation, the metadata resolution system, the complete JSON-LD structured-data plan, sitemaps and robots policy, on-page and content architecture, image SEO, Core Web Vitals budgets tuned for Nepali mobile networks, local/international SEO, and the WordPress→Next.js migration and launch plan. Every rule here is written to be implementable against the locked stack (Next.js 15 App Router, Prisma/PostgreSQL 16, `next-intl`, `next/image`) and to directly remediate the defects catalogued in the audit of the live WooCommerce site.

**Depends on:** `01` (audit), `02` (route taxonomy, i18n scope), `05` (Obsidian Peak tokens), `06` (Prisma schema, `ProductSlugHistory`, `Redirect`), `09` (owner-facing SEO fields).
**Feeds into:** `12` (analytics), `14` (performance), `16` (testing), `15` (deployment).

---

## 1. SEO baseline audit of the current site

Current stack: WordPress + WooCommerce + Elementor 4.1.4, ~150 products, single language (English only), no visible structured data.

| # | Defect observed on citycomputer.com.np | SEO / business impact | Fix in the new build |
|---|---|---|---|
| 1 | Product pages emit `og:type: article` | Social/AI parsers classify PDPs as editorial; no product preview card, no price/availability in unfurls | `generateMetadata()` sets `openGraph.type = 'website'` with full `product:*` OG namespace on `/p/[productSlug]`; type derived from a typed route registry, never hand-authored |
| 2 | No Product/Offer/Review/Breadcrumb JSON-LD anywhere | Zero rich-result eligibility: no price, no availability, no breadcrumb trail in SERP. Competitors (Daraz, Hukut, ITTI, Neoteric) all win the visual space | Centralised `lib/seo/jsonld/*` builders emitting validated JSON-LD on every route type (§4) |
| 3 | Blog nav link is a dead `#` | Crawl dead-end; blog content (if any) is orphaned; user trust signal loss | `/blog` is a first-class route with real content and hub links from category pages |
| 4 | Duplicate routes `/my-account/` + `/my-account-2/`, `/checkout-2/` | Crawl-budget waste, index bloat, split signals, confusing SERP results for brand queries | Single `/account/*` and `/checkout` routes; `-2` variants 410 (Gone) or 301 to canonical; all account/checkout `noindex` |
| 5 | Two live URLs for the same SKU (`/product/macbook-neo-price-nepal/` and `/product/apple-macbook-neo-13-inch-a18-pro-chip-8gb-ram-512gb-ssd/`) | Classic keyword-cannibalisation: two pages compete for `macbook neo price nepal`, neither consolidates links | One `Product` row → one canonical `/p/[productSlug]`. The price-intent variant becomes a *programmatic price page* under `/blog` or a `pages` entry that links to the PDP, or is 301'd. Enforced by a DB unique constraint on `slug` plus `ProductSlugHistory` |
| 6 | Image filenames like `sdfgwfv.png.webp` | No filename relevance signal; Google Images invisible; double-extension is a red flag | Deterministic filename generator (§7): `{productSlug}-{role}-{index}-{hash8}.{ext}` |
| 7 | Alt text describes an M3 MacBook on an M4 product | Actively wrong relevance signal; accessibility failure; risk of misleading-content perception | Auto-generated alt from live DB fields + human override field; alt can never be copied between products |
| 8 | 200-character product titles used as the H1 | H1 becomes an unreadable keyword soup; `<title>` truncated in SERP; no clear primary entity | Four-field split `name` / `displayTitle` / `h1` / `metaTitle` (`06 §4`, §6.1) with length budgets enforced in the admin |
| 9 | Client-side JS rewrites `Rs.` → `रु` after paint | CLS on every price node; crawlers may index `Rs.`; price mismatch between HTML and JSON-LD | Money stored as integer paisa; `formatNPR()` renders `रु` server-side in RSC. Zero client-side currency mutation |
| 10 | Footer "Webcams" link points to the motherboards category | Wrong internal-link anchor→target pairing dilutes topical signals; user bounce | Footer/nav links generated from the DB category tree; a build-time link-integrity test fails CI on any 3xx/4xx/mismatched internal link |
| 11 | Out-of-stock products indexed with no availability signal | SERP shows buyable items that are not buyable → pogo-sticking, quality signal decay | Explicit OOS policy (§5.4): stay indexed, emit `availability: OutOfStock`, show restock/alternatives block, drop from `sitemap-products` after 90 days OOS |
| 12 | Zero reviews site-wide | No `AggregateRating` possible; no UGC freshness; lower CTR vs starred competitors | Verified-purchase review system (`06 §4`, `02 §2.1`); **hard rule: never emit rating markup with zero reviews** |
| 13 | Static 2024 theme-demo Instagram images in the footer | Stale/irrelevant content, external requests, no freshness signal | Server-cached Instagram/TikTok feed or removed entirely; no demo assets ship |
| 14 | No Nepali-language content | Misses all Devanagari-script queries (`ल्यापटप मूल्य`, `कम्प्युटर पसल काठमाडौं`) | `ne` locale under `/ne/...` with a defined translation tier policy (§9.3) |
| 15 | *Inferred:* Elementor emits deeply nested wrapper divs and inline `<style>` per section | Render-blocking CSS, large DOM, poor LCP/INP on 4G | RSC + Tailwind v4 with a hard JS budget (§8) |
| 16 | *Inferred:* WooCommerce default `?orderby=`, `?filter_*`, `?add-to-cart=` URLs are crawlable | Infinite faceted URL space consuming crawl budget on a 150-product catalogue | Query-param policy + `robots.txt` disallow list (§2.5, §5.5) |
| 17 | *Inferred:* WP tag archives, author archives, `?p=` ugly permalinks, feed URLs, attachment pages | Thin/duplicate index bloat typical of WP | Not built at all; legacy patterns disallowed and 410'd (§10) |
| 18 | *Inferred:* No XML sitemap index segmentation; `lastmod` unreliable | Slow discovery of price/stock changes | Sitemap index with per-type children and DB-sourced `lastmod` (§5) |

> **ASSUMPTION:** Items 15–18 are inferred from the known plugin/theme stack and standard WooCommerce behaviour rather than confirmed by a crawl. Validate with the pre-migration crawl in §10.1 before quoting them to the owner.

---

## 2. URL architecture & canonicalisation

### 2.1 Locked route taxonomy

| Route | Purpose | Indexable |
|---|---|---|
| `/` | Home | Yes |
| `/shop` | All-products entry, faceted | Yes (self-canonical, page 1 only in sitemap) |
| `/c/[...categorySlug]` | Category, nestable (`/c/laptops/gaming`) | Yes |
| `/b/[brandSlug]` | Brand hub | Yes |
| `/p/[productSlug]` | PDP | Yes |
| `/search` | Internal search results | `noindex,follow` |
| `/build` | PC configurator | Yes |
| `/build/[shortId]` | Shared build | `noindex,follow` by default; `index` only if owner-curated (§4.11) |
| `/prebuilt` | Pre-built PC listing | Yes |
| `/cart`, `/checkout` | Funnel | `noindex,nofollow` |
| `/order/confirmation/[orderNumber]` | Post-purchase | `noindex,nofollow` |
| `/track` | Order tracking form | `noindex,follow` |
| `/account/*` | Customer area | `noindex,nofollow` |
| `/blog`, `/blog/[postSlug]`, `/blog/category/[slug]` | Editorial | Yes |
| `/service`, `/service/book` | Repair service | Yes |
| `/service/status/[ticketNumber]` | Ticket lookup result | `noindex,nofollow` |
| `/stores`, `/stores/[branchSlug]` | Branch pages | Yes (local SEO anchors) |
| `/compare` | Comparison tool | `noindex,follow` (dynamic combos) |
| `/emi-calculator` | EMI tool | Yes |
| `/pages/[slug]` | CMS pages (about, privacy, terms, returns, warranty, shipping) | Yes |
| `/admin/*` | Admin | `noindex,nofollow` + `X-Robots-Tag` + auth gate |

Nepali equivalents are the same paths prefixed `/ne` (e.g. `/ne/p/[productSlug]`). **Slugs are not translated** — the path segment is identical across locales so that one product has one slug in both locales. This avoids a second slug namespace, second redirect table, and second cannibalisation surface.

> **DECISION REQUIRED:** Whether Nepali *category* slugs should be transliterated (`/ne/c/ल्यापटप`) for user-visible relevance. Recommendation: **no** — keep ASCII slugs in both locales; percent-encoded Devanagari paths are fragile in sharing, analytics, and CDN logs. The Nepali signal is carried by `<h1>`, `<title>`, and body copy, which is what actually ranks.

### 2.2 Slug rules

| Rule | Specification |
|---|---|
| Charset | `[a-z0-9-]` only. Generated by a single `slugify()` in `lib/seo/slug.ts` |
| Transliteration | Devanagari input is transliterated to Latin (ITRANS-style), not stripped. `ल्यापटप` → `lyapatap`. Never emit an empty slug — fall back to `{entityType}-{id}` |
| Max length | 60 chars for products, 40 for categories/brands, 70 for blog posts. Truncate at a word boundary, never mid-word |
| Stopword strip | Remove `the, a, an, with, for, and, of` and marketing filler (`best, buy, price, nepal, original, genuine`) from auto-generated product slugs — those belong in the title, not the path |
| Spec noise | Do not encode full specs. `apple-macbook-neo-13-inch-a18-pro-chip-8gb-ram-512gb-ssd` → `apple-macbook-neo-13-a18-pro`. Variant dimensions live in query-less variant URLs only if they are separate `Product` rows |
| Uniqueness | DB unique index on `(slug)` for products, `(parentId, slug)` for categories. Collision suffix `-2` is a **last resort**, logged as a content warning for the owner |
| Immutability | Slugs are treated as immutable after first publish. The admin may edit, but the UI warns and the change is recorded |

### 2.3 `ProductSlugHistory` and 301 handling

```
model ProductSlugHistory {
  id         String   @id @default(cuid())
  productId  String
  oldSlug    String   @unique
  createdAt  DateTime @default(now())
  source     SlugChangeSource  // ADMIN_EDIT | MIGRATION | MERGE
  product    Product  @relation(fields: [productId], references: [id])
  @@index([productId])
}
```

Resolution order in `/p/[productSlug]`:

```
1. SELECT * FROM Product WHERE slug = :slug AND status = ACTIVE  → render 200
2. SELECT productId FROM ProductSlugHistory WHERE oldSlug = :slug   → permanentRedirect('/p/' + current.slug)  [308/301]
3. Fuzzy match on ProductSlugHistory + Product (trigram)            → render 404 with 3 suggestions
4. Otherwise                                                        → 404 (never soft-404, never redirect to /shop)
```

Parallel tables `CategorySlugHistory`, `BrandSlugHistory`, `PostSlugHistory` follow the same contract. Redirect chains are collapsed at write time: when slug B→C is created, any row pointing to B is rewritten to point at the product (whose current slug is C), so a request for A always resolves in one hop.

**Never redirect a deleted product to a category page** — that is a soft-404 pattern. Deleted/discontinued products return 410 if permanently gone, or stay published with `availability: Discontinued` if the page has accumulated links (preferred for anything with organic traffic).

### 2.4 Trailing slash, case, and host canonicalisation

| Policy | Value | Enforcement |
|---|---|---|
| Trailing slash | **Off** (`trailingSlash: false` in `next.config.ts`). Canonical form has no trailing slash | Next.js emits a 308 from `/p/foo/` → `/p/foo` automatically |
| Case | Lowercase only. Uppercase paths 301 to lowercase | Middleware: if `pathname !== pathname.toLowerCase()` → 301 to lowercase, preserving query |
| Host | `https://citycomputer.com.np` (no `www`) | Cloudflare bulk redirect: `www` → apex, `http` → `https`, all 301 |
| Duplicate index files | No `/index`, no `.html` suffixes | N/A on App Router |
| Canonical tag | **Always self-referencing and absolute** on indexable pages, emitted by `generateMetadata().alternates.canonical` | Never relative; never omitted |

WordPress served trailing slashes (`/product/foo/`). Migration redirects must therefore handle both `/product/foo/` and `/product/foo` in the same rule set — see §10.2.

### 2.5 Filter, sort, and pagination query parameters

Faceted navigation on a ~150-product catalogue creates combinatorial URL space with almost zero unique-content value. Policy:

| Param class | Examples | URL treatment | Robots | Canonical target |
|---|---|---|---|---|
| **Canonical facet (whitelisted)** | `?brand=asus` on a category, `?type=gaming` | Indexable **only** for a hand-curated whitelist of high-intent combinations that also have a `CategoryFacetLanding` row with unique copy | `index,follow` | Self |
| Non-whitelisted single facet | `?ram=16gb`, `?storage=512gb` | Crawlable but not indexable | `noindex,follow` | Clean category URL |
| Multi-facet (2+ facets) | `?ram=16gb&storage=512gb&color=black` | Blocked from crawl | `noindex,follow` + `robots.txt` disallow | Clean category URL |
| Sort | `?sort=price-asc`, `?orderby=` | Never indexable; content identical | `noindex,follow` | Clean category URL |
| Pagination | `?page=2` | Indexable, self-canonical (§6.5) | `index,follow` | Self (`?page=2`) |
| View/display | `?view=grid`, `?perPage=48` | Blocked | `noindex,follow` + disallow | Clean URL |
| Session/tracking | `?utm_*`, `?gclid`, `?fbclid`, `?ref` | Stripped from canonical; never linked internally | inherit page | Clean URL without params |
| Legacy Woo | `?add-to-cart=`, `?remove_item=`, `?wc-ajax=`, `?p=`, `?s=` | Disallowed in `robots.txt`, 410 if hit | — | — |

Implementation notes:

- Param order is normalised (alphabetical) and values lowercased before canonical construction, so `?brand=Asus&ram=16` and `?ram=16&brand=asus` produce one canonical.
- Unknown params are dropped entirely from the canonical URL.
- Facet links beyond the whitelist render as `<button>`/client-state controls that update the URL via `history.pushState` **without** an `<a href>` — no crawlable link, no crawl budget spent, full shareability retained.
- Internal links only ever point at clean or whitelisted URLs. A CI test asserts no `<a href>` in the codebase contains a non-whitelisted facet param.

**Crawl-budget strategy summary:** with ~150 products, total legitimately indexable URLs should land near 400–700 (products + categories + brands + blog + pages + stores + paginated pages + whitelisted facet landings). Any crawl-stats report showing Googlebot fetching thousands of URLs is a defect, not growth.

### 2.6 hreflang matrix

Every indexable page emits a complete, reciprocal, self-inclusive set. `x-default` points at the English (root) version because English is the default locale and serves international/undetermined visitors.

| Page | `hreflang="en"` | `hreflang="ne"` | `hreflang="x-default"` |
|---|---|---|---|
| Home | `https://citycomputer.com.np/` | `https://citycomputer.com.np/ne` | `https://citycomputer.com.np/` |
| Shop | `/shop` | `/ne/shop` | `/shop` |
| Category | `/c/laptops/gaming` | `/ne/c/laptops/gaming` | `/c/laptops/gaming` |
| Brand | `/b/asus` | `/ne/b/asus` | `/b/asus` |
| PDP | `/p/asus-tuf-a15-r7-rtx4060` | `/ne/p/asus-tuf-a15-r7-rtx4060` | `/p/asus-tuf-a15-r7-rtx4060` |
| Blog post | `/blog/best-gaming-laptop-nepal-2026` | `/ne/blog/best-gaming-laptop-nepal-2026` | `/blog/best-gaming-laptop-nepal-2026` |
| Store | `/stores/new-road` | `/ne/stores/new-road` | `/stores/new-road` |
| CMS page | `/pages/warranty` | `/ne/pages/warranty` | `/pages/warranty` |

Rules:

- Use `en` and `ne`, **not** `en-NP`/`ne-NP`, in hreflang. Language-only codes maximise match breadth; the geographic signal comes from ccTLD (`.com.np`), the LocalBusiness markup, and Google Business Profile.
- Emit via `alternates.languages` in `generateMetadata` plus `<link rel="alternate">` in HTML. **Do not** put hreflang in the XML sitemap *and* the HTML — pick HTML as the single source of truth to avoid contradictions.
- A `ne` URL is only listed in hreflang **if a real `ne` translation exists**. Missing translation → omit the `ne` alternate for that page and do not render an empty `/ne/...` shell (§9.4).
- `noindex` pages emit no hreflang.
- Language switcher links use the same absolute URLs as hreflang, keeping HTML and metadata consistent.

---

## 3. Metadata system

### 3.1 Structure

All metadata flows through one module, `lib/seo/metadata.ts`, exposing `resolveMetadata(input): Metadata`. Route files never hand-write titles.

```
app/[locale]/p/[productSlug]/page.tsx
  export async function generateMetadata({ params }) {
    const product = await getProductForSeo(params.productSlug, params.locale) // cached
    return resolveMetadata({ kind: 'product', entity: product, locale: params.locale })
  }
```

Constraints:
- `generateMetadata` and the page body must share one cached data fetch (React `cache()` + Redis) so metadata generation costs zero extra DB queries.
- Metadata is generated on the server only; no client-side `<title>` mutation ever (this is what broke the currency display on the old site).
- `metadataBase` is set once in the root layout so every relative URL resolves absolutely.

### 3.2 Resolution cascade

```
resolveMetadata()
  │
  ├─ 1. Per-entity override        (SeoMeta row: metaTitle, metaDescription, ogImageId, robots)
  │        ↓ null/blank field falls through
  ├─ 2. Entity-type template       (CategoryTemplate / BrandTemplate / ProductTypeTemplate)
  │        ↓
  ├─ 3. Route-kind default template (table in §3.5)
  │        ↓
  └─ 4. Global fallback            ("City Computer Systems — Computers & Laptops in Nepal")
```

Each field resolves independently: an owner can override the title and let the description stay templated. Empty string is treated as "not set" and falls through; only an explicit `null`-suppression flag can blank a field.

```
model SeoMeta {
  id              String  @id @default(cuid())
  entityType      SeoEntityType   // PRODUCT | CATEGORY | BRAND | POST | PAGE | BRANCH
  entityId        String
  locale          String          // "en" | "ne"
  metaTitle       String?
  metaDescription String?
  ogImageId       String?
  robotsIndex     Boolean @default(true)
  robotsFollow    Boolean @default(true)
  canonicalOverride String?
  @@unique([entityType, entityId, locale])
}
```

### 3.3 Template variable syntax

Templates are plain strings with `{{path}}` placeholders resolved against a typed context object. Unresolved or empty variables collapse along with their adjacent separator, so no page ever ships `Laptop |  | City Computer`.

| Variable | Source | Example |
|---|---|---|
| `{{product.name}}` | `Product.displayTitle` | `ASUS TUF Gaming A15 (R7-7435HS, RTX 4060)` |
| `{{product.shortName}}` | `Product.h1` | `ASUS TUF Gaming A15` |
| `{{product.price}}` | `formatNPR(price)` | `रु 1,64,900` |
| `{{product.sku}}` | `Product.sku` | `CC-LP-ASU-1042` |
| `{{brand}}` | `Brand.name` | `ASUS` |
| `{{category}}` | nearest `Category.name` | `Gaming Laptops` |
| `{{category.parent}}` | parent `Category.name` | `Laptops` |
| `{{keySpecs}}` | first 3 spec attributes, comma-joined | `Ryzen 7, 16GB RAM, RTX 4060` |
| `{{availability}}` | localised stock word | `In Stock` / `स्टकमा` |
| `{{count}}` | result count on listings | `42` |
| `{{branch}}` | `Branch.name` | `New Road` |
| `{{year}}` | current year | `2026` |
| `{{site}}` | constant | `City Computer` |

Example product title template:
`{{product.shortName}} Price in Nepal | {{brand}} {{category}} | {{site}}`

Rendering rules: collapse whitespace; strip `|` runs; if the rendered title exceeds the budget, truncate the **left-most variable group** (usually `keySpecs`) rather than the brand suffix; never truncate mid-word; never append `…` in `<title>`.

### 3.4 Length budgets

| Field | Target | Hard max | Admin hint |
|---|---|---|---|
| `<title>` | 50–60 chars | 65 | Amber <35 or >60, red >65 |
| `meta description` | 140–160 chars | 165 | Amber <110 or >160, red >165 |
| `h1` | 30–65 chars | 80 | Red >80 |
| `displayTitle` (product card / PDP heading area) | ≤ 90 chars | 120 | Red >120 |
| OG title | ≤ 60 chars | 70 | Auto |
| OG description | ≤ 120 chars | 140 | Auto |

The 200-character H1 on the current site violates every one of these; the new admin makes it structurally impossible (§6.1, §11).

### 3.5 Route × metadata matrix

`{{site}}` = "City Computer". All canonicals absolute. All indexable routes emit full hreflang per §2.6.

| Route | Title template | Description template | Canonical | Robots | OG image source |
|---|---|---|---|---|---|
| `/` | `{{site}} — Laptops, Desktops & PC Components in Nepal` | `Buy laptops, desktops, gaming PCs and components in Kathmandu. Genuine products, official warranty, EMI available. New Road, Kathmandu.` | self | `index,follow` | Static branded OG (`/opengraph-image`) |
| `/shop` | `Shop All Products — Computers & Accessories in Nepal \| {{site}}` | `Browse {{count}}+ laptops, desktops, components and accessories with prices in Nepal. In-store pickup in Kathmandu or nationwide delivery.` | self incl. `?page=n` | `index,follow` | Static branded |
| `/c/[...]` | `{{category}} Price in Nepal — Buy {{category}} Online \| {{site}}` | `{{category}} in Nepal starting from {{minPrice}}. {{count}} models from {{topBrands}}. Genuine stock, warranty, EMI. Delivery across Nepal.` | self (clean, or `?page=n`) | `index,follow` | Dynamic category OG |
| `/c/[...]` + whitelisted facet | `{{brand}} {{category}} Price in Nepal \| {{site}}` | templated per facet landing | self | `index,follow` | Dynamic |
| `/c/[...]` + other params | (inherits) | (inherits) | clean category URL | `noindex,follow` | — |
| `/b/[brandSlug]` | `{{brand}} in Nepal — Official Prices & Models \| {{site}}` | `Shop {{brand}} laptops, desktops and accessories in Nepal. {{count}} products, authorised warranty, EMI options. Kathmandu showroom.` | self | `index,follow` | Dynamic brand OG (logo + tokens) |
| `/p/[productSlug]` | `{{product.shortName}} Price in Nepal \| {{brand}} \| {{site}}` | `{{product.shortName}} price in Nepal: {{product.price}}. {{keySpecs}}. {{availability}} at {{site}}, New Road Kathmandu. Warranty + EMI.` | self | `index,follow` | Dynamic PDP OG (product image + price) |
| `/search` | `Search results for "{{q}}" \| {{site}}` | — (omit) | self, params stripped | `noindex,follow` | Static |
| `/build` | `Build Your Own PC in Nepal — Custom PC Builder \| {{site}}` | `Pick your CPU, motherboard, GPU, RAM and case with automatic compatibility checks and live prices in NPR. Save and share your build.` | self | `index,follow` | Static builder OG |
| `/build/[shortId]` | `{{build.name}} — Custom PC Build ({{build.total}}) \| {{site}}` | `A {{build.total}} custom PC build: {{build.cpu}}, {{build.gpu}}, {{build.ram}}. Open it in the builder to customise and order.` | self | `noindex,follow` (default) | Dynamic build OG (parts list) |
| `/prebuilt` | `Pre-Built Gaming & Office PCs in Nepal \| {{site}}` | `Ready-to-ship desktop PCs assembled and tested in Kathmandu. {{count}} configurations from {{minPrice}}. Warranty included.` | self | `index,follow` | Dynamic |
| `/cart` | `Your Cart \| {{site}}` | — | self | `noindex,nofollow` | — |
| `/checkout` | `Checkout \| {{site}}` | — | self | `noindex,nofollow` | — |
| `/order/confirmation/[orderNumber]` | `Order Confirmed \| {{site}}` | — | self | `noindex,nofollow` | — |
| `/track` | `Track Your Order \| {{site}}` | `Enter your order number to see the current status of your City Computer order.` | self | `noindex,follow` | Static |
| `/account/*` | `{{pageName}} \| {{site}}` | — | self | `noindex,nofollow` | — |
| `/blog` | `Buying Guides & Tech News in Nepal \| {{site}} Blog` | `Laptop and PC buying guides, price updates and comparisons for the Nepali market, from the City Computer team.` | self / `?page=n` | `index,follow` | Static blog OG |
| `/blog/[postSlug]` | `{{post.title}} \| {{site}}` | `{{post.excerpt}}` (160-char clamp) | self | `index,follow` | Post hero image, else dynamic |
| `/blog/category/[slug]` | `{{postCategory}} Articles \| {{site}} Blog` | `{{count}} articles on {{postCategory}} for buyers in Nepal.` | self | `index,follow` | Dynamic |
| `/service` | `Laptop & Computer Repair in Kathmandu \| {{site}}` | `Laptop, desktop and component repair at New Road, Kathmandu. Free diagnosis, transparent pricing, track your repair online.` | self | `index,follow` | Static service OG |
| `/service/book` | `Book a Repair \| {{site}}` | `Book a laptop or PC repair slot at City Computer, Kathmandu. Describe the fault and we will confirm by phone.` | self | `index,follow` | Static |
| `/service/status/[ticketNumber]` | `Repair Status \| {{site}}` | — | self | `noindex,nofollow` | — |
| `/stores` | `Our Stores in Kathmandu \| {{site}}` | `Visit City Computer Systems. Addresses, opening hours, phone numbers and directions for every branch.` | self | `index,follow` | Static |
| `/stores/[branchSlug]` | `{{site}} {{branch}} — Address, Hours & Phone` | `{{site}} {{branch}}: {{addressLine}}, Kathmandu. Open {{hoursSummary}}. Call {{phone}}. In-store pickup available.` | self | `index,follow` | Dynamic branch OG (storefront photo) |
| `/compare` | `Compare Products \| {{site}}` | — | `/compare` (params stripped) | `noindex,follow` | Static |
| `/emi-calculator` | `Laptop EMI Calculator Nepal — Nabil, Global IME, NIC Asia \| {{site}}` | `Calculate monthly EMI for laptops and PCs in Nepal. Compare tenures and see the total cost before you apply.` | self | `index,follow` | Static |
| `/pages/[slug]` | `{{page.title}} \| {{site}}` | `{{page.metaDescription}}` or first 155 chars of body | self | `index,follow` | Static branded |
| `/admin/*` | `Admin \| {{site}}` | — | — | `noindex,nofollow` + `X-Robots-Tag` | — |
| `/404`, `/500` | `Page Not Found \| {{site}}` | — | — | `noindex,follow` | — |

### 3.6 Rules for the auto-generation the non-technical owner depends on

1. **Nothing is ever blank.** A product created with only name, price, brand and category yields a complete, valid, budget-compliant title, description, OG image, and JSON-LD.
2. **Templates are versioned.** Changing a category template regenerates metadata for all its products on the next revalidation; the previous template string is retained for rollback.
3. **Overrides win and are visible.** The admin shows "Auto-generated" vs "Custom" per field, with a one-click "Reset to automatic".
4. **No duplicate descriptions across products.** Description templates must include at least one product-unique variable (`product.shortName`, `keySpecs`, or `product.price`). A CI/lint check rejects a template that resolves identically for two products in the same category.
5. **Price in metadata is allowed but not required to be fresh.** Titles must **not** contain a price (it stales in the SERP cache); descriptions may, because we revalidate on price change. `{{product.price}}` is banned in title templates by validation.
6. **Locale-aware.** `ne` templates are separate strings, not machine-translated at render time.

---

## 4. Structured data (JSON-LD)

All JSON-LD is emitted **server-side** as `<script type="application/ld+json">` from typed builders in `lib/seo/jsonld/`. Rules:

- One `@graph` per page where entities interrelate (`Organization` + `WebSite` + `BreadcrumbList` + primary entity), each node with a stable `@id` (absolute URL + fragment) so relationships are explicit rather than duplicated.
- Values come from the same DB read as the rendered page — **markup can never disagree with visible content**.
- Money is serialised from integer paisa via a single `toSchemaPrice()` helper (`164900.00`), never the display string with `रु`.
- Builders return `null` when preconditions are unmet; the renderer skips `null`. This is how the zero-review rule is enforced structurally.

### 4.1 Organization (site-wide, in root layout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://citycomputer.com.np/#organization",
  "name": "City Computer Systems",
  "url": "https://citycomputer.com.np",
  "logo": { "@type": "ImageObject", "url": "https://citycomputer.com.np/brand/logo-512.png", "width": 512, "height": 512 },
  "image": "https://cdn.citycomputer.com.np/brand/storefront-new-road.jpg",
  "telephone": "+977-1-XXXXXXX",
  "email": "info@citycomputer.com.np",
  "address": { "@type": "PostalAddress", "streetAddress": "New Road", "addressLocality": "Kathmandu", "addressRegion": "Bagmati", "postalCode": "44600", "addressCountry": "NP" },
  "sameAs": ["https://www.facebook.com/...", "https://www.instagram.com/...", "https://www.tiktok.com/@...", "https://www.youtube.com/@..."],
  "contactPoint": [{ "@type": "ContactPoint", "telephone": "+977-1-XXXXXXX", "contactType": "customer service", "areaServed": "NP", "availableLanguage": ["en", "ne"] }]
}
```

> **DECISION REQUIRED:** Exact legal entity name, PAN/VAT number, landline and mobile numbers, official email, and the canonical social URLs. These must match Google Business Profile character-for-character (§9.2).

### 4.2 LocalBusiness / ComputerStore, one per branch

Emitted on `/stores/[branchSlug]` as the primary entity, and referenced (not duplicated) from `/stores`. Use `ComputerStore` (a subtype of `Store`→`LocalBusiness`) — it is the most specific applicable type.

```json
{
  "@context": "https://schema.org",
  "@type": "ComputerStore",
  "@id": "https://citycomputer.com.np/stores/new-road#store",
  "name": "City Computer Systems — New Road",
  "parentOrganization": { "@id": "https://citycomputer.com.np/#organization" },
  "url": "https://citycomputer.com.np/stores/new-road",
  "image": ["https://cdn.citycomputer.com.np/stores/new-road-1.jpg"],
  "telephone": "+977-1-XXXXXXX",
  "priceRange": "NPR 500 - NPR 500000",
  "currenciesAccepted": "NPR",
  "paymentAccepted": "Cash, eSewa, Khalti, Fonepay, connectIPS, Bank Transfer, Card",
  "address": { "@type": "PostalAddress", "streetAddress": "Bishal Bazaar, New Road", "addressLocality": "Kathmandu", "addressRegion": "Bagmati", "postalCode": "44600", "addressCountry": "NP" },
  "geo": { "@type": "GeoCoordinates", "latitude": 27.7040, "longitude": 85.3095 },
  "hasMap": "https://maps.google.com/?cid=XXXXXXXXXXXX",
  "areaServed": [
    { "@type": "City", "name": "Kathmandu" },
    { "@type": "City", "name": "Lalitpur" },
    { "@type": "City", "name": "Bhaktapur" },
    { "@type": "Country", "name": "Nepal" }
  ],
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "10:00", "closes": "19:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "11:00", "closes": "16:00" }
  ],
  "specialOpeningHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "validFrom": "2026-10-20", "validThrough": "2026-10-22", "opens": "00:00", "closes": "00:00", "description": "Closed for Dashain" }
  ],
  "department": [{ "@type": "Service", "name": "Laptop & Computer Repair", "url": "https://citycomputer.com.np/service" }]
}
```

Notes: Nepal's week starts Sunday and Saturday is the weekly holiday — the `openingHoursSpecification` must reflect that, not a Mon–Fri Western default. Festival closures (Dashain, Tihar) are entered by the owner as `specialOpeningHoursSpecification` from a branch-holiday table.

> **ASSUMPTION:** Coordinates, exact street address, and opening hours above are placeholders. Confirm per branch before launch.

### 4.3 WebSite + SearchAction (root layout)

```json
{
  "@type": "WebSite",
  "@id": "https://citycomputer.com.np/#website",
  "url": "https://citycomputer.com.np",
  "name": "City Computer Systems",
  "publisher": { "@id": "https://citycomputer.com.np/#organization" },
  "inLanguage": ["en", "ne"],
  "potentialAction": {
    "@type": "SearchAction",
    "target": { "@type": "EntryPoint", "urlTemplate": "https://citycomputer.com.np/search?q={search_term_string}" },
    "query-input": "required name=search_term_string"
  }
}
```

### 4.4 BreadcrumbList (every non-home indexable page)

Generated from the same breadcrumb data structure that renders the visible trail — one source, so markup and UI can never diverge (the footer "Webcams"→motherboards class of bug).

```json
{
  "@type": "BreadcrumbList",
  "@id": "https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060#breadcrumb",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://citycomputer.com.np/" },
    { "@type": "ListItem", "position": 2, "name": "Laptops", "item": "https://citycomputer.com.np/c/laptops" },
    { "@type": "ListItem", "position": 3, "name": "Gaming Laptops", "item": "https://citycomputer.com.np/c/laptops/gaming" },
    { "@type": "ListItem", "position": 4, "name": "ASUS TUF Gaming A15" }
  ]
}
```
The last item omits `item` (self). Products belonging to multiple categories use a single `primaryCategoryId` for the canonical trail.

### 4.5 Product + Offer (PDP)

```json
{
  "@type": "Product",
  "@id": "https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060#product",
  "name": "ASUS TUF Gaming A15 FA507NU (Ryzen 7 7435HS, RTX 4060, 16GB, 512GB)",
  "description": "15.6\" 144Hz gaming laptop with Ryzen 7 7435HS and RTX 4060 8GB…",
  "sku": "CC-LP-ASU-1042",
  "mpn": "FA507NU-LP101W",
  "gtin13": "4711387345678",
  "brand": { "@type": "Brand", "name": "ASUS" },
  "category": "Laptops > Gaming Laptops",
  "image": ["https://cdn.../asus-tuf-gaming-a15-fa507nu-1.jpg", "…-2.jpg", "…-3.jpg"],
  "color": "Mecha Grey",
  "inLanguage": "en",
  "isSimilarTo": [{ "@type": "Product", "@id": "https://citycomputer.com.np/p/lenovo-loq-15-rtx4060#product" }],
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Processor", "value": "AMD Ryzen 7 7435HS" },
    { "@type": "PropertyValue", "name": "Graphics", "value": "NVIDIA GeForce RTX 4060 8GB" },
    { "@type": "PropertyValue", "name": "Display", "value": "15.6\" FHD 144Hz" }
  ],
  "offers": {
    "@type": "Offer",
    "@id": "https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060#offer",
    "url": "https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060",
    "price": "164900.00",
    "priceCurrency": "NPR",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": { "@id": "https://citycomputer.com.np/#organization" },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "NP",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 7,
      "returnMethod": "https://schema.org/ReturnInStore",
      "returnFees": "https://schema.org/FreeReturn",
      "url": "https://citycomputer.com.np/pages/returns"
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": { "@type": "MonetaryAmount", "value": "0.00", "currency": "NPR" },
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "NP" },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 5, "unitCode": "DAY" }
      }
    }
  }
}
```

| Field | Sourcing rule |
|---|---|
| `sku` | Always present — internal SKU, never blank |
| `mpn` | Manufacturer part number when known; omit if unknown rather than guess |
| `gtin13` | Only when a verified barcode exists. **Never fabricate.** Omit for assembled/no-barcode items |
| `availability` | `InStock` if any branch has sellable stock; `OnlineOnly`/`InStoreOnly` not used; `PreOrder` for announced items; `OutOfStock` when zero; `Discontinued` for EOL pages kept live |
| `itemCondition` | `NewCondition` default; `RefurbishedCondition` for the refurb range; a per-product enum, not a global constant |
| `priceValidUntil` | `now + 30 days`, recomputed on each revalidation. Never a stale past date |
| Variants | If a model has real variants stored as separate `Product` rows, each PDP emits its own single `Offer`. If one PDP presents multiple purchasable configurations, use `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount` **plus** per-variant `Offer` nodes |
| Multi-branch | Branch availability is *not* modelled as multiple `Offer`s (it inflates the graph). Pickup is expressed in copy and, where available, via GBP local inventory |

### 4.6 AggregateRating + Review — the hard rule

**Never emit `AggregateRating`, `Review`, `ratingValue`, or `reviewCount` unless there is at least one published, human-written, verified review stored in the database.** The current site has zero reviews site-wide; shipping placeholder or template rating markup is a manual-action risk (spammy structured data) and destroys trust when SERP stars lead to an empty review section.

Enforcement (three layers):
1. `buildProductJsonLd()` returns the `Product` node **without** a rating branch when `publishedReviewCount === 0`. There is no code path that accepts a hard-coded rating.
2. Unit test: `expect(json).not.toHaveProperty('aggregateRating')` for a fixture product with no reviews.
3. CI grep gate: the strings `aggregateRating` and `ratingValue` may appear only inside `lib/seo/jsonld/review.ts`.

When reviews exist:
```json
"aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": 23, "bestRating": "5", "worstRating": "1" },
"review": [
  { "@type": "Review",
    "author": { "@type": "Person", "name": "Sujan K." },
    "datePublished": "2026-05-14",
    "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
    "reviewBody": "Cooling is much better than my old laptop. Bought from the New Road store."
  }
]
```
Only the 3–5 most recent published reviews are inlined (the rest are visible via pagination); `reviewCount` reflects the true total. Reviews must be visible on the page in the same locale as the markup. Ratings are only counted from `VERIFIED_PURCHASE` or admin-approved reviews.

### 4.7 FAQPage

Emitted only where a real, visible FAQ block exists: `/service`, `/emi-calculator`, `/pages/warranty`, `/pages/shipping`, `/pages/returns`, and PDPs that have curated Q&A rows. Rich-result eligibility for FAQ is now largely restricted to authoritative sites, but the markup remains valuable for AI/answer-engine extraction, so we emit it where honest.

```json
{ "@type": "FAQPage", "mainEntity": [
  { "@type": "Question", "name": "Do you offer EMI on laptops in Nepal?",
    "acceptedAnswer": { "@type": "Answer", "text": "Yes. We support bank EMI through Nabil, Global IME, NIC Asia and Siddhartha Bank…" } }
]}
```
Never emit `FAQPage` on a PDP with no visible Q&A, and never duplicate the same FAQ set across dozens of pages.

### 4.8 Article / BlogPosting

```json
{ "@type": "BlogPosting",
  "@id": "https://citycomputer.com.np/blog/best-gaming-laptop-nepal-2026#article",
  "headline": "Best Gaming Laptops in Nepal Under Rs 2 Lakh (2026)",
  "description": "…",
  "image": ["https://cdn.../blog/best-gaming-laptops-2026-16x9.jpg"],
  "datePublished": "2026-02-10T09:00:00+05:45",
  "dateModified": "2026-07-02T11:20:00+05:45",
  "author": { "@type": "Person", "name": "…", "url": "https://citycomputer.com.np/blog/author/…" },
  "publisher": { "@id": "https://citycomputer.com.np/#organization" },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://citycomputer.com.np/blog/best-gaming-laptop-nepal-2026" },
  "inLanguage": "en",
  "articleSection": "Buying Guides"
}
```
Timezone is always `+05:45` (Nepal Time). `dateModified` comes from `Post.updatedAt` and must only change on substantive edits — a typo-fix loop that bumps `dateModified` daily is a freshness-spam pattern. Buying guides that rank on "best X" also carry `ItemList` of the recommended products.

### 4.9 ItemList (category, brand, shop, prebuilt, blog listings)

```json
{ "@type": "ItemList",
  "@id": "https://citycomputer.com.np/c/laptops/gaming#itemlist",
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "numberOfItems": 24,
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060" },
    { "@type": "ListItem", "position": 2, "url": "https://citycomputer.com.np/p/lenovo-loq-15-rtx4060" }
  ]
}
```
URL-only `ListItem`s (the summary form Google prefers for carousels); do not inline full `Product` nodes on listing pages — it bloats HTML and risks price/availability drift against the PDP. `position` is continuous across pagination (page 2 starts at 25).

### 4.10 Service (repairs)

```json
{ "@type": "Service",
  "@id": "https://citycomputer.com.np/service#service",
  "serviceType": "Computer and laptop repair",
  "name": "Laptop & Computer Repair — Kathmandu",
  "provider": { "@id": "https://citycomputer.com.np/#organization" },
  "areaServed": { "@type": "City", "name": "Kathmandu" },
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://citycomputer.com.np/service/book",
    "servicePhone": { "@type": "ContactPoint", "telephone": "+977-1-XXXXXXX" },
    "serviceLocation": { "@id": "https://citycomputer.com.np/stores/new-road#store" }
  },
  "hasOfferCatalog": { "@type": "OfferCatalog", "name": "Repair services", "itemListElement": [
    { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Laptop screen replacement" }, "priceCurrency": "NPR", "priceSpecification": { "@type": "PriceSpecification", "minPrice": "4500", "priceCurrency": "NPR" } }
  ]}
}
```
Only publish repair prices in markup if they are also visible and honoured; otherwise omit price and state "free diagnosis, quote after inspection".

### 4.11 Shared PC build page (`/build/[shortId]`)

A shared build is a user-generated bundle. Default posture: `noindex,follow` — thousands of near-duplicate configurations would be index bloat and thin content. Markup is still emitted for social/AI unfurling and for the curated exception.

Model as a `Product` of type bundle with an `AggregateOffer` and `isAccessoryOrSparePartFor`-style part references:

```json
{ "@type": "Product",
  "@id": "https://citycomputer.com.np/build/7Qk3Zx#build",
  "name": "Ryzen 5 + RTX 4060 Gaming PC Build",
  "description": "Custom PC build: Ryzen 5 7600, RTX 4060 8GB, 32GB DDR5, 1TB NVMe.",
  "image": "https://citycomputer.com.np/build/7Qk3Zx/opengraph-image",
  "brand": { "@id": "https://citycomputer.com.np/#organization" },
  "category": "Custom PC Builds",
  "isRelatedTo": [
    { "@type": "Product", "@id": "https://citycomputer.com.np/p/amd-ryzen-5-7600#product" },
    { "@type": "Product", "@id": "https://citycomputer.com.np/p/asus-dual-rtx-4060-o8g#product" }
  ],
  "offers": { "@type": "AggregateOffer", "priceCurrency": "NPR", "lowPrice": "189500.00", "highPrice": "189500.00", "offerCount": 1,
    "availability": "https://schema.org/InStock", "seller": { "@id": "https://citycomputer.com.np/#organization" } }
}
```
An owner-curated build promoted to `/prebuilt` becomes a real `Product` row with its own `/p/[slug]`, unique copy, photos, and full `Offer` — that page is indexable; the `/build/[shortId]` original 301s to it.

### 4.12 VideoObject

For product hands-on / build videos hosted on YouTube and embedded on PDPs, `/blog/*`, and `/build`.

```json
{ "@type": "VideoObject",
  "name": "ASUS TUF A15 (RTX 4060) — Nepal Price & Gaming Test",
  "description": "…",
  "thumbnailUrl": ["https://i.ytimg.com/vi/VIDEOID/maxresdefault.jpg"],
  "uploadDate": "2026-03-18T10:00:00+05:45",
  "duration": "PT8M42S",
  "embedUrl": "https://www.youtube.com/embed/VIDEOID",
  "publisher": { "@id": "https://citycomputer.com.np/#organization" }
}
```
Only emit when the video is actually embedded and is the page's own primary or supporting media. `duration` must be real (pulled from the YouTube Data API and cached), not estimated. Embeds use a click-to-load facade to protect LCP/INP (§8).

### 4.13 Coverage matrix

| Route | Graph nodes emitted |
|---|---|
| All pages | `Organization`, `WebSite` (root layout, `@graph`) |
| `/` | + `ItemList` (featured), `LocalBusiness` ref |
| `/shop`, `/c/*`, `/b/*`, `/prebuilt` | + `BreadcrumbList`, `ItemList`, `CollectionPage` |
| `/p/*` | + `BreadcrumbList`, `Product`+`Offer` (+`AggregateRating`/`Review` if ≥1), optional `FAQPage`, optional `VideoObject` |
| `/blog` | + `BreadcrumbList`, `Blog`, `ItemList` |
| `/blog/[postSlug]` | + `BreadcrumbList`, `BlogPosting`, optional `ItemList`/`FAQPage`/`VideoObject` |
| `/service` | + `BreadcrumbList`, `Service`, `FAQPage` |
| `/stores` | + `BreadcrumbList`, `ItemList` of stores |
| `/stores/[branchSlug]` | + `BreadcrumbList`, `ComputerStore` |
| `/emi-calculator` | + `BreadcrumbList`, `WebApplication`, `FAQPage` |
| `/pages/[slug]` | + `BreadcrumbList`, `WebPage` (+`FAQPage` where applicable) |
| `/build` | + `BreadcrumbList`, `WebApplication` |
| `/build/[shortId]` | + `Product`/`AggregateOffer` (page `noindex`) |
| `/search`, `/cart`, `/checkout`, `/account/*`, `/admin/*` | `Organization`+`WebSite` only |

### 4.14 Validation checklist

- [ ] Every builder has a unit test asserting required fields and absence of forbidden fields (rating with zero reviews, fabricated `gtin`).
- [ ] Zod schema validates each node before serialisation; a validation failure logs to Sentry and omits the node rather than shipping invalid JSON-LD.
- [ ] JSON-LD is escaped safely (`<`, `>`, `&`, `</script`) — XSS gate in the serialiser, covered by a test.
- [ ] **Rich Results Test** run on one URL per route type pre-launch; zero errors, warnings triaged and documented.
- [ ] **Schema Markup Validator** (validator.schema.org) run on the same set for full-vocabulary correctness, including nodes Google does not consume.
- [ ] Automated CI check: fetch built HTML for a fixture set of routes, extract all `ld+json`, assert JSON parses and matches expected `@type` list per route.
- [ ] Post-launch: **Search Console → Enhancements** reports (Products, Merchant listings, Breadcrumbs, Review snippets, Videos, FAQ) reviewed weekly for the first 8 weeks; any "Invalid items" count > 0 is a P2 bug.
- [ ] Google Merchant Center feed (if enabled) cross-checked against `Offer` markup so price/availability match, avoiding Merchant Center item disapprovals.
- [ ] Price/availability drift monitor: nightly job compares rendered JSON-LD `price`/`availability` against DB for 20 random PDPs; mismatch alerts.

---

## 5. Sitemaps & robots

### 5.1 Sitemap index design

Served from Next.js route handlers backed by DB queries, cached in Redis and revalidated on content mutation.

```
/sitemap.xml                     ← sitemap index (lists all children, both locales)
├── /sitemap-products-1.xml      ← paginated at 10,000 URLs/file
├── /sitemap-categories.xml
├── /sitemap-brands.xml
├── /sitemap-blog.xml
├── /sitemap-builds.xml          ← curated/indexable builds only (usually empty)
├── /sitemap-pages.xml           ← /pages/* + /shop /build /prebuilt /service /emi-calculator
├── /sitemap-stores.xml
└── /sitemap-images.xml          ← image sitemap (§5.6)
```

| Rule | Value |
|---|---|
| Hard limits | 50,000 URLs / 50 MB uncompressed per file; we self-impose 10,000/file for fast regeneration |
| Pagination naming | `sitemap-products-1.xml`, `-2.xml` … (page count computed from `COUNT(*)`) |
| `lastmod` | From DB `updatedAt` of the entity, W3C datetime with `+05:45`. For products, `updatedAt` is bumped on price, stock-status, content, or image change — **not** on view-count writes (which live in a separate table for exactly this reason) |
| `changefreq` / `priority` | **Omitted.** Google ignores them; they are noise |
| Locale handling | Both `en` and `ne` URLs are listed as separate `<url>` entries. Only real translated pages are listed |
| Compression | `.xml` served with `Content-Encoding: gzip` via Cloudflare; no separate `.gz` files |
| Revalidation | `revalidate = 3600` plus on-demand `revalidatePath('/sitemap-products-1.xml')` from the product mutation service. Index itself `revalidate = 3600` |
| Absolute URLs | Always `https://citycomputer.com.np/...`, matching canonical exactly (no trailing slash, lowercase) |

### 5.2 Inclusion rule

A URL belongs in a sitemap **only if** it returns 200, is `index,follow`, and is self-canonical. Anything else is a defect. A CI job crawls the generated sitemaps on staging and asserts these three properties for a random 10% sample.

### 5.3 Exclusion rules

| Excluded | Reason |
|---|---|
| `/cart`, `/checkout`, `/order/confirmation/*`, `/track`, `/account/*`, `/admin/*` | Non-indexable functional pages |
| `/search`, `/compare` | `noindex` |
| Draft/unpublished products, posts, pages | Not public |
| Products with `status = ARCHIVED` or hard-deleted | 410 |
| Non-curated `/build/[shortId]` | `noindex` |
| Paginated pages `?page=2+` | Discoverable via page-1 links; keeps sitemaps focused on canonical entities |
| Non-whitelisted facet URLs | `noindex` |
| Password-protected / staging hosts | Blocked at the edge |

### 5.4 Out-of-stock policy

| State | Page | Robots | Sitemap | Markup |
|---|---|---|---|---|
| In stock (any branch) | 200 | index | yes | `InStock` |
| Out of stock, restock expected | 200, with "notify me", ETA, and 4 alternatives | index | yes | `OutOfStock` |
| Out of stock > 90 days, no restock | 200, alternatives prominent | index | **removed** | `OutOfStock` |
| Discontinued, has backlinks/traffic | 200, "discontinued — see successor" + link | index | removed | `Discontinued` |
| Discontinued, no value | 410 Gone | — | removed | — |

Never 302 an out-of-stock PDP to its category — that is the pattern that loses the ranking outright.

### 5.5 `robots.txt` specification

Served from `app/robots.ts`. Environment-aware: on any non-production host it emits `User-agent: * / Disallow: /` (see §10.4).

```
# Production
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /order/
Disallow: /service/status/
Disallow: /compare
Disallow: /search
Disallow: /*?*sort=
Disallow: /*?*orderby=
Disallow: /*?*view=
Disallow: /*?*perPage=
Disallow: /*?*add-to-cart=
Disallow: /*?*wc-ajax=
Disallow: /*?*replytocom=
Disallow: /*?*s=
Disallow: /wp-admin/
Disallow: /wp-content/
Disallow: /wp-json/
Disallow: /*/feed/
Allow: /api/og/
Allow: /_next/static/
Allow: /_next/image

Sitemap: https://citycomputer.com.np/sitemap.xml
```

Rules and rationale:
- `noindex` pages that we still want crawled for link-flow (`/search`, `/compare`) are listed as `Disallow` **only** because they carry no unique value; where link equity matters we rely on `noindex,follow` and do *not* disallow. Do not disallow a URL you also want de-indexed — a blocked URL's `noindex` can never be read. Applied here: `/cart`, `/checkout`, `/account`, `/admin` are already unlinked and gated, so disallow is safe; multi-facet URLs are additionally `noindex` at the HTML level for the ones that remain reachable.
- Legacy WordPress paths are disallowed to stop crawlers re-requesting them for months.
- Never disallow `/_next/static` or `/_next/image` — that breaks rendering and Core Web Vitals assessment.
- No `Crawl-delay` for Google/Bing (ignored). If Cloudflare analytics show an aggressive minor bot, throttle it at the WAF instead.

**AI crawler stance.** Recommendation: **allow** the major AI crawlers that drive referral traffic and answer-engine visibility (`OAI-SearchBot`, `PerplexityBot`, `Google-Extended`, `ClaudeBot`/`Claude-SearchBot`, `Bingbot` for Copilot). For a local retailer, being the cited price source for "laptop price in Nepal" questions is upside, not risk; the content is public commercial catalogue data with no proprietary IP. Block only crawlers that provide no discovery value and consume bandwidth (`Bytespider`, `CCBot`, `Amazonbot`, `Applebot-Extended` if the owner objects to training use). Keep the allow/deny list in one place, documented in `15 §10` (`docs/runbooks/`), and revisit quarterly.

> **DECISION REQUIRED:** Owner sign-off on whether AI *training* crawlers (`GPTBot`, `Applebot-Extended`, `Google-Extended`) are permitted, separately from AI *search* crawlers. Default proposal: allow search crawlers, block pure-training crawlers.

### 5.6 Image sitemap

`sitemap-images.xml` uses the `image:` namespace, one `<url>` per page with up to 1,000 images, listing CDN URLs of product gallery images, category hero images, store photos and blog heroes.

```xml
<url>
  <loc>https://citycomputer.com.np/p/asus-tuf-a15-r7-rtx4060</loc>
  <image:image>
    <image:loc>https://cdn.citycomputer.com.np/products/asus-tuf-gaming-a15-fa507nu-1.jpg</image:loc>
    <image:title>ASUS TUF Gaming A15 FA507NU — front view</image:title>
  </image:image>
</url>
```
Only original CDN assets are listed, never `/_next/image?url=...` transforms. Excluded: UI/brand chrome, icons, placeholder blur images.

---

## 6. On-page & content architecture

### 6.1 Heading hierarchy and the three-title split

The current site uses a ~200-character product title as the H1. Fix: three distinct fields, each with a job.

| Field | Purpose | Budget | Example |
|---|---|---|---|
| `h1` | The visible page heading. Human-readable entity name | 30–65 chars | `ASUS TUF Gaming A15 (RTX 4060)` |
| `displayTitle` | Card/listing/cart label, disambiguating variants | ≤ 90 chars | `ASUS TUF Gaming A15 FA507NU — Ryzen 7 7435HS, RTX 4060, 16GB/512GB` |
| `metaTitle` | `<title>` only, keyword-ordered | 50–60 chars | `ASUS TUF A15 RTX 4060 Price in Nepal \| City Computer` |

Auto-derivation: the owner types the long descriptive name once (`displayTitle`); `h1` is derived by stripping spec clauses after the model identifier (hard cap 70 characters); `metaTitle` is derived from `h1` + template. Both derived fields are editable.

Heading rules, enforced by a linting test that parses rendered HTML:
- Exactly one `<h1>` per page, and it is the primary entity name (not the logo, not a nav item).
- No heading level skipped; section headings are `<h2>`, sub-sections `<h3>`.
- Headings never used for visual sizing — typography is a class concern, never a tag concern.
- On PDPs: `h1` = product name; `h2`s = Overview, Specifications, What's in the Box, Warranty & Support, Reviews, Related Products, FAQs.
- On categories: `h1` = `{{category}} Price in Nepal`; a short (60–120 word) intro above the grid; `h2` for facet groups; a 200–400 word buyer's-note block **below** the grid so it never delays LCP or pushes products down.

### 6.2 Internal linking strategy (hub-and-spoke)

```
                       ┌──────────────┐
                       │     Home     │
                       └──────┬───────┘
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
      ┌────────────┐   ┌────────────┐   ┌────────────┐
      │ Category   │   │  /build    │   │  /blog     │
      │ hubs /c/*  │◄─►│ configurator│◄─►│ guides    │
      └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
            │                │                │
            ▼                │                ▼
      ┌────────────┐         │          ┌────────────┐
      │ Brand /b/* │─────────┼─────────►│ Comparisons│
      └─────┬──────┘         │          └─────┬──────┘
            ▼                ▼                │
      ┌──────────────────────────────────────▼──────┐
      │                 PDP  /p/*                    │
      │  related · complete-your-build · same-brand   │
      └───────────────────┬──────────────────────────┘
                          ▼
                  ┌──────────────┐
                  │ /stores/*    │  (pickup, local)
                  └──────────────┘
```

| Link surface | Rule |
|---|---|
| Breadcrumbs | On every page except home; identical to `BreadcrumbList`; renders above the H1 |
| Category hub → children | Every parent category lists its subcategories as text links, not only icons |
| Brand pages | Every PDP links to its brand hub with the brand name as anchor; brand hub links to top categories for that brand |
| Related products | 4–8 links from the same category and adjacent price band. Deterministic (not random per request) so crawlers see stable links |
| "Complete your build" | Component PDPs link to compatible complements (CPU→motherboard, GPU→PSU); drives both AOV and topical clustering |
| Buying guides → PDPs | Every guide links to at least 5 PDPs with descriptive anchors (`ASUS TUF A15 with RTX 4060`), never "click here" |
| PDP → guides | A "Related reading" block linking 1–3 guides; the only editorial link on a PDP, placed below specs |
| Builder ↔ catalogue | `/build` links to component categories; component PDPs link back to `/build` prefilled |
| Footer | Generated from the DB category tree + CMS pages. Max ~40 links. Anchor text must equal target category name (kills the Webcams→motherboards bug) |
| Orphan prevention | Nightly job: any published entity with zero internal inbound links is reported in the admin as "Not linked from anywhere" |
| Anchor discipline | No more than one link per anchor phrase per page; no `nofollow` on internal links; external links to manufacturers `rel="noopener"` (follow is fine) |

### 6.3 Nepal-specific keyword strategy

Search behaviour in this market is dominated by price intent and model-plus-price patterns.

| Intent cluster | Query patterns | Target page | Notes |
|---|---|---|---|
| Category + price | `laptop price in nepal`, `gaming laptop price in nepal`, `desktop computer price in nepal`, `ssd price in nepal` | `/c/*` with H1 `{{category}} Price in Nepal` | Highest volume, highest competition (Hukut, Daraz, ITTI). Requires real price tables + freshness |
| Brand + category + price | `asus laptop price in nepal`, `hp laptop price nepal`, `lenovo gaming laptop nepal` | `/b/[brand]` and whitelisted facet landings `/c/laptops?brand=asus` | Whitelisted facet landings need unique intro copy or they are thin |
| Model + price | `macbook air m4 price in nepal`, `rtx 4060 price in nepal`, `ryzen 5 7600 price nepal` | `/p/*` | Title template already matches this pattern exactly |
| Budget-bounded | `laptop under 50000 in nepal`, `gaming pc under 1 lakh nepal`, `best laptop under 80000 nepal` | Programmatic price-band pages (§6.4) | Nepali users think in `50 hajar` / `1 lakh` units — build bands at 30k/50k/80k/1L/1.5L/2L |
| Nepali script | `ल्यापटप मूल्य नेपाल`, `कम्प्युटर पसल काठमाडौं`, `ग्राफिक्स कार्ड मूल्य`, `ल्यापटप मर्मत` | `/ne/*` equivalents | Lower volume, near-zero competition — cheap wins. Requires genuine Nepali copy (§9.3) |
| Local / near-me | `computer shop in new road`, `laptop shop kathmandu`, `computer shop near me` | `/stores/*` + GBP | Won mainly through GBP, reviews, and NAP consistency |
| Repair / service | `laptop repair kathmandu`, `laptop screen replacement price nepal`, `macbook servicing nepal` | `/service` + service sub-pages | High-margin, low-competition local intent |
| Build / assemble | `custom pc build nepal`, `pc build price nepal`, `gaming pc build kathmandu` | `/build`, `/prebuilt` | Differentiator no local competitor does well |
| Finance | `laptop emi nepal`, `nabil bank emi laptop`, `laptop on installment kathmandu` | `/emi-calculator` + EMI guide | Strong lead-capture intent |
| Comparison | `macbook air vs asus zenbook nepal`, `rtx 4060 vs rtx 4070 nepal` | Programmatic comparison pages | Only for pairs with real demand |
| Spec long-tail | `16gb ram 512gb ssd laptop nepal`, `laptop with rtx 4060 nepal`, `i7 12th gen laptop price nepal` | Facet landings + guides | Only build where ≥3 products qualify |

Operating rules: one primary intent per URL (the current site's two-URL MacBook problem is exactly this failure); prices displayed with `formatNPR()` so `रु` appears in the rendered HTML and can be indexed; include the Nepali number-word forms ("1 lakh", "50 thousand") in body copy where natural.

### 6.4 Programmatic SEO plan

| Page family | Template | Generation rule | Guard |
|---|---|---|---|
| Price-band landing `/c/laptops/under-50000` (as a real category-like route or a `pages` entry) | `Best Laptops Under Rs 50,000 in Nepal (2026)` | Auto-list products in band, sorted by value; auto intro paragraph from band stats (count, brands, spec floor) | Publish only if ≥ 6 in-stock products; auto-unpublish (with `noindex`) if it drops below 4 |
| Brand × category facet landing | `{{brand}} {{category}} Price in Nepal` | Only from whitelist | ≥ 5 products + ≥ 80 words unique copy |
| Comparison `/blog/compare/{a}-vs-{b}` | `{{a}} vs {{b}} — Which to Buy in Nepal?` | Auto spec-diff table + price diff + verdict stub requiring one human paragraph | Never auto-publish without the human verdict paragraph |
| Buying guide | `Best {{category}} in Nepal ({{year}})` | Human-authored intro + auto-refreshed product blocks and prices | Human-owned; auto price refresh only |
| Store page | `{{site}} {{branch}} — Address, Hours & Phone` | One per branch from DB | Requires real photos + hours |

All programmatic pages carry a `generatedBy` flag, a review status, and appear in an admin queue. Auto-published thin pages are the single biggest risk of a programmatic approach on a 150-SKU catalogue — hence the minimum-product and minimum-word gates.

### 6.5 Thin-content and duplicate-content guards

| Guard | Rule |
|---|---|
| Minimum PDP content | 120 words of unique description + ≥ 6 spec attributes + ≥ 2 real photos, else product ships `noindex` and appears in an admin "Needs content" list |
| Manufacturer copy | Boilerplate spec-sheet paste is allowed in a clearly separated "Manufacturer specifications" block, but the summary section above it must be original |
| Duplicate detection | Nightly similarity check (trigram/shingle) across product descriptions; > 85% similarity between two products flags both |
| One page per intent | DB unique constraint on slug + admin warning when a new product's name closely matches an existing one (prevents the MacBook duplicate) |
| Empty states | Category/brand pages with zero products return 200 with alternatives but are `noindex` and excluded from sitemaps |
| Tag archives | Not built |
| Print/AMP variants | Not built |

### 6.6 Pagination — the correct modern approach

`rel="next"`/`rel="prev"` has been unsupported by Google since 2019 and must not be relied on. Two other common patterns are also wrong: canonicalising every paginated page to page 1 (hides deep products from discovery), and `noindex`-ing beyond page N (cuts the crawl path to those products, since `noindex` eventually becomes an effective `nofollow`).

Correct policy:

| Aspect | Rule |
|---|---|
| URL form | `?page=2` on the clean path (`/c/laptops?page=2`). No `/page/2` segment |
| Page 1 | Always the clean URL without `?page=1`; `?page=1` 301s to the clean URL |
| Canonical | **Self-referencing on every paginated page** |
| Robots | `index,follow` on all pages. Optional `noindex,follow` only past a very deep threshold (page 15+) if crawl stats show waste — not needed at this catalogue size |
| Titles | Page 2+ appends ` — Page 2` to the title and `Page 2 of 5` to the description so SERP entries are not duplicates |
| Content | Real `<a href>` links for page numbers, plus prev/next, always server-rendered. "Load more" may enhance the experience but never replaces the links |
| Markup | `ItemList` with continuous `position` numbering across pages |
| Sitemaps | Page 1 only |
| View-all | Not offered — a 150-item HTML page would wreck LCP on 4G |
| `rel="next/prev"` | May be emitted for other consumers; assumed to have zero Google effect |

---

## 7. Image SEO

### 7.1 Filenames and storage

The live site serves `sdfgwfv.png.webp`, `12515.png`, `1223.png`. Replace with a deterministic scheme applied at upload:

`{productSlug}-{role}-{index}-{hash8}.{ext}` → `hp-victus-15-gaming-gallery-01-a3f91c2d.avif`

Stored in the private bucket, served through the CDN at `/_img/...`. The original upload is retained; derivatives are generated once and cached.

### 7.2 Alt text

| Rule | Detail |
|---|---|
| Auto-generation | On upload, `altText` is generated from live product data: `{brand} {displayTitle}{, variant}{, view}` → "HP Victus 15 Gaming Laptop, front view". **Generated from the record it is attached to, which is why the live site's M3-alt-on-an-M4-product defect cannot recur.** |
| Human override | Always editable, labelled "Photo description" with helper text |
| Regeneration | If a product is renamed, auto-generated alt text (flagged `isAutoAlt`) is regenerated; manually edited alt text is never overwritten |
| Decorative images | `alt=""` and `role="presentation"` — hero background scrims, brand wordmark strips, ambient blobs |
| Length | 60–125 characters. Never begins "Image of" or "Photo of". Never keyword-stuffed. |
| Lint | A CI check fails the build if any `<Image>` in the codebase lacks an `alt` prop |

### 7.3 Delivery

| Aspect | Rule |
|---|---|
| Component | `next/image` everywhere. Raw `<img>` is a lint error outside of email templates and the print stylesheet. |
| Formats | AVIF → WebP → JPEG fallback, negotiated by the CDN |
| Responsive | Explicit `sizes` on every image. PDP hero: `(max-width: 768px) 100vw, (max-width: 1280px) 58vw, 740px`. Grid card: `(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 400px`. A missing or wrong `sizes` is the most common cause of oversized image downloads. |
| Dimensions | `width` and `height` always supplied — CLS protection |
| Placeholder | `blurDataUrl` stored on `Media` at upload; used as `placeholder="blur"` |
| LCP image | The first gallery image on a PDP and the first hero image on `/` carry `priority` and `fetchPriority="high"`. **Exactly one priority image per route.** |
| Everything else | `loading="lazy"`, `decoding="async"` |
| Quality | 78 for photography, 90 for product shots on white, 100 never |
| Max source | 2400px longest edge; larger uploads are downscaled server-side |

### 7.4 Image sitemap and structured data

Product images are emitted in `sitemap-images.xml` with `<image:loc>`, `<image:title>`, `<image:caption>`. Every `Product` JSON-LD carries an `image` array of **absolute** URLs in 1:1, 4:3 and 16:9 crops — Google Merchant and Rich Results both prefer multiple aspect ratios.

### 7.5 Open Graph and Twitter images

Generated dynamically at `/api/og/...` using the Obsidian Peak tokens, so social cards are always current and never a stale upload.

| Route | OG image |
|---|---|
| PDP | Product photo on `--background`, with `displayTitle`, brand, price in `रु`, and the availability badge |
| Category | Category name, product count, four product thumbnails in a grid |
| Blog post | Cover image, title, author, reading time |
| Shared build | The build's key parts, total price, compatibility verdict, power draw |
| Store page | Branch name, address, opening hours |
| Default | Logo lockup on `--background` |

All 1200×630, PNG, edge-runtime rendered, cached for 24h and revalidated on entity change. `twitter:card` is `summary_large_image` everywhere.

---

## 8. Core Web Vitals

### 8.1 Targets (field data, p75, mobile)

| Metric | Target | Hard fail |
|---|---|---|
| LCP | ≤ 2.0 s | > 2.5 s |
| INP | ≤ 180 ms | > 200 ms |
| CLS | ≤ 0.05 | > 0.10 |
| TTFB | ≤ 600 ms | > 800 ms |
| FCP | ≤ 1.5 s | > 1.8 s |

These are tighter than Google's thresholds deliberately: lab targets that merely *meet* the threshold produce field data that fails it.

### 8.2 Nepal-specific reality

> **ASSUMPTION:** The majority of traffic is mid-range Android on 4G in the Kathmandu Valley, with meaningful 3G fallback outside it. Validate against GA4 device and connection data in the first 30 days.

Consequences the budget must absorb:

| Factor | Implication |
|---|---|
| No CDN PoP in Nepal for most providers | Every uncached request crosses to Singapore or Mumbai — 60–120 ms RTT before any work happens. **Cache aggressively at Cloudflare; static-render everything that can be.** |
| Mid-range Android CPU | JavaScript parse and execute costs roughly 4–6× a developer laptop. A 300 KB bundle that feels instant locally can cost 800 ms of main-thread time here. |
| Mobile data cost | Page weight is a commercial barrier, not just a performance metric |
| Inconsistent connectivity | Every network call needs a timeout, a retry, and a visible failure state |

### 8.3 Budgets (enforced in CI)

| Route | JS (gzip) | Total transfer | LCP element |
|---|---|---|---|
| `/` | ≤ 180 KB | ≤ 900 KB | Hero image |
| `/c/[...slug]` | ≤ 180 KB | ≤ 800 KB | First product image |
| `/p/[slug]` | ≤ 200 KB | ≤ 950 KB | Gallery hero |
| `/build` | ≤ 280 KB | ≤ 1.1 MB | First slot card |
| `/checkout` | ≤ 200 KB | ≤ 700 KB | Text |
| `/blog/[slug]` | ≤ 150 KB | ≤ 700 KB | Cover image |

### 8.4 The design's specific risks

The Obsidian Peak system uses `backdrop-filter: blur()` glass panels, multiple glow `box-shadow`s, and a cursor-following radial gradient. On a mid-range Android these are real paint costs.

| Risk | Mitigation |
|---|---|
| `backdrop-filter` on the sticky nav | Keep it — one element, composited. **Do not** apply it to scrolling list items or product cards. |
| Glass panels in long lists | Replace with a flat `--surface-container` fill below `lg`, or when `prefers-reduced-transparency` is set |
| Glow `box-shadow` on hover | Use `filter: drop-shadow` sparingly; prefer border-colour transitions, which are cheaper |
| Cursor-follow glow | **Delete it.** It is a `<body>`-appended element that repaints on every mousemove, has no touch equivalent, and adds nothing. |
| `group-hover:scale-105` on images | `will-change: transform` on hover only, never persistent |
| Three webfonts | Self-hosted, `font-display: swap`, preloaded for the two used above the fold. Material Symbols webfont removed entirely in favour of `lucide-react`. |

### 8.5 CLS discipline

Reserved aspect-ratio boxes for every image and embed · fonts preloaded with matched fallback metrics (`size-adjust`) · no content injected above existing content after load · the announcement bar and cookie banner are either server-rendered from the first byte or fixed-positioned so they cannot shift layout · skeletons match final dimensions exactly · `tabular-nums` on every changing number.

### 8.6 Measurement

| Layer | Tool |
|---|---|
| Field | `web-vitals` → GA4 + a first-party endpoint, segmented by route, device class and connection type |
| Lab | Lighthouse CI on every PR, mobile preset, 4× CPU throttle, "Slow 4G" |
| Budgets | `check-bundle-budget.ts` in CI; a regression over 5% fails the build |
| Monitoring | Weekly CrUX and Search Console Core Web Vitals review |

---

## 9. Local and international SEO

### 9.1 Local

City Computer's competitive moat is a physical shop on New Road. Local SEO must reflect it.

| Item | Action |
|---|---|
| Google Business Profile | One verified profile per branch. Category "Computer store", correct hours, real photos, products, weekly posts, Q&A seeded, review responses within 48 h. |
| NAP consistency | Name, address and phone must be byte-identical across the site, GBP, Facebook, Instagram and every directory. Sourced from the `Branch` record so there is one truth. |
| Branch pages | `/stores/[branchSlug]` with `LocalBusiness`/`ComputerStore` JSON-LD, `openingHoursSpecification`, `geo`, an embedded map, real photos, staff contact, directions, and available services |
| Directories | Nepali business directories, Nepal Yellow Pages, OpenStreetMap, Apple Maps. Consistent NAP only. |
| Local content | "Where to buy a gaming laptop in Kathmandu", delivery-coverage pages, New Road area content |
| Reviews | Post-purchase GBP review request. The site currently has zero reviews anywhere — this is a ranking gap and a trust gap. |
| Local intent pages | `laptop price in kathmandu`, `computer shop in new road`, delivery-district pages — but only where genuinely differentiated content exists |

### 9.2 `ne-NP` strategy

| Content | Decision |
|---|---|
| UI chrome, navigation, forms, errors | Human-authored Nepali |
| Category and brand names | Human-authored Nepali |
| Product marketing description | Optional per product; falls back to English |
| **Specification tables** | **Remain English.** Hardware terminology is used in English in Nepal. Translating "Thunderbolt 4" or "DDR5-6000" produces worse UX and worse search matching. |
| Blog | Per-post opt-in translation. Buying guides are the highest-value candidates. |
| Policy pages | Human-authored Nepali |

> **RISK:** thin duplicate `ne` pages. A `/ne/` page whose entire body is an English fallback is a duplicate with a different chrome. **Enforcement rule: if a page has no translated body content, it is `noindex` and excluded from the `ne` sitemap.** A `translationCompleteness` score per entity drives this automatically.

Machine translation is permitted only as a **draft** for a human to edit, never published unreviewed.

### 9.3 hreflang

Every indexable page emits a reciprocal set:

```
<link rel="alternate" hreflang="en"      href="https://citycomputer.com.np/p/hp-victus-15" />
<link rel="alternate" hreflang="ne"      href="https://citycomputer.com.np/ne/p/hp-victus-15" />
<link rel="alternate" hreflang="x-default" href="https://citycomputer.com.np/p/hp-victus-15" />
```

Emitted only when the alternate is actually indexable. Non-reciprocal hreflang is ignored by Google and is worse than none.

---

## 10. Migration and launch

### 10.1 URL inventory

Before anything is built:

1. Export every URL from the WordPress sitemap, Google Search Console (12 months of Performance data), Analytics landing pages, and server access logs.
2. Rank by clicks, impressions, and inbound links.
3. Classify: **migrate** (a direct equivalent exists) · **consolidate** (duplicates — the two MacBook Neo pages, `/my-account-2/`, `/checkout-2/`) · **retire** (410) · **rebuild** (needed but not yet designed, e.g. `/blog`).

### 10.2 Redirect map

Populated into the `Redirect` table (`06 §10`), evaluated in `middleware.ts` before routing, with a hit counter.

| Legacy pattern | New | Code |
|---|---|---|
| `/product/{slug}/` | `/p/{slug}` | 301 |
| `/category/{a}/{b}/` | `/c/{a}/{b}` | 301 |
| `/brand/{slug}/` | `/b/{slug}` | 301 |
| `/shop/` | `/shop` | 301 |
| `/my-account/`, `/my-account-2/` | `/account` | 301 |
| `/checkout-2/` | `/checkout` | 301 |
| `/order-tracking/` | `/track` | 301 |
| `/wishlist/` | `/account/wishlist` | 301 |
| `/about-us/`, `/contact-us/`, `/privacy-policy/`, `/terms-conditions/`, `/refund_returns/` | `/pages/{slug}` and `/contact` | 301 |
| `/author/{name}/` | `/` | 410 |
| `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/?p=`, `/feed/` | — | 410 |
| Duplicate MacBook Neo slug | The surviving canonical PDP | 301 |
| Anything with recorded traffic and no equivalent | Nearest relevant category | 301 |

**Rules:** exactly one hop — never chain 301s. Trailing slashes normalised in one step, not two. Query strings preserved only where meaningful. Every redirect is verified by an automated crawl of the full legacy inventory before go-live; the acceptance gate is **zero 404s and zero redirect chains** on any URL with recorded traffic.

### 10.3 Pre-launch

- [ ] Staging is `noindex` via `X-Robots-Tag: noindex, nofollow` **at the edge**, plus HTTP Basic auth. A meta tag alone is not enough — it does not cover JSON, PDFs, or images.
- [ ] A CI check asserts that production build output contains **no** `noindex` on indexable routes. This is the single most common catastrophic launch mistake.
- [ ] `robots.txt` and all sitemaps render correctly in the production build.
- [ ] Every canonical is absolute, HTTPS, and self-referencing.
- [ ] JSON-LD validates on one instance of every route type.
- [ ] hreflang reciprocity verified by crawl.
- [ ] Lighthouse ≥ 95 SEO, ≥ 90 performance on mobile for `/`, a category, a PDP, and a blog post.
- [ ] Legacy crawl produces zero 404s.
- [ ] GSC properties created for the domain; sitemaps ready to submit.
- [ ] Analytics verified end to end including a test purchase.
- [ ] 404 page is genuinely useful (search, popular categories, contact).

### 10.4 Launch day

1. Lower DNS TTL to 300 s, 24 hours ahead.
2. Deploy to production with the site still behind auth; smoke test.
3. Remove the `noindex` header and the auth gate.
4. Cut DNS.
5. Submit all sitemaps in GSC and Bing.
6. Request indexing for the top 20 URLs.
7. Verify 30 legacy redirects manually.
8. Confirm live analytics.
9. Announce on Facebook, Instagram and TikTok.

**Change of Address is not applicable** — the domain is unchanged. Do not use it.

### 10.5 Post-launch monitoring

| Window | Watch | Rollback trigger |
|---|---|---|
| 0–48 h | Errors, 404s, Core Web Vitals, checkout completion, GSC crawl errors | Checkout completion drops > 20%, or 5xx rate > 1% |
| Week 1 | Indexed page count, impressions, top-query rankings, redirect hit log | Indexed pages fall below 60% of the legacy count |
| Weeks 2–4 | Ranking movement on the top 50 queries, rich-result eligibility, CWV field data | Organic sessions down > 30% vs the pre-launch baseline |
| Days 30–90 | New keyword acquisition, `ne` indexation, programmatic-page performance, review accumulation | — |

**A traffic dip in weeks 1–2 is normal.** Do not react before day 14 unless a rollback trigger fires. Rollback = restore the DNS record to the old host, which stays warm and unchanged for 30 days.

---

## 11. SEO in the admin

What the non-technical owner sees, per `09`:

| Visible | Hidden and automatic |
|---|---|
| **Page Title** with a character counter and helper text "The title Google shows. Keep it under 60 characters." | Website link (slug) |
| **Search Description** with a counter and "The description Google shows underneath. Keep it under 160 characters." | Canonical URL |
| A **live Google result preview** rendered exactly as a SERP entry | All structured data |
| A traffic-light hint: 🟢 "Looks good" / 🟡 "A bit short" / 🔴 "Too long — Google will cut this off" | Sitemap inclusion |
| **Photo description** per image | OG and Twitter images |
| | hreflang |
| | Breadcrumbs |
| | Internal linking |
| | Old-link forwarding on slug change |
| | Robots directives |

An "Advanced settings" drawer, collapsed and labelled *"Only change these if someone has asked you to"*, exposes the website link and a canonical override for the rare case where it is needed.

Both fields are **pre-filled** from templates (§3), so the correct behaviour is the default and the owner only intervenes to improve.

---

## 12. Acceptance criteria

- [ ] Every route type emits a correct, absolute, self-referencing canonical.
- [ ] Every route type emits valid JSON-LD, verified against the Rich Results Test and the Schema Markup Validator.
- [ ] **No `AggregateRating` is emitted for any product with zero approved reviews.**
- [ ] `og:type` is `website` with a full `product:*` namespace on PDPs — never `article`.
- [ ] Sitemap index plus all child sitemaps generate, respect the 50k/50MB limits, carry accurate `lastmod`, and exclude `noindex`, unpublished, and out-of-scope URLs.
- [ ] `robots.txt` is generated, environment-aware, and disallows admin, cart, checkout, account, tracking and search-result URLs.
- [ ] Every legacy URL with recorded traffic 301s in exactly one hop to a live 200.
- [ ] No redirect chains and no redirect loops.
- [ ] hreflang is reciprocal and only present where the alternate is indexable.
- [ ] No `ne` page is indexed whose body is entirely an English fallback.
- [ ] Every page has exactly one `<h1>`, ≤ 70 characters, and no skipped heading levels.
- [ ] Every `<Image>` has an `alt`; no auto-generated alt text contradicts the product it belongs to.
- [ ] Faceted URLs beyond the whitelist are `noindex, follow` and canonicalised to the clean category URL.
- [ ] Paginated pages self-canonicalise and remain indexable.
- [ ] Lighthouse SEO ≥ 95 on `/`, a category, a PDP, a blog post and a store page.
- [ ] Core Web Vitals lab targets met at the mobile preset with 4× CPU throttling.
- [ ] Staging is unindexable; production carries no accidental `noindex`.
- [ ] The admin exposes exactly two SEO fields with a live preview and helper text.
