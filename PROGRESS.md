# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

While you were asleep: the entire Phase 2 design system got built (every
component in the blueprint, plus a `/design` page to see them all), and then
the backend half of Phase 3 — accounts, passwords, two-factor login, and
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

## Phase 4 onward: not started

Wiring the design system to real data (product pages, cart, checkout,
payments), the PC-builder's actual compatibility-checking logic, the admin
screens working against real orders/products, content/SEO, analytics,
automated testing (see the Playwright/axe item above), performance tuning,
and launch — per `docs/17-ROADMAP-PHASES.md`.
