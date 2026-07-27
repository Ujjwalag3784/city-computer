# 16 — Testing & QA

What gets tested, how, and what blocks a release.

**Depends on:** all implementation documents. **Feeds into:** `17`, `18`.

---

## 1. Strategy

```
                    ╱╲
                   ╱  ╲     E2E  (Playwright)          ~40 specs
                  ╱────╲    Critical journeys only
                 ╱      ╲
                ╱────────╲  Integration (Vitest + real PG/Redis)  ~200
               ╱          ╲ Services, API routes, DB constraints
              ╱────────────╲
             ╱              ╲ Unit (Vitest)                       ~800
            ╱────────────────╲ Pure logic, rules, calculations
```

**Weighting rationale:** the highest-risk logic in this system — the compatibility engine, the power model, price resolution, payment verification, and the order state machine — is *pure* and therefore cheap to unit-test exhaustively. E2E is reserved for the handful of journeys where an integration failure costs money.

### Coverage requirements

| Area | Minimum |
|---|---|
| Overall | 80% statements, 75% branches |
| `server/services/payment/**` | **95%** |
| `server/services/pricing/**` | **95%** |
| `server/services/order/**` | **95%** |
| `server/services/builder/rules/**` | **95%** |
| `server/services/inventory/**` | **90%** |
| `lib/money.ts` | **100%** |
| UI components | Not coverage-gated; gated on E2E + axe instead |

Coverage is a floor, not a goal. A 95% figure on payment code with no adversarial test is worthless — see §5.

---

## 2. Unit tests

Colocated `*.test.ts`. No database, no network, no filesystem. Fast enough to run on save.

| Target | Examples |
|---|---|
| **Money** | Paisa arithmetic, rounding, `formatNPR()` output, VAT-inclusive extraction, discount clamping at zero, no float ever appears |
| **Pricing** | Price resolution order (variant → promotion → coupon), stacking rules, `compareAtPrice` validity, free-shipping thresholds, per-zone rates |
| **Compatibility rules** | **Every rule has at least two tests: one that fires, one that does not.** Plus boundary cases (a GPU exactly at the case's max length must pass; one millimetre longer must fail) |
| **Power model** | Every component's contribution, transient calculation, recommended-wattage rounding, each severity band, connector satisfaction with and without adapters |
| **Balance model** | Every verdict band, resolution weighting, symmetry |
| **Order state machine** | Every legal transition succeeds; every illegal transition throws; side effects fire exactly once |
| **Payment verification** | Signature generation and validation per provider, amount comparison, idempotency, status mapping |
| **Slug generation** | Latin, Devanagari transliteration, collisions, length capping, reserved words |
| **Nepal helpers** | Phone normalisation across all input formats, province/district validation, ward bounds |
| **Dates** | Asia/Kathmandu (UTC+05:45) conversion, day boundaries for "today's revenue", DST-free arithmetic |
| **SEO builders** | Metadata cascade resolution, template interpolation, truncation, **`AggregateRating` omitted at zero reviews** |
| **Validation schemas** | Every Zod schema: valid input passes, each invalid variant is rejected with the right code |

---

## 3. Integration tests

Real PostgreSQL and Redis in Docker. Each test runs in a transaction that is rolled back, or against a freshly migrated schema.

| Target | Examples |
|---|---|
| **Database constraints** | Every `CHECK` in `06 §12` is asserted by a test that attempts to violate it |
| **Append-only tables** | An `UPDATE` or `DELETE` on `audit_logs`, `stock_movements`, `payment_events` is rejected at the database level |
| **Transactions** | Order placement rolls back entirely on any failure — no orphan reservation, no partial order |
| **Concurrency** | Two simultaneous orders for the last unit: exactly one succeeds. Optimistic-lock conflicts surface as `CONFLICT_VERSION`. |
| **Stock integrity** | After a sequence of adjustments, sales, cancellations and returns, `StockLevel.quantity` equals `SUM(StockMovement.delta)` |
| **Coupon limits** | Concurrent redemptions never exceed `usageLimit` |
| **Payment idempotency** | Callback + webhook + reconciliation sweep on the same payment produces exactly one settlement and one `purchase` analytics dispatch |
| **API contracts** | Every endpoint validated against the generated OpenAPI spec; drift fails |
| **Authorisation matrix** | For every protected route × every role: expected 200/401/403. Generated from the permission table, so a new route without a permission entry fails the test. |
| **Search** | Ranking behaves as specified; typo tolerance works; zero-result queries are logged |
| **Cache invalidation** | Updating a product invalidates the expected tags and nothing else |
| **Migrations** | Every migration applies cleanly to the previous schema and to a restored production snapshot |

---

## 4. End-to-end tests

Playwright, Chromium + WebKit, desktop and mobile viewports. Run against a fully seeded staging-like environment.

### Critical journeys — these block a release

| # | Journey |
|---|---|
| E1 | Browse home → category → filter by spec → PDP → add to cart → cart → checkout → COD → order confirmed |
| E2 | Same, paying with the eSewa sandbox, including the return redirect and server verification |
| E3 | Same, paying with the Khalti sandbox |
| E4 | High-value order: verify wallet methods are absent and connectIPS / bank transfer are offered |
| E5 | Bank transfer: place order → upload a receipt → admin approves → order confirms → stock decrements |
| E6 | Register → verify email → log in → place an order → view it in account history → download the invoice |
| E7 | Guest order → track it with order number + phone |
| E8 | **Builder:** Guided mode start to finish → save → share → open the link in a fresh context → clone → add to cart |
| E9 | **Builder:** deliberately create an incompatible combination → error appears → resolve it via the Fix drawer → error clears |
| E10 | **Builder:** attempt to add an incomplete or erroring build to cart → blocked with a clear reason |
| E11 | Search with a typo → relevant results; search for nonsense → helpful empty state; verify the query is logged |
| E12 | **Admin:** log in with 2FA → create a product through all four steps → publish → verify it is live on the storefront |
| E13 | **Admin:** adjust stock with a reason → verify the movement in Activity History |
| E14 | **Admin:** advance an order through every status → use undo within the window → print the invoice |
| E15 | Service booking → ticket issued → public status lookup with ticket number + phone digits |
| E16 | Locale switch en ↔ ne preserves the current page and cart |
| E17 | Mobile: full purchase journey on a 375px viewport, including the mobile nav and the filter sheet |
| E18 | Coupon: apply, see the discount, remove it, attempt an expired code |
| E19 | Out-of-stock: PDP shows correct state, add-to-cart disabled, stock-alert request works |
| E20 | Cookie consent: reject → verify no analytics network requests fire |

### Accessibility

`@axe-core/playwright` runs on every route visited during E2E. **Any violation fails the build.** Additionally, manual keyboard-only walkthroughs of checkout, the builder and the admin product wizard are performed before each release, and a screen-reader pass (NVDA or VoiceOver) is performed before launch.

### Visual regression

Playwright screenshots on key components and pages, with a tolerance threshold. Reviewed, not auto-approved. Runs on `develop` only, to keep PR pipelines fast.

---

## 5. Adversarial and security testing

The tests that matter most, because they encode the failure modes documented in `10` and `13`.

| # | Test | Expected |
|---|---|---|
| S1 | Forge a payment callback with a valid-looking but incorrect signature | Rejected, payment not settled, alert raised |
| S2 | Replay a valid webhook 10 times | Exactly one settlement |
| S3 | Return a callback whose amount is lower than the order total | Refused, payment marked failed, alert raised |
| S4 | Submit a checkout with a client-supplied price | Ignored; the server-computed total is used |
| S5 | Submit a checkout with a client-supplied discount | Ignored |
| S6 | Reuse an `intentReference` | Rejected by the unique constraint |
| S7 | Request another customer's order by guessing an order number | 403 |
| S8 | Access an admin route as a `CUSTOMER`, a `STAFF` and anonymously | 403 / 403 / 401 |
| S9 | Attempt a `STAFF` price edit | 403, and the control is not rendered |
| S10 | Attempt to approve one's own bank-transfer submission above the threshold | Refused |
| S11 | Upload an `.svg` | Rejected |
| S12 | Upload a `.jpg` that is actually a PHP file | Rejected by magic-byte sniffing |
| S13 | Upload a 50 MB file | Rejected |
| S14 | Access a bank receipt URL without a signed token | 403 |
| S15 | Submit `<script>` in a product review, an enquiry and a blog post | Escaped or rejected; never executed |
| S16 | Submit SQL metacharacters in every text input | No error, no injection |
| S17 | Exceed the login rate limit | 429 with `Retry-After`, then lockout |
| S18 | Exceed the OTP request limit | 429 |
| S19 | Post a form from a foreign origin | CSRF rejected |
| S20 | Log in, change the password, then reuse the old session | Session invalid |
| S21 | Redeem a single-use coupon concurrently from 10 sessions | Exactly one succeeds |
| S22 | Order the last unit from 10 sessions concurrently | Exactly one succeeds; no oversell |
| S23 | Request an open redirect via the post-login `next` parameter | Rejected |
| S24 | Send an unsigned webhook | 401 |
| S25 | Send a webhook with a timestamp 10 minutes old | Rejected as a replay |

---

## 6. PC Builder test suite

Called out separately because it is the highest-complexity subsystem.

| Type | Requirement |
|---|---|
| **Rule coverage** | Every rule in the catalogue: one firing case, one non-firing case, one boundary case |
| **Golden builds** | ~40 fixtures with expected issue sets, asserted on every commit. **Includes the exact invalid build the reference application accepted** — a micro-ATX board with a 420 mm AIO and an RTX 5090 in a Mini-ITX case — which must produce at least three errors (form factor, radiator fit, GPU clearance) |
| **Property-based** | Randomly generated valid builds never produce errors; randomly generated invalid builds always produce at least one |
| **Determinism** | The same build state produces an identical issue set across 1,000 runs |
| **Prevention** | With `compatibleOnly=true`, no returned part can produce an `ERROR` when selected — asserted across every part type against 50 random partial builds |
| **Auto-build** | Every auto-build result passes validation with zero errors, across 100 random budget × use-case combinations. **A single invalid auto-build fails the suite.** |
| **Power model** | Known reference configurations produce wattage figures within tolerance of published system-power measurements |
| **Data quality** | No `UNVERIFIED` part can trigger a blocking error |
| **Performance** | Validation p95 < 300 ms with a full 12-slot build; part query p95 < 200 ms over 5,000 parts |
| **Persistence** | Save → reload → identical state; revision history correct; a shared link renders identically in an anonymous context |

---

## 7. Data migration testing

| Test | Assertion |
|---|---|
| Import fidelity | Product, category, brand, order and customer counts match the WordPress source |
| No duplicates | Zero duplicate slugs; the known MacBook Neo pair is resolved |
| Spec mapping | ≥ 90% of legacy spec rows map to a `SpecField`; the remainder are in the review queue, not discarded |
| Media | Every image downloaded, re-encoded, renamed; no `sdfgwfv`-class filename survives; alt text matches the product it is attached to |
| Redirects | A crawl of the complete legacy URL inventory returns zero 404s and zero redirect chains |
| Titles | No `<h1>` exceeds 70 characters |
| Money | Every imported price is a valid positive integer in paisa; totals reconcile |
| Idempotency | Running the import twice produces no duplicates |
| Rollback | The import can be reversed cleanly on a fresh database |

---

## 8. Manual QA

Automation cannot judge these. Performed before each release against staging.

| Area | Checks |
|---|---|
| **Visual fidelity** | Every screen against the Stitch reference: spacing, colour, typography, glow treatment, radius corrections applied |
| **Copy** | No jargon in the admin (spot-check against `09 §2.1`) · no typos · consistent currency formatting · Nepali copy reviewed by a native speaker |
| **Real devices** | A mid-range Android and an iPhone on real mobile data, not simulated throttling |
| **Real network** | The full purchase journey on Kathmandu 4G |
| **Dad-mode usability** | **A person who has never seen the admin attempts to add a product and process an order, unaided and observed.** This is a formal gate, not an anecdote. Two participants minimum. |
| **Print output** | Invoice, shipping label, build quotation — printed on actual paper |
| **Email rendering** | Every template in Gmail (web, Android, iOS), Outlook, and Apple Mail |
| **Payment sandboxes** | Every provider, including cancellation, timeout, and the back button |
| **Empty states** | Every list, filter and search with no results |
| **Error states** | Network offline, server error, validation failure, payment failure |
| **Long content** | 200-character product names, 20-item carts, 4-drive builds, addresses with long landmarks |
| **Screen reader** | Checkout and builder with NVDA or VoiceOver |

---

## 9. Test data

| Fixture | Contents |
|---|---|
| `minimal` | Roles, one branch, one category, one product — for fast unit and integration runs |
| `realistic` | ~150 products mirroring the real catalogue distribution, 20 categories, 15 brands, 60 builder parts covering every type, 5 customers, 30 orders in every status, 10 service tickets |
| `stress` | 5,000 products, 20,000 builder parts, 10,000 orders — for load and admin-scale testing |
| `edge` | Zero-price product, 200-character name, product with no image, out-of-stock everything, expired coupon, order with a 3-year-old date, a customer with 500 orders |

Fixtures are deterministic and seeded from `prisma/seed/`. **No production data ever appears in a test fixture.**

---

## 10. Release gates

A release does not ship unless **all** of the following hold.

- [ ] All CI gates green (`15 §4`)
- [ ] Coverage thresholds met, including the 95% payment/pricing/order/rules floors
- [ ] All 20 critical E2E journeys pass on Chromium and WebKit, desktop and mobile
- [ ] All 25 adversarial security tests pass
- [ ] The PC Builder golden-build suite passes, including the reference-app's invalid build
- [ ] Zero axe violations on every tested route
- [ ] Lighthouse thresholds met on all measured routes
- [ ] Bundle budgets respected
- [ ] Load-test pass criteria met (before launch and before any major release)
- [ ] Migration tested against a restored production snapshot
- [ ] Backup restore verified within RTO
- [ ] Manual QA checklist complete and signed off
- [ ] **Dad-mode usability test passed with at least two naive participants**
- [ ] No open P1 or P2 defects
- [ ] `docs/` updated for any changed behaviour
- [ ] Changelog updated

---

## 11. Defect management

| Severity | Definition | Response |
|---|---|---|
| **P1** | Cannot buy · payment incorrect · data loss · security breach · site down | Fix immediately; hotfix release |
| **P2** | A major feature broken · a significant journey blocked · a visible data error | Fix before the next release |
| **P3** | A minor feature broken with a workaround · a visual defect on a key page | Next sprint |
| **P4** | Cosmetic · edge case · nice-to-have | Backlog |

Every P1 and P2 defect requires a **regression test written before the fix is merged**. A bug that recurs is a process failure, not bad luck.

---

## 12. Continuous quality

| Practice | Cadence |
|---|---|
| Flaky-test review — quarantine, fix, or delete | Weekly |
| Dependency updates | Weekly, automated |
| Coverage trend review | Monthly |
| Performance budget review against field data | Monthly |
| Accessibility audit beyond automation | Quarterly |
| Security access review | Quarterly |
| Backup restore drill | Quarterly |
| Rollback drill | Quarterly |
| Penetration test | Annually |
| Blueprint review — does `docs/` still match reality? | Quarterly |
