# 07 — API Design

Contracts for every server boundary: Route Handlers, Server Actions, and webhooks.

**Depends on:** `06`. **Feeds into:** `08`, `09`, `10`, `13`, `16`.

---

## 1. Boundary strategy

Three kinds of server boundary, used deliberately:

| Boundary | Use for | Why |
|---|---|---|
| **RSC data loading** (direct service calls in server components) | Page rendering: category listings, PDP, blog, admin tables | No HTTP hop, no serialisation cost, no duplicate validation |
| **Server Actions** | Mutations initiated from a form or a React interaction: add to cart, place order, admin CRUD | Progressive enhancement, typed end-to-end, no hand-written fetch |
| **Route Handlers `/api/v1/*`** | Anything a non-React consumer calls: webhooks, cron, health, dynamic OG, autocomplete, the builder's part queries, and any endpoint a future mobile app would need | Cacheable, versioned, testable in isolation |

**Rule:** if only our own React code calls it and it's a mutation, it's a Server Action. If it's read-heavy, cacheable, or externally callable, it's a Route Handler.

**Why not GraphQL:** one first-party client, a catalogue with predictable access patterns, and a strong need for HTTP-level caching. GraphQL would add a schema layer, a caching problem, and an N+1 risk for no benefit. If a native app ever ships, the `/api/v1` REST surface is already the right contract.

---

## 2. Conventions

### Versioning
`/api/v1/...`. Breaking changes create `/api/v2` and `v1` is supported for 6 months with a `Deprecation` and `Sunset` header. Additive changes never bump the version.

### Request

| Aspect | Rule |
|---|---|
| Content type | `application/json`, UTF-8. File uploads via `multipart/form-data` to dedicated endpoints. |
| Auth | Session cookie (`__Secure-authjs.session-token`, `HttpOnly`, `SameSite=Lax`). Admin API additionally requires a valid CSRF token on mutations. |
| Idempotency | Mutating endpoints that create money-relevant records accept `Idempotency-Key`. Stored 24 h in Redis + the `Payment.intentReference` column. |
| Locale | `Accept-Language` or an explicit `?locale=ne`. Defaults `en`. |
| Correlation | Every response carries `X-Request-Id`; clients should echo it in bug reports. |

### Response envelope

Success:
```json
{ "data": { }, "meta": { } }
```
List:
```json
{
  "data": [ ],
  "meta": {
    "pagination": { "page": 1, "perPage": 24, "total": 152, "totalPages": 7,
                    "hasNext": true, "nextCursor": "eyJpZCI6..." },
    "facets": { }
  }
}
```

Error — RFC 9457 Problem Details:
```json
{
  "type": "https://citycomputer.com.np/errors/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "instance": "/api/v1/checkout/place",
  "code": "VALIDATION_FAILED",
  "requestId": "req_01J...",
  "errors": [
    { "field": "shippingAddress.ward", "code": "required",
      "message": "Ward number is required." }
  ]
}
```

**Never** leak stack traces, SQL, provider secrets, or internal IDs in errors.

### Status codes

`200` ok · `201` created · `202` accepted (async payment) · `204` no content · `400` malformed · `401` unauthenticated · `403` unauthorised · `404` not found · `409` conflict (stock, version, duplicate) · `410` gone (retired legacy route) · `422` validation failed · `429` rate limited (with `Retry-After`) · `500` internal · `503` dependency unavailable.

### Error code registry (stable strings — clients switch on these, not on messages)

`VALIDATION_FAILED` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `RATE_LIMITED` · `CONFLICT_VERSION` · `INSUFFICIENT_STOCK` · `PRICE_CHANGED` · `CART_EMPTY` · `COUPON_INVALID` · `COUPON_EXPIRED` · `COUPON_LIMIT_REACHED` · `PAYMENT_METHOD_UNAVAILABLE` · `PAYMENT_AMOUNT_EXCEEDS_LIMIT` · `PAYMENT_VERIFICATION_FAILED` · `PAYMENT_ALREADY_PROCESSED` · `ORDER_NOT_CANCELLABLE` · `BUILD_INCOMPATIBLE` · `BUILD_PART_UNAVAILABLE` · `ADDRESS_OUTSIDE_DELIVERY_ZONE` · `COD_NOT_AVAILABLE` · `UPLOAD_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `DEPENDENCY_UNAVAILABLE`

### Pagination

| Style | Where | Params |
|---|---|---|
| Offset | Catalogue, admin tables — needs total counts and page numbers for SEO | `?page=1&perPage=24` (max 100) |
| Cursor | Infinite scroll, exports, high-churn lists | `?cursor=<opaque>&limit=50` |

Both may be returned; `page` is authoritative for indexable listings.

### Filtering and sorting

`?filter[brand]=hp,dell&filter[price][gte]=50000&filter[price][lte]=150000&filter[spec.ram_gb]=16&sort=-createdAt`

- Filter keys are whitelisted per resource. Unknown keys → `422`, never silently ignored (silent ignores produce wrong-looking pages and duplicate-content risk).
- Sort: `field` ascending, `-field` descending. Whitelisted.
- Prices in filters are in **rupees** for URL readability; converted to paisa server-side.

### Caching

| Resource | Header | Revalidation |
|---|---|---|
| Product, category reads | `s-maxage=300, stale-while-revalidate=600` | Tag-based on write (`revalidateTag('product:{id}')`) |
| Brand reads | `s-maxage=600, stale-while-revalidate=1800` | Tag-based |
| Blog | `s-maxage=600, swr=3600` | Tag-based |
| CMS pages, stores | `s-maxage=3600, swr=7200` | Tag-based |
| Search / autocomplete | `s-maxage=60` | Time only |
| Builder parts | `s-maxage=300` | Tag on part change |
| Cart, checkout, account, admin | `no-store` | — |
| Health | `no-store` | — |

### Rate limits (Redis sliding window, keyed by IP + user)

| Endpoint class | Limit |
|---|---|
| Public reads | 120 / min / IP |
| Search & autocomplete | 60 / min / IP |
| Auth (login, register, reset) | 5 / 15 min / IP **and** 5 / 15 min / identifier |
| OTP send | 3 / hour / phone, 10 / hour / IP |
| Cart mutations | 60 / min / session |
| Checkout place | 5 / 10 min / session |
| Payment initiate | 10 / hour / order |
| Review / enquiry / newsletter | 5 / hour / IP |
| Builder validate | 120 / min / session |
| File upload | 20 / hour / user |
| Admin mutations | 300 / min / user |
| Webhooks | Not limited by IP; limited by signature validity + replay window |

Exceeded → `429` + `Retry-After` + `X-RateLimit-*`.

---

## 3. Public endpoints

### 3.1 Catalogue

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/api/v1/products` | List/filter products | Paginated, faceted |
| GET | `/api/v1/products/{slug}` | Product detail | Includes variants, media, specs, stock summary, related |
| GET | `/api/v1/products/{slug}/availability` | Per-branch stock | `no-store`; called on PDP mount |
| GET | `/api/v1/categories` | Tree or flat | `?tree=true` |
| GET | `/api/v1/categories/{path}` | Category + facet definitions | |
| GET | `/api/v1/brands` · `/api/v1/brands/{slug}` | | |
| GET | `/api/v1/search?q=` | Full search with facets | |
| GET | `/api/v1/suggest?q=` | Autocomplete: products, categories, brands, blog | ≤ 10 results, ≤ 100 ms p95 |
| POST | `/api/v1/products/{slug}/view` | Record a view | Fire-and-forget, `202`, deduped per session |

**`GET /api/v1/products` query parameters**

| Param | Type | Notes |
|---|---|---|
| `category` | slug path | `laptops/gaming` — includes descendants |
| `brand` | csv slugs | |
| `q` | string | |
| `filter[price][gte\|lte]` | int (rupees) | |
| `filter[spec.<key>]` | csv or range | Whitelisted from `SpecField.isFilterable` |
| `availability` | `in_stock\|out_of_stock\|all` | Default `all`; `in_stock` boosts by default in ranking regardless |
| `branch` | slug | Limits availability to one branch |
| `condition` | `NEW\|REFURBISHED\|OPEN_BOX` | |
| `onSale` | bool | Has `compareAtPrice` |
| `sort` | `relevance\|price\|-price\|-createdAt\|-sales\|-discount` | |
| `page`, `perPage` | int | |

**Product summary shape (list):**
```json
{
  "id": "clx...", "slug": "hp-victus-15-...",
  "displayTitle": "HP Victus 15 Gaming Laptop",
  "brand": { "slug": "hp", "name": "HP" },
  "primaryCategory": { "slug": "laptops/gaming", "name": "Gaming Laptops" },
  "image": { "url": "...", "blurDataUrl": "...", "alt": "HP Victus 15 ..." },
  "specHighlights": [ { "label": "Processor", "value": "Core i5 13420H" } ],
  "priceFrom": { "amountPaisa": 12490000, "compareAtPaisa": 13990000,
                 "discountPercent": 11 },
  "availability": "IN_STOCK",
  "rating": { "average": null, "count": 0 },
  "badges": ["NEW"]
}
```

`rating.average` is `null` when `count` is 0. **Clients MUST NOT render stars for a null average**, and the JSON-LD builder MUST NOT emit `AggregateRating` — this is the current site's most visible structured-data failure.

### 3.2 Cart — Server Actions, mirrored as Route Handlers for resilience

| Action / Route | Purpose |
|---|---|
| `getCart()` / `GET /api/v1/cart` | Current cart with re-resolved prices and availability |
| `addToCart({variantId, quantity, buildId?})` / `POST /api/v1/cart/items` | `409 INSUFFICIENT_STOCK` if unavailable |
| `updateCartItem({itemId, quantity})` / `PATCH .../items/{id}` | Quantity 0 removes |
| `removeCartItem({itemId})` / `DELETE .../items/{id}` | |
| `applyCoupon({code})` / `POST /api/v1/cart/coupon` | |
| `removeCoupon()` / `DELETE /api/v1/cart/coupon` | |
| `addBuildToCart({buildId})` / `POST /api/v1/cart/build` | Re-validates the whole build, adds all parts plus the assembly service line |

Cart responses always include `warnings[]`: `PRICE_CHANGED`, `STOCK_REDUCED`, `ITEM_UNAVAILABLE`, `COUPON_NO_LONGER_VALID`. The UI surfaces these; it never silently adjusts a cart.

### 3.3 Checkout

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/checkout/quote` | Given cart + address + fulfilment type, returns shipping options, tax, total, and **the payment methods permitted at that value** (see `10 §5`) |
| POST | `/api/v1/checkout/place` | Places the order. Idempotent via `Idempotency-Key`. Returns the order and a `PaymentIntent`. |
| POST | `/api/v1/checkout/validate-address` | Zone resolution and required-field check |

**`POST /checkout/place` — request**
```json
{
  "cartToken": "...",
  "contact": { "name": "...", "phone": "+9779800000000", "email": "..." },
  "fulfilment": { "type": "DELIVERY", "branchId": null,
                  "address": { "province": "BAGMATI", "district": "Kathmandu",
                               "municipality": "Kathmandu Metropolitan City",
                               "ward": 12, "streetAddress": "...",
                               "landmark": "Opposite Shanker Dev Campus" } },
  "shippingRateId": "...",
  "paymentMethod": "ESEWA",
  "customerNote": "",
  "acceptedTerms": true
}
```

**Response `201`**
```json
{
  "data": {
    "order": { "orderNumber": "CC-2607-0042", "status": "PENDING_PAYMENT",
               "totalPaisa": 15490000 },
    "payment": {
      "id": "pay_...", "provider": "ESEWA", "status": "INITIATED",
      "action": { "type": "REDIRECT_FORM",
                  "url": "https://epay.esewa.com.np/api/epay/main/v2/form",
                  "method": "POST",
                  "fields": { "amount": "154900", "signature": "..." } },
      "expiresAt": "2026-07-27T10:35:00Z"
    }
  }
}
```

`payment.action.type` is one of `REDIRECT_FORM` · `REDIRECT_URL` · `SHOW_QR` · `SHOW_BANK_DETAILS` · `NONE` (COD). This one polymorphic field lets the client handle every Nepali gateway without provider-specific branching.

**Server-side revalidation at placement (all inside one transaction):** cart non-empty → every variant still active → stock available at the chosen branch → prices re-resolved from the DB (never trusted from the client) → coupon still valid and within limits → address resolves to a delivery zone → chosen payment method permitted at this order value → COD eligibility (cap, customer not `codBlocked`, phone verified).

### 3.4 Payments

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/payments/{id}/initiate` | Create or re-create a gateway attempt |
| GET | `/api/v1/payments/{id}/status` | Poll — used by the QR and bank-transfer flows |
| POST | `/api/v1/payments/{id}/receipt` | Upload a bank-deposit slip (multipart) |
| GET | `/api/v1/payments/callback/{provider}` | Browser return from a gateway. **Verifies server-side, then redirects.** Never trusts its own query string. |
| POST | `/api/webhooks/{provider}` | Signature-verified server-to-server notification |

See `10 §6` for the full verification protocol.

### 3.5 Orders and tracking

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/orders` | Customer session |
| GET | `/api/v1/orders/{orderNumber}` | Owner or admin |
| POST | `/api/v1/orders/{orderNumber}/cancel` | Owner, only in cancellable states |
| GET | `/api/v1/orders/{orderNumber}/invoice` | Signed short-lived URL to the PDF |
| POST | `/api/v1/track` | Public: `{orderNumber, phone}` → limited status payload. Rate limited 10/hour/IP. |

The public tracking response deliberately omits address detail, item costs, and customer email — order numbers are semi-guessable.

### 3.6 Builder

Detailed contracts in `08 §7`.

| Method | Path |
|---|---|
| GET | `/api/v1/builder/parts?type=CPU&filter[...]&compatibleWith=<buildStateToken>` |
| POST | `/api/v1/builder/validate` |
| POST | `/api/v1/builder/recommend` |
| POST | `/api/v1/builder/autobuild` |
| POST | `/api/v1/builder/builds` · GET/PATCH/DELETE `/builds/{shortId}` |
| POST | `/api/v1/builder/builds/{shortId}/clone` |
| GET | `/api/v1/builder/builds/{shortId}/pdf` |
| POST | `/api/v1/builder/compare` |

### 3.7 Content, service, misc

| Method | Path |
|---|---|
| GET | `/api/v1/posts` · `/api/v1/posts/{slug}` · `/api/v1/pages/{slug}` |
| GET | `/api/v1/branches` · `/api/v1/branches/{slug}` |
| GET | `/api/v1/menus/{key}` · `/api/v1/settings/public` |
| POST | `/api/v1/service/tickets` — create a repair booking |
| POST | `/api/v1/service/tickets/lookup` — `{ticketNumber, phoneLast4}` |
| POST | `/api/v1/reviews` — auth or verified order required |
| POST | `/api/v1/enquiries` · `/api/v1/newsletter` · `/api/v1/stock-alerts` |
| GET/POST/DELETE | `/api/v1/wishlist` |
| POST | `/api/v1/emi/calculate` — `{amountPaisa, bank, tenureMonths}` → schedule |

All public POST endpoints carry: Zod validation, rate limiting, a honeypot field, and a minimum-time-on-form check. No CAPTCHA at launch; Cloudflare Turnstile is the escalation if abuse appears.

---

## 4. Authentication flows

### 4.1 Email + password
`register → verification email → verify → login`. Argon2id (memory 19 MiB, iterations 2, parallelism 1 minimum). Passwords ≥ 10 chars, checked against a breached-password list. Registration and login responses are timing-normalised and message-identical for unknown vs wrong-password.

### 4.2 Phone OTP (Should-have)
`POST /auth/otp/request {phone}` → 6-digit code, 5-minute TTL, hashed at rest, 3 attempts, 3 requests/hour/phone. `POST /auth/otp/verify` creates or links the user.
> **DECISION REQUIRED:** No Nepali SMS provider has been selected or verified. Until one is, phone OTP cannot ship. See `19`.

### 4.3 OAuth
Google only. Email must be verified by the provider. Account linking requires proof of ownership of the existing email.

### 4.4 Sessions
Database-backed. 30-day rolling for customers, **8-hour absolute and 30-minute idle for admin roles** (`13 §2`), with a 2-minute expiry warning. Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `__Secure-` prefix. Password change, role change, or explicit revocation invalidates every session for that user.

### 4.5 Admin 2FA
TOTP mandatory for `OWNER` and `MANAGER`, with recovery codes issued once and stored hashed. Enforced in middleware — a session without a satisfied 2FA claim cannot reach `/admin`.

### 4.6 Authorisation
Every protected handler calls `requirePermission('order:refund')`. Permission checks happen in the **service layer**, not only in the route — so a Server Action and a Route Handler cannot diverge. Resource-level ownership (this customer owns this order) is checked separately from capability.

---

## 5. Admin API

Namespaced under `/api/v1/admin/*`, all requiring session + permission + CSRF, all writing `AuditLog`.

| Domain | Endpoints |
|---|---|
| Products | CRUD, `POST /products/{id}/duplicate`, `POST /products/bulk`, `POST /products/import` (CSV), `GET /products/export`, `POST /products/{id}/publish` |
| Media | `POST /media` (presigned direct-to-S3), `POST /media/{id}/alt-text` (auto-generate), `DELETE /media/{id}` (blocked if referenced) |
| Inventory | `POST /inventory/adjust` (`{variantId, branchId, delta, reason, note}`), `POST /inventory/set`, `POST /inventory/bulk`, `GET /inventory/low-stock`, `GET /inventory/movements` |
| Orders | `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/transition`, `POST /orders/{id}/undo-transition` (10 s window), `POST /orders/{id}/refund`, `POST /orders/{id}/note`, `GET /orders/{id}/invoice`, `GET /orders/{id}/label`, `POST /orders/manual` (phone orders) |
| Payments | `POST /payments/{id}/approve`, `POST /payments/{id}/reject`, `POST /payments/{id}/recheck`, `GET /payments/pending-verification` |
| Customers | CRUD-lite, `POST /customers/{id}/block-cod`, `GET /customers/{id}/orders` |
| Coupons / Campaigns | CRUD |
| Content | Posts, pages, menus, home sections, FAQs |
| Builder | Parts CRUD + import, rules CRUD, `POST /builder/rules/{id}/test` (dry-run against sample builds), `GET /builder/builds` |
| Service | Tickets CRUD, transitions, quotes |
| Reports | `GET /reports/dashboard`, `/reports/sales`, `/reports/products`, `/reports/inventory`, `/reports/search-gaps` |
| Settings | `GET/PATCH /settings` |
| Users | CRUD, role assignment, session revocation |
| Search | `GET /admin/search?q=` — global search across products, orders, customers, tickets, coupons, posts, builds |

### Bulk operations
Any bulk endpoint accepting > 50 items returns `202` with a `jobId`; progress is polled at `GET /api/v1/admin/jobs/{id}`. This keeps CSV import within serverless timeouts and gives the admin a progress bar instead of a hang.

---

## 6. Webhooks (inbound)

`POST /api/webhooks/{esewa|khalti|fonepay|connectips}`

Mandatory handling for every provider:

1. Read the **raw body** before any parsing (signatures are over raw bytes).
2. Verify the signature/HMAC. Invalid → `401`, log, alert if repeated.
3. Reject timestamps outside a 5-minute window (replay protection).
4. Dedupe on `(provider, providerTransactionId, eventType)` — persisted, not in-memory.
5. Persist a `PaymentEvent` **before** acting.
6. **Independently confirm with a server-to-server status lookup.** A webhook is a hint that something changed, never proof of what it changed to.
7. Return `200` fast; do the work in a job.
8. Never trust an amount from the webhook — compare the looked-up amount against `Order.totalPaisa` and refuse to settle on mismatch.

---

## 7. Cron endpoints

`GET /api/cron/{name}`, protected by a `CRON_SECRET` bearer token and (where possible) an IP allowlist.

| Name | Schedule | Purpose |
|---|---|---|
| `reconcile-payments` | */5 min | Look up every `INITIATED`/`PENDING` payment older than 3 min. **This is what makes async Nepali payments survivable.** |
| `release-reservations` | */10 min | Expire stale stock holds |
| `abandoned-cart` | hourly | Detect and enqueue recovery emails |
| `low-stock-alert` | 09:00 NPT | Notify the owner |
| `daily-rollups` | 01:00 NPT | `ProductViewDaily`, sales aggregates, materialised view refresh |
| `sitemap-refresh` | 02:00 NPT | Regenerate sitemap ISR |
| `stock-integrity-check` | 03:00 NPT | Assert `StockLevel == SUM(StockMovement)`; alert on drift |
| `price-freshness` | 04:00 NPT | Flag builder parts not re-verified in 30 days |
| `backup-verify` | 05:00 NPT | Confirm last night's backup restores |
| `drain-queue` | */1 min | Only on the serverless host — processes the `Job` table |

---

## 8. Validation

One Zod schema per input, shared between the client form and the server. Server validation is never skipped because the client validated.

| Field | Rule |
|---|---|
| Phone | `^\+9779[678]\d{8}$` after normalisation; accept `98…`, `+977 98…`, `977-98…` |
| Email | RFC-ish + DNS MX check on registration (async, non-blocking) |
| Money | Positive integer paisa; max 100,000,000 paisa (NPR 1,000,000) per line |
| Quantity | 1–99 storefront; unbounded admin |
| Slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80 chars |
| Ward | 1–35 |
| Free text | Length-capped, control characters stripped, no HTML |
| Rich text | Tiptap JSON validated against an allowed node/mark schema — **never accept raw HTML** |
| Uploads | Magic-byte sniffing (not extension), ≤ 10 MB images / 20 MB receipts, `image/jpeg\|png\|webp\|avif` + `application/pdf` for receipts, EXIF stripped, re-encoded server-side |

---

## 9. Real-time and polling

No WebSockets in v1.

| Need | Mechanism |
|---|---|
| QR payment confirmation | Poll `GET /payments/{id}/status` every 3 s, 5-minute cap, exponential backoff on error |
| Admin new-order notification | Poll every 60 s while the tab is visible; browser notification on change |
| Build validation | Synchronous request/response — must return < 300 ms p95 |
| Stock changes | Not real-time. Re-checked at checkout, which is the only moment it matters. |

---

## 10. API documentation

- Zod schemas → OpenAPI 3.1 via `zod-to-openapi`, generated in CI.
- Served at `/api/v1/openapi.json`; a Scalar/Redoc UI at `/api/docs` in non-production only.
- Every endpoint documents: purpose, auth, permissions, rate limit, params, request, response, error codes, and an example.
- Contract tests assert that the implementation matches the generated spec — a drifted endpoint fails CI.
