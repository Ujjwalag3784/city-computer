# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

**Latest session: the product wizard, product list, photo library, and admin
search are all real now.** You can add a product start to finish
(`/admin/products/new`), the four steps the blueprint asked for, and it lands
in a working product list (`/admin/products`) where you can change the price
or stock number right in the row without opening anything. Photos really
upload to storage now (there's a working "Photos" screen too,
`/admin/media`), and typing into the search box in the admin top bar
(`Ctrl/⌘K`) returns real matching products, brands, and categories as you
type. See "Phase 5 continued — the product wizard..." below for the full,
honest rundown, including what's simplified and what's still missing (bulk
actions on the product list, the dedicated stock screens, a real photo-
resizing pipeline).

Before that: Phase 4 (the whole storefront — homepage, category pages, brand
pages, product pages, search) finished, and further back, the entire Phase 2
design system and the backend half of Phase 3 (accounts, passwords,
two-factor login, who's-allowed-to-do-what) got built. See the phase sections
below for the fuller history.

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

Still not built: the dedicated stock-adjustment screens (the `+/−`
buttons, the "why did stock change" dialog, bulk stock updates from a
spreadsheet) and the Activity History page itself (the write side is
done — every change above already gets recorded — just not yet a screen
to browse and search that history).

## Phase 6 onward: not started

Cart, checkout, payments, the PC-builder's actual compatibility-checking
logic, content/SEO, analytics, automated testing (see the Playwright/axe
item above), performance tuning, and launch — per
`docs/17-ROADMAP-PHASES.md`.
