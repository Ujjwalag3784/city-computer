# 10 — Payments: Nepal Gateway Evaluation & Strategy

Researched 26–27 July 2026 from official documentation. Where a figure could not be verified from a primary source, it is marked. **Do not treat unverified commercial terms as fact — every one must be confirmed with the provider before contracts are signed.**

**Depends on:** `06 §6`, `07 §3.3–3.4`. **Feeds into:** `13`, `17`.

---

## 1. The central problem

City Computer sells items from ~NPR 1,500 to ~NPR 485,000. **No Nepali digital wallet can clear the top of that range.**

| Rail | Verified per-transaction ceiling |
|---|---|
| eSewa Account Link (pay from bank) | **NPR 50,000** per transaction / NPR 100,000 per day |
| eSewa wallet | End-of-day balance capped at **NPR 50,000** |
| Khalti merchant payment | **NPR 200,000** per transaction / 200,000 per day / 1,000,000 per month (KYC-verified, per NRB Unified Directive) |
| connectIPS (web) | **NPR 2,000,000** per transaction |
| connectIPS (mobile app) | NPR 200,000 |
| Card | Issuer's limit — commonly well below a NPR 400,000 laptop |

**Therefore: a single checkout that assumes any order can be paid by wallet will fail on exactly the orders that matter most.** The architecture must tier payment methods by cart value. This is the single most important payment decision in the project.

---

## 2. Provider profiles

### 2.1 eSewa (eSewa Ltd, F1Soft Group) — wallet + linked bank

| Aspect | Finding |
|---|---|
| What it is | Nepal's largest consumer wallet, with a linked-bank payment path |
| Product | ePay v2 (hosted redirect), plus a newer "Intent" flow marked Recommended |
| Integration | POST an HTML form to `https://epay.esewa.com.np/api/epay/main/v2/form` (UAT `rc-epay.esewa.com.np`) |
| Auth | **HMAC-SHA256, base64**, over the literal string `total_amount=…,transaction_uuid=…,product_code=…` in that exact field order, keyed on the merchant secret |
| Callback | Success redirect carries a **base64-encoded JSON body that is itself signed** — the signature must be recomputed, not trusted |
| Status lookup | `GET https://esewa.com.np/api/epay/transaction/status/?product_code&total_amount&transaction_uuid` → `PENDING \| COMPLETE \| FULL_REFUND \| PARTIAL_REFUND \| AMBIGUOUS \| NOT_FOUND \| CANCELED` |
| Session TTL | **5 minutes** |
| Sandbox | Excellent and fully public: merchant `EPAYTEST`, secret `8gBm/:&EnhH.1/q`, test IDs `9711111111`–`14`, password `Nepal@123`, OTP `123456` |
| Refunds | **No documented refund API** — absence of documentation, not proof of absence; confirm directly with eSewa. Refund states exist in the status enum, so refunds are handled as an operations process. |
| Fees | **Not published.** Must be negotiated. |
| Settlement | Into the merchant eSewa wallet, withdrawable to bank "free of cost". **No published T+N.** |
| Onboarding | `merchant.esewa.com.np` registration portal is a JavaScript shell; document list and SLA not published. Contacts: `merchant.operation@esewa.com.np`, `businessdevelopment@esewa.com.np`, 1810-50-00131 |
| DX | Good. Clear docs, working sandbox, unambiguous signing. |
| Best for | Orders up to ~NPR 45,000. Maximum consumer reach. |

### 2.2 Khalti (IME Khalti Limited) — wallet + aggregator

| Aspect | Finding |
|---|---|
| What it is | Wallet that also aggregates partner-bank e-banking, mobile banking, connectIPS, and SCT/Visa cards behind one checkout |
| Integration | Server-side `POST /epayment/initiate/` (sandbox `https://dev.khalti.com/api/v2/`, prod `https://khalti.com/api/v2/`) → returns `pidx`, `payment_url`, `expires_in` → redirect → callback → **`POST /epayment/lookup/` is authoritative** |
| Auth | `Authorization: Key <live_secret_key>` |
| Amounts | **In paisa** — matches our internal representation exactly |
| Verification | Docs are explicit: only `Completed` counts, and Khalti disclaims losses if you skip the lookup |
| Refunds | **Yes — a real API**, full and partial: `POST /api/merchant-transaction/{transaction_id}/refund/`. The only provider here with documented programmatic refunds. |
| Sandbox | Public (IDs `9800000000`–`05`, MPIN `1111`, OTP `987654`) but **e-banking and card do not work in sandbox** |
| Live-key ramp | Throttled until KYC/contract completes. Docs say "cannot receive payments above NPR 200 per transaction"; the marketing site says Rs 1,000. **Contradictory — confirm.** |
| Limits | **NPR 200,000 per transaction**, 200,000/day, 1,000,000/month for KYC-verified merchant payments |
| Fees | `Rs 5 / Rs 10` per transaction published for "KPG Gateway". **Percentage MDR not published.** |
| Settlement | Merchant wallet → manual withdrawal. No T+N published. One bank account. MoU required. |
| Onboarding | Documented: Company Registration Certificate, PAN/VAT, latest Tax Clearance, logo |
| Known issues | Vendor's own "gotchas" page: CORS if verifying client-side, `"Fee not found."`, `"Amount must be less than 200."`, `X-Frame-Options`/`frame-ancestors` problems with the legacy widget |
| Best for | NPR 45,000–200,000. Also the only easy route to card and e-banking. |

### 2.3 connectIPS (Nepal Clearing House Ltd — NRB-licensed PSO) — bank rail

| Aspect | Finding |
|---|---|
| What it is | Not a wallet. Debits the payer's bank account and credits the merchant's bank account directly. |
| **Per-transaction limit** | **NPR 2,000,000 via web** (NPR 200,000 mobile app), 100 transactions/day, per user per bank. **The only rail that clears a NPR 600,000 order in one go.** |
| Onboarding | Via the merchant's **own bank** as a "creditor listing". NCHL then provides the payment-processor APIs. |
| Docs / sandbox | **None public.** Everything is bank-mediated. |
| Refunds | **"Payments cannot be stopped or reversed through the system."** Refunds are manual bank transfers. |
| Customer fees | Rs 0–8 by slab; most biller payments free |
| Customer friction | Linking a bank account requires a signed form at a branch, or self-verification capped at Rs 100,000/txn |
| Fees to merchant / settlement | **Not published.** |
| Best for | High-value orders. Strategically essential; operationally slow to obtain. |

### 2.4 Fonepay (Fonepay Payment Service Ltd, F1Soft) — interoperable QR

| Aspect | Finding |
|---|---|
| What it is | The interoperable QR switch accepted by essentially every Nepali bank and wallet |
| Fees | **QR at merchant outlets is free**; interbank transfer NPR 10; fees are levied on member BFIs, not the merchant (published, effective 17 Jul 2025) |
| Cross-border | Alipay+, UPI, UnionPay inbound. **Not Visa/Mastercard.** |
| Compliance | PCI DSS certificate and ISO 27001 published; NRB PSO licence stated |
| Online checkout | "Checkout by Fonepay" exists but is early — only two named integration partners and ~11 BFIs live. Integration is "contact your bank or the Fonepay team". |
| Docs / sandbox | **No public developer docs, no public sandbox.** |
| Community intelligence | The best independent account of the Dynamic QR API reports: HMAC-SHA512 hex request signing; authenticated PRN status polling; **the status response does not echo the paid amount**; no standard refund call; and a historical sandbox endpoint with an invalid TLS certificate |
| Best for | Zero-fee QR at any value the payer's own bank permits. Excellent consumer recognition. Poor documentation. |

### 2.5 Card acquiring — must go through a Nepali bank

**Stripe: not available to Nepal.** **Razorpay: US, India, Singapore, Malaysia only.** **PayPal: send/buy only in Nepal — no merchant acquiring path found.** **2Checkout/Verifone: eligibility undocumented.** **Paddle: software/SaaS only.**

| Bank | Product | Published detail |
|---|---|---|
| **Nabil** | Electronic Payment Gateway (EPG) | Visa, Mastercard, UnionPay with 3D Secure; virtual terminal; rule-based fraud tool. Onboarding = account + signed EPG agreement at branch; "merchant shall then receive API code in 3–4 working days". Separate agreement and charges per website. **Fees not published.** |
| **NIC Asia** | CyberSource (A Visa Solution) | Visa + Mastercard worldwide, 3D Secure, PCI DSS compliant, plugins for WooCommerce/Magento/Shopify, merchant portal with refunds. "Initial integration fees and transactional charges as per Bank's Standard Tariff of Charges." Also offers **Quick Pay**, a link-based aggregation of Fonepay, connectIPS, NPS, wallets and CyberSource. |
| **Himalayan Bank** | E-Commerce | "VISA, MasterCard, AMEX and UnionPay"; HBL account compulsory; integration within 10 working days; **"We will credit merchant account after 7 days" (T+7)** — the only published settlement figure found. |
| **NIMB (ex-NIBL), Global IME** | — | Sites are client-rendered; **could not be verified.** |

### 2.6 IME Pay (IME Digital Solution Ltd) — wallet

The brief named this provider explicitly, so it was investigated directly.

| Aspect | Finding |
|---|---|
| What it is | A consumer mobile wallet in the IME group. Note that **Khalti is operated by IME Khalti Limited** — the same group — so a Khalti integration already reaches much of this ecosystem. |
| Merchant onboarding | **Not published.** The merchant site is client-rendered and returned no accessible content. |
| Integration model | **Unverified.** No public developer portal was reachable. |
| Auth / signing | Unverified |
| Sandbox | **None found publicly.** |
| Refunds | Unverified |
| Fees / MDR | **Not published.** |
| Transaction limits | Unverified. NRB wallet directives apply, so expect a ceiling in the same band as eSewa. |
| Settlement | Unverified |
| Security / compliance | NRB-licensed PSP; no published PCI DSS or ISO certification found |
| Checkout experience | Unverified — no demo or sandbox available to assess |
| Developer experience | **Cannot be assessed.** No documentation, no credible community packages. |
| Best use case | Low-value wallet payments, as a *third* wallet only if a material customer segment demands it |

**Verdict: do not integrate at launch.** Every dimension that matters is unverifiable from public sources, and the wallet segment is already served by eSewa (reach) and Khalti (aggregation, refunds, cards). Revisit only if customers actively ask for it.

> **ASSUMPTION:** this reflects what was publicly reachable on 27 July 2026. IME Pay may well have a competent merchant API behind a sales conversation. Added to §13 as an item to confirm directly.

### 2.7 Others assessed and set aside

| Provider | Verdict |
|---|---|
| **MyPay** (Smart Card Nepal) | Only open third-tier docs (`docs.mypay.com.np`), simple redirect + status API. But no published fees, limits, or settlement terms, and the docs leak a live-looking key in plaintext. Not a primary candidate. |
| **PayBridgeNP** | Self-serve aggregator over eSewa/Khalti/Fonepay with real docs and published SaaS pricing (Free ≤ NPR 50k/mo, Growth NPR 1,999/mo, Pro NPR 4,999/mo). **But you still need your own merchant accounts** — it adds a dependency without removing one. Not recommended. |
| **MOCO** (FOCUSONE) | Unified QR accepting Alipay+, Mastercard, NEPALPAY, SmartQR, UnionPay, Visa. **No API docs**; onboarding is a PDF agreement. |
| **NPS / OnePG** | `apidocs.nepalpayment.com` serves nothing. Unverifiable. |
| **IME Pay, CellPay, HamroPay, Moru/PayNep, Namaste Pay** | Client-rendered sites, no accessible merchant documentation. Unverifiable. |

---

## 3. Comparison

| Provider | Type | Per-txn max | Integration | Auth | Server verify | Refund API | Published fees | Settlement | Sandbox |
|---|---|---|---|---|---|---|---|---|---|
| **eSewa ePay v2** | Wallet / linked bank | ~50k effective | Hosted POST form | HMAC-SHA256 + base64 | ✔ status endpoint + signed callback | ✖ | — | Wallet → free withdrawal | ✔ public, excellent |
| **Khalti KPG-2** | Wallet + aggregator | **200,000** | Server initiate → redirect | `Authorization: Key` | ✔ lookup | **✔ full + partial** | Rs 5 / Rs 10 per txn | Wallet → manual | ✔ public (no card/e-banking) |
| **connectIPS** | Bank-to-bank | **2,000,000** | Bank-mediated API | not public | presumed | ✖ irreversible | Rs 0–8 payer | Direct to bank | ✖ |
| **Fonepay** | QR switch | not published | QR / bank-mediated | HMAC-SHA512 (community) | PRN polling, **no amount echo** | ✖ | Free to merchant | Via bank | ✖ |
| **Nabil EPG** | Card acquirer | issuer limit | Hosted card page | bank-issued | ✔ | portal | — | — | via bank |
| **NIC Asia CyberSource** | Card acquirer | issuer limit | CyberSource | bank-issued | ✔ | portal | "per STC" | — | via bank |
| **HBL E-Commerce** | Card acquirer | issuer limit | bank-hosted | bank-issued | ✔ | — | — | **T+7** | via bank |
| **IME Pay** | Wallet | unverified | unverified | unverified | unverified | unverified | not published | unverified | ✖ none found |
| **COD** | Cash | policy | internal | — | — | n/a | courier cost | on collection | n/a |
| **Bank transfer** | Manual | unlimited | receipt upload | manual | manual | manual | free | on clearing | n/a |

---

## 4. Recommendation

### Primary: **eSewa ePay v2**
Widest consumer reach in Nepal, an excellent public sandbox, unambiguous HMAC signing, and an authoritative status endpoint. Lowest integration risk and highest conversion at the low end of the catalogue, which is where transaction *count* lives.

### Secondary: **Khalti KPG-2**
One integration buys wallet, partner-bank e-banking, mobile banking, connectIPS, and SCT/Visa cards. It is the **only** provider with a documented refund API — decisive for a category with returns and DOA replacements. Its NPR 200,000 ceiling covers most mid-range orders.

### Third: **Fonepay QR**
Free to the merchant and universally recognised. Add it once the store's bank can provision Dynamic QR. Budget for zero documentation and community-derived integration.

### High-value rail: **connectIPS**
Begin the bank/NCHL onboarding conversation in **Phase 0**, not Phase 7 — it is bank-mediated and slow, and it is the only online rail that clears a NPR 600,000 order.

### Card: defer to post-launch
Pursue **NIC Asia CyberSource** or **Nabil EPG** after launch. Card volume in this market does not justify blocking launch on a bank integration with unpublished commercials.

---

## 5. Tiered checkout strategy

Payment methods are computed server-side from cart value in `config/payment-tiers.ts` and returned by `POST /api/v1/checkout/quote`. **The client never decides what is allowed.**

| Cart total | Methods offered | Notes |
|---|---|---|
| ≤ NPR 25,000 | eSewa · Khalti · Fonepay QR · **COD** · Bank transfer | Full menu |
| NPR 25,001 – 45,000 | eSewa · Khalti · Fonepay QR · Bank transfer · *COD by exception* | COD hidden by default above the cap |
| NPR 45,001 – 200,000 | Khalti (routes to e-banking/mobile banking, which are not wallet-capped) · Fonepay QR · connectIPS · Bank transfer | eSewa hidden — it will fail |
| NPR 200,001 – 2,000,000 | **connectIPS** · Bank transfer · **Deposit + balance** | Wallets hidden entirely |
| Any value | Bank transfer with receipt upload; in-store payment for pickup orders | Always available |

### The deposit model — recommended default for high-value builds

For orders above NPR 200,000, offer **"Reserve with a deposit"**:

- 10–20% (configurable) paid online within wallet limits, which locks the build and reserves stock.
- The balance is paid by connectIPS, verified bank transfer, card at the shop, or cash on collection.
- Implemented as **two `Payment` rows against one `Order`** — the data model already supports this (`06 §6`).
- Converts a hard limit problem into a working-capital advantage and materially reduces high-value abandonment.

### UI rules

- **Never show a method that will fail.** A method excluded by value is not greyed out; it is absent, with one line of explanation: *"For orders over रु 2,00,000 we use bank transfer or connectIPS, because wallet limits don't allow larger payments."*
- Each method shows its logo, a one-line description, and any fee or timing implication.
- Per-gateway health flags in settings let the owner disable a failing provider instantly without a deploy.

---

## 6. Payment verification protocol — MANDATORY

This section is non-negotiable. Every failure mode of a Nepali payment integration traces back to violating one of these rules.

```
 1. Order placed
      └─ Payment row created, status=INITIATED
         intentReference = our idempotency key (UUID)
         amountPaisa frozen from the server-computed order total

 2. Redirect / QR / bank details presented
      └─ PaymentEvent: REDIRECTED

 3. Customer pays (or doesn't)

 4. Browser returns to /api/v1/payments/callback/{provider}
      ├─ PaymentEvent: CALLBACK_RECEIVED  (payload stored, redacted)
      ├─ ⚠ THE CALLBACK IS NOT PROOF. Never settle from it.
      └─ Trigger step 5

 5. SERVER-TO-SERVER LOOKUP  ◄── the only thing that can mark PAID
      ├─ eSewa:  GET  /api/epay/transaction/status/
      ├─ Khalti: POST /epayment/lookup/
      ├─ Fonepay: authenticated PRN status poll
      └─ Assert:
           provider status == success
           looked-up amount == Payment.amountPaisa   (exact match)
           provider txn id not already consumed by another payment
         Any assertion fails → status=FAILED, alert, never settle

 6. Settle inside ONE transaction
      ├─ Payment.status = PAID, verifiedAt, verificationMethod=LOOKUP
      ├─ Order → CONFIRMED, paymentStatus → PAID (or PARTIALLY_PAID)
      ├─ Consume stock reservations, write StockMovements
      ├─ Generate invoice
      └─ Enqueue: customer email/SMS, admin notification,
                  GA4 Measurement Protocol purchase, Meta CAPI

 7. Webhook (if the provider sends one)
      └─ Verify signature → dedupe → re-run step 5 → idempotent no-op if already PAID

 8. Reconciliation sweep, every 5 minutes
      └─ Every Payment in INITIATED/PENDING older than 3 minutes:
           run step 5. Expire past the provider TTL.
         ◄── THIS IS WHAT MAKES ASYNC PAYMENTS SURVIVABLE.
             Customers close the tab. Networks drop. QR payments never
             call back. Without this sweep, paid orders sit unconfirmed.
```

### Hard rules

| # | Rule |
|---|---|
| P1 | A `Payment` may reach `PAID` **only** via a server-to-server lookup or a signature-verified webhook that triggers a lookup. |
| P2 | The amount is always compared against the **server-computed** order total, never against anything the client or the callback supplied. |
| P3 | `intentReference` is unique. A retry reuses the same order but creates a **new** `Payment` row with a new reference and an incremented `attemptNumber`. |
| P4 | Settlement is idempotent. Callback + webhook + sweep may all fire; only the first has effect. |
| P5 | Every interaction writes a `PaymentEvent` **before** any state change. |
| P6 | Payloads are stored with secrets, keys, and signatures redacted. |
| P7 | Money is integer paisa end to end. eSewa expects rupees in its form — conversion happens at the provider adapter boundary, nowhere else. |
| P8 | A payment whose lookup returns `AMBIGUOUS` (eSewa) is **never** auto-settled. It goes to a manual review queue. |
| P9 | No provider SDK from npm is used. Both integrations are ~80 lines of `crypto.createHmac` plus `fetch`. Every available community package is single-maintainer with double-digit downloads; a stale dependency in the payment path is a worse risk than writing it. |

### Provider adapter interface

```
interface PaymentProvider {
  code: PaymentProviderCode
  isAvailableFor(order): boolean          // value limits, currency, branch
  initiate(payment, order): PaymentAction // REDIRECT_FORM | REDIRECT_URL | SHOW_QR | SHOW_BANK_DETAILS | NONE
  parseCallback(request): CallbackResult  // parse only — never authoritative
  verify(payment): VerificationResult     // the ONLY source of truth
  refund?(payment, amountPaisa): RefundResult   // optional — most cannot
  supportsPartialRefund: boolean
}
```

Adding a provider is one file plus a config entry. No business logic knows which gateway is in use.

---

## 7. Cash on Delivery

COD is unavoidable in Nepal and genuinely dangerous at these values. A refused NPR 400,000 laptop is a courier round trip plus restocking on a serialised, fast-depreciating item.

| Control | Setting |
|---|---|
| Value cap | **NPR 25,000 default** (configurable). Accessories and low-end parts only. |
| Phone verification | Mandatory OTP before a COD order is accepted. Once SMS is available; until then, a callback-confirmation workflow in the admin. |
| Repeat-refusal blocklist | `Customer.codBlocked`, keyed on phone + normalised address hash |
| Velocity limits | Max 2 open COD orders per phone; max 3 per address per week |
| High-risk zones | Per-district COD toggle |
| First-time buyers | COD allowed but flagged for a confirmation call above NPR 10,000 |
| Monitoring | COD refusal rate tracked per district and per courier; alert above 15% |
| Alternative | Above the cap, offer "deposit + balance on delivery" rather than removing the option entirely |

---

## 8. Bank transfer with receipt upload

The realistic high-value fallback, and the highest-fraud-risk flow in the system. **A receipt image is a claim, not a payment.**

| Control | Requirement |
|---|---|
| Unique reference | The order number must be written on the deposit slip; displayed prominently with a copy button |
| Bank details | Rendered server-side from settings — never hardcoded, never editable by non-owners |
| Upload validation | Magic-byte sniffing, ≤ 20 MB, `image/jpeg\|png\|webp` or `application/pdf`, **EXIF stripped**, re-encoded server-side |
| Storage | Private bucket, never public. Access only via short-lived signed URLs. Not served from the CDN. |
| Duplicate detection | SHA-256 checksum compared against all prior receipts. A reused slip is flagged automatically. |
| **Two-person rule** | Above a configurable threshold (default NPR 100,000), approval requires an `OWNER`. Below it, `MANAGER` may approve. The requester can never be the approver. |
| Verification instruction | The approval screen states plainly: *"Check this against your bank statement before approving. Don't approve based on the photo alone."* |
| **Never auto-approve on OCR** | OCR may pre-fill the amount and reference to save typing, but a human must confirm against the statement |
| Stock hold | 24-hour reservation, extendable once by an admin |
| Auto-cancel | 48 hours without approval → order cancelled, stock released, customer notified |
| SLA | Release within 4 working hours of statement confirmation |
| Audit | Every approval and rejection writes an `AuditLog` entry with the actor, amount, and evidence reference |

---

## 9. Refunds

| Provider | Mechanism |
|---|---|
| Khalti | API — full and partial |
| eSewa | **Manual.** Record a `Refund` row with method `BANK_TRANSFER` or `CASH` and attach evidence. |
| Fonepay | Manual |
| connectIPS | Manual — irreversible by design |
| COD | Cash or bank transfer |
| Bank transfer | Bank transfer back |

The `Refund` model therefore assumes manual execution as the default and treats API refunds as the exception. Every refund requires a reason, an approver, and an evidence attachment. Partial refunds adjust `Order.refundedPaisa` and, where applicable, restock.

---

## 10. EMI — content and lead capture, not a payment method

All Nepali bank EMI is a **credit-card conversion arranged by the issuing bank**, completed on paper at a branch. It is not an API.

Terms below were read from the banks' own published pages in July 2026. **They are commercial terms that change without notice — reconfirm before publishing any figure on the site, and store them in `Setting` rather than in code.**

| Bank | Terms |
|---|---|
| **Himalayan Bank** | Up to 36 months, simple interest 6.99%, 100% financing, capped at 2.5× credit limit or Rs 500,000, whichever is lower |
| **NIC Asia "Insta Buy"** | 3–24 months. One-time handling fee, the higher of: Rs 500 or 2.5% (3mo), Rs 1,200 or 5% (6mo), Rs 2,000 or 7.5% (9mo), Rs 3,500 or 10% (12mo), Rs 6,000 or 18% (18mo), Rs 8,500 or 24% (24mo). **Zero fee at 31 named partner merchants — including ITTI Computer World, CG Digital and Information Technology Store.** Direct precedent for a computer retailer. |
| **Siddhartha** | 0% interest at authorised merchants; typically 6/12/18 months; processing fee Rs 1,000 or 1%, whichever is higher; card must have ≥ 3 months' good history; Delivery Order paperwork at a branch |
| **Nabil** | Apple BNPL at 0% over 3/6/9/12 months with 60% financing (customer pays 40% upfront); 90+ authorised merchants |
| **Global IME** | **Could not be verified** — client-rendered site |

### Implementation

1. **EMI calculator** at `/emi-calculator` and as a PDP widget: amount, bank, tenure → monthly payment, total fee, total payable. Rates and fees live in `Setting` so the owner can update them without a deploy.
2. **"EMI available" badge** on qualifying products, threshold-configurable.
3. **Lead capture**, not checkout: card issuer + preferred tenure + phone → routed to the sales team, who complete the bank's Delivery Order offline.
4. `generate_lead` analytics event fired.

> **Commercial action, worth real money:** become a listed **zero-fee partner merchant** with NIC Asia and Siddhartha before launch. The precedent for computer retailers already exists.

---

## 11. Reference implementation guidance

**Do not install a payment SDK from npm.** Every available package (`esewa-pay`, `esewa-react`, `neppayments`, `@nabwin/paisa`, `fonepay-node`, `khalti-checkout-web`) is single-maintainer with negligible downloads and, in Khalti's case, targets a deprecated widget. Both integrations are short enough to own.

The architecture worth copying is `pracharya2601/NPP` (MIT). Ignore its Vendure coupling; adopt the shape:

- Persistent, idempotent payment-attempt records.
- **Only a server-to-server lookup can settle an order; browser callback fields are never accepted as proof.**
- A signed internal settlement proof binding provider transaction → order → amount.
- Both GET and POST callback routes (providers are inconsistent).
- A reconciliation cron for delayed redirects and QR payments that never call back.

For connectIPS, `isxwor/next-connectips` is the only Next.js reference (last pushed 2023) — read-only inspiration.

---

## 12. Implementation phases

| Phase | Deliverable |
|---|---|
| **0** | Start eSewa and Khalti merchant applications. **Start the connectIPS conversation with the bank — this is the long pole.** Request written fee schedules and settlement terms from all three. |
| **7a** | Payment abstraction, `Payment`/`PaymentEvent` models, tiering config, COD, bank transfer with receipt upload, reconciliation cron, admin approval flow |
| **7b** | eSewa ePay v2 against the public sandbox, end to end including the sweep |
| **7c** | Khalti KPG-2 against the public sandbox, including refunds |
| **7d** | Production credentials, live smoke tests with real low-value transactions, gateway health flags |
| **10** | EMI calculator, badges, lead capture (delivered with the content phase) |
| **Post-launch** | Fonepay QR (bank-dependent) · connectIPS (bank-dependent) · card acquiring. Each ships behind a feature flag when the bank is ready — not tied to a build phase. |

---

## 13. Unverified — must be confirmed before contracts

| # | Item |
|---|---|
| 1 | eSewa merchant MDR/commission, settlement timing, and any merchant-side per-transaction ceiling |
| 2 | eSewa onboarding document list and approval SLA |
| 3 | Khalti's exact live-key ramp cap (docs say NPR 200; site says Rs 1,000) |
| 4 | Khalti percentage MDR, and whether the NPR 200,000 per-transaction ceiling can be raised for a high-value merchant |
| 5 | connectIPS: API spec, sandbox, signing scheme, webhook model, creditor onboarding documents, timeline, MDR, settlement T+N |
| 6 | Fonepay Checkout / Dynamic QR: current endpoints, signing, sandbox validity, per-transaction limits, refund handling, and whether web checkout is generally available |
| 7 | Card acquiring commercials for Nabil, NIC Asia and HBL: MDR, setup fee, security deposit or rolling reserve, chargeback liability, 3DS policy, settlement T+N |
| 8 | NIMB and Global IME gateway and EMI products — sites unreadable |
| 9 | NPS / OnePG — no accessible documentation |
| 9b | **IME Pay** — merchant onboarding, API documentation, sandbox, fees, limits, settlement, refund support. Every dimension unverified. |
| 10 | PayPal Nepal merchant acquiring — appears send-only; confirm before promising USD acceptance |
| 11 | Zero-fee EMI partner-merchant terms with NIC Asia and Siddhartha |
| 12 | Whether NRB rules impose any additional obligation on a merchant of this size |

> **RISK — HIGH:** Items 1, 3, 4 and 5 materially affect unit economics and the high-value checkout path. **Do not begin Phase 7 until items 1–5 have written answers.**
