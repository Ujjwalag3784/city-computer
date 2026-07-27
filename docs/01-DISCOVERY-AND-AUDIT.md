# 01 — Discovery & Audit

Evidence base for every architectural decision in this bundle. Three subjects were audited directly: the live WooCommerce site, the AI PC Builder reference application, and the approved Google Stitch design exports.

**Feeds into:** everything. Cite this document when justifying a requirement.

---

## Part A — Audit of `citycomputer.com.np`

**Audited:** 26–27 July 2026, homepage + PDP + navigation + footer + metadata.
**Detected stack:** WordPress, WooCommerce, Elementor 4.1.4, agency-built (eLance Digital Media). Theme appears to be a commercial "Shop50"-family theme (demo assets still present).

### A.1 Business facts extracted

| Fact | Value |
|---|---|
| Trading name | City Computer Systems |
| Positioning | "Genuine Products. Best Prices." |
| Location | New Road, Kathmandu |
| Phone | +977 9823595680 |
| Socials | Facebook, Instagram (`@citycomputersystems`), TikTok, YouTube |
| Stated policies | Free shipping on all orders; exchange if defective; 3-day return for DOA; 24/7 online support; Cash on Delivery |
| Currency display | `₨` server-rendered, rewritten to `रु` by client-side JS |
| Catalogue size | ~150 products (Apple 6, Laptops 27, Monitors 43, Accessories 52, Office 11, CCTV 6, Ext. HDD 3) |
| Price range observed | ~NPR 1,500 (cables) to ~NPR 485,000 (high-end builds/GPUs) |

### A.2 Current information architecture

```
Everything (/shop)
Apple Store            → Macbook
Laptops                → Gaming Laptops, Notebooks
Monitors               → Normal, Gaming, Professional
Components             → External HDD, External SSD, Internal SSD,
                         Graphics Cards, Motherboards (AMD | Intel), Memory
Accessories            → Headphones, Gaming Mouse, Cables & Adapters, Mouse,
                         Keyboards, Power Banks, Speakers, Webcams
Office Solutions       → Printers, Projectors
CCTV Camera            (footer/tiles only — absent from main nav)
```

**Taxonomy defects:** "Memory" is listed under Accessories in the menu but lives at `/category/components/memory/`. CCTV is a real category with products but is missing from primary navigation. Footer "Webcams" links to the motherboards category. Category depth is inconsistent (2 levels in most branches, 3 under Components → Motherboards → AMD).

### A.3 Customer journey as it exists today

```
Home ──► Category ──► PDP ──► Add to cart ──► Cart ──► Checkout ──► COD/?
  │         │           │
  │         │           └─► No reviews, no Q&A, no comparison, no stock ETA
  │         └─► No faceted filtering by spec; sort only
  └─► "Build your Own PC" hero banner → links to /shop (no builder exists)
```

Supporting journeys present: Wishlist, Track Order, My Account. Supporting journeys absent: search results page of any quality, product comparison, saved builds, service booking, store locator, blog.

### A.4 Defect register

Severity: **P1** blocks revenue · **P2** materially harms conversion or ranking · **P3** quality/trust.

| # | Sev | Defect | Evidence | Resolution in new build |
|---|---|---|---|---|
| 1 | P1 | **"Build your Own PC" is advertised but does not exist.** The hero slide names RTX 5080/5070/5060 Ti and links to `/shop`. | Homepage carousel | Full configurator — `08` |
| 2 | P1 | **No online payment.** Checkout appears COD-only; no wallet/bank/card integration surfaced. | Site copy: "Pay when you get the product" | Tiered gateway strategy — `10` |
| 3 | P1 | **Out-of-stock products are fully merchandised.** A NPR 154,900 MacBook Air M4 shows "Out of stock" only in a small meta line, yet appears in the homepage "All Laptops" carousel with no badge. | PDP + homepage | Availability is a first-class field surfaced in grid, PDP, schema, and sitemaps — `06`, `11` |
| 4 | P2 | **Duplicate product records.** "Apple MacBook Neo 13-inch" exists at two slugs (`/product/macbook-neo-price-nepal/` and `/product/apple-macbook-neo-13-inch-a18-pro-chip-8gb-ram-512gb-ssd/`) and appears twice in the same carousel. | Homepage listing | Unique slug constraint + duplicate detection on create — `06`, `09` |
| 5 | P2 | **Duplicate account/checkout routes.** `/my-account/` and `/my-account-2/` both live; `/checkout-2/` is the active checkout. | Header + cart drawer | Single canonical route set — `11` |
| 6 | P2 | **`og:type: article` on product pages.** No product OG namespace, no price/availability in unfurls. | PDP meta | Typed metadata registry — `11` |
| 7 | P2 | **No structured data.** No Product, Offer, Breadcrumb, LocalBusiness, or Review JSON-LD detected. | PDP source | Full JSON-LD plan — `11` |
| 8 | P2 | **Blog link is a dead `#`.** No content marketing exists despite the nav promising it. | Footer | `/blog` with buying guides — `11` |
| 9 | P2 | **Broken menu widget on homepage:** literal text "Please select a valid menu to display." renders to users. | Homepage | N/A — rebuild |
| 10 | P2 | **Promotional banners link nowhere.** "Save up to 40% On Headphones → Shop Now" points at `#`. | Homepage | Campaign/collection entities with real targets — `06` |
| 11 | P2 | **Hero CTAs are undifferentiated.** All four slides link to `/shop`, not the relevant category. | Homepage | Slide → target entity relation — `06` |
| 12 | P2 | **Zero reviews site-wide.** No social proof, no review rich results, and a review form that nobody has used. | PDP | Post-purchase review request flow — `12`; verified-buyer badge — `06` |
| 13 | P2 | **200-character product titles used as H1.** e.g. "Acer Aspire lite 14 (13th Gen Intel Core i3 N355 Processor | 8GB LPDDR5 RAM | 256GB | 14" FHD | Intel UHD Graphics | One Year". | PDP + listings | Split `name` / `displayTitle` / `h1` / `metaTitle` — `06`, `11` |
| 14 | P2 | **Currency rewritten client-side after paint.** A `DOMContentLoaded` handler string-replaces `Rs.` → `रु`. Causes a visible flash, breaks with JS disabled, and is inconsistent with the `₨` actually rendered on PDPs. | Inline script | Server-side `formatNPR()` — `00` |
| 15 | P3 | **Alt text describes the wrong product.** M4 MacBook page carries "Apple MacBook Air M3 13″..." alt text on both images. | PDP | Auto-generated alt from live product data + human override — `11` |
| 16 | P3 | **Meaningless asset filenames:** `sdfgwfv.png.webp`, `12515.png`, `1223.png`, `15125125.png`. | Media library | Deterministic media naming — `11` |
| 17 | P3 | **Theme demo content still live.** "From Instagram" section serves `shop50-instagram-1..5.jpg` from 2024. | Homepage | Real Instagram feed or removal — `02` |
| 18 | P3 | **Copy defects:** "Catagories", "Money Back Guarante", "Cash of Delivery", "Guarantee / Exchange if Defective". | PDP + homepage | Copy deck under version control, i18n keys — `05` |
| 19 | P3 | **Contradictory policy claims.** "Free Shipping in all orders" sitewide, while the approved checkout design charges NPR 150 inside the Valley and NPR 350 outside. | Homepage vs Stitch checkout | Single shipping-policy source — `06` |
| 20 | P3 | **Author archive exposed** at `/author/anishsahelance/`, leaking a staff username. | Homepage byline | No author archives; admin identities never public — `13` |
| 21 | P2 | **No faceted filtering.** Category pages cannot be filtered by processor, RAM, GPU, or price — the exact attributes buyers shop on. | Category pages | Attribute-driven facets — `06`, `07` |
| 22 | P2 | **Single-language, English only.** No Nepali content, no `hreflang`. | `og:locale: en_US` | `en` + `ne` — `11` |
| 23 | P2 | **Elementor + WooCommerce weight.** Page-builder DOM, multiple Google Font requests, jQuery, uncontrolled plugin CSS/JS. | Generator meta | RSC-first Next.js with explicit budgets — `14` |
| 24 | P3 | **No stock quantity, no ETA, no branch availability.** A customer cannot tell whether the New Road store has the item today. | PDP | Per-branch stock + pickup — `06` |
| 25 | P3 | **No EMI content** despite EMI being a decisive purchase factor at these price points in Nepal. | Site-wide | EMI calculator + partner content — `10` |

### A.5 What the current site does well (preserve)

- Clear trust messaging block (genuine products, warranty, COD, support) — this converts in Nepal and must survive the redesign.
- Detailed HTML specification tables on PDPs. The data is good; the structure is not. **This is a migration asset** — those tables are a usable source for the structured `specs` JSON.
- Reasonable category naming that matches how Nepali buyers search.
- Phone number and physical address prominent — critical for trust in this market.
- Brand taxonomy already exists (`/brand/apple/`).

---

## Part B — Teardown of `ai-pc-builder.digibuggy.com`

Reverse-engineered live, including network inspection. This is the feature we must beat.

### B.1 Their architecture

| Layer | Reality |
|---|---|
| Client | Lovable-generated React SPA, single ~2.5 MB JS bundle |
| Backend | Supabase (`parts`, `quotations`, `leads`) + edge functions |
| Data source | **A Google Sheet**, scraped from `mdcomputers.in`, 941 rows, 60-second cache |
| Public part payload | **Only four fields: `{category, name, price, url}`** |
| Specs | **Regex-parsed from the product name string at runtime** |
| Routes | `/`, `/beginner`, `/pro`, `/advanced`, plus password-gated admin |
| Persistence | **None.** No save, no share, no permalink. Refresh destroys the build. |
| Export | Client-side jsPDF quotation |
| Monetisation | Lead-capture modal that hard-gates progression; "Book Your Build — ₹5,000" |

Categories and counts: AMD_CPUS 21 · INTEL_CPUS 24 · GPU_PARTS 45 · AMD_MOTHERBOARDS 25 · INTEL_MOTHERBOARDS 42 · RAM_PARTS 29 · STORAGE_PARTS 20 · PSU_PARTS 40 · COOLER_PARTS 32 · CABINET_PARTS 513 · MONITOR_PARTS 150.

### B.2 Their three flows

| Mode | Shape |
|---|---|
| **Beginner** | 6–7 dynamic steps: use case → games/software → budget → priorities → monitor → review |
| **Pro** | 8-step stepper: Use Case → Budget → CPU & GPU → Motherboard → RAM & Storage → Cooling & PSU → Case → Review, with a persistent budget-allocation sidebar (CPU 15%, GPU 26%, Mobo 11%, RAM 15%, SSD 12%, PSU 6%, Cooling 12%, Monitor 0%, Case 4%) |
| **Advanced** | 9 flat, ungated cards; counter "N/9 selected" |

### B.3 Compatibility rules they actually enforce

| # | Rule | Severity |
|---|---|---|
| 1 | CPU socket ≠ motherboard socket | Error |
| 2 | CPU supported RAM type ≠ motherboard RAM type | Error (no fix offered — their bug) |
| 3 | CPU TDP vs motherboard VRM tier | Warning |
| 4 | RAM speed > CPU max RAM speed | Info |
| 5 | RAM speed > motherboard max RAM speed | Info ("will be downclocked") |
| 6 | RAM sticks > motherboard DIMM slots | Error |
| 7 | RAM total capacity > motherboard max | Error |
| 8 | GPU recommended PSU > PSU wattage | Error |
| 9 | Total estimated power > PSU wattage | Error |
| 10 | GPU PCIe gen > motherboard PCIe gen | Info |
| 11 | Low-tier PSU + high-end GPU | Warning |
| 12 | High-TDP CPU without adequate AIO | Warning |
| 13 | NVMe storage + motherboard with 0 M.2 slots | Error |
| 14 | CPU tier ↔ GPU tier mismatch → bottleneck | Warning (prose only) |

### B.4 What they do NOT check — verified by building an impossible PC

A micro-ATX board, a 420 mm AIO, and an RTX 5090 were placed in a Thermaltake Tower 200 Mini-ITX case. **Zero warnings.** The following are entirely absent:

- Case ↔ motherboard form factor
- GPU length, height, and slot-width clearance
- CPU cooler height vs case clearance
- Radiator mount matrix (position × size support)
- Cooler socket compatibility
- PSU form factor (ATX / SFX / SFX-L) and length
- PSU **connector** counts (12V-2×6 / 12VHPWR, EPS 8-pin, PCIe 6+2, SATA, Molex)
- SATA port budget vs drive count
- M.2 slot count, keying, and PCIe-lane sharing with SATA ports
- Drive bays (2.5" / 3.5")
- Front-panel and USB header availability
- Monitor ↔ GPU output port matching
- Multi-drive and multi-GPU configurations

**This gap is the product opportunity.** Physical fit is the single most common reason a self-built PC fails, and their tool ignores it completely.

### B.5 Their other weaknesses

| Weakness | Detail |
|---|---|
| **Validate-after, not prevent-before** | AM4 boards stay fully selectable under an AM5 CPU. Users assemble garbage and are scolded afterwards. |
| **Regex specs are wrong** | A B850 Tomahawk Max (PCIe 5.0) was parsed as PCIe 4 and generated a false bandwidth warning. Chipset scan produced junk tokens (`A2000`, `A5000`, `B570`). |
| **Naive power model** | `CPU TDP + GPU max draw + 100W fixed`, compared raw against PSU rating. No transient headroom, no efficiency target, no per-component table, no connector check. |
| **Bottleneck is a text row** | No score, no gauge, no FPS estimate. |
| **Selection UI is a bare combobox** | No specs, no images, no filters, no sort, no compare. 513 cabinets in an unvirtualised dropdown with visible duplicates. Naive substring search fails on multi-token queries. |
| **No persistence at all** | No save, share, permalink, or print view. |
| **Recommendations are unsound** | "Enthusiast / Ultra AAA at ₹1.5 L" proposed a Ryzen 5 9600X + RTX 5060 8 GB. Elsewhere a ₹52,940 64 GB DDR4 kit and a 420 mm AIO next to a case that cannot mount it. Price deltas on alternatives don't reconcile with listed prices. |
| **No commerce honesty** | No stock state, no MRP vs sale, no price-freshness timestamp, single scraped retailer. |
| **Lead-gated** | A modal blocks progression until name/email/phone are surrendered. |
| **Accessibility** | Dropdowns render behind adjacent cards; stale DOM after step transitions; no ARIA on comboboxes; no keyboard navigation. |

### B.6 What they get right (adopt)

- Three difficulty modes is a genuinely good idea for a market with mixed literacy.
- Budget-percentage allocation gives beginners a defensible starting build.
- "Why this component" tooltips tied to the chosen use case.
- Inline **Fix** accordions that expand a constraint-filtered candidate list — the right interaction, applied at the wrong moment.
- "Options N" with RECOMMENDED / COST-EFFECTIVE alternatives and ± price deltas.
- Import a configuration by pasting text or uploading a screenshot. Genuinely useful in a market where quotes circulate as images on Viber and Messenger.
- A PDF quotation with a defined build journey — this maps directly onto City Computer's assembly service.

### B.7 Design mandate derived from this teardown

| Their approach | Ours |
|---|---|
| Specs regex-parsed from names | **Normalised, typed, validated `specs` JSONB per part** with an import pipeline that rejects unparseable rows |
| Validate after selection | **Filter and disable at selection time**, with a "show incompatible" escape hatch and a reason tooltip |
| No physical fit | **Full dimensional and connector fit engine** |
| TDP + 100W | **Per-component power table with transient headroom and connector matching** |
| Bottleneck as prose | **Paired utilisation estimate + balance meter + FPS ranges per title** |
| No persistence | **Autosave, short-ID permalinks, revision history, print, export, compare** |
| Lead gate | **Free to build and share; capture contact only at quote/booking** |
| Single scraped retailer | **Our own inventory, with real stock and real prices** |

---

## Part C — Approved Stitch designs

Theme: **"Obsidian Peak"** — dark-only. Six screens delivered: Landing, Shop, Product Detail, PC Builder, Checkout, Admin. Full token extraction lives in `05-DESIGN-SYSTEM.md`; this section records findings and traps.

### C.1 What was delivered

| Screen | Key content |
|---|---|
| **Landing** | Full-viewport hero, "Curated Ecosystems" bento grid, an AI PC Builder teaser with a live-benchmark glass card, trending hardware carousel, three value props, partner wordmarks, 4-column footer with newsletter |
| **Shop** | Breadcrumb, result count, sort pill, sticky 288px filter rail (price range, brand checkboxes, processor chip grid, GPU radios, memory pills), 3-column product grid, numbered pagination |
| **PDP** | 7/5 split — gallery with thumb strip; buy column with spec tiles, two variant groups, price block with "Kathmandu Best Price" and EMI line; tabbed spec table; warranty + EMI feature cards with Nabil / Global IME / NIC Asia / Siddhartha chips; "Complete Your Rig" bento |
| **Builder** | 2/7/3 layout — vertical 4-step rail with an Expert Tip card, four slot cards (CPU, GPU, RAM, Storage) with filled and dashed-empty states, and a summary panel with estimate, power draw, compatibility %, estimated performance rows, an inline error alert, and two CTAs |
| **Checkout** | 3-node numbered stepper; 8/4 split; cart rows with quantity steppers; delivery zone radio cards (Inside Valley NPR 150 / Outside NPR 350); payment radio cards — **Fonepay/QR, Khalti, Bank Transfer, Cash on Delivery**; sticky order summary with VAT 13% line and promo code |
| **Admin** | Fixed 256px sidebar app shell; "Inventory Command" top bar; 4-up metrics bento; inventory table with stock-level bars; regional demand bar chart; recent log events; support FAB |

### C.2 Confirmed design intent

- Dark-only, `#09090B` base, electric blue `#00d1ff` used sparingly as a light source.
- Tonal elevation layering, not drop shadows.
- Monospace (JetBrains Mono) for every spec, code, and label; Geist for headings and prices; Inter for body.
- Tight radii — 4px buttons, 8px cards. Pills reserved for status chips.
- NPR pricing with EMI messaging surfaced at the point of decision.
- Nepal-specific checkout: Valley vs outside-Valley delivery zones, local payment methods, `+977 98XXXXXXXX` phone format, "House No, Street, Ward Number, Nearest Landmark" address model.

### C.3 Traps in the exports — MUST be corrected during implementation

| # | Trap | Correction |
|---|---|---|
| 1 | **The radius scale is remapped.** `rounded-full` is redefined as **12px, not a pill**. Copying markup verbatim silently breaks every avatar, status chip, and progress bar. | Restore `rounded-full: 9999px`; audit every usage; introduce `rounded-2xl` for the 12px cases. |
| 2 | **Base colour conflict.** `DESIGN.md` declares `#09090B`; the token map says `#131315`; Admin and Builder override the body to `#09090B` in raw CSS while other screens use the token. | `--background: #09090B`, `--surface: #131315`. One base. |
| 3 | **Fonts double-keyed** as both `fontFamily` and `fontSize` (`font-headline-lg text-headline-lg`). A Stitch artefact. | Three font variables + semantic typography utilities. |
| 4 | **Three different `.glass-panel` definitions** (0.7/0.8 alpha, 12/20px blur) and four glow classes. | One `--glass-bg` / `--glass-blur`; `shadow-glow` and `shadow-glow-strong`. |
| 5 | **Five different footers, two newsletter designs, three nav heights** (64/72/80px). | One `SiteFooter`, one `NewsletterForm`, one `--nav-h`. |
| 6 | **Currency rendered four different ways:** `Rs. 124,900`, `NPR 445,000`, `NPR 4,85,000` (lakh grouping!), and bare `145,800`. `DESIGN.md` mandates `रु`. | Single `formatNPR()`. Western grouping. `tabular-nums` everywhere. |
| 7 | **No mobile navigation anywhere.** Nav collapses via `hidden md:flex` with no hamburger, drawer, or bottom bar. Admin sidebar has no mobile state. Builder step rail is `hidden lg:flex`. | Mobile nav is a first-class deliverable, not an afterthought. Mobile is the majority of traffic. |
| 8 | **Material Symbols loaded as a webfont** (and linked twice per file). | `lucide-react`. Every glyph used has a direct equivalent. |
| 9 | **Layout bug:** the 64px builder estimate overflows its panel; "145,800" is clipped in the render. | Cap at ~40px, `tabular-nums`, responsive scale. |
| 10 | Inline demo scripts: cursor-follow glow appended to `<body>`, an invalid `button:contains()` selector, `innerHTML` surgery in QUICK ADD, a global `changeStep()`, manual focus-ring class toggling. | All become React state + `focus-visible:` variants. |
| 11 | Placeholder imagery from `lh3.googleusercontent.com/aida-public/...`. | Real photography via `next/image` with an allowlist and blur placeholders. |
| 12 | **Admin copy is jargon-heavy** — "Inventory Command", "SYSTEM ONLINE: KATHMANDU NODE-01", "M-T-D Revenue", "SKU", "Recent Log Events", "Technical Lead". Directly contradicts the Dad Mode requirement. | Full plain-language rewrite. The visual language survives the rename; the wording does not. See `09`. |
| 13 | No sale/strike-through price treatment anywhere, despite the live site running "Save up to 40%" banners. | Compare-at price is a required design addition. |
| 14 | Builder has only 4 slots and no rules UI for physical fit. | Expand to the full slot set defined in `08`. |

### C.4 Screens and states the designs do not cover

The following must be designed during implementation, consistent with the Obsidian Peak system.

**Storefront:** search results + autocomplete + no-results · cart page and mini-cart drawer · auth (login, register, phone OTP, forgot/reset) · account shell (profile, addresses, orders, order detail, invoice) · order confirmation, payment-pending, payment-failed · order tracking · wishlist · compare · saved builds library · builder steps 01/02/04 · component picker drawer · prebuilt catalogue · blog index + post · service booking + status · store locator + branch page · EMI calculator · policy pages · brand hubs · reviews and Q&A UI.

**Admin:** every screen except Inventory — analytics, orders, order detail, product create/edit wizard, compatibility rule editor, media library, coupons, customers, staff roles, service tickets, settings, login.

**Cross-cutting:** mobile navigation (all surfaces) · empty states · loading/skeleton states · optimistic and disabled button states · form validation errors · toasts · modals and confirmations · 404/500 · offline · cookie consent · language switcher · focus-visible rings on every interactive element.

---

## Part D — Competitive context

> **ASSUMPTION:** The competitive set below is based on general market knowledge, not a fresh audit. Validate before finalising the SEO keyword strategy.

Nepali online computer retail is dominated by Daraz (marketplace), plus specialist retailers competing largely on `<product> price in Nepal` queries. Differentiation for City Computer is therefore not price listing — it is:

1. **A working PC builder with real local inventory.** No Nepali retailer offers compatibility-validated configuration against actual in-stock parts.
2. **Physical store trust.** New Road presence, phone-first support, in-store pickup.
3. **Service and repair** as an integrated funnel, not a separate business.
4. **Honest stock and delivery information**, which marketplace listings routinely lack.
