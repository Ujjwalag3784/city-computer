# 18 — Claude Sonnet Execution Handoff

How to implement this project, one phase at a time, without drifting from the blueprint.

**Depends on:** every preceding document, especially `00`, `17`, `19`. **Feeds into:** execution.

**Read this document and `00`, `19`, and `17` before writing a single line of code.**

---

## 1. Operating protocol

### The five rules

1. **One phase at a time.** Do not start Phase N+1 until every acceptance criterion for Phase N is met and verified. Not "mostly met". Every one.
2. **The blueprint is the specification.** If the code and `docs/` disagree, the document wins — until the document is formally amended with an ADR.
3. **When the blueprint does not cover something, stop and ask.** Do not invent architecture. Record the gap so `docs/` can be amended. A wrong guess propagates through every later phase.
4. **Never mark a phase complete with failing tests, type errors, lint errors, or a breached budget.** "It works, I'll fix the test later" is how this project fails.
5. **Update the documentation in the same commit as the behaviour it describes.**

### Per-phase loop

```
┌─ 1. PREPARE ────────────────────────────────────────────────┐
│ Re-read: 17 (this phase), and every doc it depends on.      │
│ Re-read: 19, for open decisions affecting this phase.        │
│ Write a phase plan: files to create, files to change,        │
│   order of work, tests to write, risks.                      │
│ Post the plan. Do not start until it is acknowledged.        │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─ 2. BUILD ──────────────────────────────────────────────────┐
│ Schema → services → API/actions → UI → tests, in that order. │
│ Test-first for pure logic: money, rules, power, pricing,     │
│   state machines, validation.                                │
│ Commit in small, conventional, individually-green commits.   │
│ Never leave main or develop broken.                          │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─ 3. VERIFY ─────────────────────────────────────────────────┐
│ pnpm typecheck && pnpm lint && pnpm test && pnpm e2e         │
│ Lighthouse + bundle budget where the phase touches UI.        │
│ Walk the phase's acceptance criteria one by one.             │
│ Walk the phase's validation checklist.                        │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─ 4. REPORT ─────────────────────────────────────────────────┐
│ Write the phase report (§4). Include what you could NOT      │
│ do and why. Do not hide gaps — they compound.                │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─ 5. GATE ───────────────────────────────────────────────────┐
│ Wait for explicit approval. Then, and only then, Phase N+1.  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Standing constraints

These apply to **every** phase. Violating one is a defect regardless of what the phase asked for.

| # | Constraint |
|---|---|
| C1 | **Money is integer paisa.** No floats, no `Decimal` in application code. Format only at the edge via `formatNPR()`. |
| C2 | **Prices, discounts, shipping and totals are always recomputed server-side.** A client-supplied money value is ignored, never validated-and-accepted. |
| C3 | **A payment reaches `PAID` only after a server-to-server lookup.** A browser callback is never proof. |
| C4 | **Every user-facing string goes through `next-intl`.** No hardcoded copy in components. |
| C5 | **No forbidden admin vocabulary** (`09 §2.1`). The copy lint enforces it; do not work around it. |
| C6 | **Every interactive element is keyboard-operable with a visible focus ring, and every icon-only button has an `aria-label`.** |
| C7 | **`"use client"` is the exception.** Push it as deep as possible. |
| C8 | **Zod validation at every trust boundary** — route input, action input, env, webhooks, imports. |
| C9 | **No raw HTML accepted or stored.** Rich text is validated JSON, rendered by a component. |
| C10 | **Every admin mutation writes an `AuditLog` entry.** |
| C11 | **Every stock change writes a `StockMovement` with a reason.** |
| C12 | **No `noindex` on an indexable production route; no indexable staging.** |
| C13 | **Never emit `AggregateRating` for a product with zero approved reviews.** |
| C14 | **No hardcoded colour, radius, spacing or font value.** Tokens only. |
| C15 | **Every list, form and async surface has loading, empty and error states.** |
| C16 | **No secret with a `NEXT_PUBLIC_` prefix. No secret in a log.** |
| C17 | **Module boundaries from `04 §3` are enforced by lint. Do not disable the rule.** |
| C18 | **No new dependency over 30 KB gzipped without written justification.** |
| C19 | **The `docker-compose.yml` path must keep working**, whatever the hosting choice. |
| C20 | **Mobile is not an afterthought.** Every surface, including the admin and the builder, works at 375px. |

---

## 3. Phase prompts

Use these to start each phase. Each assumes you have re-read the referenced documents.

> **Phase 0 —** Review `19-ASSUMPTIONS-RISKS-DECISIONS.md`. Produce a decision brief for the owner: every open decision, its options, your recommendation, and what it blocks. Produce the procurement checklist with owners and target dates. Do not write code.

> **Phase 1 —** Scaffold the repository exactly per `04`. Implement the tooling, CI pipeline, and `lib/` utilities listed in `17 Phase 1`. Achieve 100% coverage on `lib/money.ts`. No feature code. Deliver a README that a second person can follow with no verbal help.

> **Phase 2 —** Implement the Obsidian Peak design system per `05`. **Apply all 14 corrections from `01 §C.3` explicitly and list each one in your report as applied.** Build every component in every state. Deliver `/_design`. Zero axe violations, zero hardcoded design values.

> **Phase 3 —** Implement the complete Prisma schema per `06`, all constraints, all indexes, the append-only permission revocations, and the full seed. Then implement authentication and RBAC per `07 §4` and `13 §2–3`. Deliver a passing authorisation matrix test covering every role × protected route.

> **Phase 4 —** Build the catalogue read path per `02 §3.1`, `06 §4`, `07 §3.1`. Faceted filtering driven by `ProductSpec`. Postgres FTS + trigram search. ISR with cache tags. Every route with loading, empty and error states. Meet the Phase 4 latency and Lighthouse criteria.

> **Phase 5 —** Build the admin shell and product management per `09 §3–5`. **The four-step wizard, helper text, duplicate detection, publish checklist, live SEO preview, undo, and error prevention are the deliverable — not decoration.** Media pipeline with auto alt text. Global search. Report against the Dad Mode acceptance criteria specifically.

> **Phase 6 —** Cart and inventory per `06 §5–6`, `07 §3.2`, `09 §6`. **Correctness under concurrency is the acceptance criterion.** Deliver the concurrency integration tests before the UI.

> **Phase 7 —** Checkout and payments per `10` in full. Implement the abstraction, tiering, COD, bank transfer, eSewa and Khalti against sandbox, callbacks, webhooks, and the reconciliation cron. **All 25 adversarial tests in `16 §5` must pass.** Document the outcome of every sandbox scenario in your report.

> **Phase 8 —** The PC Builder per `08` in full. **Prevention-first filtering and the physical-fit engine are the point.** Include the golden-build fixture set, and prove the reference application's invalid build produces at least three errors. Every auto-build must validate clean.

> **Phase 9 —** The remaining admin modules per `09`, and the "Today" dashboard per `12 §12`. Dashboard reads from rollup tables, never raw aggregation. All twelve help articles written.

> **Phase 10 —** Content, blog, CMS pages, menus, stores, service desk, EMI calculator per `02 §2.4` and `06 §8–9`. Rich text as validated JSON only — attempt XSS payloads in every field and report the results.

> **Phase 11 —** SEO per `11` in full. Deliver an automated crawl report over staging asserting canonical, robots, hreflang and JSON-LD validity for every route type.

> **Phase 12 —** Analytics per `12` in full. **Prove the App Router pageview is fired exactly once per navigation, and that `purchase` is server-dispatched exactly once even when the reconciliation sweep settles the payment.** Include DebugView evidence.

> **Phase 13 —** Performance per `14`. Apply the design's paint-cost mitigations. Run k6. **Verify no stale price or stock is observable after an admin change.** Report before/after numbers for every budget.

> **Phase 14 —** Migration per `06 §13.2`. Dry-run into staging first. **The gate is a legacy-URL crawl with zero 404s and zero redirect chains.** Report the spec-mapping percentage and the size of the review queue.

> **Phase 15 —** Hardening and launch per `13 §17`, `16 §10`, `11 §10.4`. Execute the restore drill and the rollback drill and record the timings. Produce the go/no-go pack.

> **Phase 16 —** Reconcile `docs/` with reality. Any divergence is either fixed in code or amended with an ADR. Deliver the handover pack and the post-launch monitoring plan.

---

## 4. Phase report template

```markdown
# Phase N — <Name> — Report

## Status
Complete / Complete with exceptions / Blocked

## Acceptance criteria
| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | …         | ✅/❌   | test name, screenshot, command output |

## Validation checklist
| Item | Result |

## Delivered
- Files created: …
- Files modified: …
- Migrations: …
- Dependencies added (with justification): …

## Quality gates
| Gate | Result |
|---|---|
| typecheck | 0 errors |
| lint | 0 errors, 0 warnings |
| unit | N passing, X% coverage (payment/pricing/order/rules: Y%) |
| integration | N passing |
| e2e | N passing |
| axe | 0 violations |
| bundle budget | route-by-route table |
| lighthouse | per-route scores |

## Decisions made
Anything not fully specified by the blueprint, what I chose, and why.
**These require review — they are candidate ADRs.**

## Gaps and deviations
What I could not complete, what I did differently, and why.
**Do not omit anything here.**

## Blueprint amendments needed
Where the blueprint was wrong, ambiguous, or silent.

## Risks carried into the next phase

## Ready for Phase N+1? Yes / No — and if no, what is required.
```

---

## 5. When you get stuck

| Situation | Do this |
|---|---|
| The blueprint is silent | **Stop. Ask.** Propose an option with reasoning. Do not guess. |
| Two documents contradict each other | **Stop. Ask.** Quote both. The contradiction is a blueprint defect and must be fixed there first. |
| A requirement seems technically wrong | Say so, with the reason and an alternative. The blueprint is not infallible — but do not silently deviate. |
| An external provider behaves differently from the documentation | Document the actual behaviour, implement against reality, and flag it for `10 §13`. |
| Something will take much longer than the estimate | Say so early, with the reason. Do not silently cut quality to hit an estimate. |
| A test is flaky | Fix it or quarantine it explicitly. **Never delete a test to make CI green.** |
| You need production data | You do not. Use fixtures. Production data never enters a test or a development environment. |
| A dependency would save time but is unmaintained | Do not use it. Especially in the payment path (`10 §11`). |

---

## 6. Definition of done — per unit of work

A feature is done when **all** of the following are true:

- [ ] It works, including on a 375px viewport
- [ ] Loading, empty and error states exist
- [ ] Types are strict; no `any`
- [ ] Input is Zod-validated at the trust boundary
- [ ] Permissions are enforced in the service layer
- [ ] Unit tests cover the logic; integration tests cover the boundaries
- [ ] E2E covers it if it is on a critical journey
- [ ] Axe reports zero violations
- [ ] Keyboard-operable with a visible focus ring
- [ ] All copy is i18n-keyed and passes the copy lint
- [ ] Bundle budget respected
- [ ] Queries have indexes; no N+1
- [ ] Cache tags set and invalidation verified
- [ ] Audit logging where a mutation occurs
- [ ] Analytics events fired where specified
- [ ] `docs/` updated if documented behaviour changed
- [ ] No new lint suppressions or `@ts-expect-error` without a comment explaining why

---

## 7. Anti-patterns — specific to this project

Each of these is something a competent implementer would plausibly do, and each is wrong here.

| Anti-pattern | Why it is wrong here |
|---|---|
| Storing money as a float or `Decimal` in app code | Rounding errors on 6-figure NPR orders |
| Trusting a payment redirect | This is how Nepali e-commerce integrations lose money |
| Deriving component specs from product names | The exact failure that makes the reference builder unreliable (`01 §B.5`) |
| Validating a build only after selection | Lets users assemble impossible machines (`08 §1`) |
| Copying the Stitch markup verbatim | Inherits the radius bug and 13 other defects (`01 §C.3`) |
| Using "SKU", "slug", "metadata" in the admin | Breaks the single hardest requirement in the project |
| A chart-first dashboard | The owner needs answers, not visualisations |
| Skipping the reconciliation cron | Async Nepali payments will silently strand paid orders |
| Reserving stock on add-to-cart | Denial-of-inventory abuse |
| Firing `purchase` from the confirmation page | Inflates revenue, double-counts, misses async settlements |
| Auto-approving a bank receipt from OCR | Fraud vector with a six-figure downside |
| Emitting review schema with zero reviews | Structured-data violation; the current site's most visible failure |
| Building desktop-first | The majority of traffic is a mid-range Android |
| Deferring accessibility "until later" | It never happens, and axe is a build gate |
| Adding a payment SDK from npm | `10 §11` |
| A single `schema.prisma` with 60 models | Unmaintainable; use the split-file layout |
| Caching product availability | The one thing that must always be fresh |
| Testing coverage percentage instead of adversarial cases | 95% coverage with no forged-callback test is worthless |

---

## 8. Communication expectations

| Frequency | What |
|---|---|
| Start of each phase | The phase plan, before any code |
| During a phase | A blocker within one working session of hitting it — never sit on it |
| End of each phase | The full phase report |
| Any time | Anything the blueprint does not cover; anything that contradicts; anything that will slip materially |

**Bias strongly toward over-communicating gaps.** A gap surfaced in Phase 5 costs an hour. The same gap surfaced in Phase 14 costs a week.

---

## 9. First action

Do not write code. Read `00`, `17`, `19`, and this document. Then produce the **Phase 0 decision brief**: every open decision, the options, your recommendation, and what each one blocks — plus the procurement checklist with owners and target dates.

Post it, and wait.
