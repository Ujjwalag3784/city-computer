# 04 — Repository Structure

The complete folder layout, module boundaries, and the import rules that keep them enforceable.

**Depends on:** `03`. **Feeds into:** every implementation phase.

---

## 1. Top level

```
citycomputer/
├── .github/
│   ├── workflows/           ci.yml, deploy-staging.yml, deploy-production.yml,
│   │                        security.yml, lighthouse.yml, db-backup-verify.yml
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .vscode/                 settings.json, extensions.json
├── docs/                    ◄── THIS BLUEPRINT. Lives in the repo. Kept current.
│   ├── 00-MASTER-INDEX.md … 19-ASSUMPTIONS-RISKS-DECISIONS.md
│   ├── adr/                 Architecture Decision Records, 0001-*.md onward
│   ├── runbooks/            incident, restore, payment-reconciliation, release
│   └── admin-help/          source of the in-product help content (see 09)
├── prisma/
│   ├── schema.prisma        (or schema/ folder split — see §4)
│   ├── migrations/
│   ├── seed/
│   │   ├── index.ts
│   │   ├── core.ts          settings, branches, roles, delivery zones
│   │   ├── taxonomy.ts      categories, brands, spec templates
│   │   ├── catalog.ts       demo products (dev only)
│   │   ├── builder.ts       component parts + compatibility rules
│   │   └── content.ts       CMS pages, blog posts
│   └── sql/                 hand-written migrations: FTS triggers, indexes, views
├── public/
│   ├── fonts/  icons/  images/  favicon set
│   └── robots.txt is generated, NOT static
├── messages/
│   ├── en.json
│   └── ne.json
├── e2e/                     Playwright specs + fixtures
├── scripts/                 one-off + operational Node scripts
│   ├── import-legacy-wp.ts        WooCommerce migration
│   ├── generate-redirect-map.ts   old URL → new URL
│   ├── import-parts.ts            builder parts CSV/XLSX ingest
│   ├── backfill-search-index.ts
│   └── check-bundle-budget.ts
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── Caddyfile           reverse proxy (VPS path only)
│   └── compose/            postgres, redis, minio, meilisearch, mailpit, caddy
├── docker-compose.yml
├── src/                     ◄── everything else
├── .env.example             every variable, documented, no real values
├── next.config.ts
├── tailwind.config.ts       (thin — tokens live in globals.css @theme)
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.mjs
├── prettier.config.mjs
├── package.json
├── pnpm-lock.yaml
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## 2. `src/` — the application

```
src/
├── app/
│   ├── layout.tsx                      root: html, fonts, providers
│   ├── globals.css                     @theme tokens (Obsidian Peak)
│   ├── not-found.tsx  error.tsx  global-error.tsx
│   ├── manifest.ts  robots.ts  sitemap.ts
│   ├── opengraph-image.tsx             default OG
│   │
│   ├── [locale]/                       next-intl; en unprefixed via middleware
│   │   ├── layout.tsx                  locale provider, direction, hreflang
│   │   │
│   │   ├── (storefront)/
│   │   │   ├── layout.tsx              SiteHeader + SiteFooter + CartDrawer
│   │   │   ├── page.tsx                /
│   │   │   ├── shop/page.tsx
│   │   │   ├── c/[...categorySlug]/    page.tsx, opengraph-image.tsx, loading.tsx
│   │   │   ├── b/[brandSlug]/page.tsx
│   │   │   ├── p/[productSlug]/        page.tsx, opengraph-image.tsx, loading.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   ├── prebuilt/page.tsx
│   │   │   ├── blog/                   page.tsx, [postSlug]/, category/[slug]/
│   │   │   ├── stores/                 page.tsx, [branchSlug]/page.tsx
│   │   │   ├── service/                page.tsx, book/, status/[ticketNumber]/
│   │   │   ├── emi-calculator/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   ├── pages/[slug]/page.tsx
│   │   │   └── track/                  page.tsx, [orderNumber]/page.tsx
│   │   │
│   │   ├── (builder)/
│   │   │   ├── layout.tsx              minimal chrome, no footer
│   │   │   ├── build/page.tsx
│   │   │   └── build/[shortId]/        page.tsx, opengraph-image.tsx
│   │   │
│   │   ├── (checkout)/
│   │   │   ├── layout.tsx              minimal nav, no distractions
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── checkout/payment/[intentId]/page.tsx
│   │   │   └── order/confirmation/[orderNumber]/page.tsx
│   │   │
│   │   ├── (account)/
│   │   │   ├── layout.tsx              auth guard + account nav
│   │   │   └── account/                page.tsx, orders/, addresses/, builds/,
│   │   │                               wishlist/, tickets/, profile/
│   │   │
│   │   └── (auth)/
│   │       ├── layout.tsx
│   │       └── auth/                   login/, register/, verify/, forgot/, reset/
│   │
│   ├── (admin)/
│   │   ├── layout.tsx                  role guard, AdminShell, noindex header
│   │   └── admin/                      dashboard + all modules (see 09 §3)
│   │
│   └── api/
│       ├── v1/
│       │   ├── products/               route.ts, [slug]/route.ts
│       │   ├── categories/  brands/  search/  suggest/
│       │   ├── cart/                   route.ts, items/route.ts
│       │   ├── checkout/               quote/route.ts, place/route.ts
│       │   ├── orders/[orderNumber]/route.ts
│       │   ├── builder/                parts/, validate/, recommend/,
│       │   │                           builds/, builds/[shortId]/
│       │   ├── service/                tickets/, tickets/[number]/
│       │   ├── reviews/  wishlist/  stock-alerts/  newsletter/
│       │   └── admin/                  admin-only endpoints
│       ├── auth/[...nextauth]/route.ts
│       ├── webhooks/
│       │   ├── esewa/route.ts
│       │   ├── khalti/route.ts
│       │   ├── fonepay/route.ts
│       │   └── connectips/route.ts
│       ├── cron/                       reconcile-payments, rollups, sitemaps,
│       │                               abandoned-cart, low-stock, drain-queue
│       ├── revalidate/route.ts         secret-guarded on-demand ISR
│       ├── og/[...params]/route.tsx    dynamic OG images
│       └── health/route.ts             liveness + dependency checks
│
├── components/
│   ├── ui/                  shadcn primitives, restyled to Obsidian Peak
│   ├── layout/              SiteHeader, SiteFooter, MobileNav, Breadcrumbs,
│   │                        LocaleSwitcher, AnnouncementBar
│   ├── commerce/            ProductCard, ProductGrid, PriceBlock, StockBadge,
│   │                        FilterRail, SortSelect, Gallery, VariantSelector,
│   │                        SpecTable, ReviewList, AddToCart, QuantityStepper,
│   │                        CartLineItem, OrderSummaryPanel, OrderStatusTracker,
│   │                        PaymentMethodTile, RadioCard, EmiWidget
│   ├── builder/             ModeSelect, StepRail, BuilderSlotCard, PartPicker,
│   │                        PartRow, CompatibilityPanel, IssueRow, FixDrawer,
│   │                        PowerMeter, BalanceMeter, BuildSummaryPanel,
│   │                        BuildShareDialog, BuildCompare, ExpertTipCard
│   ├── content/             RichText, BlogCard, TableOfContents, FaqAccordion
│   ├── admin/               AdminShell, AdminSidebar, AdminTopBar, DataTable,
│   │                        MetricTile, HelpBubble, GuidedForm, StepIndicator,
│   │                        ImageDropzone, ConfirmDialog, UndoToast,
│   │                        SeoPreview, StockAdjuster, GlobalSearch
│   ├── seo/                 JsonLd, MetaImageTemplate
│   └── analytics/           GtmScript, ConsentBanner, EventBoundary
│
├── server/                  ◄── ALL business logic. Never imported by client code.
│   ├── db.ts                Prisma singleton
│   ├── redis.ts
│   ├── auth/                config.ts, callbacks.ts, permissions.ts, guards.ts
│   ├── services/
│   │   ├── catalog/         product, category, brand, facet, search
│   │   ├── inventory/       stock, reservation, low-stock, movement-log
│   │   ├── cart/
│   │   ├── pricing/         price resolution, coupons, promotions, VAT, shipping
│   │   ├── order/           placement, state machine, fulfilment, invoice
│   │   ├── payment/
│   │   │   ├── index.ts             PaymentService facade
│   │   │   ├── provider.ts          PaymentProvider interface
│   │   │   ├── providers/           esewa.ts, khalti.ts, fonepay.ts,
│   │   │   │                        connectips.ts, bank-transfer.ts, cod.ts
│   │   │   ├── router.ts            value-tiered method availability
│   │   │   └── reconciliation.ts
│   │   ├── builder/
│   │   │   ├── catalog.ts           part querying + faceting
│   │   │   ├── rules/               engine.ts, registry.ts, rules/*.ts
│   │   │   ├── power.ts             consumption + connectors + headroom
│   │   │   ├── fit.ts               physical/dimensional checks
│   │   │   ├── balance.ts           bottleneck + performance estimates
│   │   │   ├── recommend.ts         budget allocation + constraint solving
│   │   │   └── persistence.ts       save, share, revisions
│   │   ├── service-desk/    tickets, state machine, notifications
│   │   ├── content/         blog, pages, menus, homepage sections
│   │   ├── media/           upload, derivative generation, alt-text
│   │   ├── customer/        profile, addresses, wishlist
│   │   ├── notification/    email, SMS, in-admin; template registry
│   │   ├── analytics/       first-party event capture + rollups
│   │   ├── settings/        typed key-value settings
│   │   └── audit/           immutable admin activity log
│   ├── jobs/
│   │   ├── queue.ts         JobQueue abstraction (bullmq | cron-table)
│   │   ├── workers/
│   │   └── definitions/
│   ├── mail/                templates/*.tsx (React Email), send.ts
│   ├── pdf/                 invoice.tsx, quotation.tsx, build-sheet.tsx, label.tsx
│   └── integrations/        ga4-mp.ts, meta-capi.ts, tiktok-events.ts,
│                            meilisearch.ts, sms/
│
├── lib/                     ◄── pure, dependency-light, isomorphic
│   ├── money.ts             paisa arithmetic, formatNPR()
│   ├── slug.ts              slugify incl. Devanagari transliteration
│   ├── date.ts              Asia/Kathmandu helpers (UTC+05:45)
│   ├── nepal.ts             provinces, districts, phone validation
│   ├── ids.ts               order numbers, ticket numbers, build shortIds
│   ├── seo/                 metadata builders, jsonld/*
│   ├── validation/          shared Zod schemas
│   ├── errors.ts            AppError hierarchy + problem-details mapper
│   ├── result.ts            Result<T, E>
│   ├── logger.ts
│   ├── rate-limit.ts
│   ├── cache.ts             cache key registry + tag helpers
│   └── utils.ts             cn(), typed helpers only — no dumping ground
│
├── hooks/                   use-cart, use-builder, use-media-query,
│                            use-debounced-value, use-toast, use-analytics
├── stores/                  cart-store.ts, builder-store.ts (Zustand)
├── types/                   global.d.ts, next-auth.d.ts, domain types
├── config/
│   ├── site.ts              name, urls, socials, contact
│   ├── navigation.ts        fallback nav if DB unavailable
│   ├── spec-templates.ts    category → spec field definitions
│   ├── payment-tiers.ts     order-value → allowed methods
│   └── feature-flags.ts
├── i18n/                    routing.ts, request.ts, navigation.ts
├── middleware.ts            locale, auth guard, security headers, admin allowlist
└── env.ts                   Zod-validated environment
```

---

## 3. Module boundary rules — enforced by ESLint

| Rule | Enforcement |
|---|---|
| `components/**` MUST NOT import from `server/**` | `no-restricted-imports` |
| `lib/**` MUST NOT import from `server/**`, `app/**`, or `components/**` | `no-restricted-imports` |
| `server/services/*` MUST NOT import another service's internals — only its public `index.ts` | path restriction |
| `stores/**` and `hooks/**` MUST NOT import `server/**` | `no-restricted-imports` |
| Only `src/env.ts` may reference `process.env` | `no-restricted-properties` |
| Only `server/db.ts` may instantiate `PrismaClient` | custom rule |
| No business logic in `app/**/page.tsx` — pages orchestrate, services decide | review |
| Every file in `server/**` that touches the DB starts with `import 'server-only'` | review + `server-only` package |

### Dependency direction

```
app/  ──────────►  components/  ──────────►  lib/
  │                     │                      ▲
  │                     └──► hooks/, stores/ ──┘
  │
  └──────────────►  server/services/  ──────►  lib/
                          │
                          ├──► server/db, redis, jobs, mail, pdf
                          └──► server/integrations/
```

Nothing points left. `lib/` is a leaf.

---

## 4. Prisma schema organisation

At >60 models a single `schema.prisma` becomes unworkable. Use Prisma's multi-file schema support:

```
prisma/schema/
├── schema.prisma        datasource, generator, enums shared across files
├── auth.prisma          User, Account, Session, Role, Permission
├── catalog.prisma       Product, Variant, Category, Brand, Media, SpecTemplate
├── inventory.prisma     Branch, StockLevel, StockMovement, Reservation
├── commerce.prisma      Cart, Order, OrderItem, Payment, Shipment, Coupon
├── builder.prisma       ComponentPart, CompatibilityRule, Build, BuildItem
├── content.prisma       Post, Page, Menu, HomeSection, Faq
├── service.prisma       ServiceTicket, TicketEvent
└── ops.prisma           Setting, AuditLog, Job, Redirect, analytics tables
```

---

## 5. Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Files and folders | `kebab-case` | `product-card.tsx`, `stock-movement.ts` |
| React components | `PascalCase`, one per file, named export + default | `ProductCard` |
| Hooks | `use-` prefix | `use-builder.ts` → `useBuilder()` |
| Server services | noun folder, verb functions | `catalog/product.ts` → `getProductBySlug()` |
| Prisma models | `PascalCase` singular | `OrderItem` |
| DB tables | `snake_case` plural via `@@map` | `@@map("order_items")` |
| DB columns | `snake_case` via `@map` | `@map("created_at")` |
| Enums | `PascalCase` type, `SCREAMING_SNAKE` values | `OrderStatus.CONFIRMED` |
| Zod schemas | `xSchema` | `createProductSchema` |
| Types from Zod | `z.infer` alias | `type CreateProductInput` |
| Route handlers | `route.ts`, export `GET`/`POST` | |
| Server Actions | `actions.ts` colocated, `"use server"` at top, verb names | `placeOrder()` |
| Test files | `*.test.ts` colocated; E2E in `e2e/*.spec.ts` | |
| CSS custom properties | `--kebab-case`, semantic not literal | `--surface-container-high` |
| i18n keys | `namespace.section.key` | `pdp.addToCart.label` |
| Cache tags | `entity:id` / `entity:list` | `product:abc123`, `category:list` |
| Env vars | `SCREAMING_SNAKE` | `ESEWA_SECRET` |
| Git branches | `type/short-description` | `feat/pc-builder-power-model` |
| Commits | Conventional Commits | `feat(builder): add PSU connector matching` |

---

## 6. Path aliases

```
@/*            → src/*
@/components/* → src/components/*
@/server/*     → src/server/*
@/lib/*        → src/lib/*
@/hooks/*      → src/hooks/*
@/config/*     → src/config/*
@/types/*      → src/types/*
```

Deep relative imports (`../../../`) beyond one level are a lint error.

---

## 7. Colocation policy

Keep together what changes together:

```
app/[locale]/(storefront)/p/[productSlug]/
├── page.tsx
├── loading.tsx
├── error.tsx
├── opengraph-image.tsx
├── _components/          route-private components (underscore = not a route)
│   ├── buy-box.tsx
│   ├── spec-tabs.tsx
│   └── review-section.tsx
└── actions.ts            server actions used only here
```

A component is promoted to `src/components/` only on its **second** consumer.

---

## 8. Documentation that lives in the repo

| File | Contents | Updated when |
|---|---|---|
| `README.md` | Setup in ≤ 10 commands, scripts table, architecture diagram, links to `docs/` | Any setup change |
| `CONTRIBUTING.md` | Branching, commits, PR checklist, review standards | Process change |
| `SECURITY.md` | Vulnerability disclosure, dependency policy | Annually |
| `CHANGELOG.md` | Keep a Changelog format, generated from Conventional Commits | Every release |
| `docs/adr/*.md` | One ADR per significant decision: context, options, decision, consequences | Any decision that would surprise a new engineer |
| `docs/runbooks/*.md` | Step-by-step operational procedures | After every incident |
| `.env.example` | Every variable with a comment; no real values | Any env change |
| Inline JSDoc | Only on exported service functions and non-obvious algorithms (compatibility rules, power model, price resolution) | With the code |

**Hard rule:** a PR that changes behaviour described in `docs/` and does not update `docs/` is rejected.
