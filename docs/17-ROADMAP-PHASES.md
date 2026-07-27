# 17 — Development Roadmap

Seventeen phases, numbered 0–16. Each has objectives, deliverables, dependencies, risks, acceptance criteria, and a validation checklist. **No phase begins until the previous phase's acceptance criteria are all met and verified.**

**Depends on:** all preceding documents. **Feeds into:** `18`.

Complexity scale: **S** ≈ 1–2 days · **M** ≈ 3–5 days · **L** ≈ 1–2 weeks · **XL** ≈ 2–4 weeks. These are effort estimates for a focused implementer, not calendar commitments.

---

## Phase overview

| # | Phase | Complexity | Blocks |
|---|---|---|---|
| 0 | Discovery, Decisions & Procurement | M | Everything |
| 1 | Foundation & Tooling | M | 2+ |
| 2 | Design System | L | 4+ |
| 3 | Data Layer & Auth | L | 4+ |
| 4 | Catalogue — Read Path | L | 5, 6 |
| 5 | Admin Core & Product Management | XL | 6, 9 |
| 6 | Cart & Inventory | L | 7 |
| 7 | Checkout & Payments | XL | 8 |
| 8 | PC Builder Engine | XL | — |
| 9 | Admin Complete (Dad Mode) | L | — |
| 10 | Content, Blog & Service Desk | L | 11 |
| 11 | SEO & Structured Data | L | 14 |
| 12 | Analytics & Marketing | M | — |
| 13 | Performance Optimisation | M | 14 |
| 14 | Data Migration & Redirects | L | 15 |
| 15 | Hardening, Testing & Launch | L | 16 |
| 16 | Documentation, Handover & Stabilisation | M | — |

Phases 8 and 10 are parallelisable with 9 if capacity allows. Everything else is strictly sequential.

---

## Phase 0 — Discovery, Decisions & Procurement

**Objective:** eliminate every unknown that would otherwise block a later phase, and start the long-lead procurement items.

| | |
|---|---|
| **Deliverables** | Signed-off answers to every `DECISION REQUIRED` in `19` · hosting decision made (`03 §9`) · eSewa and Khalti merchant applications submitted · **connectIPS conversation opened with the bank** (longest lead time) · SMS provider selected and contracted · written fee schedules requested from all payment providers · GA4, GTM, Meta Business, TikTok Business, Clarity, Sentry accounts created · domain and DNS moved behind Cloudflare · full legacy URL inventory exported from GSC, sitemap and server logs · WooCommerce data export taken · category taxonomy remap reviewed and approved by the owner · Nepali copy owner named · legal review of privacy policy and terms commissioned |
| **Dependencies** | None |
| **Risks** | Payment onboarding is slower than expected (**high** — mitigate by starting now and by shipping with COD + bank transfer if necessary) · the owner defers decisions (mitigate: a decision log with dates) |
| **Acceptance** | Zero open `DECISION REQUIRED` items that block Phases 1–7 · hosting chosen · at least two payment applications submitted · legacy URL inventory exported and counted · taxonomy remap signed off |
| **Validation** | Decision log reviewed with the owner; every item has an answer or an explicit, dated deferral with a named owner |

---

## Phase 1 — Foundation & Tooling

**Objective:** a repository that enforces its own standards from the first commit.

| | |
|---|---|
| **Deliverables** | Next.js 15 + TypeScript strict scaffold · folder structure per `04` · ESLint flat config with module-boundary rules, security plugin, jsx-a11y, and the admin copy lint · Prettier · husky + lint-staged + commitlint + gitleaks · `src/env.ts` Zod validation · Pino logger · `AppError` hierarchy + problem-details mapper · `lib/money.ts`, `lib/date.ts`, `lib/nepal.ts`, `lib/ids.ts`, `lib/slug.ts` with full unit tests · `docker-compose.yml` (postgres, redis, minio, meilisearch, mailpit) · Dockerfile · GitHub Actions CI with every gate wired (initially permissive thresholds) · Sentry · `/api/health` · `docs/` committed into the repo · README with ≤ 10-command setup |
| **Dependencies** | Phase 0 hosting decision |
| **Risks** | Over-engineering the scaffold (mitigate: no feature code in this phase) |
| **Acceptance** | `pnpm install && docker compose up -d && pnpm db:migrate && pnpm dev` works on a clean machine · CI runs green on an empty PR · a deliberately bad commit is blocked by the hooks · `lib/money.ts` is at 100% coverage · a secret in a commit is caught by gitleaks |
| **Validation** | A second person clones and runs the setup from the README with no verbal help |

---

## Phase 2 — Design System

**Objective:** every visual primitive exists, correct and accessible, before any page is built.

| | |
|---|---|
| **Deliverables** | `globals.css` with the full Obsidian Peak `@theme` token map (`05 §1`) · **all 14 Stitch corrections applied** (`01 §C.3`) — radius scale restored, base colour unified, glass and glow consolidated, fonts single-keyed · `next/font` for Geist, Inter, JetBrains Mono · typography utilities · all shadcn primitives restyled · layout components including **MobileNav** · commerce components · admin components · `formatNPR()` · `next-intl` wiring with `en`/`ne` routing · every component in every state (default, hover, focus, disabled, loading, empty, error) · a `/_design` route rendering the complete inventory · contrast audit |
| **Dependencies** | Phase 1 |
| **Risks** | Copying prototype markup verbatim and inheriting the radius bug (**high** — explicitly checked in review) · dark-only contrast failures (mitigate: audit before building pages) |
| **Acceptance** | `/_design` renders every component and variant · axe reports zero violations there · **no hardcoded colour, radius, spacing or font value exists in any component** (grep-verified) · every contrast pair passes AA · mobile nav works at 375px · `prefers-reduced-motion` disables all transitions |
| **Validation** | Side-by-side comparison with the Stitch screenshots; each of the 14 corrections confirmed applied |

---

## Phase 3 — Data Layer & Authentication

**Objective:** the schema and identity model that everything else depends on.

| | |
|---|---|
| **Deliverables** | Complete Prisma schema per `06`, split across `prisma/schema/*.prisma` · all migrations · all `CHECK` constraints · append-only table permissions revoked at the DB role level · all indexes including GIN/trigram · FTS trigger · Prisma soft-delete extension · full seed data (roles, permissions, branch, zones, settings, taxonomy, 15 spec templates, connector registry, compatibility rules, demo catalogue, 60 builder parts) · Auth.js v5 with credentials + Google · Argon2id · session strategy · RBAC permission layer with `requirePermission()` · admin 2FA (TOTP) · rate limiting on auth · registration, verification, login, reset flows · account shell |
| **Dependencies** | Phase 1 |
| **Risks** | Schema churn later (mitigate: `06` is thorough; changes require an ADR) · getting money types wrong (mitigate: 100% coverage on `lib/money.ts` first) |
| **Acceptance** | All migrations apply cleanly from empty · seed produces a working dataset · every `CHECK` constraint has a test that proves it rejects bad data · `UPDATE`/`DELETE` on append-only tables fails at the DB level · the full authorisation matrix test passes for every role × route · admin 2FA is enforced · password reset invalidates all sessions |
| **Validation** | `prisma migrate reset && pnpm db:seed` produces a browsable dataset; the authorisation matrix test is green |

---

## Phase 4 — Catalogue Read Path

**Objective:** the storefront's discovery surface, fast and indexable.

| | |
|---|---|
| **Deliverables** | Home page with typed `HomeSection` blocks · category pages `/c/[...slug]` with nested resolution via materialised path · brand pages · PDP with gallery, variants, spec table, branch availability, related products · faceted filtering driven by `ProductSpec` · sort · pagination · search + autocomplete on Postgres FTS + trigram · `/compare` · wishlist · recently viewed · `SearchQueryLog` including zero-result capture · ISR + cache tags · loading, empty and error states for every surface |
| **Dependencies** | Phases 2, 3 |
| **Risks** | Facet query performance (mitigate: cache counts, `EXPLAIN ANALYZE` in the PR) · variant/price resolution edge cases |
| **Acceptance** | A category page with 5 active filters renders p95 < 250 ms server-side · autocomplete p95 < 100 ms · every route has loading and empty states · zero-result searches are logged · bundle budgets met · Lighthouse ≥ 90 on `/`, a category and a PDP |
| **Validation** | Manual browse of the seeded catalogue on a throttled mobile profile; facet counts verified against the database |

---

## Phase 5 — Admin Core & Product Management

**Objective:** the owner can run the catalogue. This is the phase most likely to be under-scoped.

| | |
|---|---|
| **Deliverables** | Admin shell with sidebar (sheet on mobile), top bar, permission-gated navigation · **the four-step product wizard** (`09 §5.1`) with duplicate detection, live SEO preview, publish readiness checklist, autosave · category-driven spec templates · media library with drag-drop upload, presigned direct-to-S3, server-side derivative generation, auto alt text, checksum deduplication · product list with inline price and stock editing, filters, bulk actions · categories and brands management with drag ordering · `AuditLog` on every mutation · `UndoToast` · `ConfirmDialog` · `HelpBubble` · in-product help articles · global search (`09 §9`) |
| **Dependencies** | Phases 3, 4 |
| **Risks** | **Underestimating Dad Mode** (**high** — the wizard, helper text, and error prevention are the deliverable, not decoration) · media pipeline complexity |
| **Acceptance** | A naive user creates and publishes a complete product in under 5 minutes, unaided · every field has a label or helper text · the copy lint passes with zero forbidden terms · every mutation appears in Activity History · every destructive action is confirmed · duplicate-name detection fires on the seeded MacBook Neo pair · admin usable at 375px · axe clean |
| **Validation** | **Observed usability test with two naive participants.** This is a gate, not a formality. |

---

## Phase 6 — Cart & Inventory

**Objective:** correct stock behaviour under concurrency.

| | |
|---|---|
| **Deliverables** | Cart (guest cookie + customer persistence + merge on login) · mini-cart drawer · cart page · price re-resolution with `warnings[]` · coupon application · `StockLevel` / `StockMovement` / `StockReservation` services · reservation TTLs by payment method · release job · stock integrity check job · admin stock screen: quick adjust with mandatory reason, bulk update, spreadsheet upload with preview-before-apply, low-stock alerts, movement history |
| **Dependencies** | Phases 4, 5 |
| **Risks** | **Overselling under concurrency** (**high** — the defining risk of this phase) |
| **Acceptance** | 10 concurrent orders for the last unit → exactly one succeeds · `StockLevel` always equals `SUM(StockMovement)` after any sequence · no stock change is possible without a recorded reason · reservations expire and release correctly · spreadsheet upload never applies without confirmation · cart warnings surface on price and stock change |
| **Validation** | Concurrency integration tests green; the k6 flash-sale scenario shows no oversell |

---

## Phase 7 — Checkout & Payments

**Objective:** money moves correctly, including when the network does not cooperate.

| | |
|---|---|
| **Deliverables** | Three-step checkout matching the approved design · Nepal address model with zone resolution · delivery vs pickup · shipping rates · VAT-inclusive totals · order placement transaction · `Order` state machine with declarative transitions · order numbers · payment abstraction + `PaymentProvider` interface · **value-tiered method availability** (`10 §5`) · COD with all controls · bank transfer with receipt upload and two-person approval · **eSewa ePay v2** against sandbox · **Khalti KPG-2** against sandbox including refunds · callback handlers · webhook handlers with signature, replay and dedupe protection · **reconciliation cron** · invoice PDF · order confirmation, pending and failed states · order tracking · transactional emails · admin order management with the visual tracker, one-click transitions, undo, and quick actions |
| **Dependencies** | Phase 6; Phase 0 payment credentials |
| **Risks** | **Payment provider onboarding delay** (**high** — the reason it starts in Phase 0) · async confirmation handling · Fonepay's undocumented API (deferred out of this phase deliberately) |
| **Acceptance** | All 25 adversarial payment tests pass (`16 §5`) · a payment confirmed only by the reconciliation sweep still settles correctly and exactly once · no client-supplied price or discount is ever honoured · a NPR 400,000 cart does not offer eSewa · bank-transfer approval requires a second approver above the threshold · every payment interaction is recorded in `PaymentEvent` · E2E journeys E1–E5 pass |
| **Validation** | Full sandbox transaction matrix — success, cancel, timeout, back-button, duplicate callback, replayed webhook, amount mismatch — with the outcome documented for each |

---

## Phase 8 — PC Builder Engine

**Objective:** the differentiating feature, built to the standard in `08`.

| | |
|---|---|
| **Deliverables** | `ComponentPart` / `PartConnector` / `CompatibilityRule` data layer · Zod spec schemas for all 16 part types · declarative rule engine · **the full 45+ rule catalogue including every physical-fit rule** · connector satisfaction check · power model with transient headroom · balance/bottleneck model · recommendation and auto-build solver · three modes (Guided, Standard, Expert) · slot cards in all states · virtualised faceted part picker with prevention-first filtering and a "show incompatible" escape hatch · compatibility panel with Fix drawers · power and balance meters · autosave, save, `shortId` share links, revisions, print, PDF quotation, export · public `/build/[shortId]` page · build comparison · add-build-to-cart · admin parts and rules management with a mandatory rule tester · builder analytics events · mobile layout with sticky summary bar |
| **Dependencies** | Phases 4, 6 |
| **Risks** | **Component spec data quality** (**high** — see `08 §11`; mitigate with `dataConfidence` gating and a narrow launch catalogue) · rule-engine complexity · validation latency |
| **Acceptance** | The golden-build suite passes, **including the reference app's invalid build producing ≥ 3 errors** · every auto-build across 100 random inputs validates with zero errors · with `compatibleOnly` on, no selectable part can produce an error · validation p95 < 300 ms · picker p95 < 200 ms over 5,000 parts · no `UNVERIFIED` part triggers a blocking error · E2E journeys E8–E10 pass · fully usable on mobile |
| **Validation** | A hardware-literate reviewer attempts to construct five physically impossible builds; every one is prevented or flagged with a correct, plain-language reason |

---

## Phase 9 — Admin Complete

**Objective:** every remaining admin module, to the same Dad Mode standard.

| | |
|---|---|
| **Deliverables** | The **"Today" dashboard** (`09 §4`, `12 §12`) from first-party rollups · customers with COD blocking and notes · coupons and campaigns · reviews moderation · enquiries inbox · service ticket management · reports (sales, products, inventory, search gaps) · branches and hours · staff accounts with plain-language roles · settings (contact, shipping zones, payment tiers, COD cap, EMI rates, feature flags, gateway health) · Activity History · all remaining in-product help articles · first-time coach marks |
| **Dependencies** | Phases 5, 6, 7 |
| **Risks** | Dashboard query performance (mitigate: rollup tables, never raw aggregation) |
| **Acceptance** | The dashboard answers all twelve business questions above the fold or one click away, with no chart required · every number links to the list behind it · dashboard loads p95 < 400 ms · every module passes the copy lint and axe · all twelve help articles exist and are reachable in context |
| **Validation** | Second observed usability session: a naive user processes an order end to end, checks a bank transfer, and updates stock, unaided |

---

## Phase 10 — Content, Blog & Service Desk

**Objective:** the organic-acquisition surface and the repair business, both editable by non-technical staff.

| | |
|---|---|
| **Deliverables** | Blog with categories, authors, Tiptap editor, sanitised rendering, reading time, related products · CMS pages with templates · menus editable in admin with a broken-link check · FAQs · store locator and branch pages · service booking flow · `ServiceTicket` state machine · public status lookup gated by ticket number + phone digits · technician admin views · ticket notifications · EMI calculator with per-bank tenures from settings · contact form · newsletter with double opt-in |
| **Dependencies** | Phases 3, 5 |
| **Risks** | Rich-text XSS (mitigate: JSON schema validation, never raw HTML) · content authoring effort underestimated |
| **Acceptance** | Blog and pages render server-side and are indexable · no raw HTML is ever accepted or stored · menu items resolve to entities and a nightly job flags broken links · service booking issues a ticket, sends notifications, and the public status page works · EMI figures are editable in settings without a deploy |
| **Validation** | XSS payloads attempted in every rich-text field; menu link checker run against the seeded menu |

---

## Phase 11 — SEO & Structured Data

**Objective:** make everything already built discoverable, correctly described, and safe to migrate onto.

| | |
|---|---|
| **Deliverables** | Metadata resolution cascade with templates · `generateMetadata` on every route · complete JSON-LD builders (`11 §4`) with the **zero-review rating suppression rule** · sitemap index and all children · generated environment-aware `robots.txt` · canonical policy including faceted-navigation handling · hreflang matrix · pagination policy · dynamic OG image routes · image SEO (naming, alt generation, `sizes`, priority) · breadcrumbs everywhere · internal linking (hub-and-spoke, related products, buying-guide cross-links) · programmatic price and comparison pages behind a review queue · thin-content guards · admin SEO fields with live SERP preview and traffic-light hints |
| **Dependencies** | Phases 4, 10 |
| **Risks** | Emitting invalid or over-claimed structured data (mitigate: validate every route type; the zero-review rule is explicitly tested) |
| **Acceptance** | Every route type emits a valid, self-referencing absolute canonical · every route type's JSON-LD passes the Rich Results Test and the Schema Markup Validator · **no `AggregateRating` for a zero-review product** · `og:type` is never `article` on a PDP · sitemaps respect limits and exclude `noindex` · hreflang is reciprocal · no `ne` page with a pure English fallback body is indexable · Lighthouse SEO ≥ 95 on six route types · every `<h1>` ≤ 70 characters |
| **Validation** | Automated crawl of the staging site asserting canonical, robots, hreflang and JSON-LD validity on a sample of every route type |

---

## Phase 12 — Analytics & Marketing

**Objective:** measure the business truthfully, including payments that settle hours after the customer leaves.

| | |
|---|---|
| **Deliverables** | Consent banner + Consent Mode v2 defaults · GTM container with naming conventions · `pushEvent()` helper and `dataLayer` contract · explicit App Router page_view handling · all GA4 e-commerce events · all custom events (`12 §3.3`) · **server-side `purchase`/`refund` via Measurement Protocol with idempotency** · Meta Pixel + CAPI with `event_id` dedupe · TikTok Pixel + Events API · Microsoft Clarity with the full masking spec and admin exclusion · GSC and Bing setup · GSC API ingestion into the admin · first-party analytics tables and nightly rollups · Meta catalogue feed · lifecycle email sequences · abandoned cart and abandoned build jobs · back-in-stock alerts · post-purchase review requests · WhatsApp deep links |
| **Dependencies** | Phases 7, 9, 11 |
| **Risks** | Double-counted or missing pageviews in App Router (**known pitfall** — explicitly tested) · purchase events firing from the redirect page |
| **Acceptance** | Nothing fires before consent (verified in a clean network trace) · exactly one `page_view` per navigation across 10 navigations in DebugView · a test purchase produces exactly one server-dispatched `purchase` · a payment settled 30 minutes later by the sweep still produces exactly one · Meta dedupe rate > 80% · Clarity absent from `/admin/*` and a sample recording shows no PII · GA4 revenue reconciles with the database within 2% over 7 days |
| **Validation** | End-to-end measurement test: complete a sandbox purchase and trace the event through GA4 DebugView, Meta Events Manager, and the database |

---

## Phase 13 — Performance Optimisation

**Objective:** meet the budgets on a mid-range Android over Kathmandu 4G, not on a developer's laptop.

| | |
|---|---|
| **Deliverables** | Caching layers finalised (edge, ISR, Redis) with the cache tag registry · facet count caching · materialised views · denormalised counters · connection pooling · statement timeouts · N+1 elimination pass · bundle analysis and dynamic-import pass · **the design's paint-cost mitigations applied** (`14 §6`) · image pipeline verification · font optimisation · Web Vitals field reporting · Lighthouse CI thresholds raised to final values · bundle budget enforcement · load testing with k6 · Meilisearch behind the `SearchProvider` interface (optional if Postgres FTS meets targets) |
| **Dependencies** | Phases 4–12 |
| **Risks** | Cache invalidation bugs producing stale prices or stock (**high** — mitigate: TTL backstops on every cached entry, and never cache availability) |
| **Acceptance** | All per-route budgets met · Lighthouse ≥ 90 performance on mobile for all measured routes · all API latency targets met · edge cache hit ratio > 80% · every k6 scenario passes, **especially no oversell under the flash-sale profile** · no stale price or stock observable after an admin change (verified manually) |
| **Validation** | Real-device test on a mid-range Android over Kathmandu 4G; field Web Vitals collected from staging |

---

## Phase 14 — Data Migration & Redirects

**Objective:** move the catalogue, the customers and — critically — the SEO equity, losing nothing.

| | |
|---|---|
| **Deliverables** | The full 12-step migration per `06 §13.2` · taxonomy remap applied · product deduplication · spec-table parsing into `ProductSpec` with a review queue · media re-processing with deterministic naming and regenerated alt text · customer and order import as historical records · title splitting into `name`/`displayTitle`/`metaTitle` · the complete `Redirect` table · middleware redirect handling · a legacy-URL crawl verification script · a dry run into staging with a diff report |
| **Dependencies** | Phases 3–11; Phase 0 exports |
| **Risks** | **Spec-table parsing is hand-written HTML with inconsistent labels** (**high** — budget real human review time; do not let the importer guess) · losing SEO equity through missed redirects (**high**) |
| **Acceptance** | Entity counts match the source · zero duplicate slugs · ≥ 90% of spec rows mapped, remainder queued for review not discarded · **a crawl of the complete legacy URL inventory returns zero 404s and zero redirect chains** · no `sdfgwfv`-class filename survives · no alt text contradicts its product · no `<h1>` over 70 characters · re-running the import produces no duplicates |
| **Validation** | 30 products spot-checked against the live WordPress site by a human; full legacy crawl report reviewed |

---

## Phase 15 — Hardening, Testing & Launch

**Objective:** prove the system is safe to run with real money and real customer data, then launch it.

| | |
|---|---|
| **Deliverables** | Full security checklist (`13 §17`) · CSP moved from report-only to enforcing · external penetration test and remediation · complete E2E suite green · load tests passed · **backup restore drill within RTO** · rollback drill · all runbooks written · monitoring and alerting configured and tested · staging `noindex` verified · production `noindex` absence verified in CI · manual QA complete · **Dad-mode usability gate passed** · legal review complete · launch-day execution per `11 §10.4` |
| **Dependencies** | All prior phases |
| **Risks** | Discovering a P1 late (mitigate: the security and adversarial tests run from Phase 7 onward, not here) · launching before payment credentials are live (mitigate: launch with COD + bank transfer if necessary and add gateways behind feature flags) |
| **Acceptance** | Every item in `16 §10` release gates is checked · penetration test high findings remediated · restore drill completed within RTO and recorded · zero open P1 or P2 defects · security headers grade A · TLS A+ |
| **Validation** | Go/no-go review against the release gate checklist with the owner present |

---

## Phase 16 — Documentation, Handover & Stabilisation

**Objective:** make the system operable and maintainable by people who did not build it.

| | |
|---|---|
| **Deliverables** | `docs/` reconciled with the shipped system (any divergence either fixed in code or amended in the document with an ADR) · all runbooks final · owner training session recorded · in-product help articles reviewed by the owner · a one-page "what to do if" card for the shop · 30/60/90-day monitoring per `11 §10.5` · a prioritised post-launch backlog · a v2 scope note (B2B quotations, WhatsApp Business API, card acquiring, Fonepay, loyalty, native app) |
| **Dependencies** | Phase 15 |
| **Risks** | Documentation drift beginning immediately (mitigate: the quarterly blueprint review in `16 §12`) |
| **Acceptance** | The owner independently performs all routine tasks in a recorded session · every runbook has been executed at least once by someone other than its author · no undocumented divergence between `docs/` and the code · post-launch monitoring is live with alert routing confirmed |
| **Validation** | Handover session with the owner; a developer unfamiliar with the project builds and deploys to staging using only the documentation |

---

## Critical path

```
0 ──► 1 ──► 2 ──► 3 ──► 4 ──► 5 ──► 6 ──► 7 ──────────────► 15 ──► 16
                              │           │
                              │           └──► 8 (builder) ──┤
                              │                              │
                              ├──► 9 (admin complete) ───────┤
                              │                              │
                              └──► 10 ──► 11 ──► 12 ──► 13 ──┤
                                                             │
                                          14 (migration) ────┘
```

**The longest pole is not code — it is payment provider onboarding.** connectIPS is bank-mediated with no public documentation and no published timeline. It is started in Phase 0 for that reason, and Phase 7 is designed to ship without it. Fonepay, connectIPS and card acquiring are all post-launch, feature-flagged additions rather than build phases.

---

## Contingency: a reduced launch scope

If schedule pressure forces a cut, this is the order in which scope is removed. **Nothing above the line may be cut.**

| Keep — launch is meaningless without it |
|---|
| Catalogue, PDP, search, faceted filtering |
| Cart, checkout, orders, order tracking |
| At least one online payment method + COD + bank transfer |
| Admin: products, stock, orders, dashboard |
| SEO: metadata, structured data, sitemaps, **redirects** |
| Performance budgets |
| Security controls |
| Backups with a verified restore |

| Defer, in this order |
|---|
| 1. Nepali localisation (ship `en` only; add `ne` in Phase 16+) |
| 2. Service & repair module |
| 3. Blog and programmatic SEO pages |
| 4. Build comparison, auto-build, upgrade suggestions (keep the core builder) |
| 5. Product comparison, reviews, wishlist |
| 6. Multi-branch (launch single-branch; the schema already supports more) |
| 7. TikTok and Clarity (keep GA4 and Meta) |
| 8. EMI calculator (ship as static content) |

**The PC Builder core is not deferrable.** It is the reason this rebuild exists, and it is already advertised on the current homepage with nothing behind it.
