# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## Good morning — start here

While you were asleep, the entire Phase 2 design system got built: every
primitive, every layout piece, every commerce/PC-builder/admin component in
the blueprint, plus a single page where you can see all of it at once. That's
roughly 165 new component files across 9 commits, all passing type-checking,
linting, and the existing test suite.

### What you need to do this morning

1. **Pull the changes and reinstall.** From the `CityComputer` folder:
   ```bash
   git log --oneline -15   # see everything that landed overnight
   pnpm install             # picks up the new "recharts" chart library
   ```
2. **Look at the result.** Run `pnpm dev` and open:
   - `http://localhost:3000/design` — this is the big one. It's a single
     page showing every button, card, form, product card, cart, PC-builder
     screen piece, and admin screen piece in the whole design system, all in
     one scrollable page with a jump-menu at the top. Click things — most of
     it actually works (sorting, filters, dialogs, the quantity steppers,
     etc.), not just pictures.
   - `http://localhost:3000/` — the small homepage checkpoint from earlier,
     unchanged.
3. **One naming decision for you.** The blueprint document calls this page
   `/_design`. It turns out Next.js (the framework) treats any folder name
   starting with an underscore as "private" and refuses to make it into a
   real web page — so I built it at `/design` instead (no underscore) and
   made sure it's marked "don't show this in Google search results." If you
   want a different name, or want it protected behind a login later, just
   say so — it's a five-minute rename.
4. **Nothing is wired to real data yet.** Every single component you'll see
   at `/design` (and everywhere else) is currently fed made-up example data
   — fake product names, fake prices, fake orders. That's expected at this
   stage. Connecting it to your real database is the next phase.
5. **No action needed on the database.** That part was already finished in
   an earlier session and doesn't change tonight's work.

If anything at `/design` looks visually broken to you (not "unfinished," but
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

## Phase 3 — Data Layer & Auth: partly done

**Done:** the full database design (`prisma/schema/*.prisma`, ~75 models),
the manual SQL constraints, the one shared database-connection file, and the
seed data (roles, branches, categories, ~10 demo products, ~22 PC-builder
parts). This was finished in an earlier session, before tonight, and hasn't
changed.

**Not done:** logging in and creating accounts (Auth.js), password security,
who's-allowed-to-do-what rules (RBAC), the extra security step for staff
logins (two-factor), and the actual login/signup pages. This is real,
security-sensitive work that's best done with fresh attention rather than
tacked onto an overnight session — deliberately left for you to kick off
when you're ready, rather than rushed.

## Phase 4 onward: not started

Wiring the design system to real data (product pages, cart, checkout,
payments), the PC-builder's actual compatibility-checking logic, the admin
screens working against real orders/products, content/SEO, analytics,
automated testing (see the Playwright/axe item above), performance tuning,
and launch — per `docs/17-ROADMAP-PHASES.md`.
