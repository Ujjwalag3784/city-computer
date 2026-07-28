# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

**Latest session: Phase 4 is now finished.** There are real pages to click
through for the first time since the `/design` showcase: a homepage, category
pages, brand pages, individual product pages, and a search results page — all
showing live data from the database (the 20 dev-seed demo products, since
that's all that's in there right now), with working filters, sorting, and
pagination, and all switchable between English and Nepali. See "Phase 4 —
Catalogue" below for the plain-language version and what's still missing
(there's no "Add to cart" yet — that button exists but doesn't do anything
real), or keep reading for the fuller history.

Before that: the entire Phase 2 design system got built (every component
in the blueprint, plus a `/design` page to see them all), and then the
backend half of Phase 3 — accounts, passwords, two-factor login, and
who's-allowed-to-do-what — got built on top of it. Roughly 180 new files
across 12 commits, all passing type-checking, linting, and the test suite.

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
inline price/stock editing, categories and brands management, the photo
library, stock adjustment screens, and the admin's own search box. None
of the sidebar links to those sections do anything real yet if you click
them — they 404, rather than showing a half-built page.

## Phase 6 onward: not started

Cart, checkout, payments, the PC-builder's actual compatibility-checking
logic, content/SEO, analytics, automated testing (see the Playwright/axe
item above), performance tuning, and launch — per
`docs/17-ROADMAP-PHASES.md`.
