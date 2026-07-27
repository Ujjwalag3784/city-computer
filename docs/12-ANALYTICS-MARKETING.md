# 12 — Analytics & Marketing

Measurement plan, event contract, consent handling, and the plain-language dashboards the owner actually uses.

**Depends on:** `02`, `06`, `07`, `09`, `11`. **Feeds into:** `13`, `14`, `17`.

---

## 1. Measurement plan first

Instrument to answer questions, not to collect events.

| Business question | KPI | Definition | Source |
|---|---|---|---|
| Are we selling more? | Revenue | Σ `Order.totalPaisa` where `paymentStatus = PAID` | Postgres |
| Are more people buying? | Conversion rate | Purchases ÷ sessions | GA4 |
| Is the site bringing in customers? | Organic sessions | Sessions, `medium = organic` | GA4 + GSC |
| Which products make money? | Units, revenue, margin | `OrderItem` with `costPaisaSnapshot` | Postgres |
| Where do people give up? | Checkout funnel drop-off | `begin_checkout` → `purchase` | GA4 |
| Does the PC builder work? | Builder completion | `builder_add_to_cart` ÷ `builder_start` | GA4 + `BuilderSession` |
| What do we not stock that people want? | Zero-result searches | `SearchQueryLog` where `hasResults = false` | Postgres |
| Which payment methods fail? | Payment success rate by provider | `Payment` PAID ÷ INITIATED | Postgres |
| Is COD hurting us? | COD refusal rate | Cancelled-after-shipping ÷ COD orders | Postgres |
| Are customers coming back? | Repeat rate | Customers with ≥ 2 orders ÷ all | Postgres |
| Is the site fast enough? | CWV p75 | LCP / INP / CLS | `web-vitals` → GA4 + first-party |
| Is the shop being found locally? | GBP views, direction requests, calls | | Google Business Profile |

Targets are set after 30 days of baseline. **Do not set targets against WordPress-era data** — the measurement is not comparable.

---

## 2. GA4 + GTM architecture

### Decision: **client-side GTM, plus server-side Measurement Protocol for money events.**

Server-side GTM (a tagging server) is the technically superior option and is **rejected** for this project: it adds a container to host, monitor and pay for, and the primary benefit — resilience to ad blockers — is not worth the ops burden for a two-person team. Instead:

- **Browser GTM** handles behavioural events (views, clicks, funnel steps).
- **Server-side Measurement Protocol** handles `purchase` and `refund`, which must be correct.
- **Meta CAPI and TikTok Events API** are called server-side directly from our own code, deduplicated against the browser pixel by `event_id`.

This captures most of the benefit of a tagging server for a small fraction of the operational cost. The precise ratio is a judgement, not a measurement.

### GTM container conventions

| Object | Naming |
|---|---|
| Tag | `GA4 - Event - add_to_cart`, `Meta - Event - Purchase`, `Clarity - All Pages` |
| Trigger | `CE - add_to_cart`, `PV - All Pages`, `Click - WhatsApp` |
| Variable | `DLV - ecommerce.items`, `CONST - GA4 Measurement ID`, `JS - Page Type` |
| Folder | One per destination: GA4, Meta, TikTok, Clarity, Consent |

Every tag has a firing trigger **and** a consent-category blocking condition. Nothing fires on "All Pages" without a consent check except GTM itself and Consent Mode defaults.

### The App Router pageview pitfall

Next.js App Router does not perform a full document load on navigation, and GTM's built-in History Change trigger fires **before** React has committed the new route — producing pageviews with the previous page's title and, on `router.replace`, duplicates.

**Solution:** disable GTM's automatic pageview entirely. Push an explicit `page_view` from a client component that subscribes to `usePathname()` + `useSearchParams()` inside a `useEffect`, after the route has committed, guarded against duplicate consecutive URLs. GA4's "Enhanced measurement → page changes based on browser history events" must be **turned off** in the GA4 admin, or every navigation is counted twice.

### The `dataLayer` contract

One shape, always. Every push clears `ecommerce` first (GA4 requirement, otherwise parameters leak between events):

```js
dataLayer.push({ ecommerce: null });
dataLayer.push({
  event: 'add_to_cart',
  event_id: 'evt_01J...',        // for CAPI dedupe
  page_type: 'product',
  locale: 'en',
  ecommerce: {
    currency: 'NPR',
    value: 1249.00,
    items: [ /* see §3.2 */ ]
  }
});
```

A single `pushEvent()` helper in `hooks/use-analytics.ts` is the **only** place that touches `dataLayer`. Direct pushes from components are a lint error.

### Consent Mode v2

Defaults set **before** the GTM snippet, in the document head:

```js
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', functionality_storage: 'granted',
  security_storage: 'granted', wait_for_update: 500
});
```

Updated on the user's choice, persisted, and re-applied on every page load before any tag fires.

---

## 3. Event specification

### 3.1 GA4 recommended e-commerce events

| Event | Fires when | Key parameters |
|---|---|---|
| `view_item_list` | A product grid enters the viewport | `item_list_id`, `item_list_name`, `items[]` |
| `select_item` | A product card is clicked | `item_list_id`, `item_list_name`, `items[1]` |
| `view_item` | PDP loads | `currency`, `value`, `items[1]` |
| `add_to_cart` | Add to cart succeeds (server-confirmed) | `currency`, `value`, `items[]` |
| `remove_from_cart` | Item removed | `currency`, `value`, `items[]` |
| `view_cart` | `/cart` loads | `currency`, `value`, `items[]` |
| `begin_checkout` | `/checkout` step 1 | `currency`, `value`, `coupon?`, `items[]` |
| `add_shipping_info` | Delivery step completed | `+ shipping_tier` (`inside-valley`, `outside-valley`, `pickup`) |
| `add_payment_info` | Payment method chosen | `+ payment_type` (`esewa`, `khalti`, `fonepay`, `connectips`, `bank_transfer`, `cod`) |
| `purchase` | **Server-verified payment** (§4) | `transaction_id`, `value`, `tax`, `shipping`, `coupon?`, `affiliation`, `items[]` |
| `refund` | Refund completed | `transaction_id`, `value`, `items[]?` |
| `add_to_wishlist` | | `currency`, `value`, `items[1]` |
| `view_promotion` | Campaign banner in viewport | `promotion_id`, `promotion_name`, `creative_slot` |
| `select_promotion` | Banner clicked | same |
| `search` | Search executed | `search_term`, `results_count` |
| `sign_up` | Registration complete | `method` |
| `login` | Login complete | `method` |
| `generate_lead` | EMI enquiry, bulk enquiry, service booking | `lead_type`, `value?` |

### 3.2 `items[]` shape

```json
{
  "item_id": "HP-VIC15-001",
  "item_name": "HP Victus 15 Gaming Laptop",
  "item_brand": "HP",
  "item_category": "Laptops",
  "item_category2": "Gaming Laptops",
  "item_category3": null,
  "item_variant": "16GB / 512GB",
  "price": 1249.00,
  "discount": 150.00,
  "quantity": 1,
  "affiliation": "New Road",
  "item_list_id": "category_laptops_gaming",
  "item_list_name": "Gaming Laptops",
  "index": 3,
  "coupon": null
}
```

**Rules:** `item_id` is the SKU (`Variant.sku`) — never the internal cuid. `item_category`…`item_category5` come from the nested `Category.path`. **`price` is in rupees as a decimal**, not paisa — GA4 expects currency units. The conversion happens once, in the analytics mapper. `affiliation` is the fulfilling branch.

### 3.3 Custom events for this project

| Event | Parameters |
|---|---|
| `builder_start` | `mode` (guided\|standard\|expert), `entry_point` |
| `builder_step_complete` | `mode`, `step_key`, `step_number`, `seconds_on_step` |
| `builder_slot_filled` | `slot_key`, `part_type`, `part_id`, `price`, `selection_method` (manual\|quick_add\|autobuild\|fix) |
| `builder_slot_cleared` | `slot_key`, `part_type` |
| `builder_compatibility_error` | `rule_code`, `severity`, `slots`, `resolved` (bool), `seconds_to_resolve?` |
| `builder_autobuild` | `budget`, `use_case`, `target_resolution`, `succeeded`, `iterations` |
| `builder_save` | `build_short_id`, `slot_count`, `total_value`, `compatibility_score` |
| `builder_share` | `build_short_id`, `channel` (link\|whatsapp\|facebook\|copy) |
| `builder_add_to_cart` | `build_short_id`, `value`, `item_count` |
| `emi_calculated` | `bank`, `tenure_months`, `amount`, `monthly_payment` |
| `service_booking_started` / `service_booking_submitted` | `device_type`, `issue_category`, `branch` |
| `service_status_checked` | `ticket_status` |
| `store_pickup_selected` | `branch` |
| `whatsapp_click` / `call_click` | `page_type`, `context` (header\|pdp\|order\|footer) |
| `receipt_uploaded` | `order_value_band` |
| `language_switched` | `from_locale`, `to_locale`, `page_type` |
| `stock_alert_requested` | `item_id`, `channel` |
| `filter_applied` | `filter_key`, `filter_value`, `result_count` |
| `zero_results` | `search_term` |

**Naming rules:** `snake_case`, ≤ 40 chars, parameter values ≤ 100 chars. Never put PII in a parameter. Never put a raw price in an event name.

---

## 4. Purchase-event integrity

This is where most e-commerce analytics implementations are wrong, and it matters more here than usual because **eSewa, Fonepay and bank transfer all confirm asynchronously** — sometimes hours later.

### Rules

| # | Rule |
|---|---|
| 1 | `purchase` fires **only** from the server, when a `Payment` transitions to `PAID` after a verified lookup (`10 §6`). Never from `/order/confirmation/[orderNumber]`. |
| 2 | `transaction_id` = `Order.orderNumber`. Stable, human-readable, and the natural idempotency key. |
| 3 | Idempotency: an `analyticsPurchaseSentAt` timestamp on `Order`. The dispatcher is a no-op if it is set. Redirect + webhook + reconciliation sweep may all fire; only one purchase event is sent. |
| 4 | Dispatch via **GA4 Measurement Protocol** (`/mp/collect`) with `client_id` captured at checkout from the `_ga` cookie and stored on the order. Without a stored `client_id`, the purchase cannot be attributed to the session and appears as `(direct)`. **Capture it at `begin_checkout` and persist it.** |
| 5 | Same pattern for Meta CAPI and TikTok Events API, with the `event_id` generated at checkout and stored so the browser and server events deduplicate. |
| 6 | `refund` is dispatched server-side when a `Refund` completes, with the same idempotency guard. |
| 7 | On the confirmation page, when the payment is still pending, fire **`checkout_pending`**, not `purchase`. Show the customer an honest state: "We're waiting for confirmation from eSewa. This usually takes a minute — we'll text you." |
| 8 | Never fire `purchase` for a COD order at placement. Fire it on **delivery confirmation**, when the money actually exists. COD orders that are refused would otherwise inflate revenue. |

> **DECISION REQUIRED:** COD purchase timing. Firing at delivery is financially honest but makes attribution windows longer and some ad platforms less effective. The recommendation is to fire at delivery and accept the attribution cost. Confirm with the owner.

---

## 5. Meta Pixel + Conversions API

> **ASSUMPTION** (`19 A11`): Meta is the dominant acquisition channel. Validate against GA4 source/medium in month 1.

Meta is believed to be the dominant acquisition channel for this business — its live presence is Facebook, Instagram, TikTok and YouTube, and Nepali retail discovery happens largely on Instagram and Facebook.

| GA4 event | Meta event |
|---|---|
| `view_item` | `ViewContent` |
| `add_to_cart` | `AddToCart` |
| `begin_checkout` | `InitiateCheckout` |
| `add_payment_info` | `AddPaymentInfo` |
| `purchase` | `Purchase` |
| `search` | `Search` |
| `sign_up` | `CompleteRegistration` |
| `add_to_wishlist` | `AddToWishlist` |
| `generate_lead` | `Lead` |
| `builder_add_to_cart` | `AddToCart` + custom `BuilderComplete` |
| `service_booking_submitted` | `Schedule` |

### Dual-send with deduplication

Every event is sent twice — once from the browser pixel, once from the server via CAPI — carrying the **same `event_id`** and `event_source_url`. Meta deduplicates. This recovers events lost to ad blockers and iOS restrictions.

> **ASSUMPTION:** industry reports commonly put that loss in the 20–40% range; the actual figure for this audience is unknown until measured. Compare browser-only against deduplicated volume in month 1.

### Advanced matching

Sent **SHA-256 hashed, lowercased, trimmed**, server-side only: email, phone (E.164 without `+`), first name, last name, city, country (`np`), and `external_id` (a stable hashed customer ID).

**Never sent, hashed or otherwise:** full street address, ward number, payment details, bank receipt content, order contents beyond product IDs, or any admin identity.

A product catalogue feed is generated at `/feeds/meta-catalog.xml` (product ID = SKU, matching `content_ids` in events) so dynamic product ads and Instagram Shopping work.

---

## 6. TikTok

TikTok is an active channel for this business. Same dual-send pattern: browser Pixel + Events API server-side, deduplicated on `event_id`.

| Mapping | `ViewContent`, `AddToCart`, `InitiateCheckout`, `CompletePayment`, `Search`, `CompleteRegistration`, `SubmitForm` |

> **ASSUMPTION:** TikTok attribution quality in Nepal is materially worse than Meta's owing to smaller sample sizes and in-app browser behaviour. Treat TikTok-reported conversions as directional. The first-party `Order.sourceChannel` and UTM capture are more trustworthy.

---

## 7. Microsoft Clarity

Free, lightweight, and the fastest way to see why the builder or checkout is failing.

| Priority | Pages |
|---|---|
| 1 | `/build` — the most complex UI in the product |
| 2 | `/checkout` — every abandonment is money |
| 3 | `/p/[slug]` — buy-box interaction |
| 4 | `/c/[...slug]` — filter usage |

### Mandatory masking

| Rule | Implementation |
|---|---|
| Clarity **must not load on `/admin/*`** at all | Route-level exclusion, not a masking rule |
| Mask by default | Clarity's strict masking mode, then selectively unmask non-sensitive content |
| Always masked | Names, phone numbers, email addresses, all address fields, ward numbers, landmarks, payment fields, coupon codes, order numbers, uploaded bank receipt images, invoice content, account pages |
| Never recorded | Any page under `/account/*` or `/order/confirmation/*` |
| Verification | A quarterly manual review of 10 recordings to confirm no PII has leaked |

---

## 8. Search Console & Bing

| Task | Detail |
|---|---|
| Properties | Domain property for `citycomputer.com.np`. `en` and `ne` are the same property; segment by page path. |
| Sitemaps | Submit the sitemap index; verify child discovery |
| Bing Webmaster | Import from GSC; also feeds ChatGPT/Copilot surfaces |
| Weekly review | Coverage errors · new 404s · Core Web Vitals · rich-result errors · top queries gaining and losing · manual actions |
| Into the admin | A nightly job pulls GSC Search Analytics via API into a `SearchConsoleDaily` table and renders "How people found you" on the owner's dashboard in plain language: *"1,240 people saw your site in Google search this week, and 87 clicked."* |

---

## 9. First-party analytics in Postgres

GA4 is sampled, delayed, jargon-heavy and cannot be joined to orders. **The owner's dashboard is powered entirely by our own database.** GA4 is for marketing analysis; Postgres is for running the business.

| Table | Columns | Notes |
|---|---|---|
| `ProductViewDaily` | `productId`, `date`, `views`, `uniqueViews` — unique `(productId, date)` | Written by a debounced `POST /products/{slug}/view`, deduped per session; rolled up nightly. Powers "Most Viewed Products". |
| `SearchQueryLog` | `query`, `normalisedQuery`, `resultCount`, `hasResults`, `clickedProductId?`, `locale`, `sessionHash`, `createdAt` | Index on `(normalisedQuery, createdAt)`. **Zero-result queries are a purchasing instruction, not a metric.** |
| `AbandonedCart` | `cartId`, `customerId?`, `email?`, `phone?`, `valuePaisa`, `itemCount`, `stage`, `recoveryEmailSentAt`, `recoveredOrderId?` | Populated by an hourly job |
| `BuilderSession` | `sessionToken`, `mode`, `useCase`, `budgetPaisa`, `stepsCompleted`, `slotsFilled`, `errorsEncountered`, `abandonedAtStep?`, `buildId?`, `convertedOrderId?` | The builder funnel, joinable to revenue |
| `BuilderEvent` | `sessionId`, `type`, `payload` JSONB, `createdAt` | Raw; pruned after 90 days once rolled up |
| `PriceHistory` | `variantId`, `pricePaisa`, `compareAtPricePaisa`, `changedById`, `reason` | Also a fat-finger safety net |
| `StockAlertRequest` | `variantId`, `email\|phone`, `status`, `notifiedAt` | Demand signal for restocking |
| `SearchConsoleDaily` | `date`, `page`, `query`, `clicks`, `impressions`, `ctr`, `position` | Pulled from the GSC API |

**Aggregation:** raw events are written cheaply and rolled up nightly into daily tables. Dashboards query rollups, never raw events. **Retention:** raw events 90 days, rollups indefinitely, `ipAddress` and `userAgent` on orders 180 days then nulled.

---

## 10. Lifecycle marketing

### Email

Two sending identities, and they must not share a domain reputation:

| Stream | From | Contains |
|---|---|---|
| Transactional | `orders@citycomputer.com.np` | Order confirmation, payment confirmed, payment failed, shipped, delivered, invoice, repair status, password reset, OTP |
| Marketing | `news@mail.citycomputer.com.np` (subdomain) | Newsletter, offers, back-in-stock, abandoned cart, review requests |

SPF, DKIM and DMARC configured for both. Marketing is double opt-in with one-click unsubscribe. Transactional email never carries a marketing unsubscribe link.

### Sequences

| Sequence | Timing | Content |
|---|---|---|
| Abandoned cart | +1 h, +24 h, +72 h | Reminder → answer objections (warranty, EMI, delivery) → optional small incentive. Stops immediately on purchase. |
| Abandoned build | +2 h, +48 h | "Your PC build is saved" with the share link and a "talk to us" CTA |
| Back in stock | On restock | Single notification, then removed |
| Post-purchase | +1 day (care tips), +7 days (**review request**), +30 days (accessories) | The review request is critical — **the site currently has zero reviews**, which costs both conversion and rich results |
| Repair updates | On status change | Ticket status with the public tracking link |
| Win-back | 90 days inactive | New arrivals in previously browsed categories |

### WhatsApp / Viber

The realistic conversational channel in Nepal. v1 implements **deep links only** (`wa.me` with pre-filled templates) from the admin order screen and from PDPs — not a Business API integration. Track `whatsapp_click`. Revisit the WhatsApp Business API when volume justifies it.

### SMS

> **DECISION REQUIRED:** No Nepali SMS aggregator has been selected or verified. SMS blocks phone OTP login, COD phone verification, and delivery notifications. This is a **Phase 0 procurement item**, not a Phase 11 one.

---

## 11. Consent and privacy

### Cookie banner

| Aspect | Spec |
|---|---|
| Appears | First visit, before any non-essential tag fires |
| Options | **Accept all** · **Reject all** (equally prominent — a hidden reject button is a dark pattern) · **Choose** |
| Categories | Essential (always on) · Analytics · Marketing · Preferences |
| Persistence | 12 months, then re-ask. Choice stored in a first-party cookie + `localStorage`. |
| Withdrawal | A permanent "Cookie settings" link in the footer |
| Layout | Fixed-position — must never cause CLS |
| Language | Available in Nepali |

### Pre-consent

Allowed: the GTM container itself, Consent Mode defaults, Sentry error capture with PII scrubbing, first-party performance beacons with no identifier, and essential session/cart cookies.
Blocked: GA4, Meta, TikTok, Clarity, and any advertising cookie.

### Retention

| Data | Retention |
|---|---|
| GA4 | 14 months |
| Raw first-party events | 90 days |
| Rollups | Indefinite |
| `Order.ipAddress` / `userAgent` | 180 days, then nulled |
| Session records | 30 days after expiry |
| Bank receipt images | 7 years (financial record), private bucket |
| Clarity recordings | Clarity default (30 days) |
| Deleted-account data | Orders retained (legal); personal fields anonymised |

### Legal position

> **ASSUMPTION:** As of the last available information, Nepal has no comprehensive data-protection statute equivalent to GDPR, though the Individual Privacy Act 2075 (2018) and related regulations impose obligations regarding personal information. **This has not been legally verified and no compliance claim should be made on the basis of this document.** The site should obtain a legal review before launch.

The practical stance: **implement to a GDPR-like standard regardless.** It is not materially more expensive, it is more defensible, and it is required anyway for any customer in the EU or UK.

---

## 12. Owner-facing dashboard

Plain-language metrics, each with its helper line, source, and cadence. No jargon, no charts above the fold. See `09 §4` for layout.

| Shown as | Helper text | Source | Refresh |
|---|---|---|---|
| **Orders today** | "3 still need attention" | `COUNT(Order)` placed today (NPT) | 60 s |
| **Money today** | "Yesterday: रु 3,10,000" | `SUM(totalPaisa)` where `paymentStatus = PAID`, today | 60 s |
| **Needs your attention** | "2 payments to check · 3 orders to send" | Composite count | 60 s |
| **Almost out of stock** | "See the list" | `StockLevel.quantity <= lowStockThreshold` | 5 min |
| **Out of stock** | "These products can't be bought right now" | `quantity - reserved <= 0`, active products | 5 min |
| **Waiting to be delivered** | "Orders you've packed but not sent" | Orders in `PACKED` / `SHIPPED` | 60 s |
| **Cancelled this week** | "3 last week" | Orders `CANCELLED` in 7 days | hourly |
| **Best sellers this week** | "By number sold" | `OrderItem` grouped, 7 days, paid only | hourly |
| **Most viewed this week** | "People looked but may not have bought" | `ProductViewDaily`, 7 days | nightly |
| **New customers** | "First-time buyers this week" | `Customer.totalOrders = 1`, created in 7 days | hourly |
| **Unread messages** | | `Enquiry` where `status = UNREAD` | 60 s |
| **This week's money** | "Compared to last week: up 12%" | `SUM(totalPaisa)`, paid, current ISO week | hourly |
| **This month's money** | "Compared to last month" | Same, calendar month, Asia/Kathmandu | hourly |
| **What people searched for and didn't find** | "You might want to stock these" | `SearchQueryLog` where `hasResults = false`, 7 days | nightly |
| **How people found you** | "1,240 saw your site in Google, 87 clicked" | `SearchConsoleDaily` | nightly |

Every tile links to the filtered list behind it. Every comparison is stated in words ("up 12%"), never only as a coloured arrow.

**Explicitly rejected:** a chart-first dashboard, "MTD/YTD" abbreviations, funnel visualisations, cohort tables, and any metric the owner cannot act on.

---

## 13. Implementation order

`17-ROADMAP-PHASES.md` is authoritative for phase boundaries. Events are **instrumented** as their features are built, but the whole measurement stack is **verified and gated in Phase 12**.

| Phase | Deliverable |
|---|---|
| **0** | Create GA4, GTM, Meta Business, TikTok Business and Clarity accounts. Select and contract an SMS provider. |
| **3** | `pushEvent()` helper, `dataLayer` contract, page_view handling, consent banner + Consent Mode defaults |
| **5** | Catalogue events: `view_item_list`, `select_item`, `view_item`, `search`, `filter_applied`, `zero_results` |
| **6** | Cart events + `AbandonedCart` capture |
| **7** | Checkout funnel events + **server-side `purchase` via Measurement Protocol** + Meta CAPI + TikTok Events API |
| **8** | Builder events + `BuilderSession` funnel |
| **9** | Owner dashboard from first-party rollups |
| **12** | Clarity, GSC API ingestion, Meta catalogue feed, lifecycle email sequences, and the full acceptance gate below |
| **13** | Web Vitals field reporting (delivered with performance work) |

---

## 14. Acceptance criteria

- [ ] No analytics tag fires before consent, verified in a network trace with an empty cookie jar.
- [ ] A page navigation produces exactly one `page_view` — verified with GA4 DebugView across 10 navigations.
- [ ] Every e-commerce event carries a valid `items[]` with SKU-based `item_id` and rupee-denominated `price`.
- [ ] A test purchase produces exactly one `purchase` event with the correct `transaction_id`, `value`, `tax` and `shipping`, dispatched from the server.
- [ ] A payment confirmed 30 minutes later by the reconciliation sweep still produces exactly one `purchase` event.
- [ ] Browser and server events deduplicate in Meta Events Manager (dedupe rate > 80%).
- [ ] Clarity does not load on any `/admin` route, and a sample recording shows no PII.
- [ ] The owner's dashboard answers all twelve required questions without a chart.
- [ ] Zero-result searches from the last 7 days are visible to the owner.
- [ ] GA4 revenue reconciles with `SUM(Order.totalPaisa)` within 2% over a 7-day window.
- [ ] All marketing email is double opt-in with a working one-click unsubscribe.
- [ ] SPF, DKIM and DMARC pass for both sending identities.
