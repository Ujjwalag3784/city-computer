# City Computer Systems — Master Implementation Blueprint

**Project codename:** `citycomputer`
**Document status:** v1.0 — Architecture frozen, pending the decisions listed in `19-ASSUMPTIONS-RISKS-DECISIONS.md`
**Date:** 27 July 2026
**Audience:** Claude Sonnet (implementing agent), plus the human product owner
**Rule:** This bundle is the single source of truth. No implementation decision may contradict it. Where a document and the code disagree, the document wins until the document is amended.

---

## 1. What is being built

A complete replacement for `https://citycomputer.com.np/` — currently WordPress + WooCommerce + Elementor — with a purpose-built, enterprise-grade e-commerce platform for a Kathmandu computer retailer.

The platform has five product surfaces:

| Surface | Description | Primary user |
|---|---|---|
| **Storefront** | Catalogue, product pages, cart, checkout, accounts, order tracking | Nepali consumers, mostly on mobile 4G |
| **PC Builder** | A compatibility-validated custom-PC configurator with shareable builds | Enthusiasts, gamers, creators, students |
| **Service desk** | Repair/servicing booking, ticket status lookup | Walk-in and online repair customers |
| **Admin ("Dad Mode")** | Plain-language business management console | A non-technical shop owner + 1–3 staff |
| **Content** | Blog, buying guides, price pages, store pages | Organic search acquisition |

### Non-negotiable characteristics

1. **The admin panel must be usable by someone who has never used Shopify or WordPress.** This constrains the data model, not just the UI. See `09-ADMIN-DAD-MODE.md`.
2. **The PC Builder must prevent impossible builds, not merely complain about them.** This is the single largest differentiator versus the reference implementation. See `08-PC-BUILDER-ENGINE.md`.
3. **Payment must degrade gracefully by order value.** No Nepali wallet clears a NPR 400,000 laptop. See `10-PAYMENTS-NEPAL.md`.
4. **SEO is the acquisition strategy.** `price in Nepal` intent queries are the whole game. See `11-SEO-STRATEGY.md`.
5. **Performance is measured on a Kathmandu 4G phone, not a developer's laptop.** See `14-PERFORMANCE.md`.

---

## 2. Locked decisions

These were confirmed by the product owner and are not open for re-litigation during implementation.

| Decision | Value |
|---|---|
| Architecture shape | **Next.js 15 full-stack monolith** (App Router, Route Handlers, Server Actions) — single repository |
| Languages | **Bilingual: English (default, unprefixed) + Nepali (`/ne/...`)** |
| Multi-branch | **Yes** — per-branch stock, in-store pickup, store locator |
| Service & repair | **Yes** — booking, ticketing, public status lookup |
| B2B quotations | **Out of scope for v1**, data model must not preclude it |
| Deliverable format | Multi-file Markdown blueprint (this bundle) |
| Hosting | **Open** — decision matrix in `03-TECHNOLOGY-STACK.md §9`, must be resolved before Phase 0 exit |

---

## 3. Document map

Read in order. Each document declares its dependencies.

| # | Document | Purpose | Required before |
|---|---|---|---|
| `00` | **Master Index** (this file) | Orientation, conventions, glossary | Everything |
| `01` | [Discovery & Audit](./01-DISCOVERY-AND-AUDIT.md) | Teardown of the current site, the AI PC Builder reference, and the Stitch designs | Phase 0 |
| `02` | [Product Scope & Journeys](./02-PRODUCT-SCOPE-AND-JOURNEYS.md) | Personas, user journeys, feature inventory, explicit non-goals | Phase 0 |
| `03` | [Technology Stack](./03-TECHNOLOGY-STACK.md) | Every dependency with justification; hosting decision matrix | Phase 1 |
| `04` | [Repository Structure](./04-REPOSITORY-STRUCTURE.md) | Complete folder layout, module boundaries, naming conventions | Phase 1 |
| `05` | [Design System](./05-DESIGN-SYSTEM.md) | Obsidian Peak tokens → Tailwind theme; component inventory | Phase 2 |
| `06` | [Data Model](./06-DATA-MODEL.md) | All entities, relations, indexes, constraints, migration plan | Phase 3 |
| `07` | [API Design](./07-API-DESIGN.md) | Every endpoint, contract, auth flow, validation, pagination, versioning | Phase 4 |
| `08` | [PC Builder Engine](./08-PC-BUILDER-ENGINE.md) | Component schema, compatibility rules, power model, recommendations | Phase 8 |
| `09` | [Admin — Dad Mode](./09-ADMIN-DAD-MODE.md) | Plain-language admin spec, screen by screen | Phase 9 |
| `10` | [Payments — Nepal](./10-PAYMENTS-NEPAL.md) | Gateway evaluation, tiered strategy, reconciliation, COD controls | Phase 0 (procurement) / Phase 7 |
| `11` | [SEO Strategy](./11-SEO-STRATEGY.md) | URLs, metadata, JSON-LD, sitemaps, migration redirects | Phase 11 |
| `12` | [Analytics & Marketing](./12-ANALYTICS-MARKETING.md) | Measurement plan, event spec, consent, owner dashboards | Phase 12 |
| `13` | [Security](./13-SECURITY.md) | AuthN/AuthZ, threat model, hardening, audit, backup/DR | All phases |
| `14` | [Performance](./14-PERFORMANCE.md) | Budgets, caching layers, image pipeline, DB tuning | Phase 13 |
| `15` | [DevOps & CI/CD](./15-DEVOPS-CICD.md) | Git workflow, environments, pipeline, Docker, rollback | Phase 1 |
| `16` | [Testing & QA](./16-TESTING-QA.md) | Test pyramid, coverage gates, E2E scenarios, security testing | Phase 15 |
| `17` | [Roadmap & Phases](./17-ROADMAP-PHASES.md) | Phases 0–16 with objectives, deliverables, risks, acceptance criteria | Execution |
| `18` | [Claude Sonnet Handoff](./18-SONNET-HANDOFF.md) | Execution protocol, per-phase prompts, validation gates | Execution |
| `19` | [Assumptions, Risks & Decisions](./19-ASSUMPTIONS-RISKS-DECISIONS.md) | Everything unverified, every open decision, risk register | Phase 0 |

> Phase numbers reference `17-ROADMAP-PHASES.md`, which is authoritative. Phases run **0–16** (seventeen in total).

---

## 4. System context diagram

```
                          ┌─────────────────────────────────────┐
                          │        Cloudflare (CDN + WAF)       │
                          │  cache, image resize, bot mgmt,     │
                          │  rate limit, TLS                    │
                          └───────────────┬─────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │            Next.js 15 (App Router)              │
                 │                                                 │
                 │  (storefront)  (checkout)  (admin)  (api)       │
                 │   RSC + ISR     RSC+CSR    RSC+CSR   Route      │
                 │                                      Handlers   │
                 │  ┌───────────────────────────────────────────┐  │
                 │  │  Service layer (src/server/services/*)    │  │
                 │  │  catalog · cart · order · payment ·       │  │
                 │  │  inventory · builder · service-desk ·     │  │
                 │  │  content · media · notification · audit   │  │
                 │  └───────────────────────────────────────────┘  │
                 └───┬──────────┬──────────┬──────────┬────────────┘
                     │          │          │          │
        ┌────────────▼──┐  ┌────▼─────┐ ┌──▼──────┐ ┌─▼──────────────┐
        │ PostgreSQL 16 │  │  Redis   │ │ S3-compat│ │ Job runner     │
        │ Prisma        │  │ cache +  │ │ object   │ │ (BullMQ)       │
        │ pg_trgm, FTS  │  │ rate lim │ │ storage  │ │ email, webhooks│
        │ pgvector(v2)  │  │ sessions │ │ (R2/MinIO)│ │ recon, rollups│
        └───────────────┘  └──────────┘ └──────────┘ └────────────────┘
                     │
        ┌────────────▼───────────────────────────────────────────────┐
        │ External:  eSewa · Khalti · Fonepay · connectIPS ·          │
        │            Resend/SMTP · GA4/GTM · Meta CAPI · TikTok ·     │
        │            Sentry · Better Stack · Meilisearch (Phase 12+)  │
        └────────────────────────────────────────────────────────────┘
```

---

## 5. Conventions used throughout this bundle

### Notation

| Marker | Meaning |
|---|---|
| `> **DECISION REQUIRED:**` | Blocks implementation until the owner answers. Collected in `19`. |
| `> **ASSUMPTION:**` | Believed true, not verified. Must be validated. Collected in `19`. |
| `> **RISK:**` | Known hazard with a mitigation. Collected in `19`. |
| `MUST` / `MUST NOT` | Non-negotiable. A PR violating this is rejected. |
| `SHOULD` | Strong default. Deviation requires a written note in the PR. |
| `MAY` | Genuinely optional. |

### Engineering conventions

| Topic | Rule |
|---|---|
| Language | TypeScript, `strict: true`, no `any` (use `unknown` + narrowing) |
| Money | **Integer paisa** (`Int` in Prisma, 1 NPR = 100 paisa). Never floats. Never `Decimal` in app code. Format only at the edge via `formatNPR()`. |
| Dates | Store UTC `timestamptz`. Display in `Asia/Kathmandu` (UTC+05:45). Never assume whole-hour offsets. |
| IDs | Internal PKs are `cuid2`. Public-facing identifiers are separate, human-safe, and short (order number `CC-2607-0001`, build `shortId` 8 chars, ticket `SVC-2607-0042`). Never expose PKs in URLs. |
| Naming | DB tables `snake_case` plural via `@@map`; Prisma models `PascalCase` singular; TS files `kebab-case`; React components `PascalCase`; hooks `use-*`. |
| Errors | Typed `AppError` hierarchy with a stable `code`. API returns RFC 9457 Problem Details. User-facing copy is never a raw error string. |
| Validation | Zod at every trust boundary: route handler input, server action input, env vars, external webhook payloads, CSV imports. |
| Logging | Pino structured JSON. Every request carries a `requestId`. Never log PII, tokens, card data, or payment secrets. |
| i18n | No hardcoded user-facing strings in components. All copy via `next-intl` message keys. |
| Comments | Explain *why*, never *what*. |

### Environment naming

| Env | Branch | Database | Purpose |
|---|---|---|---|
| `local` | any | local Docker Postgres | Development |
| `preview` | any PR | ephemeral / shared preview DB | Per-PR review |
| `staging` | `develop` | staging DB (anonymised prod copy) | UAT, payment sandbox, `noindex` |
| `production` | `main` | production DB | Live |

---

## 6. Glossary

Terms used consistently across all documents. **The right-hand column is the wording the non-technical admin sees** — see `09-ADMIN-DAD-MODE.md`.

| Internal term | Meaning | Admin-facing label |
|---|---|---|
| `Product` | A sellable catalogue entry | Product |
| `Variant` | A purchasable configuration of a product (16GB/512GB) | Product Option |
| `SKU` | Unique stock code on a variant | Product Code |
| `slug` | URL path segment | Website Link |
| `Category` | Nested taxonomy node | Category |
| `Brand` | Manufacturer | Brand |
| `Branch` | Physical store location | Store |
| `StockLevel` | Quantity of a variant at a branch | Stock |
| `metaTitle` / `metaDescription` | SEO metadata | Page Title / Search Description |
| `ComponentPart` | A PC-builder-eligible variant with structured specs | Buildable Part |
| `CompatibilityRule` | A declarative constraint between parts | Build Rule |
| `Build` | A saved PC configuration | Saved PC Build |
| `PaymentIntent` | A single attempt to pay for an order | Payment Attempt |
| `Fulfilment` | The shipping/pickup half of an order | Delivery |
| `ServiceTicket` | A repair job | Repair Job |
| `AuditLog` | Immutable record of admin actions | Activity History |

---

## 7. How to use this bundle (for the implementing agent)

1. Read `00`, `01`, `02`, `03`, `04`, `06`, `19` in full before writing any code.
2. Read `17-ROADMAP-PHASES.md` and `18-SONNET-HANDOFF.md`.
3. Execute exactly one phase at a time. Do not start Phase N+1 until Phase N's acceptance criteria are all met and validated.
4. At the start of each phase, re-read the documents that phase depends on.
5. If you encounter something the blueprint does not cover, **stop and ask** rather than inventing. Record the gap so the blueprint can be amended.
6. Every phase ends with: tests green, typecheck clean, lint clean, Lighthouse/budget check where applicable, and a written phase report.

---

## 8. Success definition

The project is complete when:

- [ ] The shop owner can add a product, photograph it, price it, and publish it to Google-indexable pages **without assistance**.
- [ ] A customer on a Kathmandu 4G phone can find a laptop, pay for it, and track it, with LCP ≤ 2.0s p75.
- [ ] The PC Builder refuses to let a user assemble a physically impossible machine, and explains why in plain language.
- [ ] A NPR 450,000 order can be paid for and reconciled without a developer touching the database.
- [ ] Every legacy URL that had traffic returns a 301 to a live equivalent.
- [ ] The site can be restored from backup to a known-good state within the documented RTO.
