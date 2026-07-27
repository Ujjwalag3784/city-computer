# 06 — Data Model

Every entity, relationship, constraint, and index. This is the most consequential document in the bundle: the Dad Mode admin, the compatibility engine, and the payment reconciliation all live or die on the shape below.

**Depends on:** `02`, `03`, `04`. **Feeds into:** `07`, `08`, `09`, `10`.

---

## 1. Global conventions

| Rule | Detail |
|---|---|
| Primary keys | `String @id @default(cuid())` — cuid2. Never exposed in URLs. |
| Public identifiers | Separate, human-safe columns: `orderNumber` `CC-YYMM-NNNN`, `ticketNumber` `SVC-YYMM-NNNN`, `Build.shortId` (8-char base58), `slug`. |
| Money | `Int` in **paisa**. Column names end `...Paisa` in the DB, exposed as paisa in the API, formatted only at the edge. Never `Float`, never `Decimal` in app code. |
| Timestamps | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, both `timestamptz`. |
| Soft delete | `deletedAt DateTime?` on Product, Variant, Category, Brand, Post, Page, Customer, ComponentPart. **Never** on Order, Payment, StockMovement, AuditLog — those are immutable financial/legal records. All queries filter `deletedAt: null` via a Prisma extension. |
| Naming | Model `PascalCase` singular; table `snake_case` plural via `@@map`; column `snake_case` via `@map`. |
| Translations | Sidecar `*Translation` tables keyed `(parentId, locale)`. No JSON blobs for translatable text — they cannot be indexed or queried. |
| Enums | Postgres enums via Prisma `enum`. |
| Optimistic locking | `version Int @default(0)` on Product, Variant, StockLevel, Order. |

---

## 2. Entity map

```
┌─ IDENTITY ────────────────────────────────────────────────┐
│ User ─┬─ Account (OAuth)                                  │
│       ├─ Session                                          │
│       ├─ UserRole ── Role ── RolePermission ── Permission │
│       └─ Customer ─┬─ Address                             │
│                    ├─ WishlistItem                        │
│                    └─ SavedBuild                          │
└───────────────────────────────────────────────────────────┘
┌─ CATALOGUE ───────────────────────────────────────────────┐
│ Category ─┬─ Category (self, nested)                      │
│           ├─ CategoryTranslation                          │
│           ├─ SpecTemplate ── SpecField                    │
│           └─ ProductCategory ── Product                   │
│ Brand ── BrandTranslation ── Product                      │
│ Product ─┬─ ProductTranslation                            │
│          ├─ ProductMedia ── Media                         │
│          ├─ Variant ─┬─ VariantOptionValue ── OptionValue │
│          │           ├─ StockLevel ── Branch              │
│          │           ├─ PriceHistory                      │
│          │           └─ ComponentPart  (builder link)     │
│          ├─ ProductSpec        (denormalised, queryable)  │
│          ├─ Review                                        │
│          ├─ ProductSlugHistory (301 redirects)            │
│          └─ RelatedProduct                                │
└───────────────────────────────────────────────────────────┘
┌─ INVENTORY ───────────────────────────────────────────────┐
│ Branch ─┬─ StockLevel ── Variant                          │
│         ├─ StockMovement                                  │
│         └─ BranchHours                                    │
│ StockReservation ── Variant, Cart|Order                   │
└───────────────────────────────────────────────────────────┘
┌─ COMMERCE ────────────────────────────────────────────────┐
│ Cart ── CartItem ── Variant                               │
│ Order ─┬─ OrderItem ── Variant                            │
│        ├─ OrderAddress (frozen copy)                      │
│        ├─ OrderStatusEvent                                │
│        ├─ Payment ── PaymentEvent                         │
│        ├─ Fulfilment ── FulfilmentItem                    │
│        ├─ Refund                                          │
│        └─ Invoice                                         │
│ Coupon ── CouponRedemption                                │
│ Promotion ── PromotionRule                                │
│ DeliveryZone ── ShippingRate                              │
└───────────────────────────────────────────────────────────┘
┌─ PC BUILDER ──────────────────────────────────────────────┐
│ ComponentPart ─┬─ Variant (1:1 optional)                  │
│                ├─ PartSpec  (typed JSONB + columns)       │
│                └─ PartConnector                           │
│ CompatibilityRule ── RuleCondition                        │
│ Build ─┬─ BuildItem ── ComponentPart                      │
│        ├─ BuildRevision                                   │
│        └─ BuildValidationSnapshot                         │
│ BuildTemplate (presets / prebuilts)                       │
└───────────────────────────────────────────────────────────┘
┌─ CONTENT ─────────────────────────────────────────────────┐
│ Post ── PostTranslation, PostCategory, Author             │
│ Page ── PageTranslation                                   │
│ Menu ── MenuItem (self-nested)                            │
│ HomeSection (typed blocks)                                │
│ Faq                                                       │
└───────────────────────────────────────────────────────────┘
┌─ SERVICE DESK ────────────────────────────────────────────┐
│ ServiceTicket ─┬─ TicketEvent                             │
│                ├─ TicketMedia ── Media                    │
│                └─ TicketQuote                             │
└───────────────────────────────────────────────────────────┘
┌─ OPS & ANALYTICS ─────────────────────────────────────────┐
│ Setting · AuditLog · Job · Redirect · Enquiry             │
│ ProductViewDaily · SearchQueryLog · AbandonedCart         │
│ BuilderSession · StockAlertRequest · NewsletterSubscriber │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Identity & access

### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | String PK | |
| `email` | String? unique | Nullable — phone-first accounts are legitimate here |
| `emailVerified` | DateTime? | |
| `phone` | String? unique | E.164, `+9779XXXXXXXXX` |
| `phoneVerified` | DateTime? | |
| `passwordHash` | String? | Argon2id. Null for OAuth-only. |
| `name` | String? | |
| `image` | String? | |
| `status` | enum `ACTIVE\|SUSPENDED\|DELETED` | |
| `lastLoginAt` | DateTime? | |
| `failedLoginCount` | Int @default(0) | Lockout after 10 |
| `lockedUntil` | DateTime? | |
| `twoFactorSecret` | String? | Encrypted at rest; **required for admin roles** |
| `preferredLocale` | enum `EN\|NE` | |

Constraint: at least one of `email` or `phone` must be non-null (DB `CHECK`).
Indexes: `email`, `phone`, `status`, `createdAt`.

### `Account`, `Session`, `VerificationToken`
Auth.js standard shapes. `Session` uses database strategy so admin sessions can be revoked server-side.

### `Role`, `Permission`, `RolePermission`, `UserRole`

Roles seeded: `OWNER`, `MANAGER`, `STAFF`, `CONTENT_EDITOR`, `SUPPORT`, `TECHNICIAN`, `CUSTOMER`.

Permissions are `resource:action` strings — `product:create`, `order:refund`, `price:update`, `settings:write`, `user:manage`, `builder-rule:write`, `payment:approve`, `report:view`, `audit:view`, `service-ticket:write`.

| Role | Capability summary |
|---|---|
| `OWNER` | Everything, including user management and settings. Only role that can approve a bank-transfer payment above the two-person threshold. |
| `MANAGER` | Everything except user management, settings, and destructive deletes |
| `STAFF` | Orders, inventory, customers, service tickets. **No price editing, no deletes.** |
| `CONTENT_EDITOR` | Blog, pages, SEO fields, media |
| `SUPPORT` | Read orders and customers, reply to enquiries |
| `TECHNICIAN` | Service tickets only |
| `CUSTOMER` | Storefront only |

Checks are always permission-based (`can(user, 'order:refund')`), never role-string comparisons.

### `Customer`
1:1 with `User` for registered customers; standalone rows exist for guest orders.

| Field | Notes |
|---|---|
| `userId` | String? unique — null for guests |
| `email`, `phone`, `name` | Denormalised for guest orders |
| `defaultAddressId` | |
| `totalOrders`, `totalSpentPaisa`, `lastOrderAt` | Maintained by trigger/job for the admin customer list |
| `tags` | String[] — e.g. `wholesale`, `cod-blocked` |
| `codBlocked` | Boolean @default(false) — set after repeated COD refusals |
| `notes` | Text — internal, admin-only |

### `Address`
`fullName`, `phone`, `alternatePhone?`, `province` (enum, 7 provinces), `district`, `municipality`, `ward` (Int?), `streetAddress`, `landmark?`, `latitude?`, `longitude?`, `label` (`HOME\|OFFICE\|OTHER`), `isDefault`.

> Nepal has no reliable postal-code system in practice. **There is no postcode field.** `landmark` is effectively required — it is how deliveries actually get made.

---

## 4. Catalogue

### `Category`
| Field | Notes |
|---|---|
| `slug` | unique, immutable once published |
| `parentId` | self-relation |
| `path` | String — materialised path `laptops/gaming`, indexed, enables `/c/[...slug]` in one query |
| `depth` | Int |
| `position` | Int — admin drag-order |
| `imageId`, `iconName` | |
| `specTemplateId` | Drives the admin spec form and the storefront facets |
| `isActive`, `showInNav`, `showInFooter` | |
| `metaTitle`, `metaDescription`, `ogImageId` | |

`CategoryTranslation(categoryId, locale, name, description, metaTitle, metaDescription)` — unique `(categoryId, locale)`.

Indexes: `slug`, `path`, `parentId`, `(isActive, position)`.

### `Brand`
`slug` unique, `name`, `logoId`, `description`, `website`, `isActive`, `isFeatured`, SEO fields, + `BrandTranslation`.

### `Product`
| Field | Notes |
|---|---|
| `slug` | unique. Immutable after publish; changes write to `ProductSlugHistory`. |
| `name` | Full catalogue string (may be long) |
| `displayTitle` | ≤ 70 chars — the product-card title |
| `h1` | ≤ 70 chars — the page heading. Derived from `displayTitle` by stripping spec clauses; editable. **Fixes audit defect `01 A.4 #13`.** |
| `shortDescription` | ≤ 200 chars |
| `description` | Tiptap JSON |
| `brandId` | |
| `primaryCategoryId` | Canonical category for breadcrumbs and URLs |
| `type` | enum `SIMPLE \| VARIABLE \| PREBUILT \| SERVICE \| BUNDLE` |
| `status` | enum `DRAFT \| ACTIVE \| ARCHIVED` |
| `publishedAt` | |
| `isFeatured`, `isNew` | |
| `warrantyMonths`, `warrantyText` | |
| `conditionType` | enum `NEW \| REFURBISHED \| OPEN_BOX` |
| `metaTitle`, `metaDescription`, `ogImageId`, `canonicalOverride` | |
| `searchVector` | `tsvector`, GIN-indexed, maintained by trigger |
| `viewCount` | Denormalised from `ProductViewDaily` |
| `ratingAverage`, `ratingCount` | Denormalised; **`ratingCount = 0` MUST suppress rating schema** (see `11`) |
| `version` | Optimistic lock |

Indexes: `slug`, `status`, `brandId`, `primaryCategoryId`, `(status, publishedAt DESC)`, `(status, isFeatured)`, GIN on `searchVector`, GIN `pg_trgm` on `name`.

`ProductTranslation(productId, locale, displayTitle, shortDescription, description, metaTitle, metaDescription)`.

`ProductCategory(productId, categoryId)` — many-to-many for cross-listing (a MacBook is in both Apple Store and Laptops, as today).

### `Variant`
The unit that is actually priced, stocked, and sold. **Every product has at least one variant**, even simple ones — this avoids a whole class of bugs, and the admin hides it when there is only one ("Product Options" only appears when the owner adds a second).

| Field | Notes |
|---|---|
| `productId` | |
| `sku` | unique — admin label: **"Product Code"** |
| `barcode` | String? |
| `title` | e.g. "16GB / 512GB" |
| `pricePaisa` | Int — selling price |
| `compareAtPricePaisa` | Int? — the struck-through original. **Missing from the Stitch designs; required.** |
| `costPaisa` | Int? — admin-only, drives margin reporting |
| `weightGrams` | Int? |
| `isDefault` | Boolean |
| `position` | Int |
| `isActive` | |
| `lowStockThreshold` | Int @default(3) |
| `allowBackorder` | Boolean @default(false) |
| `version` | |

Unique: `sku`. Indexes: `productId`, `(productId, isDefault)`, `isActive`.

**Price rule:** `compareAtPricePaisa` must be `> pricePaisa` or null (DB `CHECK`). The admin shows a friendly error, not a constraint violation.

### `OptionType` / `OptionValue` / `VariantOptionValue`
`OptionType(productId, name, position)` — e.g. "Memory", "Storage".
`OptionValue(optionTypeId, value, position)` — "16GB", "512GB".
`VariantOptionValue(variantId, optionValueId)` — composite key.

Admin label: "Product Options".

### `ProductSpec`
Denormalised, queryable specification rows — this is what powers faceted filtering.

| Field | Notes |
|---|---|
| `productId` | |
| `key` | Slug from `SpecField`, e.g. `processor`, `ram_gb`, `screen_size_in` |
| `label` | Display label at time of entry |
| `valueText` | String? |
| `valueNumber` | Decimal? — enables range filters and sorting |
| `valueBool` | Boolean? |
| `unit` | String? — `GB`, `inch`, `Hz`, `W` |
| `group` | String? — spec-table section |
| `position` | Int |
| `isFilterable`, `isComparable` | Boolean |

Unique `(productId, key)`. Indexes: `(key, valueText)`, `(key, valueNumber)`.

**Why both this and `PartSpec` (§7)?** `ProductSpec` is a flexible, human-authored, per-category display and filter layer. `PartSpec` is a strict, validated, machine-consumed schema for the compatibility engine. Conflating them was the reference application's core mistake — it inferred engine-grade facts from marketing strings.

### `SpecTemplate` / `SpecField`
Per-category templates that make the admin's Step 3 automatic.

`SpecTemplate(categoryId, name)`.
`SpecField(templateId, key, label, helpText, dataType [TEXT|NUMBER|BOOL|SELECT], unit?, options String[], isRequired, isFilterable, isComparable, group, position)`.

Seeded templates: Laptop, Desktop/Prebuilt, Monitor, CPU, GPU, Motherboard, RAM, Storage, PSU, Cooler, Case, Printer, Projector, CCTV, Accessory. See `09 §5` for the field lists.

### `Media`
| Field | Notes |
|---|---|
| `key` | S3 object key |
| `url`, `cdnUrl` | |
| `mimeType`, `sizeBytes`, `width`, `height` | |
| `blurDataUrl` | base64 LQIP |
| `altText` | **Auto-generated from product + brand + variant, human-overridable.** Fixes audit defect `01 A.4 #15`. |
| `caption`, `credit` | |
| `checksum` | SHA-256 — deduplication and duplicate-receipt detection |
| `variants` | JSONB — generated derivative keys/sizes |
| `uploadedById` | |

`ProductMedia(productId, mediaId, position, role [GALLERY|THUMBNAIL|BANNER|SPEC_SHEET])`.

**Filename rule:** stored objects are named `{productSlug}-{role}-{index}-{hash8}.{ext}` — e.g. `hp-victus-15-gaming-gallery-01-a3f91c2d.avif`. Fixes audit defect `01 A.4 #16`. See `11 §7.1`.

### `Review`
`productId`, `customerId?`, `orderId?`, `authorName`, `rating (1–5)`, `title`, `body`, `isVerifiedPurchase`, `status` (`PENDING|APPROVED|REJECTED`), `adminReply?`, `helpfulCount`, `mediaIds[]`.

Unique `(productId, orderId)` — one review per product per order.
**Only `APPROVED` reviews count toward `ratingAverage`/`ratingCount`, and only those may be emitted in JSON-LD.**

### `ProductSlugHistory`
`productId`, `oldSlug` unique, `changedAt`, `source` (enum `MIGRATION \| ADMIN_EDIT \| MERGE`). Powers permanent 301s. Same pattern for `CategorySlugHistory` and `PostSlugHistory`.

### `RelatedProduct`
`productId`, `relatedProductId`, `type` (`SIMILAR|ACCESSORY|UPGRADE|BUNDLE`), `position`. Manual curation plus a nightly job that proposes suggestions.

---

## 5. Inventory & branches

### `Branch`
`slug` unique, `name`, `addressLine`, `district`, `province`, `phone`, `email`, `latitude`, `longitude`, `mapEmbedUrl`, `isPickupEnabled`, `isDefaultFulfilment`, `isActive`, `position`, SEO fields.
`BranchHours(branchId, dayOfWeek 0-6, openTime, closeTime, isClosed)` — feeds `openingHoursSpecification` in LocalBusiness schema.

Seeded with New Road, Kathmandu.

### `StockLevel`
| Field | Notes |
|---|---|
| `variantId`, `branchId` | Unique together |
| `quantity` | Int — physical on hand |
| `reservedQuantity` | Int — held by active carts/unpaid orders |
| `incomingQuantity` | Int? — on order from supplier |
| `expectedAt` | DateTime? |
| `version` | Optimistic lock |

**Available = `quantity − reservedQuantity`.** Computed, never stored.

### `StockMovement` — append-only, never updated or deleted
`variantId`, `branchId`, `delta` (Int, signed), `reason` (enum `PURCHASE|SALE|RETURN|DAMAGE|CORRECTION|TRANSFER_IN|TRANSFER_OUT|INITIAL|RESERVATION_RELEASE`), `referenceType`, `referenceId`, `note`, `actorId`, `createdAt`.

**This is the audit trail for stock.** `StockLevel.quantity` must always equal `SUM(StockMovement.delta)` for that pair; a nightly job asserts this and alerts on drift. Directly addresses the "prevent accidental inventory resets" requirement.

### `StockReservation`
`variantId`, `branchId`, `quantity`, `cartId?`, `orderId?`, `expiresAt`, `status` (`ACTIVE|CONSUMED|RELEASED|EXPIRED`).

Rules:
- Reserved on **order placement**, not add-to-cart (avoids denial-of-inventory abuse).
- TTL by payment method: 30 min for wallet redirects, 24 h for bank transfer, immediate consume for COD.
- A job releases expired reservations and writes `RESERVATION_RELEASE` movements.

---

## 6. Commerce

### `Cart`
`id`, `token` (unique, cookie value), `customerId?`, `currency` (`NPR`), `branchId?`, `couponCode?`, `metadata` JSONB, `expiresAt`, `lastActivityAt`.
Guest carts expire after 30 days; customer carts persist. Merged on login by SKU with quantity summing.

### `CartItem`
`cartId`, `variantId`, `quantity`, `unitPricePaisaSnapshot`, `addedAt`, `buildId?` (when the line came from a PC build), `metadata` JSONB.

**Price is re-resolved server-side at checkout.** The snapshot exists only to detect and surface "the price changed since you added this".

### `Order`
| Field | Notes |
|---|---|
| `orderNumber` | unique, `CC-2607-0001`. Monthly sequence via a DB sequence + advisory lock. |
| `customerId` | |
| `email`, `phone` | Denormalised — orders must be readable if the customer is deleted |
| `status` | enum, see §6.1 |
| `paymentStatus` | enum `UNPAID \| PENDING \| PARTIALLY_PAID \| PAID \| REFUNDED \| PARTIALLY_REFUNDED \| FAILED` |
| `fulfilmentType` | enum `DELIVERY \| PICKUP` |
| `branchId` | Fulfilling branch |
| `subtotalPaisa`, `discountPaisa`, `shippingPaisa`, `taxPaisa`, `totalPaisa`, `paidPaisa`, `refundedPaisa` | All Int |
| `taxInclusive` | Boolean @default(true) — VAT 13% is included in displayed prices in Nepal |
| `couponCode`, `couponDiscountPaisa` | |
| `deliveryZoneId` | |
| `customerNote`, `internalNote` | |
| `placedAt`, `confirmedAt`, `shippedAt`, `deliveredAt`, `completedAt`, `cancelledAt`, `cancellationReason` | |
| `sourceChannel` | enum `WEB \| PHONE \| WALK_IN \| SOCIAL` — the owner takes many orders by phone |
| `buildId?` | If the order originated from a PC build |
| `ipAddress`, `userAgent` | Fraud signals; retention-limited |
| `version` | |

Indexes: `orderNumber`, `customerId`, `(status, placedAt DESC)`, `paymentStatus`, `(branchId, status)`, `phone`.

**Arithmetic invariant (DB `CHECK` + service assertion):**
`total = subtotal − discount + shipping (+ tax if exclusive)`.

### `OrderItem` — immutable snapshot
`orderId`, `variantId?` (nullable so deleting a product never orphans history), `productNameSnapshot`, `variantTitleSnapshot`, `skuSnapshot`, `imageUrlSnapshot`, `unitPricePaisa`, `quantity`, `lineTotalPaisa`, `taxPaisa`, `costPaisaSnapshot`, `buildItemRef?`, `isAssemblyService` Boolean.

Everything is snapshotted. An invoice from 2027 must render identically in 2030.

### `OrderAddress`
Frozen copy of the shipping and billing address at placement — never a foreign key to a mutable `Address`.

### `OrderStatusEvent`
`orderId`, `fromStatus`, `toStatus`, `actorId?`, `actorType` (`CUSTOMER|ADMIN|SYSTEM|GATEWAY`), `note`, `createdAt`. Append-only. Powers the visual tracker and the undo window.

#### 6.1 Order state machine

```
                    ┌──────────► CANCELLED (from any pre-SHIPPED state)
                    │
PENDING_PAYMENT ─┬─► CONFIRMED ─► PREPARING ─► PACKED ─► SHIPPED ─► DELIVERED ─► COMPLETED
      │          │                                          │
      │          └─ (COD) ────────────────────────────────► │
      ▼                                                     ▼
PAYMENT_FAILED                                    RETURN_REQUESTED ─► RETURNED ─► REFUNDED
      │
      └─► (retry) PENDING_PAYMENT
```

Transitions are declared in a table, not scattered `if` statements. Illegal transitions throw. Each transition declares: allowed roles, side effects (stock, email/SMS, analytics), and whether it is reversible within the 10-second undo window.

| Status | Admin label | Stock effect |
|---|---|---|
| `PENDING_PAYMENT` | Waiting for payment | Reserved |
| `CONFIRMED` | Payment received | Reserved |
| `PREPARING` | Getting it ready | Reserved |
| `PACKED` | Packed | Reserved |
| `SHIPPED` | Sent | Deducted |
| `DELIVERED` | Delivered | Deducted |
| `COMPLETED` | Done | Deducted |
| `CANCELLED` | Cancelled | Released |
| `RETURNED` | Returned | Restocked (or written off) |

### `Payment`
| Field | Notes |
|---|---|
| `orderId` | An order may have several — retries, and deposit + balance |
| `provider` | enum `ESEWA \| KHALTI \| FONEPAY \| CONNECTIPS \| BANK_TRANSFER \| COD \| CARD` |
| `amountPaisa` | |
| `status` | enum `INITIATED \| PENDING \| AUTHORIZED \| PAID \| FAILED \| CANCELLED \| EXPIRED \| REFUNDED` |
| `intentReference` | unique — our idempotency key sent to the gateway (`transaction_uuid` / `purchase_order_id`) |
| `providerTransactionId` | Their reference (`pidx`, `refId`, `PRN`) |
| `providerStatusRaw` | Their literal status string |
| `signature`, `verifiedAt`, `verificationMethod` | enum `CALLBACK \| LOOKUP \| WEBHOOK \| MANUAL` |
| `requestPayload`, `responsePayload` | JSONB, **secrets redacted before storage** |
| `receiptMediaId` | Bank-transfer slip |
| `approvedById`, `approvedAt`, `rejectionReason` | Manual verification trail |
| `expiresAt` | |
| `attemptNumber` | Int |

Unique: `intentReference`, and `(provider, providerTransactionId)` where non-null.
Indexes: `orderId`, `(status, createdAt)`, `(provider, status)`.

**Hard rule (`10`): a `Payment` may only reach `PAID` via a server-side provider lookup or a signature-verified webhook. A browser redirect is never proof.**

### `PaymentEvent`
Append-only log of every interaction: `paymentId`, `type` (`INITIATED|REDIRECTED|CALLBACK_RECEIVED|LOOKUP_PERFORMED|WEBHOOK_RECEIVED|STATUS_CHANGED|MANUAL_APPROVED|MANUAL_REJECTED|RECONCILED`), `payload` JSONB (redacted), `createdAt`.

### `Refund`
`orderId`, `paymentId`, `amountPaisa`, `reason`, `status` (`REQUESTED|PROCESSING|COMPLETED|FAILED`), `providerRefundId?`, `method` (`GATEWAY|BANK_TRANSFER|CASH|STORE_CREDIT`), `requestedById`, `approvedById`, `note`, `evidenceMediaIds[]`.

> eSewa, Fonepay, and connectIPS have **no refund API**. Most refunds are therefore a recorded manual bank transfer. The model must not assume automation.

### `Fulfilment` / `FulfilmentItem`
`orderId`, `branchId`, `type` (`DELIVERY|PICKUP`), `carrier?`, `trackingNumber?`, `trackingUrl?`, `status`, `packedAt`, `dispatchedAt`, `deliveredAt`, `deliveryPersonName?`, `deliveryPersonPhone?`, `proofMediaId?`, `podSignatureName?`.

Supports partial shipment (`FulfilmentItem` links to `OrderItem` with a quantity).

### `Invoice`
`orderId` unique, `invoiceNumber` unique (separate legal sequence from `orderNumber`), `issuedAt`, `pdfMediaId`, `vatNumber?`, `totalPaisa`, `taxPaisa`. Immutable once issued; corrections are credit notes.

### `Coupon`
`code` unique (case-insensitive), `description`, `type` (`PERCENTAGE|FIXED_AMOUNT|FREE_SHIPPING`), `value`, `minOrderPaisa?`, `maxDiscountPaisa?`, `usageLimit?`, `usageLimitPerCustomer?`, `usedCount`, `startsAt`, `endsAt`, `isActive`, `appliesTo` (`ALL|CATEGORY|PRODUCT|BRAND`), `targetIds[]`, `excludeDiscounted` Boolean, `firstOrderOnly` Boolean.

`CouponRedemption(couponId, orderId, customerId, discountPaisa, redeemedAt)` — unique `(couponId, orderId)`.

### `Promotion` / `PromotionRule`
Automatic discounts requiring no code: `name`, `type` (`PERCENTAGE|FIXED|BUY_X_GET_Y|BUNDLE|TIERED`), `priority`, `stackable`, `startsAt`, `endsAt`, `isActive`, plus condition/action rules. Powers the "Save up to 40% on Headphones" banners that currently link nowhere.

### `DeliveryZone` / `ShippingRate`
`DeliveryZone(name, districts String[], isActive, position, estimatedDaysMin, estimatedDaysMax)`.
`ShippingRate(zoneId, name, type [FLAT|FREE_ABOVE|WEIGHT_BASED], basePaisa, freeAbovePaisa?, perKgPaisa?, isActive)`.

Seeded: "Inside Kathmandu Valley" NPR 150, "Outside Valley" NPR 350 — matching the approved checkout design. **Resolves audit defect #19** (the current site claims free shipping everywhere): free shipping becomes a `FREE_ABOVE` threshold or a promotion, not a slogan.

---

## 7. PC Builder data

Full behavioural specification in `08`. Schema here.

### `ComponentPart`
Links a sellable `Variant` to the compatibility engine. Not every variant is a part; not every part must be a variant (a part may be catalogued before it is stocked).

| Field | Notes |
|---|---|
| `variantId` | String? unique — null means informational/not-for-sale |
| `partType` | enum `CPU \| CPU_COOLER \| MOTHERBOARD \| RAM \| GPU \| STORAGE \| PSU \| CASE \| CASE_FAN \| MONITOR \| OS \| CAPTURE_CARD \| SOUND_CARD \| NETWORK_CARD \| THERMAL_PASTE \| ACCESSORY` |
| `manufacturer`, `model`, `partNumber` | |
| `specs` | JSONB — **strictly validated against a Zod schema per `partType`** |
| `performanceTier` | Int 1–10 — drives balance/bottleneck scoring |
| `benchmarkScore` | Int? — synthetic, for perf-per-rupee ranking |
| `tdpWatts`, `idleWatts`, `loadWatts`, `transientMultiplier` | Power model inputs |
| `lengthMm`, `widthMm`, `heightMm` | Physical fit |
| `releaseYear` | |
| `dataSource` | enum `MANUAL \| IMPORT \| VENDOR_FEED` |
| `dataConfidence` | enum `VERIFIED \| INFERRED \| UNVERIFIED` — **inferred data may never generate a blocking error**, only a caveated warning |
| `isActive` | |

Indexes: `partType`, `(partType, isActive)`, GIN on `specs`, `variantId`.

**Critical design rule, derived directly from the reference app's failure:** `specs` is never regex-parsed from a product name at runtime. It is authored or imported, validated by Zod on write, and rejected if unparseable. `dataConfidence` makes the uncertainty explicit rather than silently wrong.

`specs` shape per `partType` is specified in `08 §3`.

### `PartConnector`
The reference app has nothing equivalent, which is why it cannot check PSU cabling.

`partId`, `direction` (`PROVIDES|REQUIRES`), `connectorType` (enum: `ATX_24PIN`, `EPS_8PIN`, `PCIE_6PIN`, `PCIE_8PIN`, `PCIE_12VHPWR`, `PCIE_12V2X6`, `SATA_POWER`, `MOLEX`, `SATA_DATA`, `M2_M_KEY`, `M2_B_KEY`, `M2_E_KEY`, `USB2_HEADER`, `USB3_HEADER`, `USB_C_HEADER`, `FAN_4PIN`, `ARGB_3PIN`, `RGB_4PIN`, `FRONT_PANEL_AUDIO`, `HDMI`, `DISPLAYPORT`, `USB_C_DP`), `quantity` Int, `notes`.

PSU-provides vs GPU-requires, motherboard-provides vs case-requires: connector matching becomes a simple set comparison rather than a special-cased rule.

### `CompatibilityRule`
Rules are **data, not code**, so the owner (or a technician) can add a rule without a deploy — one of the explicit admin requirements.

| Field | Notes |
|---|---|
| `code` | unique, e.g. `CPU_SOCKET_MATCH` |
| `name`, `description` | Plain language |
| `severity` | enum `ERROR \| WARNING \| INFO` |
| `subjectType`, `objectType` | Part types involved |
| `expression` | JSONB — declarative condition tree (see `08 §4`) |
| `messageTemplate` | Plain-language, `{{subject.model}}`-interpolated |
| `fixHintTemplate` | What to change |
| `autoFixStrategy` | enum `FILTER_SUBJECT \| FILTER_OBJECT \| SUGGEST_ALTERNATIVE \| NONE` |
| `isBlocking` | Boolean — blocks add-to-cart |
| `isPreventive` | Boolean — **also used to filter the picker before selection** |
| `isActive`, `priority` | |

### `Build`
| Field | Notes |
|---|---|
| `shortId` | unique, 8-char base58 — the public URL `/build/a7Kd93Xq` |
| `customerId?`, `sessionToken?` | Anonymous builds are first-class |
| `name`, `description` | |
| `mode` | enum `GUIDED \| STANDARD \| EXPERT` |
| `useCase` | enum `GAMING \| CONTENT_CREATION \| 3D_RENDERING \| STREAMING \| PROGRAMMING \| AI_ML \| OFFICE \| GENERAL` |
| `targetResolution` | enum `FHD \| QHD \| UHD \| ULTRAWIDE` |
| `budgetPaisa` | Int? |
| `visibility` | enum `PRIVATE \| UNLISTED \| PUBLIC`. Default `UNLISTED`. **All shared builds are `noindex,follow`; only an owner-curated build promoted to `/prebuilt` becomes an indexable `Product`** (`11 §4.11`) |
| `status` | enum `DRAFT \| COMPLETE \| ORDERED` |
| `totalPaisa`, `estimatedWatts`, `recommendedPsuWatts`, `compatibilityScore` (0–100), `balanceScore` (−100 CPU-bound … +100 GPU-bound) | Denormalised at save |
| `snapshotPricesPaisa` | JSONB — prices at save time, so a shared build shows what it cost *then* alongside today's price |
| `viewCount`, `cloneCount` | |
| `orderId?` | If purchased |

### `BuildItem`
`buildId`, `partId`, `slotKey` (e.g. `storage_1`, `case_fan_3`), `quantity`, `position`, `unitPricePaisaSnapshot`, `isUserSelected` (vs auto-recommended).
Unique `(buildId, slotKey)`.

### `BuildRevision`
Append-only history: `buildId`, `revisionNumber`, `itemsSnapshot` JSONB, `totalPaisa`, `changeSummary`, `createdAt`. Enables undo and "what changed".

### `BuildValidationSnapshot`
`buildId`, `issues` JSONB (`{ruleCode, severity, slotKeys[], message, fixes[]}[]`), `validatedAt`, `engineVersion`. Stored so a shared build renders instantly without re-running the engine, and so we can detect when a rule change invalidates old builds.

### `BuildTemplate`
Curated presets and prebuilt PCs: `name`, `slug`, `useCase`, `tier`, `budgetBandPaisa`, `itemsJson`, `isActive`, `position`, `productId?` (when sold as a prebuilt SKU).

---

## 8. Content

`Post` — `slug` unique, `title`, `excerpt`, `content` (Tiptap JSON), `coverMediaId`, `authorId`, `status` (`DRAFT|SCHEDULED|PUBLISHED|ARCHIVED`), `publishedAt`, `readingMinutes`, `viewCount`, SEO fields, `searchVector`. Plus `PostTranslation`, `PostCategory`, `PostTag`, `PostProduct` (products referenced in a buying guide → internal links both ways).

`Page` — `slug` unique, `title`, `content`, `template` (`DEFAULT|FULL_WIDTH|POLICY|LANDING`), `status`, SEO fields, `PageTranslation`. Seeded: about, contact, privacy-policy, terms-conditions, refund-returns, shipping-policy, warranty, emi.

`Menu` / `MenuItem` — `Menu(key [HEADER|FOOTER_COMPANY|FOOTER_CATEGORIES|MOBILE], name)`; `MenuItem(menuId, parentId?, label, url?, categoryId?, brandId?, pageId?, position, isActive, iconName?, badge?)`. **Fixes audit defect: footer "Webcams" pointing at motherboards** — items link to entities, and a nightly job flags any `url` item that 404s.

`HomeSection` — typed content blocks: `type` (`HERO_SLIDER|CATEGORY_BENTO|PRODUCT_CAROUSEL|BUILDER_TEASER|PROMO_BANNER|VALUE_PROPS|BRAND_STRIP|BLOG_STRIP|INSTAGRAM_FEED`), `position`, `isActive`, `config` JSONB validated per type, `startsAt`/`endsAt` for scheduled campaigns.
Hero slides carry `targetType` + `targetId`, so **every CTA resolves to a real destination** — fixing audit defects #10 and #11.

`Faq` — `question`, `answer`, `category`, `position`, `isActive`, plus optional `productId`/`categoryId` scoping. Feeds `FAQPage` schema.

---

## 9. Service desk

`ServiceTicket`
`ticketNumber` unique (`SVC-2607-0042`), `customerId?`, `name`, `phone`, `email?`, `branchId`, `deviceType` (`LAPTOP|DESKTOP|MONITOR|PRINTER|OTHER`), `brand`, `model?`, `serialNumber?`, `issueCategory`, `issueDescription`, `accessoriesReceived` String[], `status`, `priority` (`LOW|NORMAL|HIGH|URGENT`), `assignedToId?`, `estimatedCostPaisa?`, `finalCostPaisa?`, `estimatedReadyAt?`, `warrantyClaim` Boolean, `underWarrantyOrderId?`, `receivedAt`, `completedAt`, `collectedAt`, `internalNotes`.

Status flow: `RECEIVED → DIAGNOSING → QUOTE_SENT → AWAITING_APPROVAL → APPROVED|DECLINED → IN_REPAIR → AWAITING_PARTS → READY_FOR_PICKUP → COLLECTED | CANCELLED`.

`TicketEvent` (append-only, with `isCustomerVisible` so internal notes stay internal), `TicketMedia`, `TicketQuote(ticketId, lineItems JSONB, totalPaisa, validUntil, status, sentAt, respondedAt)`.

Public lookup at `/service/status/[ticketNumber]` requires ticket number **plus** the last 4 digits of the phone — otherwise ticket numbers are enumerable.

---

## 10. Operations & analytics

| Model | Key fields |
|---|---|
| `Setting` | `key` unique, `value` JSONB, `group`, `label`, `helpText`, `dataType`, `isPublic`. Typed accessor layer; never raw string lookups. |
| `AuditLog` | `actorId`, `actorEmail` (denormalised), `action`, `entityType`, `entityId`, `before` JSONB, `after` JSONB, `ipAddress`, `userAgent`, `createdAt`. **Append-only; no update or delete grant on this table.** Admin label: "Activity History". |
| `Job` | `type`, `payload` JSONB, `status`, `runAt`, `attempts`, `maxAttempts`, `lastError`, `lockedAt`, `lockedBy`. Backs the `cron-table` queue driver (see `03 §9`). |
| `Redirect` | `fromPath` unique, `toPath`, `statusCode` (301/302/410), `hitCount`, `lastHitAt`, `isActive`, `source` (`MIGRATION|MANUAL|SLUG_CHANGE`). Owns the WordPress migration map. |
| `Enquiry` | `name`, `email`, `phone`, `subject`, `message`, `type` (`GENERAL|BULK|SUPPORT|COMPLAINT`), `status` (`UNREAD|READ|REPLIED|CLOSED`), `assignedToId`, `productId?`. Drives "Unread Customer Enquiries" on the dashboard. |
| `ProductViewDaily` | `(productId, date)` unique, `views`, `uniqueViews`. Nightly rollup → "Most Viewed Products". |
| `SearchQueryLog` | `query`, `normalisedQuery`, `resultCount`, `hasResults`, `clickedProductId?`, `locale`, `createdAt`. **Zero-result queries are a merchandising instrument.** |
| `AbandonedCart` | `cartId`, `customerId?`, `email?`, `phone?`, `valuePaisa`, `itemCount`, `stage`, `recoveryEmailSentAt`, `recoveredOrderId?`. |
| `BuilderSession` | `sessionToken`, `customerId?`, `mode`, `useCase`, `budgetPaisa`, `stepsCompleted`, `slotsFilled`, `errorsEncountered`, `completedAt`, `buildId?`, `convertedOrderId?`. Funnel analysis. |
| `PriceHistory` | `variantId`, `pricePaisa`, `compareAtPricePaisa`, `changedById`, `reason`, `createdAt`. Protects against fat-finger pricing and answers "why did this cost more last week". |
| `StockAlertRequest` | `variantId`, `email\|phone`, `notifiedAt`, `status`. |
| `NewsletterSubscriber` | `email` unique, `locale`, `status`, `source`, `confirmedAt`, `unsubscribedAt`. Double opt-in. |

---

## 11. Indexing strategy

### Composite indexes for known access paths

| Query | Index |
|---|---|
| Category listing, price ascending | `Variant(productId, pricePaisa)` + `Product(status, primaryCategoryId)` |
| Category listing with facets | `ProductCategory(categoryId, productId)`, `ProductSpec(key, valueNumber)`, `ProductSpec(key, valueText)` |
| Newest in category | `Product(status, primaryCategoryId, publishedAt DESC)` |
| Best sellers | Materialised view `product_sales_30d`, refreshed nightly |
| Order list in admin | `Order(status, placedAt DESC)`, `Order(paymentStatus, placedAt DESC)` |
| Customer's orders | `Order(customerId, placedAt DESC)` |
| Low stock report | Partial index `StockLevel(branchId, quantity) WHERE quantity <= 5` |
| Payment reconciliation sweep | Partial index `Payment(status, createdAt) WHERE status IN ('INITIATED','PENDING')` |
| Builder part picker | `ComponentPart(partType, isActive)` + GIN on `specs` |
| Public build page | `Build(shortId)`, `Build(visibility, updatedAt DESC)` |
| Search | GIN on `Product.searchVector`; GIN `gin_trgm_ops` on `Product.name`, `Variant.sku` |
| Sitemap generation | `Product(status, updatedAt)`, `Post(status, updatedAt)` |
| Slug redirects | `ProductSlugHistory(oldSlug)` |

### Extensions required

`pg_trgm` (fuzzy search, duplicate detection) · `unaccent` (Devanagari/Latin normalisation) · `btree_gin` · `pgcrypto` · `pgvector` (deferred to v2, semantic build recommendations).

### Full-text search

`Product.searchVector` is a generated `tsvector` maintained by a trigger, weighted:
**A** `displayTitle` · **B** `brand.name` + `sku` · **C** `shortDescription` + category path · **D** filterable spec values.

Ranking blends `ts_rank_cd`, trigram similarity, in-stock boost, and 30-day sales velocity.

---

## 12. Constraints and data integrity

| # | Constraint | Enforcement |
|---|---|---|
| 1 | `Variant.pricePaisa > 0` | DB `CHECK` |
| 2 | `compareAtPricePaisa IS NULL OR > pricePaisa` | DB `CHECK` |
| 3 | `StockLevel.quantity >= 0` and `reservedQuantity >= 0` | DB `CHECK` |
| 4 | `reservedQuantity <= quantity` unless `allowBackorder` | Service-level, with a DB check where feasible |
| 5 | Order total arithmetic | DB `CHECK` + service assertion |
| 6 | Exactly one `Variant.isDefault` per product | Partial unique index |
| 7 | `User` has `email` or `phone` | DB `CHECK` |
| 8 | `Category.path` matches ancestry | Trigger on insert/update |
| 9 | `Coupon.usedCount <= usageLimit` | Service, inside a transaction |
| 10 | `AuditLog`, `StockMovement`, `OrderStatusEvent`, `PaymentEvent`, `BuildRevision` are append-only | Revoke `UPDATE`/`DELETE` at the DB role level |
| 11 | `Payment.intentReference` unique | Unique index — payment idempotency |
| 12 | `Build.shortId` unique and unguessable | Unique index + 8 base58 chars |
| 13 | Deleting a `Product` with orders is forbidden | FK `ON DELETE RESTRICT` + soft delete only |
| 14 | `Review` counted only when `APPROVED` | Service + a DB view for aggregates |
| 15 | Prices never negative after discount | Service clamp at 0 + assertion |

### Transaction boundaries

| Operation | Must be atomic |
|---|---|
| Order placement | Validate cart → re-resolve prices → check availability → create reservations → create Order + items + addresses → create PaymentIntent → clear cart |
| Payment confirmation | Verify with provider → update Payment → transition Order → consume reservations → write StockMovements → enqueue notifications |
| Stock adjustment | Update StockLevel (with version check) → write StockMovement |
| Coupon redemption | Check limits → increment `usedCount` → create redemption |
| Refund | Create Refund → update Order totals → optionally restock |

All use `SERIALIZABLE` or `REPEATABLE READ` with retry on serialisation failure, plus optimistic `version` checks.

---

## 13. Migration plan

### 13.1 Prisma migration discipline

- Every schema change is a checked-in migration. `prisma db push` is **development only**.
- Migrations must be forward-only in production. Rollback = a new corrective migration, never `migrate resolve --rolled-back` against live data.
- Destructive migrations (drop column, drop table, narrow a type) require the expand/contract pattern:
  1. **Expand** — add the new column, dual-write, backfill in batches.
  2. **Migrate** — switch reads.
  3. **Contract** — drop the old column in a *later* release, after a full backup and a verified restore.
- Any migration expected to run > 5 s against production data is executed as a background backfill job, not a blocking DDL. Use `CREATE INDEX CONCURRENTLY`.
- Every migration is tested against a restored production snapshot in staging before it reaches production.

### 13.2 Legacy WordPress/WooCommerce data migration

| Step | Action | Validation |
|---|---|---|
| 1 | Export the full URL inventory (sitemap + GSC + server logs) | Row count recorded |
| 2 | Export WooCommerce products, categories, brands, media, orders, customers, reviews (WP REST API or SQL dump) | Counts match the WP admin |
| 3 | **Manual taxonomy remap.** The current tree has real defects (Memory misplaced, CCTV absent from nav, Webcams duplicated) — do not import it as-is. Produce a reviewed mapping sheet. | Owner sign-off on the new tree |
| 4 | **Deduplicate products.** At minimum the MacBook Neo pair. Trigram similarity ≥ 0.85 on names flags candidates for human review. | Zero duplicate slugs |
| 5 | Parse the existing HTML specification tables into `ProductSpec` rows using the per-category `SpecTemplate`. Unmapped keys go to a review queue — **never silently dropped**. | ≥ 90% of spec rows mapped; remainder reviewed |
| 6 | Download and re-process all media: rename deterministically, generate AVIF/WebP/thumbnails, regenerate alt text from live product data (fixing the M3/M4 mismatch), compute checksums, drop the theme-demo Instagram files. | No `sdfgwfv`-class filenames remain |
| 7 | Import customers and orders as **historical, read-only** records. Do not import password hashes (different algorithm, unknown strength) — force a reset on first login. | Order totals reconcile |
| 8 | Split long product names into `name` / `displayTitle` / `metaTitle`. Auto-truncate at a word boundary, flag anything over 70 chars for review. | No `<h1>` over 70 chars |
| 9 | Build the `Redirect` table: `/product/{slug}/` → `/p/{slug}`, `/category/...` → `/c/...`, `/brand/{x}/` → `/b/{x}`, `/my-account-2/` → `/account`, `/checkout-2/` → `/checkout`, and every legacy URL with recorded traffic. | Automated crawl: zero 404s on the legacy inventory |
| 10 | Seed builder parts from the existing Components catalogue plus a curated dataset. Every part starts `dataConfidence = UNVERIFIED` and must be reviewed to `VERIFIED` before it can trigger a blocking rule. | Parts import report reviewed |
| 11 | Dry-run the whole migration into staging; diff counts and spot-check 30 products against the live site. | Sign-off |
| 12 | Freeze the WP admin, re-run the delta import, cut over DNS. | Post-cutover crawl clean |

> **RISK:** the legacy spec tables are hand-written HTML with inconsistent labels. Budget real human time for step 5. Do not let the importer guess.

### 13.3 Seed data (required for a working dev environment)

Roles + permissions · the New Road branch + hours · delivery zones and rates · settings (contact, VAT rate, COD cap, payment tiers) · the category tree · brands · all 15 spec templates · connector type registry · the full compatibility rule set · 3 build templates · policy pages · 20 demo products with variants, media, and specs (dev only) · 60 builder parts covering every `partType`.
