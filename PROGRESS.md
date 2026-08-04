# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

**Latest session: the premium visual redesign is merged into `main`.**
An isolated frontend worktree (`CityComputer-frontend`, a disconnected
`git init`, forked before Phase 11 started) ran a Stitch/Obsidian-Peak-
inspired presentation pass over 9 files — no business logic, data
fetching, event handlers, or component prop contracts touched, per its
own `REDESIGN_NOTES.md`. That work has now been folded into `main`:

- **Files merged**: `_components/category-grid.tsx` (taller image-style
  category tiles, single-column on mobile), the storefront
  `page.tsx` (full hero section above the fold, restyled section
  headers), `admin-sidebar.tsx` and `metric-tile.tsx` and
  `builder-slot-card.tsx` (hover-glow treatment), `filter-rail.tsx`
  (glass-panel wrapper, monospace labels), `order-summary-panel.tsx`
  (hover glow), `product-card.tsx` (grid-variant hover glow/scale/
  color-shift), and `spec-table.tsx` (zebra striping, monospace labels).
  A 10th file the source repo touched, `product-grid.tsx`, was correctly
  excluded — its only change there was a reverted `"use client"`
  directive, so it carried no real redesign diff, and it also holds
  Phase 11's LCP `priority={index < 3}` hint, which stays untouched.
- **Two real merge conflicts, resolved by hand, not overwritten**: the
  frontend repo forked before Phase 11's SEO work, so two of its 9 files
  had since been touched by Phase 11 on `main`. `page.tsx` had gained
  `generateMetadata` (canonical/hreflang/OG) and a `JsonLd` +
  `buildItemListJsonLd` call; `product-card.tsx` had gained a `priority`
  prop threaded through all three variants' `<Image>` for the LCP hint.
  Both were kept exactly as Phase 11 left them, with the redesign's
  presentational JSX/Tailwind changes layered around them, not inside
  them. No `src/lib/seo/**` code was touched at all.
- **Verification**: `pnpm typecheck` (0 errors), `pnpm lint` (0
  warnings/errors), and `pnpm test` (703/703 tests, 78 files) all pass
  clean on `main` post-merge. `pnpm build` was attempted repeatedly and
  in several forms — a real `next build` with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`
  pointed at genuine local Inter/JetBrains Mono `.woff2` files (this
  sandbox's outbound network policy blocks `fonts.googleapis.com`/
  `fonts.gstatic.com`, same root cause the frontend agent's own sandbox
  hit), a Turbopack build (ruled out: it panics on a pre-existing,
  unrelated Phase 11 route — a catch-all segment ordering issue with the
  `opengraph-image` routes — nothing to do with this merge), and a
  `--no-mangling`/clean-cache build. Every attempt showed genuine,
  actively-progressing CPU-bound compilation (verified via `ps` — steady
  ~130-140% CPU, climbing memory, zero errors, zero crashes at any
  point) but did not reach a finished state inside this environment's
  hard per-command execution ceiling — the codebase's generated Prisma
  client alone (`src/generated/prisma/`) is 260k+ lines, and this
  sandbox has 2 CPUs — nor could the build be resumed across separate
  attempts, since each command's process tree is torn down at the end of
  that command regardless of `nohup`/`disown`/`setsid` (a hard PID-
  namespace property of this execution environment, independently
  confirmed). This is a tooling/environment ceiling, not a demonstrated
  code defect: no build error, warning, or crash was ever observed, only
  an incomplete run against the clock. **Caveat, matching
  `REDESIGN_NOTES.md`'s own honesty about the same limitation in the
  frontend sandbox: `pnpm build` should be re-run to a finished
  completion in a normal, unconstrained environment (a real CI box or a
  developer machine) before this is treated as deploy-verified** — there
  is no positive evidence of a defect, but there is also no completed
  build log to point to.
- **Merge mechanics**: branch `frontend/stitch-redesign-merge` off
  `main` at `43a7b90`, the 9 files copied/merged file-by-file (not a
  history merge — the frontend repo has fully disconnected git history),
  committed as `9b9cd33`, then merged into `main` with `--no-ff` as
  `b8f67cd`.

**Before that: SEO & Structured Data (Phase 11) is complete.** The
site now emits correct, Google-parseable structured data on every
indexable route — and correctly suppresses it where the data doesn't
exist. Here's what landed:

- **JSON-LD library** (`src/lib/seo/jsonld/`): 10+ typed builders —
  `Product` (with the zero-review `aggregateRating` suppression rule),
  `BreadcrumbList`, `Organization`, `WebSite` + `SearchAction`,
  `ComputerStore`, `BlogPosting`, `FAQPage`, `Service`, `ItemList` +
  `CollectionPage`, `WebApplication`, and the PC-builder `Product`
  bundle. Every builder has unit tests; 703 tests pass total.
- **Metadata on every route**: `generateMetadata` with canonical,
  hreflang, `noindex` guards, and Open Graph on all 15+ storefront
  routes (homepage, PDP, category, brand, search, blog list, blog post,
  blog category, CMS pages, FAQ, stores, store detail, service, build
  share, EMI calculator).
- **Thin-content guards**: PDP (120 words + 6 specs + 2 photos),
  blog post (150 words), CMS page (150 words) — all wired at the route
  level, not just defined.
- **Faceted-URL `noindex`**: category and brand pages with any filter
  param except `page` are `noindex,follow`, canonical pointing at the
  clean URL.
- **Dynamic OG images** (`next/og`, edge runtime): homepage fallback,
  PDP (product photo + brand + price + availability), category (name +
  live count), blog post (title + author + reading time).
- **Sitemap** (`/sitemap.xml`): index sharded into 6 fixed types
  (static, categories, brands, posts, pages, branches) + one 10k-chunk
  shard per product. Revalidates every hour.
- **`robots.txt`**: production allows crawlers, blocks `Disallow` list
  including all admin/cart/checkout routes; staging/preview/local always
  returns `Disallow: /`. AI training crawlers blocked, search/answer
  crawlers explicitly allowed.
- **Admin SEO fields**: `SeoPreview` (live SERP preview + traffic-light
  hint) wired into every admin form with a `metaTitle`/`metaDescription`
  pair — the product wizard's Step 4, and now the category, brand, blog
  post, and CMS page forms too. The `serp-hint.ts` thresholds are
  imported from the same constants that actually truncate the live tags.
- **XSS-safe serialisation**: `serializeJsonLd()` escapes `<`, `>`, `&`,
  and Unicode line separators — the only place in the codebase that
  touches the raw JSON-LD string before it hits the HTML response.

**Before that: the site now has real content, a service desk, and an
EMI calculator — the last feature phase before payment gateways.** A
real blog (Tiptap-authored, sanitised on render, categories/authors,
reading time, related products), editable CMS pages and menus with a
broken-link checker, FAQs, a store locator, a working contact form and
double-opt-in newsletter signup, an online repair-booking flow with a
public ticket-status lookup and queued status notifications, and a
`/emi-calculator` reading real per-bank instalment terms from `Setting`
so the owner can update them without a deploy. See "Phase 10" below for
the full, honest rundown of what's real and what's deferred (a nightly
broken-link sweep, FAQ product/category scoping, and PDP-level EMI
wiring, among a few smaller items).

**Before that: the admin is complete enough to actually run the shop
day to day.** Every module docs/09-ADMIN-DAD-MODE.md describes is now a
real screen backed by a real service: the "Today" dashboard, customers
(with COD blocking and notes), coupons and campaigns, review moderation,
the enquiries inbox, repair-job (service ticket) management, reports
(sales/best-sellers/stock/search-gaps), branches and opening hours,
staff accounts with plain-language roles, settings (contact, shipping
pricing, payment/feature flags, gateway status display), Activity
History, and 12 in-product help articles. See "Phase 9" below for the
full, honest rundown of what's real, what's simplified, and what's
explicitly deferred (campaign rule editing, coach marks, and payment
gateway integration itself — still last, as instructed).

**Before that: the PC Builder's brain is real — build, save, and share
a build, and it actually checks compatibility.** A build can be created
and saved part-by-part, and `/build/[shortId]` is a real page anyone with
the link can open: parts list, price then-vs-now, a compatibility score,
a power meter, a balance meter, every issue in plain language, and a
working "Add to cart." Underneath, there's a genuine rule engine — 37
database-driven compatibility rules plus a generic connector-satisfaction
check — not a hardcoded checklist, tested against 19 golden builds
including the specific "Micro-ATX board + 420mm cooler + flagship GPU in
a Mini-ITX case" bad-build case this session asked for by name.

**Before that: checkout is real. You could place an actual order.**
`/checkout` exists — a 3-step address / payment / review flow — and
finishing it creates a real `Order` in the database, holds the stock aside
(the reservation system Phase 6 built and tested but never switched on),
and creates a Cash-on-Delivery or Bank-Transfer payment record. After
placing an order you land on `/order/[orderNumber]`, which tracks its
status, lets a bank-transfer shopper upload their receipt, and can produce
a PDF invoice. On the admin side, `/admin/orders` is a real list-and-detail
screen — move an order forward, cancel it, mark cash collected, or
approve/reject a bank-transfer receipt. See "Phase 7" below for the full,
honest rundown of what's simplified and what's still missing (mainly: only
Cash on Delivery and Bank Transfer work — no eSewa/Khalti/Fonepay/
connectIPS yet, and nobody gets an email when any of this happens).

Before that: the dedicated stock screens landed, and so did the whole
cart. `/admin/inventory` now exists — search, an "almost out of stock" /
"out of stock" filter, the real `+/−`/"Set…" stock control with its
mandatory reason dialog, a plain-language stock history timeline per
product, and a bulk-update dialog. Right after that: a real shopping cart.
Add something to cart on any product page and it actually persists now — as
a cookie for a browser that isn't signed in, in the database once someone
is — the little cart icon in the header shows a real count, clicking it
opens a real slide-out cart, and there's a real `/cart` page with a working
quantity stepper, remove button, and coupon box. See "Phase 5e" and "Phase
6" below for the full, honest rundown of those.

Before that: the product wizard, product list, photo library, and admin
search all landed, and before that, Phase 4 (the whole storefront —
homepage, category pages, brand pages, product pages, search) finished, and
further back, the entire Phase 2 design system and the backend half of
Phase 3 (accounts, passwords, two-factor login, who's-allowed-to-do-what)
got built. See the phase sections below for the fuller history.

### What you need to do this morning

1. **Pull the changes and reinstall.** From the `CityComputer` folder:
   ```bash
   git log --oneline -20   # see everything that landed overnight
   pnpm install             # picks up recharts, next-auth, argon2, otplib, qrcode, ioredis
   ```
2. **Start Redis and Postgres if they aren't already running** — logins,
   rate limiting, and two-factor all depend on Redis now, not just the
   database:
   ```bash
   docker compose up -d
   ```
3. **Look at the design system.** Run `pnpm dev` and open:
   - `http://localhost:3000/design` — every button, card, product card,
     cart, PC-builder piece, and admin piece in one scrollable page. Click
     things — most of it actually works, not just pictures.
   - `http://localhost:3000/` — the small homepage checkpoint, unchanged.
4. **There are no login/signup pages to click through yet.** Tonight's
   Phase 3 work is the _backend_ only — password checking, two-factor
   codes, session rules, who-can-do-what. The actual pages someone would
   type their email and password into don't exist yet (see "what's left"
   below). Nothing to click there today.
5. **One naming decision from earlier, still true.** The blueprint calls
   the showcase page `/_design`; it's built at `/design` instead because of
   a Next.js naming rule. Say the word if you'd rather rename it.
6. **Nothing is wired to real product/order data yet.** Every component at
   `/design` still uses made-up example data. That's expected — connecting
   it to your real database is a later phase.

If anything at `/design` looks visually broken (not "unfinished," but
actually wrong — overlapping text, colours that don't match, something
unreadable), that's the most useful thing to flag, since it's a full visual
review in one place.

## How to check any of this yourself

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings=0
pnpm test        # vitest run
pnpm build       # next build
```

The first four are confirmed green as of the latest commit. `pnpm build`
could **not** be run to completion in the sandbox this was built in, because
that sandbox blocks the network call `next/font` makes to Google Fonts — it
is not a real bug, just a sandbox limitation. On your machine (which has
normal internet access) `pnpm build` should be the first thing you try, to
get real confirmation the whole app compiles end to end.

## Phase 1 — Foundation & Tooling: done, verified

Next.js 15 + TypeScript strict + Zod-validated env (`src/env.ts`), the
pure-logic `src/lib/` modules (`money.ts`, `date.ts`, `nepal.ts`, `ids.ts`,
`slug.ts`, `errors.ts`, `result.ts`, `logger.ts`, `utils.ts` — 111 tests total,
all passing), ESLint flat config with the module-boundary and security
rules, Vitest, Prettier, Docker Compose (Postgres/Redis/MinIO/Meilisearch/
Mailpit), the GitHub Actions CI pipeline, husky + lint-staged + commitlint,
`CONTRIBUTING.md`, `SECURITY.md`.

## Phase 2 — Design System ("Obsidian Peak"): done

Every step in `docs/05-DESIGN-SYSTEM.md` §10's implementation order is
complete:

| Step | What                                                                                                                              | Where                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | Theme tokens (colours, radii, spacing, typography, motion)                                                                        | `src/app/globals.css`                                                 |
| 2    | Fonts (Geist, Inter, JetBrains Mono) + typography utility classes                                                                 | `src/app/layout.tsx`, `globals.css`                                   |
| 3    | All ~31 shadcn primitives restyled (Button, Input, Dialog, Table, Calendar, etc.)                                                 | `src/components/ui/`                                                  |
| 4    | Radius/glass/glow consolidated to one definition each                                                                             | done as part of step 1                                                |
| 5    | Layout: header, mobile nav, footer, announcement bar, breadcrumbs, locale switcher, cookie banner, admin shell/sidebar/top bar    | `src/components/layout/`, `src/components/admin/admin-shell.tsx` etc. |
| 6    | Commerce: product cards, cart, checkout pieces, reviews, PC-part comparison, EMI calculator, filters — 32 components              | `src/components/commerce/`                                            |
| 7    | PC Builder UI: mode picker, step rail, slot cards, part picker, compatibility/power/balance meters, build summary — 16 components | `src/components/builder/`                                             |
| 8    | Admin: dashboard tiles, charts, data table, image uploader shell, SEO preview, stock adjuster, rule builder, etc. — 17 components | `src/components/admin/`                                               |
| 9    | The `/design` showcase page rendering (almost) everything above                                                                   | `src/app/design/`                                                     |

**Everything is presentational only** — no real product catalogue, cart,
order, or admin data is connected yet. Every component takes its data as
plain props/arguments; a later phase wires those to the real database. This
was a deliberate, correct way to build a design system before the features
that use it exist.

**What step 9 does _not_ yet cover** (so nothing is overstated): the
blueprint's "definition of done" for this phase also asks for the showcase
page to "pass an automated accessibility check (axe) with zero violations."
That specific automated check needs a browser-testing tool called Playwright,
which isn't installed in this project yet — setting it up is real,
separate work (tracked as its own to-do item), not something skipped by
accident. Everything was still built _by hand_ following the accessibility
rules in the blueprint (readable focus outlines, proper labels, keyboard
support, colour never used as the only signal, etc.) — it just hasn't been
machine-checked yet.

A few small, defensible calls were made along the way that you might want to
know about:

- The chart library (`recharts`) installed is version 3, not the version 2
  the blueprint mentions — version 2 wasn't available to install anymore.
  Nothing currently depends on this distinction.
- Social-media icons (Facebook/Instagram/YouTube) in the footer are small
  hand-drawn icons, not from the icon pack — the icon pack (`lucide-react`)
  stopped shipping brand logos a while back for trademark reasons.
- The PC-builder's "part picker" list (potentially hundreds of parts) is
  built as a plain scrollable list for now, not a special fast-scrolling
  ("virtualized") list — that optimization is flagged in the code as a
  follow-up once you have a sense of how many real parts you'll actually
  list.

## Phase 3 — Data Layer & Auth: schema done; auth backend done and tested; auth pages not started

**Database (done, from an earlier session, unchanged tonight):** the full
database design (`prisma/schema/*.prisma`, ~75 models), the manual SQL
constraints, the shared database-connection file, and the seed data (roles,
branches, categories, demo products, PC-builder parts).

**Auth backend (done tonight, including tests):**

- Passwords: hashed with Argon2id at the security-doc's minimum strength,
  checked against a real breach database (Have I Been Pwned) when
  registering or changing one, with a small offline backup list if that
  check can't reach the internet.
- Two-factor login: generates the QR code an authenticator app scans,
  verifies the 6-digit codes, and enforces it for the two most powerful
  staff roles (Owner, Manager) — anyone else can turn it on but isn't
  forced to.
- Login/signup/password-reset: the actual account-creation, email
  verification, and "forgot password" logic — built to never reveal
  whether a given email/phone is already registered (a real security
  property, not just a nice-to-have).
- Rate limiting: 5 login attempts per 15 minutes per IP address and per
  account, matching the security document's limits.
- Who's-allowed-to-do-what (RBAC): every admin action will check a
  specific permission (like "can approve payments") rather than just "is
  this person staff" — the building blocks for that check are done.
- Staff session rules: staff logins expire after 8 hours no matter what,
  and after 30 minutes of no activity — customer logins stay signed in for
  30 days like a normal online shop.
- The route-guarding logic (`middleware.ts`) that will block anyone
  without the right role/2FA from ever reaching an admin page.
- 187 automated tests covering all of the above (including "does
  registering with an email that's already taken behave exactly like a
  brand-new signup" and "does a wrong 2FA code get rejected without
  marking the session verified") — up from 111 before tonight.

**Not done — the actual pages:** there is no page yet where someone types
an email and password, no signup form, no "forgot password" screen, no
2FA setup screen. Everything above is the logic _behind_ those pages;
building the pages themselves, and testing the whole login flow start to
finish on a running app, is the next piece of this work.

**Two things flagged rather than worked around, for you to know about:**

- The "backup codes" you'd normally get when turning on two-factor login
  (in case you lose your phone) aren't stored anywhere yet — there's
  nowhere in the database for them to live, and adding that requires a
  database change that needs internet access this working environment
  didn't have. Turning on 2FA itself still works; the backup-code safety
  net for it doesn't yet. Tracked so it isn't forgotten.
- The two-factor secret key is stored as plain text in the database for
  now — the security document asks for it to be encrypted, and that
  encryption piece hasn't been built yet either.

Automated "does the login page correctly block someone without
permission" testing (what the blueprint calls the authorisation matrix)
is also not done yet — same reasoning as the accessibility testing item
below, it needs a real running app to test against.

## Phase 4 — Catalogue: done — English/Nepali switching, the data-fetching logic, and now real pages people can click through

**English/Nepali site switching (done):** the site can now serve pages in
English at the normal URL (`/`) and in Nepali at `/ne/...`, with the
plumbing in place to translate any piece of text going forward.

One thing worth knowing: the existing header/footer/navigation
(built in Phase 2) link around the site using a plain link component, not
the locale-aware one. In practice this means: browsing the English site
is unaffected, but a visitor on the Nepali site who clicks a nav link
today gets bounced back to the English version instead of staying on the
Nepali one. Fixing every link is a mechanical but real chunk of work,
lower priority until there's actual Nepali product content to show —
right now nothing in the catalogue has Nepali translations yet either.

**Product/category/brand/search data-fetching logic (done, with tests):**
this is the "kitchen" work behind the counter — the actual database
queries and business rules a product listing page, a category page, and
a search box call:

- Given a category (like "Laptops → Gaming"), find every product in it
  and its sub-categories, in one query.
- Given a list of filters (brand, price range, spec like "16GB RAM",
  in-stock only, on sale), narrow down the product list correctly.
- Work out "starting from" pricing when a product has multiple options
  (sizes/colours/configurations) — always the cheapest one currently
  available.
- Build the filter sidebar's option lists and counts (e.g. "HP (12),
  Dell (8)") from whatever products are currently showing.
- Full-text search — type a few words, get ranked results.
- The one rule from the security/SEO document that matters most here:
  a product with zero reviews always shows "no rating" rather than a
  fake-looking "0 out of 5 stars."

51 new automated tests cover the trickier logic (translation fallbacks,
pagination math, category-tree building, and the filter-sidebar
counting logic). The two biggest files (the main product-listing
function and the search function) are checked by the type-checker and
linter but don't have dedicated automated tests yet — they're
straightforward compositions of the smaller, already-tested pieces, and
writing thorough tests for them is more valuable once there's a real
page calling them to test against, rather than guessing at the shape of
that call now.

**Two things flagged rather than worked around:**

- Search is fully built and ready, but won't return any results until a
  piece of database setup (written back in the data-layer phase,
  sitting in `prisma/sql/manual-constraints.sql`) actually gets applied
  on your machine — this sandbox never had a real database connection
  to apply it against. This is expected, not a bug to chase.
- "In stock" filtering currently just checks "is there physical
  quantity on the shelf," not the more precise "shelf quantity minus
  anything currently reserved by someone else's cart." The precise
  version is what actually protects against overselling at checkout
  time (that part is unaffected) — this is only about what a browsing
  filter shows before checkout, and the simpler version is accurate
  enough for that.

**The actual pages (done tonight):** every storefront page now exists and
shows real data pulled live from the database — not mock data, not a
placeholder:

- **Homepage** (`/`) — the top-level categories and a row of featured
  products, both real.
- **Category pages** (e.g. `/c/laptops/gaming`) — every product in that
  category and its sub-categories, with a working filter sidebar (brand,
  price range, spec filters like "16GB RAM"), sort dropdown, and page
  numbers. Change a filter or the sort order and the page URL updates too
  — so a filtered/sorted view can be bookmarked or shared, not just
  clicked into from scratch each time.
- **Brand pages** (e.g. `/b/hp`) — same filtering/sorting, scoped to one
  brand instead of one category.
- **Product pages** (e.g. `/p/hp-victus-15-...`) — photo gallery, pick a
  configuration if the product has more than one (e.g. "16GB / 512GB" vs
  "32GB / 1TB"), price and stock status for whichever one is picked, the
  full spec sheet, and a "you may also like" row of related products.
- **Search results page** (`/search?q=...`) — ranked results for whatever
  someone typed, with the "no exact matches, try browsing instead"
  message when nothing comes back.

Everything above is now genuinely clickable if you run `pnpm dev` on your
own machine (this sandbox still can't run a full build far enough to try it
itself — see "How to check any of this yourself" below).

**Two things worth knowing about what's on the product page specifically:**

- **"Add to cart" doesn't actually do anything yet.** The button is there
  and behaves like a real button (it shows "Adding…" then "Added" when
  clicked), but there's no shopping cart behind it yet — that's a later
  phase (Cart & Inventory). Nothing is broken; it's just not wired to
  anything real yet, on purpose.
- **No customer reviews show up yet**, even for products that might have
  some — reading reviews out of the database wasn't part of tonight's
  scope (only products/categories/brands/search/filters were). Adding
  that is a small, separate piece of follow-up work.

One more small thing a careful reviewer might notice: while testing this,
a real bug was caught (and fixed) by actually trying to build the site —
four small files needed one extra line each to satisfy a Next.js
technical requirement that only shows up at build time, not while writing
or type-checking the code. Mentioned here mainly as a reminder of why
tonight's work kept trying `pnpm build` at every step even though it
can't finish in this sandbox: it still catches real problems along the
way that the other checks (type-checking, linting, tests) don't.

## A correction to what I told you last time

I'd said the next phase was "cart, checkout, payments." That was wrong —
I re-read the roadmap's own dependency table (`docs/17-ROADMAP-PHASES.md`)
more carefully and it's explicit: **Admin (Phase 5) comes before Cart &
Inventory (Phase 6)**, because Phase 6 itself is listed as depending on
Phase 5, not just Phase 4. Cart/checkout is still coming, just not next.
Sorry for the confusion — flagging it here rather than quietly fixing the
order without saying anything.

## Phase 5 — Admin: just started tonight

Phase 5 is the admin panel — the screens the shop owner actually uses day
to day to add products, check stock, and see what needs attention.
Docs/17 calls this phase "the one most likely to be under-scoped," so
tonight was one deliberately small, foundational slice rather than
rushing the big pieces (the product wizard, the photo library):

- **The admin area now has a working shell.** Visit `/admin` and — once
  signed in as staff — you get the real sidebar, a top bar, and (on a
  phone-sized screen) the sidebar becomes a slide-out menu, exactly per
  the "Dad Mode" spec. The sidebar only shows the sections your role can
  actually use (a repair technician doesn't see "Customers"; shop staff
  don't see "Settings") — nothing is shown and then denied.
- **The "Today" page is real**, not a mockup. It shows actual counts from
  the database: orders placed today, money taken in today (vs.
  yesterday), and a "what to do next" list — e.g. "2 bank transfer
  payments waiting for you to check," "3 orders are paid but not sent
  yet," "7 products are almost out of stock" — each with a button that
  will jump straight to the filtered list once that list page exists.
  Rows further down the page (this week/month comparisons, top-selling
  products, charts) are intentionally not built yet — the two rows that
  actually answer "do I need to do something right now" came first.
- **Every future admin change will have a paper trail.** Built the
  "Activity History" write path (`AuditLog`) that every later admin
  screen (adding a product, changing a price, adjusting stock) will
  write to automatically — this is what makes "every mutation appears
  in Activity History," one of the phase's own pass/fail requirements,
  possible once those screens exist.

**Not built yet, on purpose** (each is its own upcoming piece of work):
adding/editing products (the four-step wizard), the product list with
inline price/stock editing, the photo library, stock adjustment screens,
and the admin's own search box.

## Phase 5 continued — Categories and Brands are now real screens

- **`/admin/categories`** is a working screen, not a mockup. You can add a
  category, edit its name and description, turn "Show in menu" and "Live
  on the website" on or off, and drag categories up or down to reorder
  them (including nesting one inside another). Trying to delete a
  category that still has products or sub-categories in it is refused
  with a plain explanation, rather than silently breaking something.
- **`/admin/brands`** works the same way — add, edit, delete — as a
  simple list rather than a tree, since brands aren't nested. One honest
  limitation: brands can't be manually reordered. The database has no
  column to remember a custom brand order (categories do, brands don't),
  so rather than build a reorder control that would just forget its own
  order every time the page reloads, I left it out and left a note in
  the code explaining why. Brands are listed alphabetically instead.
- **Every add/edit/delete on both screens writes to Activity History**,
  as promised last time.
- Two smaller, deliberate simplifications, both noted in the code: moving
  a category to a _different_ parent category isn't supported yet
  (renaming, describing, and hiding/showing it are); and a category or
  brand's website address (its "slug") can't be changed after it's
  created, to avoid quietly breaking a link someone may have already
  shared.

Still not built (as of that session): the product wizard, the product
list, stock screens, the photo library, and admin search. All but the
dedicated stock screens are done now — see the next section.

## Phase 5 continued — the product wizard, product list, photo library, and admin search are now real

Tonight's session tackled the biggest piece of Phase 5: the four-step
product wizard the blueprint calls the phase's centrepiece, plus the
product list, the photo library, and wiring up the admin's search box.

- **Adding a product is now a real, working four-step flow**
  (`/admin/products/new`, or `/admin/products/[id]/edit` to come back to
  one later):
  1. **Basics** — name, a shorter title for product cards (with a
     one-click "use this" suggestion), a description, brand, category,
     "also show in" other categories, price and offer price (with a live
     "Save 12%" badge), stock, a product code (auto-generated if left
     blank), condition, and warranty. Typing a product name that's very
     similar to one you already have shows a warning with a link to the
     existing one — the exact "did you mean the MacBook you already
     added?" protection the blueprint asked for.
  2. **Photos** — drag and drop, or click to choose. Photos really upload
     to storage now (not a placeholder), with each one getting an
     editable description field.
  3. **Details** — the spec sheet (Processor, RAM, Storage, etc.) fills
     in automatically based on the category you picked in step 1, plus a
     "+ Add another detail" button for anything the template doesn't
     cover.
  4. **Search info** — the page title and description Google will show,
     pre-filled sensibly, with a live preview of what the Google result
     will actually look like and a plain-language hint on whether it
     looks good.
  - **"Save as draft" works from any step**, and the whole thing
    autosaves every 20 seconds while you're working, plus warns you if
    you try to close the tab with unsaved changes.
  - **Publishing checks itself first.** Click "Publish" and, if
    something's missing (no photos yet, description a bit short), you
    get a plain checklist and a choice — fix it now, or publish anyway.
    A complete product just publishes immediately, no extra dialog in
    the way.
- **The product list (`/admin/products`) is a real screen.** Search,
  seven filter buttons (All / Live / Not published / Out of stock /
  Almost out of stock / No photo / On offer), and — the part people will
  use daily — you can change a product's price or stock number right in
  the table, no separate page needed. A price change of more than 50%
  gets a friendly "are you sure?" warning after saving, not before.
- **The photo library (`/admin/media`) is a working screen** — every
  photo you've ever uploaded, in one place, each with an editable
  description. Upload photos here ahead of time if you want, or add them
  straight from a product's own Photos step.
- **The search box in the top bar actually searches now.** Press
  `Ctrl/⌘K` or click it, type "HP," and real matching products, brands,
  and categories show up grouped, as you type — not the empty box it was
  before tonight.
- **Every save above writes to Activity History**, same promise as every
  other admin screen so far.

**Simplifications made tonight, each flagged in the code, not hidden:**

- The category and brand pickers in step 1 are a searchable list, not the
  fancier expandable tree the blueprint pictured — there's no tree-picker
  building block in the project yet, and a searchable list still finds
  things fast.
- Prices are typed as plain numbers with a रु sign in front and a
  formatted preview underneath ("रु 1,54,900"), rather than the number
  reformatting itself with commas while you're still typing it — that
  live reformatting needs a specialised input the project doesn't have
  yet.
- Photos really upload and get stored for real, but the automatic
  resizing/format-conversion/blurry-placeholder step the blueprint
  describes isn't built yet — that needs a separate image-processing
  tool and a background job. Photo descriptions are also a simple
  placeholder ("HP Victus 15 photo") rather than software actually
  looking at the picture and describing it — you're expected to edit it.
- "Change many products at once" (bulk price changes, bulk publish, etc.)
  on the product list isn't built yet — every row is edited one at a
  time for now.
- The duplicate-product-name warning and the storefront's search box both
  depend on the same piece of database setup mentioned in earlier
  sessions (`prisma/sql/manual-constraints.sql`) that still hasn't been
  applied on a real database from this sandbox — both are built to use
  it for real and will start working the moment that setup runs; until
  then they quietly skip the check rather than erroring.
- The search box's brand and category results currently take you to the
  Brands/Categories list pages rather than jumping straight to that one
  brand or category — those are edited via a pop-up on the list page
  itself, and there's no way yet to link straight to "open this one's
  edit pop-up." Product results do jump straight to the right page.

Automated tests were added for the trickier logic behind tonight's work:
the duplicate-name check's fallback behaviour, the publish checklist's
pass/fail logic, the 50%-price-change warning, stock changes always
recording a reason, and the product list's filter buttons. 296 tests
pass in total now (up from 271 this morning), alongside a clean
type-check and lint.

Still not built as of that session: the dedicated stock-adjustment
screens and the Activity History page itself (the write side is done —
every change above already gets recorded — just not yet a screen to
browse and search that history). The stock screens are done now — see
the next section. The Activity History browsing page is still not built.

## Phase 5e — the dedicated stock screens are real now

`/admin/inventory` — the screen the product list's inline price/stock
quick-edit was always meant to be a smaller, faster sibling of, not a
replacement for:

- **Search and filter.** Type a product name or product code, or click
  "Almost out of stock" / "Out of stock" to narrow the list.
- **The real `+/−`/"Set…" stock control**, wired for the first time — it
  was built earlier as a showcase piece but never connected to anything
  real. Every single change, even clicking `+1`, opens the same
  "why did this change?" dialog (Received new stock / Sold in shop /
  Damaged / Correction / Returned) and writes a permanent record — there
  is still no way to change a stock number without a reason, exactly as
  the security document requires.
- **"Stock history"** — click it on any row and see a plain-language
  timeline: "27 Jul, 10:14 — Ramesh added 5 (Received new stock). Now
  12," reading from the same Activity History log every other admin
  change already writes to, not a separate record-keeping system.
- **Bulk update** — select several rows, pick one reason and an optional
  note, and change all of their stock numbers in one save. If one row
  fails (e.g. someone deleted that product moments earlier), the rest
  still go through — you're told exactly which one didn't.

**Not built, flagged rather than faked:** uploading a spreadsheet to
bulk-update stock (needs real spreadsheet-reading and a background job,
both separate pieces of work), and the daily 9am "you're running low on
these" email (there's no scheduled-job runner in the project yet to
trigger it — the "Almost out of stock" filter and the dashboard tile
are the low-stock warning that exists today).

307 tests pass now (up from 296), including new ones for the stock
history timeline and the bulk-update failure handling.

## Phase 6 — Cart & Inventory: the cart is real; checkout is not next

`docs/17-ROADMAP-PHASES.md` calls this phase's defining risk
"overselling under concurrency" — two people trying to buy the last unit
at the same time. That real, hard part (the reservation system) is built
and tested; it just isn't switched on yet, because switching it on needs
a checkout screen this project doesn't have.

**What actually works right now, for real:**

- **Add something to your cart on any product page** and it's genuinely
  remembered — as a cookie if you're just browsing, or in the database
  once you're signed in. Sign in after adding a few things as a guest
  and everything you added is still there, combined with anything
  already in your signed-in cart.
- **The cart icon in the header shows a real count** and opens a real
  slide-out cart preview — not the mockup version from the design
  showcase.
- **A real `/cart` page** — every item, a working "how many" stepper, a
  remove button, and a coupon code box. Change the quantity or remove
  something and it saves immediately, no separate "update cart" button.
- **Prices and stock are always rechecked, live, every time you look at
  your cart** — never trusted from whenever you first added the item.
  If a price went up (or down) since you added something, or there's
  suddenly less in stock than you have in your cart, you're told, right
  there on the cart page — this is the exact "surface warnings if price
  or stock changed" requirement from the plan.
- **Coupon codes work** — percentage off, a fixed rupee amount off, or
  free shipping, each checked against expiry dates, minimum order
  amounts, and usage limits before it's accepted.

**What's built and tested, but deliberately not switched on yet:** the
system that actually holds stock aside once an order is placed (so two
shoppers can't both "win" the last unit), and the job that would release
that hold if someone abandons their order without paying. Both are real,
correct, and covered by tests — they're just not called by anything yet,
because there is no "place order" button anywhere in the project. Adding
one is later work; wiring these two systems to it at that point is a
small step, not a rebuild.

**Two smaller things worth knowing:**

- Coupons that are restricted to one category only match a product's
  main category for now, not every category it happens to also be
  listed under (a product can appear in more than one). A reasonable
  first cut, noted in the code.
- "Proceed to checkout" is on the cart page but greyed out — there's
  genuinely nowhere for it to go yet.

357 tests pass now (up from 307), and a clean type-check and lint.
Checkout, payments, and the PC-builder's compatibility-checking logic
are next, per `docs/17-ROADMAP-PHASES.md`.

## Phase 7 — Checkout & Orders: Cash on Delivery and Bank Transfer, real end to end

This phase turns Phase 6's cart into an actual order. Scoped to two
payment rails only, per this session's own instruction: **Cash on
Delivery and Bank Transfer**. eSewa, Khalti, Fonepay, connectIPS,
webhooks, a payment-reconciliation cron, and transactional emails are all
part of the _full_ Phase 7 in `docs/17-ROADMAP-PHASES.md` — none of them
are built this pass, and nothing here pretends otherwise.

**What actually works right now, for real:**

- **`/checkout`** — a 3-step flow (Address → Payment → Review). The
  address step covers Nepal's shape (province, district, municipality,
  ward, delivery vs. branch pickup) and shows a live shipping-cost and
  VAT quote as you fill it in; the payment step only shows Cash on
  Delivery and Bank Transfer, and only offers Cash on Delivery when the
  order is under the configured limit (NPR 25,000 by default); the review
  step shows the real, final total before you place the order. Every
  number shown is recalculated on the server at each step — nothing
  the browser sends is ever trusted for a price.
- **Placing an order is real.** It creates the `Order` and its line
  items/addresses in the database, snapshotting the product name, price,
  and photo at that exact moment (so a later price change never rewrites
  history), holds the stock aside immediately, and creates the payment
  record. A coupon applied back on the cart page is re-checked against
  the live cart before being honoured — never just trusted from what was
  stored earlier.
- **Cash on Delivery has real guardrails**: a value cap, a "too many
  cash-on-delivery orders already in progress" check per phone number, a
  "too many orders to this exact address this week" check, and an
  account-level block a shop owner can set on a repeat no-show customer.
- **Bank Transfer has a real receipt-upload-and-review flow.** After
  placing a bank-transfer order, the customer sees an upload box on their
  order page. What they upload goes to private storage — never a public
  link — and an admin has to open it deliberately to see it. Orders over
  NPR 100,000 can only be approved by an Owner account; below that, a
  Manager can do it too.
- **`/order/[orderNumber]`** — track any order by its number. If you're
  signed in and it's your order, it just shows. If not (a guest, or
  checking from a different device), typing in the phone number the
  order was placed under unlocks the same view. Shows a plain step
  tracker (Placed → Confirmed → Packed → Shipped → Delivered), the
  items, the address, and — for bank transfer — the receipt upload box.
  There's also a genuine "Download invoice" button that produces a real
  PDF, built on the spot each time (nothing is pre-generated and stored).
- **`/admin/orders`** — search and filter every order (including two
  filters the dashboard's own "needs attention" tiles already linked to
  from an earlier phase, now finally real: bank-transfer payments
  waiting for review, and orders that are paid but not yet sent).
  `/admin/orders/[id]` shows the full picture and only shows the buttons
  an admin's own role is actually allowed to click — a Support account
  sees a read-only order, a Staff account can move it forward but not
  cancel or refund it, a Manager or Owner can do everything, and only an
  Owner can approve a bank transfer above the NPR 100,000 line. Cancelling
  an order also correctly releases whatever stock it was holding.

**What's deliberately simplified, flagged rather than faked:**

- **No SMS anywhere.** The blueprint calls for a phone-verification code
  before accepting a Cash-on-Delivery order above a certain value, and a
  confirmation call for first-time buyers. Neither exists — there's no
  SMS provider wired into this project yet, so it would only be able to
  fake sending a code, and this project doesn't do that.
- **No email either.** Nobody gets an order-confirmation, payment-
  received, or shipping-notice email. This is a real, known gap, not an
  oversight — sending real email needs a provider account this sandbox
  doesn't have.
- **Only one order page design, not three.** The blueprint originally
  called for three separate pages (a post-checkout confirmation page, a
  public "track by phone" page, and a signed-in "my orders" page). This
  pass built one page that covers all three jobs instead, since that's
  what was actually asked for this session. Worth knowing if you want the
  original three-page split later.
- **A bank receipt isn't checked for being a real image/PDF beyond its
  declared file type**, and nothing strips identifying photo metadata
  from it yet. Someone could theoretically upload a mislabeled file. An
  admin still has to look at it before approving anything, so this isn't
  a security hole today, just a rough edge.
- **Nothing automatically cancels an unpaid bank-transfer order after 48
  hours**, even though the stock hold itself does expire on schedule —
  there's no background job scheduler in this project yet to run that
  sweep.
- **The "requester can never be the approver" half of the two-person
  bank-transfer rule isn't enforced**, because nothing in the database
  currently records who uploaded a receipt on a customer's behalf (this
  only matters for an order a staff member enters by phone, not a
  customer's own upload, which is the only path this pass builds).
- **Only 13 of Nepal's 77 districts have a delivery price configured**
  (a Phase 6 gap, not new) — checkout tells a shopper outside those
  districts to contact the shop or choose pickup instead of pretending a
  price exists.
- The invoice PDF is intentionally plain — no logo, no letterhead. It's
  correct and complete, just not "designed" yet.

394 tests pass now (up from 357), and a clean type-check and lint. The PC
builder's compatibility-checking logic and the remaining online payment
gateways are next, per `docs/17-ROADMAP-PHASES.md`.

## Phase 8 — PC Builder Engine: the compatibility brain is real; the interactive builder screen isn't built yet

This phase's own instruction scoped it to six things: the rule engine, the
power/balance model, three builder modes with virtualized pickers, fix
drawers and power warnings, a shareable build page with "Add to cart", and
an admin parts/rule-tester screen. Payment gateways (eSewa/Khalti/Fonepay/
connectIPS) stay deliberately deferred to the very end of the whole
project, per this session's own instruction — not touched this pass.

**What actually works right now, for real:**

- **A real compatibility rule engine.** 37 `CompatibilityRule` rows,
  covering CPU↔motherboard, RAM↔motherboard/CPU, GPU↔motherboard/case/PSU,
  storage↔motherboard/case, cooler↔CPU/case, case↔motherboard/PSU, and
  cross-build checks (bottleneck, budget, upgrade headroom, use-case fit).
  Every rule is a declarative JSON expression row in the database, not
  hardcoded `if` statements — an admin (or a future rule-tester screen)
  could add a 38th rule without a code deploy. Five more real checks
  (GPU/PSU connectors, storage/PSU SATA power, PSU/board EPS connectors,
  case front-panel headers, cooler fan headers) are enforced by a separate
  generic connector-satisfaction pass rather than one-rule-per-connector,
  matching how the spec itself describes that part. One more (flagging
  parts with unverified/inferred specs) is computed directly rather than
  needing 16 near-identical rule rows. Six checks from the full spec are
  genuinely not implemented yet (see below), not faked.
- **A real power model**, with the "peak load can spike well above typical
  draw" transient-headroom math (not just `CPU + GPU + 100W`), and a real
  balance/bottleneck score comparing CPU and GPU strength, weighted by
  what resolution you're targeting.
- **19 golden-build tests**, including the specific one this session asked
  for by name: a Micro-ATX motherboard with a 420mm liquid cooler and a
  flagship graphics card crammed into a Mini-ITX case correctly produces
  several real errors (wrong case size, GPU too long, radiator won't fit,
  wrong PSU shape) rather than silently seeming fine. Plus 11 tests for
  saving/editing a build and 413 tests total pass.
- **You can build, save, and share a build.** A build can be created,
  parts can be set slot-by-slot (each save re-runs the whole engine and
  refreshes the build's compatibility score/power/balance figures), and
  `/build/[shortId]` is a real, working shareable page — anyone with the
  link sees the parts list, the price then-vs-now, the compatibility
  score, power meter, balance meter, every issue in plain language, and a
  working "Add to cart" button that adds every purchasable part and tells
  you plainly which parts (if any) you'll need to source separately. An
  anonymous shopper's build is protected by a cookie so only they can keep
  editing it; a shared link is viewable and purchasable by anyone, like a
  product page.
- **The seed data was rewritten from scratch** to actually match a real
  schema — the previous pass's placeholder parts used inconsistent,
  made-up field names that didn't line up with any validation, and one of
  its two case parts was missing the field a rule needed to check GPU
  length against, meaning that rule silently never worked. Every part's
  specs now go through the same real Zod validation the engine reads from,
  so a typo in the seed data fails loudly instead of quietly breaking a
  rule.

**What's deliberately simplified or deferred, flagged rather than faked:**

- **There's no interactive builder screen yet** — no `/build/new`, no
  Guided/Standard/Expert mode switcher, no virtualized part-picker
  (`@tanstack/react-virtual` isn't installed), no drag-through slot
  workspace. The Server Actions and service layer everything like that
  would call already exist and are tested; the screen that calls them
  slot-by-slot with a live picker is the single biggest piece of this
  phase still ahead.
- **No Fix drawers wired up yet.** The `IssueRow`/`FixDrawer` components
  from Phase 2 exist and the share page shows every issue in plain
  language, but nothing yet opens a drawer of specific alternative parts
  when you tap "Fix this" — that needs the picker/catalogue browsing UI
  above to exist first.
- **No admin "Buildable Parts" or "Rule Tester" screen yet.** Parts and
  rules can only be added/edited by hand in the seed file or directly in
  the database right now — there's no `/admin/builder` screen to manage
  either one, and no UI for an admin to pick sample parts and see which
  rules fire before saving a rule change.
- **Six named checks from the spec's own rule list aren't implemented**,
  each for a real, specific reason rather than being skipped for time:
  two need tracking exactly which physical M.2 slot a drive occupies
  (this pass's slot model doesn't go that granular yet); one needs
  matching a GPU's video outputs against a monitor's inputs (monitors are
  explicitly out of scope this pass); one needs knowing which case
  position — front, top, rear — a radiator was actually mounted at
  (nothing records that); and two need a live stock/price lookup at
  validation time that this pass's engine doesn't make (it only reads the
  part catalogue and the build's own saved snapshot).
- **A build's price/stock never gets rechecked against what's live** once
  saved — "the price changed since you saved this" and "a part in your
  build just sold out" are both real, described checks that need that
  live lookup wired in, which didn't happen this pass.
- **No "Clone this build" button** on the share page yet, and no
  versioned validation-snapshot history (`BuildRevision`/
  `BuildValidationSnapshot` exist as database tables but nothing writes to
  them) — every page read always re-runs the live engine instead, which
  is correct but means there's no "undo" or "what changed" history yet.
- **No per-resolution GPU benchmark data.** The balance model's formula is
  implemented exactly as specified, but the GPU-strength figure it
  compares against the CPU currently falls back to the same coarse 1-10
  tier used everywhere else, not a real "this card's benchmark score at
  1080p vs. 4K" figure — no such benchmark data has been sourced yet.
- Only ~25 parts are seeded (a handful of CPUs/GPUs/motherboards/etc.,
  plus three parts added specifically to make the mandatory bad-build test
  above possible), well short of a real catalogue — same reduced-for-review
  approach every earlier phase's placeholder seed data has taken.

424 tests pass now (up from 394), and a clean type-check and lint. The
interactive builder screen (three modes, virtualized pickers, fix drawers)
and the admin parts/rule-tester screen are next, per
`docs/17-ROADMAP-PHASES.md` — followed by the still-deferred payment
gateways once every other feature area is complete, per this session's own
instruction.

## Phase 8 continued — the interactive builder screen and the admin surface are real now

This pass finished what the previous Phase 8 session flagged as "the
single biggest piece of this phase still ahead": an actual `/build/new` →
`/build/[shortId]/edit` workspace a shopper can click through, Fix drawers
wired to real issues, and a minimal admin Buildable Parts list + Rule
Tester. The rule engine, power/balance model, persistence layer, and
shareable `/build/[shortId]` page were already real and committed before
this pass started (see the Phase 8 section above) — nothing about the
engine itself changed here except two small additions described below.

**What actually works right now, for real:**

- **A real slot model and part-image resolution.** `src/lib/builder/
slots.ts`'s `SLOT_MODEL` covers this pass's 8 "core" slots (cpu,
  motherboard, ram, gpu, storage_1, cpu_cooler, psu, case), with CPU as
  the single anchor prerequisite — a documented simplification of the
  docs' fuller per-slot prerequisite chain. `src/lib/builder/part-image.ts`
  resolves a part's photo through its optional `variant → product → media`
  chain, falling back to a flagged inline SVG placeholder for the
  informational-only parts that don't have one.
- **A real candidate-parts service.** `listCandidatePartsForSlot` (and
  `listCandidatePartsWithPriceDelta` for the Fix drawer) hypothetically
  substitutes every active part of a slot's type into the build and
  re-runs the actual engine (`evaluateSelectedParts`, extracted from
  `validateBuild` for exactly this reuse) to compute a real `compatible`/
  `incompatibleReason` per row — never a second, drifted copy of the
  compatibility logic.
- **A real virtualized part picker.** `PartPickerDrawer` now uses
  `@tanstack/react-virtual`'s `useVirtualizer` with dynamic per-row
  measurement and a 6-row overscan, with no change to its exported props.
- **`/build/new` is a real page.** Mode + use-case + resolution + budget
  capture, calling `createBuildAction`, redirecting to the edit page.
  Guided mode collects the exact same four inputs as Standard/Expert —
  the docs' fuller "6 questions → auto-built complete build" vision is
  NOT implemented (no solver runs anywhere this pass); mode only changes
  how the edit page _presents_ the same slot grid afterwards.
- **`/build/[shortId]/edit` is a real, ownership-gated workspace.** A new
  `isBuildOwner` (non-throwing) check in `builds.ts` lets the page branch
  before rendering — a non-owner is redirected to the read-only
  `/build/[shortId]` share view rather than shown an error. The page
  renders `BuilderEditView`: a `SLOT_MODEL`-driven grid of
  `BuilderSlotCard`s (every non-CPU slot shows the `incompatible` state
  with "Pick a processor first" until a CPU is chosen), the virtualized
  `PartPickerDrawer` wired to `listPartsForSlotAction`/`setBuildItemAction`,
  a live `CompatibilityPanel`/`IssueRow` list refreshed after every
  change, `BuildSummaryPanel` with working Share/Print/Add-to-cart, and a
  new `setBuildModeAction` so switching modes never touches a `BuildItem`
  (mode really is "switchable at any time without losing the build," not
  just documented as such). Standard mode additionally renders `StepRail`
  over the same 8 core slots as a simplified stand-in for the docs' fuller
  10-step wizard — flagged, not silently substituted. Expert and Guided
  modes render the identical grid with no extra gating beyond the
  CPU-anchor rule already in `SLOT_MODEL`.
- **Fix drawers are wired for real (Task #74).** `FixDrawer` (a Phase 2
  presentational component that already existed, unused, since before
  this pass) now opens from any fixable `IssueRow` in the edit workspace,
  listing real alternative parts with real price deltas via a new
  `listPartsForSlotWithDeltaAction`. "Fixable" means a rule-engine issue
  whose `subjectSlotKey` maps to one of this pass's 8 core slots —
  connector-shortfall issues and the data-confidence note have no single
  part/slot to attribute a fix to and never render a Fix button, a real
  and flagged scope limit rather than a bug.
- **A minimal admin surface exists (Task #76).** `/admin/builder/parts`
  lists every `ComponentPart`, filterable by `PartType` and
  `PartDataConfidence`, searchable by manufacturer/model — read-only this
  pass. `/admin/builder/rules` is a real Rule Tester: pick a sample part
  for any of the 8 core slots from a live dropdown and run the exact same
  `evaluateSelectedParts` pipeline the real builder uses (via a new
  `runRuleTester`/`listRuleTesterPartOptions` service), showing every
  fired rule's raw code, both slot keys, and message — a technician's
  diagnostic view, deliberately not the shopper-facing
  `CompatibilityPanel`. Both screens are gated on their real seeded
  permissions (`builder-part:write`, `builder-rule:write`).
- **432 tests pass now** (up from 424): 4 existing `listCandidatePartsForSlot`
  tests (compatible candidate, incompatible candidate with a real reason,
  re-picking a slot's own current part, unknown slot key) plus 4 new
  `runRuleTester`/`listRuleTesterPartOptions` tests (a compatible pair, a
  socket-mismatched pair firing the real `CPU_MOBO_SOCKET` rule, an
  unselected slot being silently skipped rather than erroring, and
  per-slot option grouping). Clean type-check and lint throughout.

**What's deliberately simplified or deferred, flagged rather than faked
(this pass's own explicit out-of-scope list, carried over verbatim from
the instructions this pass was given):**

- No `MobileStepBar`/mobile-specific sheet variants — the builder
  workspace is desktop-shaped this pass (`StepRail` itself is already
  `hidden lg:flex` only).
- No "show parts that don't fit" escape-hatch toggle in the part picker —
  incompatible rows are always shown, disabled, with a reason; there's no
  way to hide them.
- No localStorage autosave/resume-prompt. Every change is already
  persisted server-side immediately (`setBuildItemAction` writes on every
  selection), so there's no unsaved-work-to-resume state to begin with,
  but there's also no "you were mid-edit, continue?" banner.
- No named saves under `/account/builds` — a build is only reachable by
  its own shareable link right now, there's no signed-in "my builds" list.
- No `BuildRevision` diffing/"what changed" history — `BuildRevision`/
  `BuildValidationSnapshot` still exist as unused database tables, same
  as noted in the previous Phase 8 section.
- No export beyond the existing `window.print()` the share page already
  had (no PDF/JSON quote generation).
- No auto-build/solver and no `/builder/recommend`, `/builder/compare`,
  `/builder/import` endpoints.
- No multi-storage/case-fan/monitor/OS/expansion/peripheral slots in the
  UI — `SLOT_MODEL` only covers the 8 core slots described above; the
  engine itself still evaluates rules against any `BuildItem` in those
  other `PartType`s if one exists in the database, this UI just never
  offers a tile to pick one.
- **Admin: only two of the five described admin screens exist.** Buildable
  Parts (read-only list) and Rule Tester are real. Full `ComponentPart`
  CRUD (authoring `specs` JSON per `PartType` through a form, not by hand
  in the seed file), CSV/XLSX bulk import, the Customer Builds funnel, the
  Build Templates screen, and the Data Quality screen are NOT built —
  deferred for budget reasons, per this pass's own explicit priority order
  (sections 1-5 solid and committed before spending any time on section 6).
- The Rule Tester is narrowed to this pass's 8 core `SLOT_MODEL` slots,
  same simplification as the shopper-facing builder — testing a rule
  against `case_fan_3` or a monitor isn't supported this pass.

The PC Builder's UI is now feature-complete enough to actually build,
save, share, and buy a PC end to end through the browser — the remaining
gaps above are real, described product surface, not silent omissions.
Payment gateways (eSewa/Khalti/Fonepay/connectIPS) remain the last
deferred item for the whole project, per every prior session's own
instruction — still untouched.

## Phase 9 — Admin Complete: every module in docs/09-ADMIN-DAD-MODE.md is a real screen now

This session worked through the Phase 9 deliverable list in priority
order — dashboard and customers first, help articles and coach marks
last, as instructed, since they're the most skippable if time ran out.
Every deliverable in the priority list shipped except coach marks
(explicitly deferred, see below). Nothing was silently faked: every gap
below is a real, flagged scope cut with a doc comment in the code
pointing back here.

**"Today" dashboard.** `getTodayDashboard`/`getTodayDashboardForRequest`
(cached per-request via React `cache()` so the sidebar's badge counts and
the dashboard body share one set of queries) already existed from Phase
5a and needed no rebuilding — Row 1 (4 tiles), Row 2 (6-item "what to do
next" task list), Row 3 (this week/month vs. the period before, worded
not just coloured), and Row 4 (best sellers, most viewed, new customers,
recent orders) all read real first-party data, every number links to its
list. One reconciliation worth recording: docs/12-ANALYTICS-MARKETING.md
§12's broader 15-row table lists two metrics — a distinct "Out of stock"
tile and a "Cancelled this week" tile — that docs/09-ADMIN-DAD-MODE.md
§4 (the binding, authoritative Dad-Mode layout spec, which explicitly
enumerates "four tiles" for Row 1 and a fixed 6-item Row 2 list) does not
include. Since 09 is the doc this admin was actually built against, and
09's exact tile/task counts were followed precisely, those two numbers
aren't their own dashboard tiles — but both are still one click away
exactly as the acceptance bar requires: Inventory already has a
dedicated "Out of stock" filter chip (`stockListFilterSchema`'s
`out-of-stock` value, built in Phase 5e), and cancelled orders are
visible via the Orders list's own status badge/filtering. Row 5's
optional 30-day charts remain un-built, per docs/17's own Phase 9
acceptance bar reading "with no chart required."

**Customers.** `/admin/customers` (list, search, filter) and
`/admin/customers/[id]` (profile, addresses, order history, COD block
toggle with a mandatory reason on block _and_ unblock, and free-text
notes) — `server/services/admin/customers.ts`, `lib/validation/admin/
customers.ts`. `ReasonDialog` was promoted from `admin/orders` into
`components/admin/reason-dialog.tsx` here, on its second real consumer,
per this codebase's own "promote on second consumer" convention.

**Coupons and campaigns.** Coupons (`/admin/coupons`) are full CRUD —
percentage, fixed-amount, and free-shipping codes, usage limits,
validity windows, an active/inactive toggle. Campaigns
(`/admin/campaigns`) are deliberately narrower: they manage a
`Promotion`'s name/dates/active state and show a "Needs setup" badge
when it has zero `PromotionRule`s, but there is no rule condition/action
editor — no promotions evaluator exists anywhere in checkout yet to
consume such rules, and `PromotionType`'s five distinct shapes would
each need a bespoke non-technical form. Flagged, not built partially and
silently passed off as complete.

**Reviews.** `/admin/reviews` defaults to a "needs approval" (PENDING)
filter, with approve/reject and an admin reply field —
`server/services/admin/reviews.ts`.

**Enquiries and service tickets.** `/admin/enquiries` is a real inbox
(`tel:`/`mailto:` links, unread/replied/closed status) with one flagged
gap: there is no reply-text field and no outbound email/SMS sender
anywhere in this codebase (grepped — only `auth/verify-email.ts` sends
anything, and that's a fixed transactional template), so "replying"
here means calling or emailing the customer outside the system and then
marking the message Replied/Closed. `/admin/service` is full repair-job
management: ticket numbers (`SVC-YYMM-NNNN`, mirroring `order-number.ts`'s
`Setting`-row-plus-advisory-lock counter pattern exactly), a real state
machine (`ticket-state-machine.ts`, same shape as
`order-state-machine.ts`, reusing the `CONFLICT_VERSION` error code for
an illegal transition rather than inventing a new one), an event
timeline, and internal notes.

**Reports.** `/admin/reports` — sales (today/7d/30d/month), top
products, stock levels (reuses `admin/inventory.ts`'s existing
`listStockForAdmin`), and search gaps. The search-gaps report reads the
real `SearchQueryLog` table, which `catalog/search.ts` has written to
unconditionally since Phase 4 — verified this wasn't a stub before
building a report on top of it.

**Branches, staff, settings, Activity History.** `/admin/branches` —
CRUD plus a full 7-day weekly-hours editor (`BranchHours`, upserted
every save, times nulled when a day is marked closed). `/admin/users` —
staff accounts with plain-language role descriptions lifted verbatim
from the seeded `ROLES`, a generated 16-character temporary password
shown once, and a self-deactivation guard (`AppError("VALIDATION_
FAILED", ...)` if a staff member tries to turn off their own account).
One simplification: a staff member holds exactly one role at a time
(`updateStaffRole` deletes all existing `UserRole` rows before creating
the new one), even though the schema supports many-to-many — flagged in
the service's own doc comment. `/admin/settings` — contact/shipping/
payment/feature settings grouped and rendered by `dataType` (boolean
switch, JSON textarea, number/text input), a dedicated shipping-pricing
screen (updates `ShippingRate.basePaisa` and `DeliveryZone.estimated
Days` together in one transaction), and a gateway-status screen showing
eSewa/Khalti/Fonepay/connectIPS as a static "not connected yet" list —
display only, since gateway integration itself stays out of scope for
the whole project until the very end, as instructed. Five new `Setting`
seed rows were added (`payments.emiEnabled`, `payments.emiRates`,
`features.enableReviews`, `features.enablePcBuilder`, `features.
maintenanceMode`) — like every other seed change in this codebase, these
need `pnpm db:seed` re-run on a real machine to actually appear.
`/admin/activity` — a plain-English feed over the `AuditLog` table that
already existed in full since Phase 5g; this pass only needed to build
the UI (`ACTION_SENTENCE` curated map for common actions, a generic
`humanizeAction` fallback, a compact before/after diff line).

**Help articles.** 12 in-product help articles from docs/09 §10, written
as typed TypeScript content (`src/content/admin-help.ts`) rather than
markdown-plus-parser, since the content is small and static enough that
adding a markdown pipeline wasn't worth it. All 12 are reachable from
the `/admin/help` index (already linked from the sidebar's existing,
previously-unwired "Help" nav item); 7 of the 12 are additionally wired
via a new `LearnMoreLink` component directly into the real screen they
explain: adding a product, understanding stock, creating a discount
code, adding a staff member, managing repair jobs, understanding Today,
and processing an order. The remaining 5 (what "Live"/"Not published"
mean, checking a bank transfer safely, page title and search
description, adding good photos, what to do when something looks wrong)
are fully written and live at their own URL, just not yet linked from a
specific screen — a minor, explicitly-noted gap rather than a silent
one. Screenshots mentioned in docs §10 are not included anywhere.

**Deferred entirely: first-time coach marks.** No onboarding-tooltip
system was built this pass. Given the priority order this session was
explicitly given ("help/coach-marks last as most skippable"), and that
12 real help articles plus a reachable Help index already give a new
admin user somewhere to go, coach marks were cut for budget reasons
rather than half-built. A future pass would need a small "seen this
tip" per-user preference (no existing table fits — nearest is `User`
itself, which has no JSON preferences column) plus a tooltip-anchoring
component; neither exists yet.

**Testing and verification.** New unit tests were added alongside every
new service module, following this codebase's existing per-service
`*.test.ts` convention (`vi.mock("@/server/db", ...)`, `recordAuditLog`
mocked, `beforeEach` resetting mocks): customers, coupons, campaigns,
reviews, enquiries, the ticket state machine, service tickets, reports,
activity, branches, staff, and settings. The full suite now stands at
**507 tests passing across 51 files**, with a clean `pnpm typecheck` and
a clean `pnpm lint` (zero warnings, `--max-warnings=0`). Help articles
and `LearnMoreLink` are static content/presentation with no service
logic, so no new tests were added for them specifically — consistent
with this codebase's own practice of testing service-layer logic, not
static content or thin presentational wrappers.

No Prisma schema changes were needed this phase beyond the five new
`Setting` seed rows — every model Phase 9 needed (`Customer`, `Review`,
`Coupon`/`CouponRedemption`, `Promotion`/`PromotionRule`, `Enquiry`,
`ServiceTicket`/`TicketEvent`, `Branch`/`BranchHours`, `User`/`Role`/
`Permission`/`UserRole`, `Setting`, `AuditLog`, `DeliveryZone`/
`ShippingRate`, `SearchQueryLog`, `ProductViewDaily`) already existed
from earlier phases with the right shape. Payment gateway integration
code itself remains completely untouched, per every prior session's own
instruction — still the last item for the whole project.

## Phase 10 — Content, Blog & Service Desk: done, in priority order

Worked in the priority order this session was explicitly given: blog
first, then CMS pages/menus, then FAQs/store locator/contact, then
service booking/status lookup/notifications, then the EMI calculator,
with newsletter double opt-in folded into the FAQ/store-locator/contact
batch since it shared the same "public form" shape. Every item in that
list shipped — nothing was cut for budget this time, though several
sub-pieces inside each item were deliberately narrowed and are flagged
below rather than silently dropped.

**The single biggest, pleasant surprise this phase:** every database
model Phase 10 needed — `Post`/`PostCategory`/`PostAuthor`, `Page`,
`Menu`/`MenuItem`, `Faq`, `NewsletterSubscriber`, `Branch` (already used
by Phase 9's admin), and the full `ServiceTicket`/`TicketEvent` set —
already existed in the schema since Phase 3, just unused by any real
code path. **Zero new Prisma models, and zero `prisma generate`/
migration steps, were needed this entire phase** — unlike the `RecoveryCode`
gap flagged back in Phase 3, there was nothing here to ask you to run on
a real machine.

**Blog** (`62f8115`). A real Tiptap-authored editor
(`components/admin/tiptap-editor.tsx`), but content is never trusted as
raw HTML at any point: `lib/tiptap/schema.ts`'s `tiptapDocumentSchema`
allow-lists a small, fixed set of node/mark types (paragraphs, headings,
lists, blockquote, code block, image, bold/italic/underline/strike/code/
link — with `isSafeHref` blocking anything except http(s)/relative/
mailto), and `lib/tiptap/render.tsx` walks that validated JSON tree
building real JSX per node — `dangerouslySetInnerHTML` is never used
anywhere in this feature (or anywhere in the codebase; the project's own
ESLint rule bans it outright). Reading time is computed server-side
(`lib/tiptap/reading-time.ts`, 200wpm). `/admin/blog` has full post/
category/author CRUD; `/blog`, `/blog/[slug]`, `/blog/category/[slug]`
are the public routes, with related products resolved through the
existing `catalog/product.ts` summary lookup, not a duplicated query.

**CMS pages + menus** (`16b2e52`). `Page` CRUD reuses the exact same
Tiptap-validation pattern as blog posts — one content-safety story, not
two. Menus are the more interesting half: `MenuItem` rows can target a
category, brand, page, or a raw URL, and `admin/menus.ts`'s
`checkMenuLinks()` is a real, on-demand broken-link checker — entity-
linked items are checked against live DB rows (category still active,
brand still exists, page still published), a `url` item is pattern-
matched against known internal route shapes and checked against the
real DB, or given a real `HEAD` request (5s timeout) if external, with
"unknown" (not "broken") on a network failure so a slow host is never
mislabelled as a dead link. Reorder is up/down buttons, not drag-and-
drop — flagged, not a silent simplification.

**FAQs, store locator, contact, newsletter** (`3be7dbe`). `/faq` (with
real `FAQPage` JSON-LD), `/stores` + `/stores/[slug]` (with `LocalBusiness`
JSON-LD and real opening hours from Phase 9's `BranchHours`), a genuine
`/contact` form (the first public path this codebase had into the
`Enquiry` inbox Phase 9's admin already reads from — verified by
grepping for `enquiry.create` before writing it), and newsletter double
opt-in (`content/newsletter.ts`): a subscribe issues an opaque token
stored the same way `auth/verify-email.ts` already does, confirming it
flips `NewsletterSubscriber.status` to `CONFIRMED`, and — since no email
provider exists anywhere in this codebase — the "email" is a structured
`logger.info` call, an honest, flagged gap rather than a fake send.
JSON-LD on both pages is embedded as `<script>` children text, never
`dangerouslySetInnerHTML`, with a `</` → `<` escape against a
literal `</script>` breakout. FAQs are general-only for now — no
per-product/per-category FAQ scoping in the public list yet, even
though the `Faq` model supports it.

**Service booking, status lookup, notifications** (`bbaedd5`).
`/service/book` creates a real `ServiceTicket` with no staff actor
(`actorId: null`, a genuinely different write path from
`admin/service-tickets.ts`'s staff-side `createTicket`, not a thin
wrapper around it) and immediately queues a status notification.
`/service/status` is the security-sensitive half: `getPublicTicketStatus`
requires the ticket number **and** the last 4 digits of the phone number
used to book — a wrong-phone-digits lookup throws the exact same
`NotFoundError` as a nonexistent ticket number (unit-tested to assert the
messages are byte-identical), so ticket numbers can't be enumerated one
digit at a time. Notifications (`ticket-notifications.ts`) queue a real,
durable `Job` row per status change rather than faking a send — same
honesty precedent as the newsletter's confirmation email — and a future
worker can drain `type: "ticket_notification"` jobs through a real SMS/
email provider without touching any call site built this phase. The
admin side (technician ticket views, the state machine) was already
built in Phase 9 and needed no rework, just the two-line notification
hook added to `applyTicketTransition`.

**EMI calculator** (`19e6aba`). `/emi-calculator` reads real per-bank
tenure/interest/fee data from the `payments.emiRates` `Setting` row —
flipped to `isPublic: true` this phase (it was `isPublic: false` and
unread by anything since Phase 9) and reshaped from a single flat
schedule into a genuine per-bank tenure list, since real Nepali bank EMI
terms differ by issuer, not just by tenure length (docs/10-PAYMENTS-
NEPAL.md §10's own bank table). `lib/emi.ts`'s `calculateEmi` is a pure,
paisa-safe function (asserts its principal via `assertPaisa`, rounds
every output with `Math.round`) with its own unit tests, extracted so
both this route and the pre-existing `components/commerce/emi-widget.tsx`
share one calculation rather than drifting. A malformed admin edit to
the settings JSON degrades to "no banks published" rather than 500ing
the page — `getPublicEmiData` validates the stored JSON with a real Zod
schema (`lib/validation/emi.ts`) before trusting it. The lead-capture
step ("have someone call me") writes a `GENERAL` `Enquiry`, same inbox
every other public form this phase feeds — docs/10 §10 is explicit this
is "content and lead capture, not a payment method," so there is no
checkout integration and none was attempted.

**What's deliberately deferred, flagged rather than faked:**

- **No nightly/scheduled broken-link sweep.** `checkMenuLinks()` is
  real and correct but only runs on-demand from the admin screen — there
  is still no scheduled-job runner in this project (same gap Phase 5e
  flagged for low-stock emails).
- **FAQ scoping to a specific product or category** isn't in the public
  `/faq` list yet, even though `Faq.productId`/`Faq.categoryId` exist —
  only general FAQs (`productId: null, categoryId: null`) are shown.
- **Menu reorder is up/down buttons, not drag-and-drop.**
- **No EMI badge or widget wired into the product detail page.**
  `components/commerce/emi-widget.tsx` was already built (Phase 2, prop-
  driven, never connected to real data) and is still only used in the
  `/design` showcase — wiring a "starting from Rs X/month" badge into a
  real PDP, and swapping `EmiWidget` itself onto the new per-bank-tenure
  settings data, is real follow-up work, not done this pass.
- **No real SMS/email transport anywhere** — ticket-status notifications
  and the newsletter confirmation both queue/log rather than send, the
  same honest gap every prior phase's PROGRESS.md section has flagged.
- **Newsletter unsubscribe has no per-address token** — it's a simpler,
  lower-severity flow than subscribe/confirm, flagged in
  `content/newsletter.ts`'s own doc comment.
- **No author avatar picker** in the blog admin — authors are text
  fields (name/bio) only.

**Testing and verification.** New unit tests were added alongside every
new service module: `lib/tiptap/schema.test.ts`, `lib/tiptap/reading-
time.test.ts`, `admin/blog.test.ts`, `admin/menus.test.ts` (including the
broken-link checker's category/page/internal-url/external-url/empty-item
scenarios), `content/newsletter.test.ts`, `service/ticket-notifications.
test.ts`, `service/public-tickets.test.ts` (with an explicit enumeration-
resistance assertion comparing error messages), `service/ticket-state-
machine.test.ts` (extended with the new notification hook), `content/
emi.test.ts` (including the malformed-JSON-degrades-safely case), and
`lib/emi.test.ts`. The full suite now stands at **573 tests passing
across 60 files**, with a clean `pnpm typecheck` and a clean `pnpm lint`
(zero warnings, `--max-warnings=0`). Commits: `62f8115` (blog), `16b2e52`
(CMS pages + menus), `3be7dbe` (FAQs/stores/contact/newsletter), `bbaedd5`
(service booking/status/notifications), `19e6aba` (EMI calculator).

Payment gateway integration itself remains completely untouched, per
every prior session's own instruction — still the last item for the
whole project.

## Phase 11 — SEO & Structured Data: done, six commits

Worked docs/11-SEO-STRATEGY.md's own dependency order: the JSON-LD
builder catalogue first (nothing downstream can render structured data
without it), then the `generateMetadata` cascade that wires those
builders (plus canonical/hreflang/pagination) onto every route, then
sitemaps/robots, then OG images, then the PDP thin-content gate, and
last the admin-facing SERP preview. Two things that read as separate
line items in docs/17-ROADMAP-PHASES.md turned out to already be
satisfied by earlier phases rather than needing new work: breadcrumb UI
(`components/layout/breadcrumbs.tsx`, `components/ui/breadcrumb.tsx`)
already existed pre-Phase-11 and only needed `BreadcrumbList` JSON-LD
wired alongside it (folded into the `generateMetadata` commit below,
not a separate deliverable), and related-products resolution already
lived in `catalog/product.ts` since Phase 4/10 and needed no rework.
Canonical, hreflang, and pagination metadata are likewise not a
standalone commit — they're clauses inside the same `generateMetadata`
cascade, per `metadata.ts`'s own doc comments (§2.4/§2.6/§9.3/§6.6).

**JSON-LD builder catalogue** (`74a69d1`). Ten-plus typed builders
under `src/lib/seo/jsonld/`: `Product` (with the zero-review
`aggregateRating` suppression rule — emitting a fabricated 0-review
rating is worse for trust than omitting the field), `BreadcrumbList`,
`Organization` (reads the `ORG_INFO` placeholder in `lib/seo/site.ts`,
flagged `DECISION REQUIRED` per docs/11 §4.1 pending the owner's real
legal name/PAN/VAT/phone/social links), `WebSite` + `SearchAction`,
`ComputerStore` (`LocalBusiness`), `BlogPosting`, `FAQPage`, `Service`,
`ItemList`/`CollectionPage`, `WebApplication`, and the PC-builder's own
`Product` bundle. `serializeJsonLd()` is the one function allowed to
turn a builder's output into the literal string that lands inside a
`<script type="application/ld+json">` tag — it escapes `<`, `>`, `&`,
and the two Unicode line-separator characters that can otherwise break
out of a script context, and every route uses it instead of
`JSON.stringify` directly. Every builder and the serialiser have their
own unit tests.

**`generateMetadata` + JSON-LD on every route** (`9289ad9`). All 15+
storefront routes (homepage, PDP, category, brand, search, blog list,
blog post, blog category, CMS pages, FAQ, stores index, store detail,
service book/status, build share, EMI calculator) now export a real
`generateMetadata`, not a static `metadata` object — title/description
built per-entity, a self-referencing absolute canonical
(`lib/seo/site.ts`'s `absoluteUrl`), `hreflang` alternates for every
`next-intl` locale via the same `localePath` helper the canonical uses
(one function owns that rule so it can't drift between the two), and
`noindex,follow` on any category/brand URL carrying a filter param
other than `page` (with canonical still pointing at the clean,
unfiltered URL). Pagination metadata (`rel="next"`/`rel="prev"`-
equivalent handling via canonical-per-page) rides the same cascade.
Breadcrumb JSON-LD was wired onto every route that already rendered
the pre-existing breadcrumb UI, rather than building new breadcrumb
components.

**Sitemaps + robots.txt** (`f170618`). `/sitemap.xml` is a real index,
sharded into six fixed-type child sitemaps (static routes, categories,
brands, posts, pages, branches) plus one 10,000-URL-chunked shard per
product, each revalidating hourly. `/robots.txt` is environment-aware:
production allows crawlers with a `Disallow` list covering every
admin/cart/checkout path, while staging/preview/local unconditionally
return `Disallow: /` so a non-production deploy can never leak into a
search index. Known AI-training crawlers are blocked; AI
answer/search crawlers (the ones that drive real referral traffic) are
explicitly allowed — a deliberate distinction, not an oversight.

**OG image routes + LCP priority hints** (`b12ea7b`). Branded
`opengraph-image` routes (Next's `next/og`, edge runtime) for the
homepage fallback, PDP (product photo + brand + price + availability
badge), category (name + live product count), and blog post (title +
author + reading time) — every shared link gets a real, on-brand
preview card instead of a blank one. Alongside that, `priority` hints
were added to the PDP's above-the-fold hero image so it isn't
lazy-loaded behind the fold, per docs/11's Core Web Vitals guidance.

**PDP thin-content gate** (`5768410`). docs/11 §6.5's exact table for
products (>= 120 words of unique description + >= 6 spec attributes +

> = 2 real photos, else `noindex` — all three floors independently, an
> "and" not an "or") is a real, tested gate (`lib/seo/thin-content.ts`),
> wired at the PDP route level so a thin product genuinely ships
> `noindex`, not just a defined-but-unused function. The doc has no
> numeric floor for blog posts or CMS pages, so this module makes its own
> documented, flagged call — 150 words, a common general-SEO substance
> floor — rather than leaving those two page families ungated.

**Admin SEO fields with live SERP preview** (`f20633c`, this session's
close-out commit). The prior pass had already left three files in
good shape, uncommitted: `serp-hint.ts`, a pure, tested module holding
the title/description character-count traffic-light logic, with its
thresholds (`TITLE_HARD_MAX`/`DESCRIPTION_HARD_MAX`) imported straight
from `metadata.ts` so the admin hint can never drift from the real
truncation behaviour; its test file; and a refactored
`seo-preview.tsx` that consumes `serp-hint.ts` instead of duplicating
the threshold constants inline (it had drifted from the doc before —
that drift is exactly why the constants now live in one place). All
three were correct as found and needed no changes. What was actually
missing was wiring: `SeoPreview` was only mounted in the product
wizard's Step 4. This commit mounts it — replacing a plain, unguided
text `<Input>`/`<Textarea>` pair — in the category form dialog, the
blog post form, and the CMS page form, each following the product
wizard's exact pattern (`pageUrl` built from the entity's real
storefront route — `/c/{slug}` for categories, `/blog/{slug}` for
posts, `/pages/{slug}` for CMS pages — and the entity's name/title
passed as `productNameForHint` for the "mentions the entity name"
check). Brand wasn't on the original required list, but its dialog
turned out to be a clean fit — same "reused-once, re-synced-on-open"
shape as the category dialog, and `metaTitle`/`metaDescription` already
had full schema and service support, just no editable UI — so it got
the same treatment (`pageUrl` from the real `/b/{slug}` storefront
route) rather than being left as the one inconsistent form.

**What's deliberately deferred, flagged rather than faked:**

- **`ORG_INFO` in `lib/seo/site.ts` is still placeholder data** — exact
  legal name, PAN/VAT, phone, and social `sameAs` URLs are docs/11
  §4.1's own `DECISION REQUIRED` item, pending the owner. The
  `Organization` JSON-LD builder omits `sameAs` entirely rather than
  emit an empty array while this is unresolved.
- **No component-rendering test infrastructure** (no jsdom/happy-dom,
  no `@testing-library/react`) exists in this project yet — `vitest
.config.ts`'s `environment: "node"` only globs `*.test.ts`. Rather
  than stand up a whole DOM-testing stack for one component,
  `serp-hint.ts` extracts `SeoPreview`'s actual decision logic into
  plain, directly-testable functions; the component itself is
  untested at the render level, same honest gap as every other
  `"use client"` component in this codebase.
- **Blog post / CMS page thin-content floors (150 words) are this
  session's own judgement call**, not a number from docs/11's table —
  flagged in `thin-content.ts`'s own doc comment.
- **No scheduled/nightly sitemap ping or re-crawl request** — the
  sitemap is correct and revalidates hourly on request, but nothing
  proactively tells Google/Bing it changed, the same class of gap
  Phase 5e (low-stock emails) and Phase 10 (broken-link sweep) already
  flagged for this project's total absence of a scheduled-job runner.

**Testing and verification.** New unit tests landed with every
service module this phase: the full `lib/seo/jsonld/*.test.ts` set (one
per builder, including the zero-review suppression case and the
`sameAs`-omission case), `lib/seo/jsonld/serialize.test.ts` (the
script-breakout escape), `lib/seo/metadata.test.ts`, `lib/seo/
sitemap.test.ts`, `lib/seo/site.test.ts`, `lib/seo/thin-content.test.ts`,
and `lib/seo/serp-hint.test.ts`. The full suite now stands at **703
tests passing across 78 files**, with a clean `pnpm typecheck` and a
clean `pnpm lint` (zero warnings, `--max-warnings=0`) — both re-run
after this session's admin-form wiring, not just carried over from the
earlier five commits. Commits: `74a69d1` (JSON-LD builder catalogue),
`9289ad9` (generateMetadata + JSON-LD on every route), `f170618`
(sitemaps + robots.txt), `b12ea7b` (OG images + LCP hints), `5768410`
(PDP thin-content gate), `f20633c` (admin SEO fields + SERP preview).

No bugs were found in the five commits that predated this session's
work — the audit this session did (reading `serp-hint.ts`,
`serp-hint.test.ts`, and the refactored `seo-preview.tsx` before
touching anything, then grepping every `SeoPreview` call site for
stale props) turned up one small leftover: `seo-preview.tsx` and its
callers briefly carried a redundant `slug` prop for the "Advanced
settings" website-link field, even though `pageUrl` already encodes
the same information. That was cleaned up (in the same uncommitted
working tree, before this session's commit) so `SeoPreview`'s public
API has exactly one source of truth for the link it displays.
