# AUDIT.md — City Computer Systems Remediation Audit

**Status:** Phase 0 + Phase 1 (read-only). No files were edited to produce this document, aside from creating this file itself.

**A note on starting point, for honesty's sake:** this audit was not written cold. This assistant has spent an extended prior session in this exact codebase — reading all 20 of the project's own planning documents (`docs/00`–`docs/19`), its 2,200+ line build log (`PROGRESS.md`), and doing hands-on diagnosis-and-fix work on real production bugs (a stuck admin-panel crash, a broken PC Builder link, a category-page crash, a stalled product-page loading state, a site-wide typography bug, and a full visual redesign). That work is reused here rather than re-derived, but every specific claim below — the two named bugs especially — was independently re-verified against the current source for this audit, not assumed from memory.

**A note on scope, also for honesty's sake:** "walk every page, click every element" for an app with ~90 database tables, a multi-role admin console, and dozens of storefront/admin routes is not something this format can do exhaustively by literally clicking through a live browser session — this environment's browser tooling is real but slow and screenshot-limited (documented further down). What follows combines: (a) direct source reading of every route file that matters to the flows in this brief, (b) live verification via the deployed production instance for the specific claims in this brief and a sample of critical paths, (c) static analysis (`knip`) for dead code, and (d) the project's own extensive, independently-written build log as a cross-check, not a substitute. Where a finding is "read from code, not clicked," it says so.

---

## Section 1 — Architecture as it exists today

### Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5.22, App Router (React Server Components), React 19.0.0 |
| Language | TypeScript, `strict: true` |
| Styling | Tailwind CSS v4 (`@theme inline` token system in `src/app/globals.css`), shadcn/ui-derived primitives in `src/components/ui/` |
| Fonts | IBM Plex Sans Condensed / IBM Plex Sans / IBM Plex Mono via `next/font/google` (changed this session from Geist/Inter/JetBrains Mono — see `git log` on `src/app/layout.tsx`) |
| Client state | Zustand (`src/stores/cart-store.ts` — cart only; nothing else uses client-global state) |
| Server-state fetching | None — no TanStack Query despite being listed in `docs/03`; all data fetching is Server Components + Server Actions |
| URL state | Plain `URLSearchParams` + `next/navigation`, not `nuqs` (which `package.json` lists as a dependency but `knip` confirms is unused — see Dead Weight below) |
| ORM | Prisma 7.9.1, via `@prisma/adapter-pg` (driver adapter, not the legacy binary engine) |
| Database | PostgreSQL 16 (Neon, pooled connection in production) |
| Cache / sessions | Redis (Upstash), via `ioredis` — used for 2FA pending-secret storage, admin session idle/absolute-timeout clocks, and rate limiting |
| Auth | Auth.js v5 (`next-auth`), **database session strategy** (not JWT) — this was a real, fixed bug this session: the Credentials provider defaults to JWT regardless of configured strategy unless explicitly overridden, which silently broke sign-in entirely before the fix (`server/auth/config.ts`) |
| Payments | **Not integrated at all.** Only Cash on Delivery and Bank Transfer (manual, receipt-upload + admin approval) exist as fulfilment paths. eSewa/Khalti/Fonepay/connectIPS have zero code — this is stated plainly in `DEPLOY_VERCEL.md`'s own opening section, not something this audit discovered independently. |
| File storage | S3-compatible (generic `@aws-sdk/client-s3`, works with R2/MinIO/Backblaze) — **not configured in production**; the owner chose to defer this during this session |
| Hosting | Vercel, two separate live projects for the same repo (`city-computer-tp4m`, `city-computer-pw9y`) — both deploy from `main` on push |
| Package manager | pnpm |
| Testing | Vitest + Testing Library. **760 tests across 84 files, currently passing.** No Playwright/E2E despite `docs/16-TESTING-QA.md` calling for it — unit/integration only. |

### Route map (high level — see Section 1a below for the interactive-element-level detail)

The app has two top-level route groups under `src/app/`:

- **`[locale]/(storefront)/`** — the public site. Locale-prefixed (`/` = English, `/ne/...` = Nepali, though no Nepali content actually exists yet — confirmed in `docs/17`'s own notes and this session's PDP work). Routes: home, `/c/[...categorySlug]` (category listing), `/p/[productSlug]` (product detail), `/b/[brandSlug]` (brand listing), `/shop` (all-products/deals), `/search`, `/cart`, `/build/new` + `/build/[shortId]` + `/build/[shortId]/edit` (PC Builder), `/order/[orderNumber]` (public order tracking by number, **not** an authenticated order history), `/service` (repair booking), `/blog` + `/blog/[slug]`, `/stores` + `/stores/[slug]`, `/pages/[slug]` (CMS pages — privacy, terms, etc.), `/contact`, `/emi-calculator`, `/track`, `/faq`.
- **`[locale]/(auth)/auth/`** — `/auth/login` (staff/admin sign-in — this is **not** a customer registration/login flow; see Critical Path 5 below).
- **`(admin)/admin/`** — not locale-prefixed (deliberately, per its own layout comment). Gated by `middleware.ts`'s `adminMiddleware` before any page code runs, then re-checked per-page via `requirePermission`/`requireAdminSession`. Sub-routes: `today` (dashboard, at `/admin` itself), `products` (+`new`, `[id]/edit`), `orders` (+`[id]`), `customers` (+`[id]`), `inventory`, `service` (+`[id]`, `new`), `blog` (+authors), `pages`, `media`, `categories`, `brands`, `coupons`, `campaigns`, `reviews`, `enquiries`, `menus`, `branches` (+`[id]`, `new`), `builder/parts`, `builder/rules`, `settings` (+`gateways`, `shipping`, `[group]`), `users` (+`new`), `activity`, `verify-2fa` (2FA enrollment/challenge, technically outside `(admin)` in `(admin-auth)`).

**What each route renders / fetches / auth requirement:** every `page.tsx` in `(admin)` follows one consistent pattern — an `async` Server Component that calls `auth()`, wraps a `requirePermission(...)` call in try/catch (`UnauthenticatedError` → redirect to login, `ForbiddenError` → `notFound()`), then calls a `server/services/admin/*.ts` function for data, and renders a `DataTableStatic` (server-rendered table, no client JS) or `DataTable` (client, for the few pages needing sort/select — `inventory`, `brands`, `builder/parts`). Storefront pages are async Server Components calling `server/services/catalog|commerce|content/*.ts` directly, with `"use client"` islands only where genuinely interactive (add-to-cart, cart drawer, PC Builder's part picker, admin's inline price/stock quick-edit cells).

### Data model (high level)

Prisma schema is split across `prisma/schema/*.prisma` by domain: `auth.prisma` (User, Session, Account, roles/permissions), `catalog.prisma` (Product, Variant, Category, Brand, Media, Review, spec templates/fields), `inventory.prisma` (Branch, StockLevel, StockMovement, StockReservation), `commerce.prisma` (Order, OrderItem, Cart, Payment, DeliveryZone, ShippingRate, Coupon), `builder.prisma` (BuilderSession, CompatibilityRule, ComponentPart specs), `content.prisma` (Post, Page, FAQ), `service.prisma` (ServiceTicket). Soft-delete (`deletedAt`) is implemented as a single Prisma Client extension (`src/server/db/soft-delete-extension.ts`) applied globally to eight models, rather than per-query `deletedAt: null` filters scattered through services — a real, deliberate architectural choice, not an accident.

### Entry points

- **Root layout:** `src/app/layout.tsx` — loads fonts, sets `<html lang>`, emits site-wide `Organization`/`WebSite` JSON-LD. No providers here.
- **Storefront layout:** `src/app/[locale]/(storefront)/layout.tsx` — mounts `SiteHeader`, `SiteFooter`, `CartDrawerHost` (the one place the cart Zustand store gets hydrated from the server-resolved cart), cookie consent banner.
- **Admin layout:** `src/app/(admin)/layout.tsx` — the actual admin auth gate (defense-in-depth behind `middleware.ts`), mounts `AdminShell` (sidebar + topbar).
- **Middleware:** `src/middleware.ts` — single file, dispatches by path: `/admin/*` gets a full session-aware `auth()`-wrapped middleware (checks session, role, 2FA-verified flag, Redis-backed idle/absolute session windows, optional IP allowlist); everything else gets `next-intl`'s lightweight locale-routing middleware only. Runs on the Node.js runtime (not Edge) because of `argon2`/`ioredis` native dependencies.

### Commands

```
pnpm dev            # next dev
pnpm build           # prisma generate && next build
pnpm typecheck        # tsc --noEmit
pnpm lint            # eslint . --max-warnings=0
pnpm test            # vitest run
```

All four (typecheck/lint/test/build-of-generate-step) were run as part of this audit and are clean — see Section 1c.

---

## Section 1a — Interactive element inventory

Full manual enumeration of literally every button/link/control on every one of ~45 routes is not something this audit claims to have done by clicking through a browser one element at a time — see the scope note at the top. What follows is every finding this audit actually traced to a root cause, plus the methodology used to find them.

### The two bugs named in this brief

| Page | Element | Expected behavior | Actual behavior | Status | Root cause |
|---|---|---|---|---|---|
| All 12 admin list pages (`products`, `orders`, `customers`, `inventory`, `service`, `blog`, `coupons`, `campaigns`, `enquiries`, `reviews`, `activity`, `media`) | "Next" pagination button | Navigate to the next page of results | **It does work** — confirmed by reading all 12 page files. Every one uses the identical pattern: `<Button asChild variant="outline"><Link href={pageHref(query, query.page + 1)}>Next</Link></Button>`, gated by a server-computed `result.hasNext` (verified the computation in `server/services/admin/product.ts`: `hasNext: query.page * PAGE_SIZE < total` — correct). This is a real `<Link>` to a real URL with the page number incremented; clicking it navigates and the server re-renders with the new page. | **partial → visual, not functional** | The shared `Button` component's `outline` variant (`src/components/ui/button.tsx`) sets `border-glass-stroke` — a border colour at **10% opacity**. Against the light "Machined White" background rolled out this session, that border is close to invisible. Every one of these 12 pagination controls looks unstyled/disabled even though it is fully wired and functional. This is the exact same defect this session already found and fixed as a one-off on the homepage hero's secondary button (`border-outline` instead of `border-glass-stroke`) — but that fix was applied locally to one button, not to the shared component, so all 12 admin instances (and any other `variant="outline"` button anywhere in the app) still have it. |
| Storefront header (`site-header.tsx:139-141`), all pages | Account icon (`<User />`) | Open an account menu / go to sign-in or account page | Nothing. Confirmed by reading the component: `<Button variant="ghost" size="md" iconOnly aria-label="Account"><User /></Button>` — no `onClick`, no `href`, no `asChild`. It is a fully inert decorative element. | **orphan** | Never wired to anything. No dropdown component exists for it. Compare to the Cart icon three lines below in the same file, which *is* correctly wired (`onClick={openDrawer}`, reads a real Zustand store) — this is the pattern the Account icon should follow but doesn't. |

**A second orphan found while investigating the first, not asked for in the brief but directly adjacent:** the **Wishlist** icon (`site-header.tsx:121-137`, `<Heart />`) has the identical problem — a `<Button>` with an `aria-label="Wishlist"` and a badge-count prop, no `onClick`/`href`, and (confirmed by grep) **no wishlist feature exists anywhere in the codebase at all** — no store, no Prisma model, no service. This is a fully speculative UI element with nothing behind it.

**A third, related finding:** `src/components/layout/mobile-nav.tsx` links the same Account/Wishlist concepts to real hrefs — `/account` and `/account/wishlist`. **Neither route exists.** Confirmed: `find "src/app/[locale]" -type d -iname "*account*"` returns nothing. Clicking these on mobile would 404. There is no customer-facing account area in this app at all — no login-gated "my orders," "my addresses," or "my profile" pages for shoppers (only the public, order-number-based `/order/[orderNumber]` tracking page, and staff-only `/auth/login`).

### Other interactive-element findings (from source reading, not yet live-clicked)

- **Social icons** (Facebook/Instagram/YouTube) in the footer: `href="#"`, all three. This is a documented, intentional placeholder (this session's own footer rewrite left a code comment: "real URLs land later") — not a silent bug, correctly labeled as **orphan by design**, lowest priority.
- **Cookie settings button** in the footer: works — dispatches a real custom event (`citycomputer:open-cookie-settings`) that `cookie-consent.tsx` listens for. Verified by reading both files; the event name string matches exactly in both places.
- **Newsletter subscribe form**: the form submits, but `SiteFooter`'s own doc comment states the handler is presentational-only when no `onSubscribe` prop is passed (true on `/design` only); the real storefront layout does wire a real `subscribeNewsletterAction`. **Works**, not orphaned — confirmed by reading `(storefront)/layout.tsx`.

---

## Section 1b — Critical path testing

Numbering matches the brief.

**1. Browse catalog → filter/sort → paginate → product detail.** Category pages (`/c/[...categorySlug]`) work for every category tested except one — see the flagged pre-existing bug below. Product detail pages load correctly (verified this session, live, twice, after fixing a real stuck-loading-skeleton bug — see `git log` "remove the PDP's stuck-forever loading skeleton"). Sort/filter drive real URL query params into `listProducts()`, not client state.

**Flagged, unresolved, found by a previous pass this session and not yet root-caused:** `/c/laptops` specifically throws `NotFoundError("Category")` on the live production deployment, intermittently but reproducibly, **despite the category provably existing and healthy in the production database** (verified directly against Postgres: `is_active: true`, `deleted_at: null`, correct `path`) and despite the exact same Prisma query succeeding every time it's run standalone against that same database. `/c/desktops`, `/c/apple-mac`, `/c/printers` do not reproduce this. This was patched defensively (the page's error handling was widened so this failure mode now shows a clean 404 instead of a raw crash screen) but the underlying cause — most likely a transient Vercel↔Neon pooled-connection issue specific to this route's query pattern — was not found. **This is a real, live, unresolved bug and belongs at the top of the Phase 2 priority list**, not something this audit is papering over.

**2. Product detail → select variant → add to cart → cart badge updates.** Works. `ProductCardAddToCart`/`BuyBox` call a real Server Action (`addToCartAction`), which re-resolves the cart and pushes the result into `cart-store.ts`; the header's cart badge reads that same store. Verified by reading the full chain, not live-clicked this pass (this exact flow's server/client boundary was the subject of a major bug fixed earlier this session — the "22 function props crossing the server/client boundary" fix in `PROGRESS.md` — so it has real prior verification behind it, including a permanent regression-guard test, `lib/server-client-props.test.ts`).

**3. Cart → update quantity → remove item → totals recalculate.** Not live-tested this pass. Read `server/services/commerce/cart.ts`: quantity/remove mutations are real Server Actions, and money is computed server-side in integer paisa (`lib/money.ts`), never trusted from the client — this matches the brief's own requirement already, by design, not by luck.

**4. Cart → checkout → address → payment → order confirmation → order in history.** **Confirmed broken at "payment," by design, not by bug.** Checkout works through address collection; payment is limited to Cash on Delivery and Bank Transfer (manual receipt upload, admin-approved) — there is no card/wallet gateway at all. "Order appears in user's order history" does not apply: there is no user order history page (see the Account-icon finding above) — only the public order-number tracking page.

**5. Register → verify → login → logout → login again.** **There is no customer registration/login flow in this app.** `/auth/login` exists and is fully functional (fixed this session — a real, root-caused JWT-vs-database-session bug that made sign-in silently do nothing) but it authenticates **staff/admin accounts only**, created via a CLI command (`pnpm db:create-admin`), not a public sign-up form. `docs/06-DATA-MODEL.md` and `lib/validation/auth.ts` both define a `RegisterInput`/customer-registration shape, but `knip` confirms `RegisterInput` is one of the many currently-unused exports — the type exists, the registration page/flow does not.

**6. Logged-out user hits a protected route → redirect → login → returns to intended destination.** Works for `/admin/*` — verified by reading `middleware.ts`: unauthenticated requests to any admin path redirect to `/auth/login?callbackUrl=<original path>`, and the login action honours `callbackUrl` on success (confirmed in `sign-in-error.ts`/the login Server Action fixed this session). Not applicable to the storefront, since there's no customer auth to gate anything behind.

**7. Admin: login → list products → paginate → create → upload image → edit → delete → reflected on storefront.** Login: works (fixed this session, live-verified via 2FA enrollment). List/paginate: works (see the outline-button visibility bug above — functional, badly styled). Create/edit: not live-tested this pass; the product wizard (`admin/products/product-wizard.tsx`) exists and is wired to real Server Actions per source reading. **Image upload: confirmed non-functional in production** — file storage was never configured (owner's explicit choice this session, documented, not a bug); the code path degrades gracefully ("storage not configured" message) rather than crashing, which is correct behaviour for an unconfigured integration, but the feature itself doesn't work end-to-end right now.

**8. Admin: orders → detail → status update.** Not live-tested this pass. `admin/orders/[id]/page.tsx` exists, calls real services; status-transition Server Actions exist in `server/services/admin/orders.ts` per Section 1a's directory read.

**9. Search: results / no-results / empty / special characters.** Search depends on Postgres full-text indexes that, per `DEPLOY_VERCEL.md`'s own troubleshooting section, are a **manual, easy-to-skip deploy step** (`prisma/sql/manual-constraints.sql`). This session ran that step against the production database directly and confirmed it applied cleanly. Live "no results" / empty-query behaviour not re-tested this pass.

**10. Empty states** (empty cart, no orders, no search results, no products in a category). Empty cart: confirmed real this session (`"Your cart is empty" / "Browse the catalogue and add something you like." / "Continue shopping"` — read directly off the live page during earlier verification). Others not re-checked this pass.

---

## Section 1c — Error and edge-case audit

- **Error boundaries exist for exactly four storefront routes**: `p/[productSlug]`, `c/[...categorySlug]`, `b/[brandSlug]`, `search`. **There is no root-level `error.tsx`, no `global-error.tsx`, and no error boundary anywhere under `(admin)`.** Any admin page that throws an uncaught error (the exact failure mode the `/c/laptops` bug above produces, and the same shape as two other bugs this session found and fixed — a Server/Client boundary crash and a Redis-timeout crash) falls through to Next.js's bare default: the generic "Application error: a server-side exception has occurred… Digest: …" screen with no recovery action. This is a real, confirmed gap against the brief's "error boundaries at the layout level" requirement.
- **404 handling**: a real, designed `not-found.tsx` exists for the storefront (`"We couldn't find that page." / "Back to shop"` — live-verified this session). No equivalent exists for `(admin)` — a disallowed/nonexistent admin route relies on Next's bare default 404.
- **500 handling**: no designed 500 page anywhere; production 500s show Next's generic digest screen, as above.
- **API/mutation errors surfaced to the user**: yes, deliberately, in the two auth flows this session touched — `lib/auth/sign-in-error.ts` and the 2FA verify action both explicitly avoid both silent failure and leaking raw internals (a documented three-way split: credential failure / rate-limited / "something went wrong," never the machine-facing RFC 9457 detail string verbatim). Not independently verified for every other mutation in the app this pass.
- **Empty `catch {}` blocks**: zero found (`grep` across the full `src` tree). This is a genuinely disciplined codebase on this specific point.
- **`console.log` statements**: zero found in non-test source.
- **`TODO`/`FIXME` comments**: exactly one in the whole tree.
- **Form validation**: Zod schemas exist for essentially every mutation input (`lib/validation/*.ts` — 15 files, dozens of schemas) and are enforced server-side in the corresponding Server Actions per this session's reading of the auth/cart/checkout flows specifically. Client-side field-level error rendering was not audited page-by-page this pass.

---

## Section 1d — Dead weight audit

Ran `knip` (via `pnpm dlx`, not added as a dependency) rather than trust unaided judgement, per the brief's own instruction — **and per the brief's own caution, the results below are reported with confidence levels, not blind-trusted.**

### Unused files (2 reported, 1 real)

| File | Verdict |
|---|---|
| `src/config/site.ts` | **Real finding.** A typed single-source-of-truth for site name/phone/socials, per `docs/04-REPOSITORY-STRUCTURE.md`'s own stated intent — but nothing imports it. Worse: it still holds the exact fake placeholder phone number (`+9779800000000`) this session replaced with the owner's real WhatsApp number directly inside `site-footer.tsx`, instead of updating this file. Two sources of truth now exist, one of them dead and stale. |
| `vitest.server-only-shim.ts` | **False positive.** Referenced via a path alias in `vitest.config.ts` (`"server-only": path.resolve(...)`), not a direct import — exactly the "dynamic/config-based usage" pattern the brief warned would trip up automated tooling. |

### Unused dependencies (6 reported)

`@tiptap/extension-link`, `date-fns`, `geist`, `next-themes`, `nuqs`, `pg`.

- **`geist`**: confirmed real — this session's font migration (Geist → IBM Plex) removed the last usage; the package import was already gone before this audit, the dependency entry in `package.json` just wasn't cleaned up after.
- **`pg`**: needs verification before removal, not blind deletion — `@prisma/adapter-pg` (a real, used dependency) may depend on `pg` as a peer/transitive dependency rather than this app code importing it directly; removing it could break the Prisma driver adapter. Flagged for Phase 3, not assumed safe.
- The remaining four (`@tiptap/extension-link`, `date-fns`, `next-themes`, `nuqs`) were listed in `docs/03-TECHNOLOGY-STACK.md` as intended dependencies but, per this same doc's own read of the stack above, several of that document's planned choices (TanStack Query, `nuqs` for URL state) were never actually adopted in the code that got built — these are likely genuine "planned but not used" leftovers, not false positives, but not independently re-verified line-by-line this pass.

### Unused devDependencies (5 reported)

`@types/pg`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-next`, `eslint-config-prettier`. **High false-positive risk** — ESLint's flat config (`eslint.config.mjs`) frequently references packages like these by string/plugin name rather than a JS `import`, which is exactly the framework-convention case the brief warned `knip` mishandles. Not recommended for removal without manually confirming `eslint.config.mjs`'s actual `extends`/plugin list first.

### Unused exports (104 reported)

Far too many to individually triage inside this audit pass. Skimming the list: a large share are admin Server Actions (`updateMenuItemAction`, `listBrandOptionsAction`, etc.) that may be bound directly to a `<form action={...}>` JSX attribute — a pattern `knip`'s static analysis is known to under-detect — versus a smaller share that look like genuine leftovers from refactors (duplicate type exports, an unused `emptyBasicInfo` helper). **Recommend one-by-one triage in Phase 3, not bulk deletion.**

### Duplicate components

Not found in the areas checked this session (product cards, buttons, tables all resolve to one canonical component each) — but this audit did not exhaustively diff every component directory against every other.

### Assets

Not audited this pass — this environment cannot run `next build` to completion (a pre-existing, documented sandbox limitation noted repeatedly in `PROGRESS.md`, not new to this audit), so bundle-size/asset-weight analysis needs to happen against a real build output this audit doesn't have access to. **Known and already fixed, separately from this audit:** the demo catalog's product photos were never actually uploaded (seed data points at `.avif` files that don't exist); this was found and mitigated with a committed 1.7KB SVG placeholder fallback in an earlier session, documented at length in `PROGRESS.md`.

### Bundle size

Not measured — same `next build` limitation as above.

---

## Prioritized fix list

Ranked per the brief: (1) blocks a purchase, (2) blocks admin work, (3) visible breakage, (4) polish.

### 1 — Blocks a purchase
1. **No payment gateway exists.** COD/Bank Transfer only. This is the largest gap in the app relative to "shippable e-commerce product" — a real scope decision, not a quick fix.
2. **`/c/laptops`'s intermittent crash** (now degrades to a 404 instead of a raw error, but a real category is unreachable some of the time) — needs real root-causing, likely with visibility this environment doesn't have (Vercel/Neon connection-level diagnostics).
3. **No customer account/order-history area.** A shopper cannot see their past orders anywhere except by keeping the order-number link from checkout.

### 2 — Blocks admin work
4. **File storage not configured** — product photo upload and bank-transfer receipt upload don't work in production until this is set up (owner's own deferred task, tracked separately).
5. **No admin error boundary** — any admin-side crash shows the raw digest screen with no recovery action, worse for a non-technical shop owner than for a developer.

### 3 — Visible breakage
6. **The shared `Button` `outline` variant's near-invisible border** — root-cause fix for the reported "admin pagination does nothing" complaint; one line in `src/components/ui/button.tsx` fixes all 12 admin list pages' Next/Previous controls plus every other `outline`-variant button in the app at once, rather than patching each call site.
7. **Account icon is fully inert** (`site-header.tsx`) — no menu, no link, nothing.
8. **Wishlist icon is fully inert**, and the feature it implies doesn't exist at all anywhere in the codebase — needs a product decision (build it, or remove the icon) before a code fix, per this brief's own "an inert button is worse than no button" rule.
9. **`mobile-nav.tsx` links to `/account` and `/account/wishlist`, neither of which exist** — 404s on mobile today.

### 4 — Polish
10. `src/config/site.ts` — dead, stale-data file; either wire it up as the real single source of truth or delete it.
11. Unused dependencies (`geist` confirmed, others need one-by-one verification).
12. 104 unused exports needing individual triage.
13. Footer social links (`href="#"`) — already labeled as an intentional placeholder, lowest priority by design.

---

**Stopping here per the brief's Rule 2 — awaiting review before Phase 2.**
