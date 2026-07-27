# 02 — Product Scope & Journeys

Defines who the platform serves, what it does, what it deliberately does not do, and the exact route map.

**Depends on:** `01`. **Feeds into:** `04`, `06`, `07`, `17`.

---

## 1. Personas

| # | Persona | Context | Needs | Design implication |
|---|---|---|---|---|
| P1 | **Ramesh — the owner** (primary admin) | 50s, runs the New Road shop, uses a phone and a desktop, no software background | Add products, update stock and prices, see today's orders, print invoices, call customers | Every admin screen must be self-explanatory. No jargon. Big targets. Undo everywhere. See `09`. |
| P2 | **Sita — shop staff** | 20s–30s, comfortable with Facebook and Excel, high turnover | Process orders, update delivery status, answer enquiries, book repairs | Role-limited admin. Guided workflows. In-product help. |
| P3 | **Bibek — the student buyer** | 19, Kathmandu, browsing on a mid-range Android on 4G, budget NPR 60–90k, price-sensitive | Compare laptops on spec, see real price, know EMI options, trust the seller | Fast mobile pages, faceted spec filters, EMI messaging, visible trust signals |
| P4 | **Anjana — the professional** | 32, buying a MacBook or workstation, NPR 150–450k | Genuine product assurance, warranty clarity, a payment method that works at this value, delivery certainty | Warranty content, tiered payment, order tracking, invoice |
| P5 | **Suman — the PC builder** | 24, gamer, knows some hardware, has a budget and a target game | Configure a machine that actually works, understand trade-offs, share it with friends before buying | The builder is his entire journey. Prevention over correction. Shareable links. |
| P6 | **Prakash — the SME buyer** | 40s, buying 5 laptops and a printer for an office | Bulk enquiry, invoice with VAT, quotation, delivery to office | v1: enquiry form + manual quote. v2: B2B module. |
| P7 | **Deepa — the repair customer** | Any age, laptop won't boot | Book a slot, know the cost, track the job | Service booking + public ticket status |
| P8 | **Googlebot** | — | Crawlable, fast, structured, canonical pages | See `11` |

---

## 2. Feature inventory

Priority: **M** = v1 must-have · **S** = v1 should-have · **C** = v1 could-have · **W** = deferred (won't, this release)

### 2.1 Catalogue & discovery

| Pri | Feature | Notes |
|---|---|---|
| M | Nested categories (unlimited depth, materialised path) | Fixes taxonomy defects in `01 A.2` |
| M | Brand entities with hub pages | `/b/[brandSlug]` |
| M | Products with variants and per-variant SKU/price/stock | |
| M | Structured, category-templated specifications | Source: existing PDP spec tables |
| M | Faceted filtering driven by spec attributes | Processor, RAM, storage, GPU, screen size, price, brand, availability |
| M | Sort: relevance, price ↑↓, newest, best-selling, discount % | |
| M | Full-text + fuzzy search with autocomplete | Postgres FTS + `pg_trgm` in v1; Meilisearch in Phase 12 |
| M | Zero-result search logging | Drives merchandising — `12` |
| S | Product comparison (up to 4) | `/compare` |
| S | Recently viewed | Cookie-backed |
| S | Related / cross-sell / "Complete your rig" | |
| M | Wishlist | Exists today; must survive |
| S | Reviews with verified-buyer flag and moderation | The current site has zero reviews; this is a ranking and conversion gap |
| C | Product Q&A | |
| M | Prebuilt PC catalogue | Products composed of builder parts |
| M | Collections / campaigns (e.g. "Save up to 40% on Headphones") | Fixes defect #10 |

### 2.2 Cart, checkout, orders

| Pri | Feature | Notes |
|---|---|---|
| M | Persistent cart (guest via cookie, merged on login) | |
| M | Guest checkout | Mandatory in this market |
| M | Delivery zones with per-zone fee | Inside Valley NPR 150 / Outside NPR 350, per approved design |
| M | In-store pickup at a branch | |
| M | Nepal address model: Province → District → Municipality/City → Ward → Street → Landmark | |
| M | Phone as the primary identifier, `+977 98XXXXXXXX` | |
| M | VAT 13% handling (inclusive display) | |
| M | Coupons and promotions | |
| M | Tiered payment by order value | `10` |
| M | Order lifecycle with visual tracker | New → Payment Confirmed → Preparing → Packed → Shipped → Delivered → Completed |
| M | Public order tracking by order number + phone | |
| M | Invoice PDF | |
| S | Partial deposit for high-value builds | `10` |
| S | Back-in-stock alerts | |
| S | Abandoned cart recovery | |
| C | Returns/RMA workflow | 3-day DOA policy exists today |

### 2.3 PC Builder — see `08` for the full spec

| Pri | Feature |
|---|---|
| M | Three modes: Guided / Standard / Expert |
| M | Full slot set with required/optional distinction |
| M | Prevention-first compatibility filtering |
| M | Physical fit engine (case, GPU, cooler, radiator, drive bays) |
| M | Power model with connectors and headroom |
| M | Live validation panel with plain-language issues and one-click fixes |
| M | Autosave + save + short-ID share links + print |
| M | Add whole build to cart |
| S | Bottleneck / balance meter |
| S | Auto-build from budget + use case |
| S | Build comparison |
| S | Upgrade suggestions ("what to change to gain the most") |
| C | Import a build from pasted text |
| W | Import a build from a screenshot (vision) |
| W | LLM-assisted natural-language build requests |

### 2.4 Content, service, stores

| Pri | Feature |
|---|---|
| M | Blog with categories, authors, MDX-ish rich content |
| M | Buying guides and programmatic price pages |
| M | CMS pages (about, privacy, terms, returns, warranty, shipping) |
| M | Store locator + per-branch pages with hours, map, phone |
| M | Service/repair booking with device, issue, preferred branch and slot |
| M | Public repair status lookup by ticket number |
| S | EMI calculator with per-bank tenures |
| S | Contact / enquiry form routed to the admin inbox |

### 2.5 Accounts

| Pri | Feature |
|---|---|
| M | Email + password registration, email verification |
| M | Login, logout, forgot/reset password |
| M | Order history and order detail |
| M | Address book |
| M | Saved builds library |
| M | Wishlist |
| S | Phone OTP login | Realistic for Nepal; depends on an SMS provider — `19` |
| S | Google OAuth |
| S | Service ticket history |

### 2.6 Admin — see `09`

Product management wizard · media library · inventory (quick adjust, bulk edit, CSV import/export, low-stock alerts) · orders with one-click status and customer quick actions · customers · coupons and campaigns · blog · CMS pages · SEO fields with live preview · builder parts and rules · service tickets · enquiries inbox · plain-language analytics · users, roles and permissions · activity history.

### 2.7 Explicit non-goals for v1

| Not building | Why | Revisit |
|---|---|---|
| Multi-vendor marketplace | Single retailer | Never |
| Full B2B portal (credit terms, negotiated price lists, PO workflow) | Complexity vs volume | v2 |
| Native mobile apps | PWA is sufficient | v2 |
| Subscription / rental | No business case | — |
| Loyalty points | Adds accounting complexity before product-market fit | v2 |
| Live chat with agents | Phone and WhatsApp are the real channels here | v2 |
| Real-time GPS delivery tracking | No courier API confirmed | v2 |
| Accounting/ERP integration | Manual export is acceptable at this size | v2 |
| International shipping / multi-currency | Domestic only | — |
| Third-party price comparison scraping | Legal and reliability risk | — |

---

## 3. Route map

Locked. Every document uses these paths.

### 3.1 Storefront (locale-prefixed for `ne`, unprefixed for `en`)

| Route | Rendering | Notes |
|---|---|---|
| `/` | RSC + ISR 300s | Home |
| `/shop` | RSC, dynamic on searchParams | All products |
| `/c/[...categorySlug]` | RSC + ISR 300s | Nested category, e.g. `/c/laptops/gaming` |
| `/b/[brandSlug]` | RSC + ISR 600s | Brand hub |
| `/p/[productSlug]` | RSC + ISR 300s, on-demand revalidate on change | PDP |
| `/search` | RSC, dynamic | Search results |
| `/compare` | Client | Up to 4 products |
| `/prebuilt` | RSC + ISR | Prebuilt PC catalogue |
| `/build` | Client shell + server validation | Configurator |
| `/build/[shortId]` | RSC + ISR | Public shared build. **`noindex,follow` by default** — only owner-curated builds are indexed (`11 §4.11`) |
| `/cart` | Client | |
| `/checkout` | Client + Server Actions | `noindex` |
| `/checkout/payment/[intentId]` | Server | Gateway hand-off |
| `/order/confirmation/[orderNumber]` | Server | `noindex` |
| `/track` · `/track/[orderNumber]` | Server | Public, `noindex` |
| `/account`, `/account/orders`, `/account/orders/[orderNumber]`, `/account/addresses`, `/account/builds`, `/account/wishlist`, `/account/tickets`, `/account/profile` | Server, auth-gated | `noindex` |
| `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/forgot`, `/auth/reset` | Server | `noindex` |
| `/blog`, `/blog/[postSlug]`, `/blog/category/[slug]` | RSC + ISR 600s | |
| `/service`, `/service/book`, `/service/status/[ticketNumber]` | RSC / Server Action | Status page `noindex` |
| `/stores`, `/stores/[branchSlug]` | RSC + ISR 3600s | LocalBusiness schema |
| `/emi-calculator` | Client | |
| `/pages/[slug]` | RSC + ISR 3600s | CMS pages |
| `/contact` | RSC + Server Action | |

### 3.2 Admin — all `noindex`, all auth+role gated

`/admin` · `/admin/orders[/id]` · `/admin/products[/new|/id]` · `/admin/inventory` · `/admin/categories` · `/admin/brands` · `/admin/media` · `/admin/customers[/id]` · `/admin/coupons` · `/admin/campaigns` · `/admin/blog` · `/admin/pages` · `/admin/builder/parts` · `/admin/builder/rules` · `/admin/builder/builds` · `/admin/service[/id]` · `/admin/enquiries` · `/admin/reviews` · `/admin/reports` · `/admin/branches` · `/admin/users` · `/admin/settings/*` · `/admin/activity`

### 3.3 API — `/api/v1/*`

See `07-API-DESIGN.md`.

---

## 4. Critical user journeys

### 4.1 Discovery → purchase (P3 Bibek, mobile 4G)

```
Google "gaming laptop price in nepal"
   └─► /c/laptops/gaming  (ISR, LCP ≤ 2.0s)
        ├─ facets: Price ≤ 100k · RAM 16GB · GPU RTX 4050
        └─► /p/hp-victus-15-...
             ├─ price, compare-at, availability, branch stock
             ├─ EMI: "From रु 8,400/mo — see options"
             ├─ specs table, warranty, reviews
             └─► Add to cart ──► /cart ──► /checkout
                   ├─ Contact: name + phone (OTP optional)
                   ├─ Delivery: zone + Nepal address, or pickup at New Road
                   ├─ Payment: eSewa (order < NPR 45k)
                   └─► gateway redirect ──► server verify ──► /order/confirmation/CC-2607-0123
                         └─ SMS/email + tracking link
```

**Failure paths that must be designed:** payment abandoned at gateway · payment pending on return · payment failed · stock sold out between add-to-cart and checkout · address outside any delivery zone.

### 4.2 PC Builder → purchase (P5 Suman)

```
/build ──► Mode: Standard
   Step 1 Purpose   → Gaming · 1440p · AAA titles
   Step 2 Budget    → NPR 250,000  → allocation preview
   Step 3 Core      → CPU (filtered to in-stock, in-budget)
                       └─ motherboard list now filtered to matching socket
   Step 4 Memory    → RAM filtered to board's type/speed/slots
   Step 5 Graphics  → GPU list annotated with length vs shortlisted cases
   Step 6 Storage   → M.2 options limited by board slot count and keying
   Step 7 Power     → PSU filtered by required wattage AND connectors
   Step 8 Cooling   → coolers filtered by socket AND case height clearance
   Step 9 Case      → cases filtered by board form factor, GPU length,
                       cooler height, radiator support
   Step 10 Review   → validation summary, power draw, balance meter,
                       upgrade headroom, estimated FPS
        ├─► Save (autosaved already) ──► /build/a7Kd93Xq  (shareable; noindex by default)
        ├─► Print / PDF quotation
        └─► Add all to cart ──► /checkout (assembly service line item added)
```

### 4.3 Owner adds a product (P1 Ramesh)

```
/admin ──► big green "Add a Product" button
  Step 1 Basics    Name · Brand · Category · Price · Offer Price · Stock
                   → duplicate-name warning if similar product exists
                   → live "how this looks on Google" preview
  Step 2 Photos    Drag & drop ─► auto WebP/AVIF, thumbnails, alt text,
                   reorder, cover-photo picker
  Step 3 Details   Category-driven spec template auto-loaded
                   (Laptop → Processor/RAM/Storage/Display/Graphics/Battery)
  Step 4 Search    Page Title + Search Description, both pre-filled,
                   both with a one-line explanation and a preview
  ──► "Save as Draft" | "Publish" (with a checklist of what's missing)
```

### 4.4 Owner processes an order

```
/admin/orders ──► card/list with a coloured status pill
  └─► order detail
       ├─ Visual tracker: New ▸ Paid ▸ Preparing ▸ Packed ▸ Shipped ▸ Delivered ▸ Done
       ├─ One click advances one step (with an "undo" toast for 10 seconds)
       ├─ Quick actions: Call · WhatsApp · Email · Copy Address ·
       │                 Print Invoice · Print Shipping Label
       └─ Payment panel: method, status, and for bank transfer,
          the uploaded receipt with Approve / Reject (two-person rule)
```

### 4.5 Repair booking (P7 Deepa)

```
/service ──► /service/book
   Device type · Brand · Model · Problem description · Photos (optional)
   Preferred branch · Preferred date · Contact phone
   ──► SVC-2607-0042 issued, SMS + email
        └─► /service/status/SVC-2607-0042
             Received ▸ Diagnosed ▸ Quote Sent ▸ Approved ▸
             In Repair ▸ Ready for Pickup ▸ Collected
```

---

## 5. Content model overview

| Content type | Managed by | Storage | Rendering |
|---|---|---|---|
| Products, categories, brands | Admin | Postgres | RSC + ISR |
| Blog posts | Admin (rich text editor) | Postgres, sanitised HTML/JSON | RSC + ISR |
| CMS pages | Admin | Postgres | RSC + ISR |
| Homepage sections (hero slides, bento tiles, campaigns) | Admin | Postgres, typed section blocks | RSC + ISR |
| Navigation menus | Admin | Postgres | RSC, cached |
| Site settings (phone, address, hours, policies, shipping zones) | Admin | Postgres `Setting` key-value with typed schema | RSC, cached |
| UI copy | Developers | `messages/en.json`, `messages/ne.json` | `next-intl` |
| Legal/marketing long-form | Admin | CMS pages | RSC |

**Decision:** no external headless CMS. A dedicated CMS (Sanity, Payload, Strapi) would add a second admin UI, a second permission model, and a second thing for a non-technical owner to learn — directly contradicting the Dad Mode requirement. Content lives in the same Postgres database, edited through the same admin.

---

## 6. Localisation scope

| Content | `en` | `ne` |
|---|---|---|
| UI chrome, buttons, labels, errors | Authored | Authored (human-reviewed) |
| Category and brand names | Authored | Authored |
| Product marketing description | Authored | Optional; falls back to `en` |
| Product specification tables | Authored | **Remain English** — hardware terms are used in English in Nepal, and translating "Thunderbolt 4" is worse than leaving it |
| Blog posts | Authored | Per-post opt-in translation |
| Policy pages | Authored | Authored |
| Emails/SMS | Authored | Authored |

**Fallback rule:** a `ne` page with no translated body falls back to `en` content but keeps `ne` chrome. A `ne` page whose *entire* content is a fallback MUST be excluded from the `ne` sitemap and marked `noindex` to avoid thin duplicate pages.

> **DECISION REQUIRED:** Who writes and reviews the Nepali copy? Without a named owner, `ne` should ship in Phase 14 rather than Phase 5.
