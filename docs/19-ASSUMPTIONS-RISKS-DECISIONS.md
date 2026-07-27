# 19 — Assumptions, Risks & Open Decisions

Everything this blueprint is not certain about, in one place.

**Depends on:** all preceding documents. **Feeds into:** `17` (Phase 0), `18`.

**Read before Phase 0.**

---

## 1. Decisions required from the owner

Each blocks the phase named. Unanswered by the stated deadline, the recommended default applies and is recorded as a decision.

| # | Decision | Options | Recommendation | Blocks | Source |
|---|---|---|---|---|---|
| D1 | **Hosting** | Managed cloud (Vercel + Neon + Upstash + R2) · Single VPS with Docker · Nepal-hosted | **Managed cloud.** The binding constraint is maintenance capacity, not ~USD 30/month. Keep the Docker path working for portability. | Phase 1 | `03 §9` |
| D2 | **Who writes and reviews Nepali copy?** | An internal person · A contracted translator · Ship English only at launch | Name a person, or defer `ne` to Phase 16. Machine translation is not publishable. | Phase 2 (i18n scope) | `02 §6` |
| D3 | **SMS provider** | Not yet selected | **Procure in Phase 0.** Without SMS there is no phone OTP, no COD verification, and no delivery notification. | Phase 3 (OTP), Phase 7 (COD) | `07 §4.2` |
| D4 | **COD value cap** | NPR 10,000 · **25,000** · 50,000 · none | NPR 25,000. Accessories and low-end parts only. A refused NPR 400,000 laptop is a serious loss. | Phase 7 | `10 §7` |
| D5 | **Deposit percentage for high-value builds** | 10% · **15%** · 20% | 15%, non-refundable, locking the build and reserving stock. | Phase 7 | `10 §5` |
| D6 | **Bank-transfer two-person threshold** | NPR 50,000 · **100,000** · 200,000 | NPR 100,000. Above it, only `OWNER` may approve. | Phase 7 | `10 §8` |
| D7 | **COD `purchase` event timing** | On placement · **On delivery** | On delivery. Financially honest, at some cost to ad-platform attribution. | Phase 12 | `12 §4` |
| D8 | **Free shipping policy** | Genuinely free everywhere (as currently claimed) · **Zone rates** (NPR 150 / 350 per the approved design) · Free above a threshold | Zone rates, plus free above a threshold as a promotion. The current site's blanket claim contradicts the approved checkout design. | Phase 7 | `01 A.4 #19` |
| D9 | **Assembly service fee for PC builds** | Free · Flat fee · % of build | A flat fee, configurable in settings. It must be a visible line item. | Phase 8 | `08 §2` |
| D10 | **Launch scope if the schedule slips** | Confirm the cut order in `17` | The stated order. **The PC Builder core is not cuttable.** | Phase 15 | `17` |
| D11 | **Branch count at launch** | New Road only · Multiple | Confirm. The schema supports many; launching with one is simpler and the migration cost is zero. | Phase 3 | `02` |
| D12 | **Review moderation policy** | Auto-publish verified purchasers · **Moderate everything** | Moderate everything at launch; relax later. Zero reviews today means the first ones set the tone. | Phase 10 | `06 §4` |
| D13 | **Is data residency in Nepal legally required?** | Unknown | **Obtain a legal opinion before D1 is finalised.** | Phase 1 | `03 §8` |
| D14 | **Domain strategy at launch** | Cut over in place · Soft launch on a subdomain first | Cut over in place; the old host stays warm for 30 days. | Phase 15 | `11 §10` |
| D15 | **Should the current WordPress site stay live as a fallback?** | Yes, 30 days · No | Yes. DNS rollback is the only real disaster recovery for launch week. | Phase 15 | `13 §13` |

---

## 2. Assumptions

Believed true, not verified. Each has a validation method and an impact if wrong.

| # | Assumption | Validate by | If wrong |
|---|---|---|---|
| A1 | Majority of traffic is mid-range Android on 4G in the Kathmandu Valley | GA4 device and connection reports, first 30 days | Performance budgets and the mobile-first ordering need revision |
| A2 | The catalogue will stay under ~2,000 products for 12 months | Owner confirmation | Postgres FTS may need to become Meilisearch sooner; facet caching becomes critical |
| A3 | Order volume is tens per day, not hundreds | Current WooCommerce data | Admin list performance and the reconciliation cron interval need tuning |
| A4 | No Nepali statute mandates local data residency for retail e-commerce | Legal opinion (D13) | Hosting decision changes entirely |
| A5 | The existing PDP specification tables are parseable into structured specs at ≥ 90% | A parsing dry-run in Phase 0 | Migration effort in Phase 14 grows substantially; budget manual entry |
| A6 | eSewa and Khalti merchant onboarding completes within 4–6 weeks | Submit applications in Phase 0 | Launch with COD + bank transfer; add gateways behind feature flags |
| A7 | The owner's bank will support a connectIPS creditor listing | Ask in Phase 0 | High-value orders rely entirely on manual bank transfer |
| A8 | Component spec data can be authored for the stocked catalogue within Phase 8 | Author 20 parts as a Phase 0 spike and measure | The builder launches with a narrower catalogue |
| A9 | FPS and performance estimates from a curated reference table are acceptable to customers | Usability testing | Remove estimates and show only relative tiers |
| A10 | The owner will actually use the admin daily rather than delegating | Observe during handover | Redesign for the actual operator |
| A11 | Meta/Instagram is the dominant acquisition channel | GA4 source/medium, first 30 days | Reweight the marketing plan |
| A12 | Free tiers cover launch traffic for Sentry, Resend and Better Stack | Monitor in month 1 | Costs rise ~USD 50/month |
| A13 | Cloudflare's Nepal latency is acceptable without a local PoP | Real-device testing from Kathmandu in Phase 13 | Consider a regional origin or a Nepali CDN |
| A14 | The competitive set is Daraz plus specialist retailers competing on `price in Nepal` queries | A fresh competitive audit in Phase 0 | The keyword strategy in `11 §6` needs rework |
| A15 | TikTok attribution in Nepal is directionally useful but unreliable | Compare against `Order.sourceChannel` | Deprioritise TikTok measurement |

---

## 3. Risk register

Probability × Impact. **Critical** risks have a named mitigation that is already built into the plan.

| # | Risk | P | I | Severity | Mitigation | Owner | Phase |
|---|---|---|---|---|---|---|---|
| R1 | **Payment provider onboarding delays launch** | High | High | **Critical** | Applications start in Phase 0. Launch is viable with COD + bank transfer. Gateways ship behind feature flags. | Owner | 0 |
| R2 | **SEO traffic collapses after migration** | Medium | High | **Critical** | Complete URL inventory in Phase 0; `Redirect` table; automated legacy crawl as a hard gate; old host warm for 30 days; DNS rollback path | Dev | 14 |
| R3 | **Component spec data is too costly to maintain** | High | Medium | **Critical** | `dataConfidence` gating; only `VERIFIED` parts trigger blocking rules; launch with the stocked catalogue only; a real operational review queue with an owner | Owner + Dev | 8 |
| R4 | **The admin is still too complex for the owner** | Medium | High | **Critical** | Dad Mode is a specification, not a preference; the copy lint is a build gate; **two observed usability tests are release gates** (Phases 5 and 9) | Dev | 5, 9 |
| R5 | **Overselling under concurrency** | Medium | High | **Critical** | Reservation model; optimistic locking; append-only `StockMovement`; concurrency tests; k6 flash-sale scenario | Dev | 6 |
| R6 | **A payment is settled without verification** | Low | Critical | **Critical** | Lookup-only settlement (`10 §6`); 25 adversarial tests; amount comparison; replay protection | Dev | 7 |
| R7 | **Bank-receipt fraud** | Medium | High | High | Two-person approval; checksum duplicate detection; explicit bank-statement verification requirement; audit trail | Owner | 7 |
| R8 | **COD refusals erode margin** | High | Medium | High | Value cap; OTP; blocklist; velocity limits; refusal-rate monitoring; deposit alternative | Owner | 7 |
| R9 | **The builder ships an unsound recommendation** (the reference app's failure) | Medium | High | High | Every auto-build validated before return; constraint-solved against the whole build; golden-build fixtures | Dev | 8 |
| R10 | **Cache invalidation shows a stale price or stock** | Medium | High | High | TTL backstops on every cached entry; availability never cached; explicit manual verification in Phase 13 | Dev | 13 |
| R11 | **The Stitch designs' missing screens are underestimated** | High | Medium | High | `01 §C.4` enumerates them; they are scoped into their owning phases, not treated as polish | Dev | 2+ |
| R12 | **A migration destroys data** | Low | Critical | High | Backup verified before every migration; expand/contract; staging rehearsal against a production snapshot; PITR | Dev | all |
| R13 | **A backup cannot be restored when needed** | Medium | Critical | High | Automated nightly restore verification with alerting; quarterly timed drills | Dev | 1 |
| R14 | **Nepali content ships as thin duplicates and harms SEO** | Medium | Medium | Medium | `translationCompleteness` gating; fallback-only pages are `noindex` and excluded from the `ne` sitemap | Dev | 11 |
| R15 | **Scope creep during implementation** | High | Medium | Medium | Phase gates; explicit non-goals in `02 §2.7`; new scope requires a blueprint amendment | Owner | all |
| R16 | **Performance targets missed on real Nepali networks** | Medium | Medium | Medium | Budgets in CI; real-device testing in Phase 13; the design's paint costs explicitly mitigated | Dev | 13 |
| R17 | **Zero reviews persist after launch** | High | Medium | Medium | Post-purchase review request sequence; verified-buyer badges; GBP review requests | Owner | 12 |
| R18 | **Key-person dependency on a single developer** | Medium | High | Medium | Documentation in the repo; runbooks; ADRs; a handover session; a naive developer must be able to deploy from the docs alone (Phase 16 gate) | Owner | 16 |
| R19 | **Third-party outage blocks checkout** | Medium | Medium | Medium | Gateway health flags; COD and bank transfer always available; no third-party blocks first paint | Dev | 7 |
| R20 | **Legal exposure on privacy or terms** | Medium | Medium | Medium | Legal review before launch; GDPR-grade implementation regardless of local requirements | Owner | 15 |
| R21 | **The owner's time for content, photography and spec authoring is underestimated** | High | Medium | Medium | Surface it in Phase 0 with a concrete estimate; a product without photos does not publish | Owner | 5, 8 |
| R22 | **Fonepay's undocumented API consumes disproportionate effort** | Medium | Low | Low | Explicitly deferred out of Phase 7; treated as a post-launch, feature-flagged item | Dev | post-launch |

---

## 4. Known unknowns — must be resolved by research or by asking a provider

| # | Unknown | Who resolves | By when |
|---|---|---|---|
| U1 | eSewa merchant MDR, settlement timing, and any merchant-side transaction ceiling | Owner ↔ eSewa | Phase 0 |
| U2 | Khalti percentage MDR and the real live-key ramp cap (docs contradict the website) | Owner ↔ Khalti | Phase 0 |
| U3 | connectIPS API specification, sandbox, signing, onboarding documents, MDR, settlement | Owner ↔ bank ↔ NCHL | Phase 0 |
| U4 | Fonepay Checkout availability, endpoints, limits, refund handling | Owner ↔ bank | Phase 14 |
| U5 | Card acquiring commercials — Nabil, NIC Asia, HBL | Owner ↔ banks | Phase 14 |
| U6 | Zero-fee EMI partner-merchant terms with NIC Asia and Siddhartha | Owner | Phase 11 |
| U7 | Nepali SMS aggregator: pricing, delivery rates, API quality | Owner | Phase 0 |
| U8 | Nepal data-protection obligations for this business | Lawyer | Phase 0 |
| U9 | Actual traffic composition — device, connection, geography | GA4 | Month 1 |
| U10 | Actual competitive set and query landscape | SEO audit | Phase 0 |
| U11 | Whether the current WooCommerce export includes complete order and customer history | Dev | Phase 0 |
| U12 | Courier partners and whether any offers a tracking API | Owner | Phase 10 |

---

## 5. Deliberate limitations

Things this blueprint chooses not to solve, and why. Recording them prevents them being rediscovered as bugs.

| Limitation | Rationale | Revisit when |
|---|---|---|
| No real-time updates (no WebSockets) | Polling is sufficient for QR payment and admin notifications; WebSockets add infrastructure for marginal benefit | Live chat or live order tracking is added |
| No read replica | Write volume is low; a replica adds replication-lag bugs | Admin reports slow down measurably |
| No search service at launch | Postgres FTS + trigram handles a 150–2,000 product catalogue | Catalogue exceeds ~5,000, or facet latency exceeds budget |
| No antivirus scanning on uploads | Mitigated by server-side re-encoding, magic-byte validation, SVG rejection, and private buckets | Uploads become user-browsable |
| No native mobile app | A well-built PWA covers the need at a fraction of the cost | Repeat-purchase behaviour justifies it |
| No B2B portal | Volume does not justify it; the schema does not preclude it | Corporate enquiries become a meaningful revenue share |
| No loyalty programme | Adds accounting complexity before product-market fit | Repeat rate is measured and worth optimising |
| No ERP or accounting integration | Manual export is acceptable at this size | Order volume exceeds manual reconciliation capacity |
| Light theme not shipped | The approved design is dark-only; every value is tokenised so a light ramp is a CSS change | Users ask, or accessibility feedback requires it |
| Vision-based build import deferred | The reference app's text import already misfires; a vision path would be worse without careful evaluation | The text import proves reliable |
| No LLM-assisted build recommendations at launch | The deterministic constraint solver is more trustworthy and cheaper; `pgvector` is reserved for v2 | The solver's limits are demonstrated |

---

## 6. Change control

This blueprint is versioned in the repository at `docs/`.

| Change type | Process |
|---|---|
| Clarification or typo | Direct edit, noted in the commit message |
| A decision the blueprint left open | Record the answer here in §1, write an ADR, update the affected document |
| A change to a specified behaviour | **ADR required**, with context, options, decision, and consequences. Update every affected document in the same PR. |
| New scope | Owner approval, then update `02`, `17`, and any affected specification. Scope added without a blueprint update does not get built. |
| Discovered blueprint defect | Fix the document first, then the code. Note it in the phase report. |

**Quarterly review:** does `docs/` still describe the system that exists? Divergence found is either fixed in code or amended in the document. A blueprint nobody trusts is worse than no blueprint.

---

## 7. Summary — the five things most likely to go wrong

Ranked by expected cost.

1. **Payment provider onboarding.** It is bank-mediated, undocumented, and outside our control. Started in Phase 0 for exactly this reason. Launch must be viable without it.
2. **Component spec data for the PC builder.** The feature's value is entirely a function of data quality, and data quality is an ongoing human cost. Mitigated by confidence gating and a narrow launch catalogue — but it needs a named owner, not good intentions.
3. **The admin being too complex anyway.** Dad Mode is easy to agree with and hard to actually deliver. It is protected by a copy lint and two observed usability gates. Do not let those slip.
4. **SEO equity lost at migration.** One missed redirect on a high-traffic URL is months of ranking. Protected by a complete URL inventory taken in Phase 0 and a zero-404 crawl gate in Phase 14.
5. **A payment settled without verification.** Low probability, catastrophic impact. Protected by lookup-only settlement and 25 adversarial tests that must pass before Phase 7 closes.
