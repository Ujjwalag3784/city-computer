# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

**Latest session: the PC Builder's brain is real — build, save, and share
a build, and it actually checks compatibility.** A build can be created
and saved part-by-part, and `/build/[shortId]` is a real page anyone with
the link can open: parts list, price then-vs-now, a compatibility score,
a power meter, a balance meter, every issue in plain language, and a
working "Add to cart." Underneath, there's a genuine rule engine — 37
database-driven compatibility rules plus a generic connector-satisfaction
check — not a hardcoded checklist, tested against 19 golden builds
including the specific "Micro-ATX board + 420mm cooler + flagship GPU in
a Mini-ITX case" bad-build case this session asked for by name. What's
still missing: the actual interactive builder screen (Guided/Standard/
Expert modes, a live part picker, fix drawers) and the admin
parts/rule-tester screen — see "Phase 8" below for the full, honest
rundown.

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
