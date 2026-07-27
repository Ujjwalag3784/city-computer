# 09 — Admin System ("Dad Mode")

The admin panel is used by a shop owner with no software background. This document treats that as an engineering constraint, not a styling preference.

**Depends on:** `05`, `06`, `07`. **Feeds into:** `12`, `17`.

---

## 1. The standard

> A new employee, given no training and no documentation, should be able to add a product, update stock, and process an order correctly on their first day — and should not be able to break anything while trying.

Every screen is measured against three questions:

1. **Can they tell what this page is for in 3 seconds?**
2. **Can they tell what every field means without asking anyone?**
3. **If they do the wrong thing, does the system stop them or let them undo it?**

If any answer is no, the screen is not finished.

---

## 2. Language rules

The approved Stitch admin design is jargon-heavy — "Inventory Command", "SYSTEM ONLINE: KATHMANDU NODE-01", "M-T-D Revenue", "SKU", "Recent Log Events", "PC Builder Rules", "TECHNICAL LEAD". **The visual language survives; the wording does not.** The "command center" feel comes from the dark palette, mono labels, and electric accent — not from the words.

### 2.1 Vocabulary translation table (binding)

| Never write | Always write |
|---|---|
| SKU | Product Code |
| Slug / permalink | Website Link |
| Metadata / meta description | Search Description |
| Meta title | Page Title |
| Taxonomy | Category |
| Attribute / attribute set | Product Details |
| Variant | Product Option |
| Cache / purge cache | Refresh the website (button, not a field) |
| Inventory | Stock |
| Fulfilment | Delivery |
| Order status transition | Update order |
| Entity / record | Product / Order / Customer |
| Query / filter | Search / Show only |
| Bulk operation | Change many at once |
| Deprecated / archived | Hidden from the website |
| Draft | Not published yet |
| Published | Live on the website |
| CSV import | Upload a spreadsheet |
| Export | Download a spreadsheet |
| Audit log | Activity History |
| Compatibility rule | Build Rule |
| Payment intent / gateway | Payment |
| Webhook / callback | (never shown) |
| Threshold | When to warn me |
| Alt text | Photo description |
| OG image | Sharing photo |
| Canonical URL | (hidden entirely) |
| 301 redirect | Old link forwarding |
| MTD / YTD | This month / This year |
| Critical | Almost out of stock |
| Optimal | Good |
| Node / system / instance | (never shown) |

### 2.2 Copy rules

- **Sentence case.** No `SCREAMING_CAPS` outside small mono eyebrow labels.
- **Second person.** "Add your first product", not "Product creation".
- **Verbs on buttons.** "Save changes", not "Submit". "Add product", not "Create".
- **Every field that isn't obvious gets one line of helper text below it**, in `--on-surface-variant`, ≤ 90 characters:
  - *Product Code* — "A short code you use to identify this product. We'll make one for you if you leave it blank."
  - *Search Description* — "This is the text Google shows under your product. Keep it under 160 characters."
  - *Offer Price* — "The discounted price. Leave blank if there's no discount."
  - *When to warn me* — "We'll tell you when stock drops to this number."
- **Errors say what to do**, not what failed: "The offer price needs to be lower than the normal price." Not "Validation error: compareAtPrice constraint."
- **Success messages confirm the outcome**: "Saved. Your product is now live at citycomputer.com.np/p/hp-victus-15." with a "View it" link.
- **Numbers are formatted**: `रु 1,54,900` never `15490000`. Dates as "27 Jul 2026" or "2 hours ago".

---

## 3. Module map

| Route | Screen name shown to the user | Who can use it |
|---|---|---|
| `/admin` | Today | All staff |
| `/admin/orders` | Orders | OWNER, MANAGER, STAFF, SUPPORT (read) |
| `/admin/orders/[id]` | Order details | ″ |
| `/admin/products` | Products | OWNER, MANAGER, STAFF (no price edit) |
| `/admin/products/new` | Add a product | OWNER, MANAGER |
| `/admin/inventory` | Stock | OWNER, MANAGER, STAFF |
| `/admin/categories` | Categories | OWNER, MANAGER |
| `/admin/brands` | Brands | OWNER, MANAGER |
| `/admin/media` | Photos | OWNER, MANAGER, CONTENT_EDITOR |
| `/admin/customers` | Customers | OWNER, MANAGER, SUPPORT |
| `/admin/coupons` | Discount codes | OWNER, MANAGER |
| `/admin/campaigns` | Offers & banners | OWNER, MANAGER |
| `/admin/blog` | Blog | OWNER, MANAGER, CONTENT_EDITOR |
| `/admin/pages` | Website pages | OWNER, MANAGER, CONTENT_EDITOR |
| `/admin/builder/parts` | PC parts | OWNER, MANAGER, TECHNICIAN |
| `/admin/builder/rules` | Build rules | OWNER, TECHNICIAN |
| `/admin/builder/builds` | Customer PC builds | OWNER, MANAGER |
| `/admin/service` | Repair jobs | OWNER, MANAGER, TECHNICIAN, STAFF |
| `/admin/enquiries` | Messages | OWNER, MANAGER, SUPPORT |
| `/admin/reviews` | Reviews | OWNER, MANAGER |
| `/admin/reports` | Reports | OWNER, MANAGER |
| `/admin/branches` | Stores | OWNER |
| `/admin/users` | Staff accounts | OWNER |
| `/admin/settings/*` | Settings | OWNER |
| `/admin/activity` | Activity History | OWNER |

### Navigation

Sidebar is grouped and short. Ten items maximum at the top level:

```
  Today
  Orders            ● 4
  Products
  Stock             ● 7
  Customers
  Repairs           ● 2
  Messages          ● 3
  PC Builder
  Content
  Settings
```

Badges show counts that need attention. A "Help" item sits at the bottom, always visible.

---

## 4. The dashboard — "Today"

The approved design opens with charts. **Charts do not answer a shop owner's questions.** The dashboard answers them in words and numbers, and charts come further down.

### Layout order

**Row 1 — Today (four large tiles, big numbers)**

| Tile | Value | Helper line | Source |
|---|---|---|---|
| Orders today | `12` | "3 still need attention" | `Order` where `placedAt` today |
| Money today | `रु 4,85,200` | "Yesterday: रु 3,10,000" | `SUM(totalPaisa)` where paid |
| Needs your attention | `5` | "2 payments to check · 3 orders to send" | Composite |
| Almost out of stock | `7` | "See the list" | `StockLevel.quantity <= lowStockThreshold` |

**Row 2 — What to do next.** An actual task list, not a metric:

```
  ▸ 2 bank transfer payments waiting for you to check        [Review]
  ▸ 3 orders are paid but not sent yet                       [See orders]
  ▸ 7 products are almost out of stock                       [See list]
  ▸ 2 products have no photo                                 [Fix]
  ▸ 3 customer messages you haven't read                     [Read]
  ▸ 1 repair job is ready for pickup                         [See job]
```

Empty state: "Nothing needs your attention right now."

**Row 3 — This week and this month.** Revenue, order count, average order value, each with a plain comparison ("up 12% from last week").

**Row 4 — Lists.** Top selling products (7 days) · Most viewed products (7 days) · Recent customers · Recent orders.

**Row 5 — Charts.** Revenue over 30 days · orders by day of week · sales by category. Optional, collapsible, remembered per user.

Every number is clickable and lands on the filtered list that produced it.

---

## 5. Product management

### 5.1 The four-step wizard

A single long form is where non-technical users give up. Product creation is four steps with a progress indicator, save-as-draft at every step, and no step that can't be skipped and returned to.

#### Step 1 — Basic information

| Field | Type | Helper text | Behaviour |
|---|---|---|---|
| Product name | text, required | "The full name customers will search for." | On blur, checks for similar existing products and warns: *"You already have a product called 'Apple MacBook Neo 13-inch'. Is this the same one?"* — **directly prevents the duplicate-product defect found on the live site.** |
| Short title | text | "A shorter name for product cards. We'll shorten it for you." | Auto-generated ≤ 70 chars, editable, with a live character count |
| Brand | searchable select, required | | "+ Add a new brand" inline |
| Category | tree picker, required | "Choose where this belongs on your website." | Loads the spec template for step 3 |
| Also show in | multi-select | "Other categories where this should appear." | |
| Price | money, required | "The normal price." | `रु` prefix, thousands auto-formatted |
| Offer price | money | "The discounted price. Leave blank if there's no discount." | Validates lower than price with a friendly message; shows the resulting "Save 12%" badge preview |
| Stock | number, required | "How many you have right now." | Per-branch when multiple branches exist |
| Product Code | text | "A short code you use to identify this product. We'll make one for you if you leave it blank." | Auto-generated `BRAND-MODEL-NNN`; uniqueness checked live |
| Condition | radio | | New / Refurbished / Open box |
| Warranty | number + text | "How many months of warranty?" | |

#### Step 2 — Photos

- Large drag-and-drop zone: *"Drag photos here, or click to choose. The first photo is the main one."*
- Also accepts paste from clipboard and camera capture on mobile.
- On upload, automatically: resize, generate AVIF + WebP + JPEG, produce thumbnails and a blur placeholder, strip EXIF, compute a checksum, rename deterministically, and **write a photo description** ("HP Victus 15 gaming laptop, front view").
- Reorder by drag. The first slot is labelled "Main photo".
- Each photo has an editable "Photo description" field with helper text: *"Describe what's in the photo. This helps people who can't see images, and helps Google."*
- Warning, not a block, if there are no photos: *"Products with photos sell much better. Add at least one before publishing."*
- Duplicate detection by checksum: *"You've already uploaded this photo. Use the existing one?"*

#### Step 3 — Details (specifications)

The category chosen in step 1 loads the right template automatically. The owner never designs a spec sheet.

| Category | Fields shown |
|---|---|
| **Laptop** | Processor · RAM · Storage · Display size · Display resolution · Graphics · Battery · Weight · Operating system · Ports · Warranty |
| **Desktop / Prebuilt** | Processor · Graphics · Motherboard · RAM · Storage · Power supply · Case · Cooling · Operating system |
| **Monitor** | Screen size · Resolution · Panel type · Refresh rate · Response time · Ports · Adaptive sync · Curved |
| **Graphics card** | Chipset · Memory · Memory type · Length · Power connectors · Recommended power supply · Outputs |
| **Processor** | Socket · Cores · Threads · Base speed · Boost speed · Power draw · Integrated graphics · Cooler included |
| **Motherboard** | Socket · Chipset · Size · Memory type · Memory slots · M.2 slots · SATA ports · Wi-Fi |
| **Memory** | Type · Speed · Capacity · Number of sticks · Latency · Height |
| **Storage** | Type · Capacity · Interface · Read speed · Write speed · Form factor |
| **Power supply** | Wattage · Efficiency rating · Modular · Size · Connectors |
| **Cooler** | Type · Supported sockets · Height · Radiator size · Fan count |
| **Case** | Size · Motherboard sizes supported · Max graphics card length · Max cooler height · Radiator support · Drive bays · Front ports |
| **Printer** | Type · Print speed · Resolution · Connectivity · Duplex · Paper sizes |
| **CCTV** | Resolution · Night vision · Indoor/outdoor · Connectivity · Storage |
| **Accessory** | Type · Connectivity · Compatibility · Colour |

Each field carries its own helper text and, where relevant, a dropdown of known values rather than free text (Socket, Panel type, Efficiency rating) — which is also what makes filtering work on the storefront.

A "+ Add another detail" escape hatch exists for anything the template misses.

#### Step 4 — Search information

Only two fields are visible. Everything else is automatic.

| Field | Helper | Behaviour |
|---|---|---|
| Page Title | "The title Google shows. Keep it under 60 characters." | Pre-filled from `{Product name} Price in Nepal \| {Brand} \| City Computer`; live character counter turns amber above 60, red above 65 (matching `11 §3.4`) |
| Search Description | "The description Google shows underneath. Keep it under 160 characters." | Pre-filled from the short description and key specs |

Below them, a **live Google result preview** rendered exactly as a SERP entry, plus a traffic-light hint:

> 🟢 Looks good — your title and description are the right length and mention the product name.

Automatic and hidden: website link (slug), sharing photo, canonical URL, structured data, breadcrumbs, sitemap entry, search keywords, old-link forwarding.

An "Advanced settings" section, collapsed by default and labelled *"Only change these if someone has asked you to"*, exposes the website link and canonical override.

#### Publishing

Two buttons: **Save as draft** and **Publish**.

"Publish" runs a readiness check and, if anything is missing, shows a checklist rather than blocking:

```
  Before publishing:
  ✓ Name and price
  ✓ Category
  ✗ No photos yet          — customers rarely buy products without photos
  ✓ Details filled in
  ⚠ Search description is a bit short

  [ Publish anyway ]   [ Go back and fix ]
```

### 5.2 Product list

- Big search box at the top; results appear as you type.
- Filter chips: All · Live · Not published · Out of stock · Almost out of stock · No photo · On offer.
- Each row: photo, name, category, price (with offer struck through), stock with a coloured bar, status pill, and quick actions.
- Inline editing of price and stock directly in the row — the two things edited most often.
- Bulk select → change price by %, change category, publish, hide, export.

---

## 6. Stock management

### Quick actions
Every stock number in the system has inline `−1` / `+1` / `Set…` controls. `Set…` opens a small dialog: new quantity, a **required** reason (Received new stock / Sold in shop / Damaged / Correction / Returned), and an optional note.

**Every change writes a `StockMovement`.** There is no way to change stock without a recorded reason. This is what makes "prevent accidental inventory resets" real rather than aspirational.

### Bulk update
A dedicated screen: search or scan, then a list of rows with quantity inputs, one "Save all" at the bottom, and a confirmation summarising the changes ("You're about to change stock for 14 products. 3 will go to zero.").

### Spreadsheet upload
- Download a template pre-filled with current products.
- Upload → **preview screen showing exactly what will change**, row by row, with errors highlighted and downloadable.
- Nothing is applied until the owner confirms.
- The job runs in the background with a progress bar and a completion summary.

### Low stock
- Per-product "When to warn me" threshold, defaulting to 3.
- Daily 09:00 NPT email listing everything at or below threshold.
- A persistent dashboard tile.

### Stock history
Per product: a plain-language timeline. "27 Jul, 10:14 — Ramesh added 5 (Received new stock). Now 12."

---

## 7. Order management

### Order list
Cards on mobile, table on desktop. Coloured status pill, order number, customer name, phone, total, payment method, age. Filter chips: Needs attention · Waiting for payment · Paid · Preparing · Sent · Delivered · Cancelled.

### Order detail

**A visual tracker across the top**, exactly as required:

```
  ●━━━━━━●━━━━━━●━━━━━━○──────○──────○──────○
  New   Paid  Getting Packed  Sent  Delivered Done
              ready
```

Completed steps are filled, the current step glows, future steps are outlined. **One button advances one step**, labelled with what happens next: "Mark as packed".

**Undo:** after any status change, a toast appears for 10 seconds — "Marked as packed. **Undo**". After that, the change is permanent but reversible by an OWNER with a recorded reason.

**Quick actions row** (exactly the set requested):

| Action | Behaviour |
|---|---|
| Call customer | `tel:` link |
| WhatsApp customer | `wa.me` deep link, pre-filled with the order number and a friendly template |
| Email customer | Opens a composer with templates (order ready, delayed, out for delivery) |
| Copy address | Copies the full formatted Nepali address to the clipboard, ready to paste into a courier form |
| Print invoice | Server-generated PDF |
| Print shipping label | Server-generated PDF, sized for a label printer |
| Send SMS | If an SMS provider is configured |

**Payment panel.** Method, amount, status, and for bank transfer the uploaded receipt image, large, with **Approve** and **Reject** buttons. Approving above the configured threshold requires a second person (see `10 §8`). The panel states plainly: *"Check this against your bank statement before approving. Don't approve based on the photo alone."*

**Items panel.** Photos, names, product codes, quantities, prices. If the order came from a PC build, a "View the build" link.

**Customer panel.** Name, phone, email, address with a map link, order count, total spent, and any internal notes.

**History panel.** Every event with who did it and when.

### Taking a phone order
"+ New order" lets staff create an order manually — the owner takes many orders by phone. Same product search, same customer lookup, payment method set to COD or "paid in shop".

---

## 8. Error prevention

This is a functional requirement, not polish.

| Risk | Control |
|---|---|
| Deleting a product | Products are **hidden**, never deleted, if they have any order history. The confirm dialog names the product and requires typing nothing — just an explicit "Yes, hide it" — and states "You can bring it back any time." |
| Deleting anything else | Two-step confirm naming the item and its consequences. Destructive buttons are red, secondary, and never adjacent to a primary action. |
| Accidental stock reset | Reason required on every change; `+/−` deltas preferred over absolute set; a warning when a change would move stock by more than 50 or to zero |
| Price mistakes | Warn if the new price differs from the old by more than 50%: *"That's 80% lower than the current price. Is that right?"* Warn if offer price ≥ price. Warn if price is below cost. |
| Duplicate products | Trigram name similarity check on create, with a link to the existing product |
| Missing images | Publish checklist warning |
| Publishing incomplete products | Publish checklist |
| Losing unsaved work | Autosave drafts every 20 s; browser-close warning; "Restore your unsaved changes?" on return |
| Wrong bulk action | Preview-before-apply on every bulk operation |
| Approving a fake receipt | Two-person rule above the threshold; duplicate-image detection by checksum; explicit instruction to check the bank statement |
| Cancelling a paid order | Requires a reason and warns about the refund obligation |
| Changing someone else's work | Optimistic locking with a friendly message: "Sita changed this product 2 minutes ago. Reload to see her changes." |
| Staff exceeding their role | Actions they lack permission for are not rendered at all — never shown-then-denied |

---

## 9. Global search

A single search box in the top bar, also reachable with `/` or `Ctrl/⌘ K`. Typing "HP" returns grouped results immediately:

```
  PRODUCTS (12)
    HP Victus 15 Gaming Laptop              रु 124,900   In stock
    HP Pavilion 14                          रु  89,500   2 left
  ORDERS (3)
    CC-2607-0042  Ramesh Shrestha  रु 124,900  Paid
  CUSTOMERS (2)
    Hari Prasad  ·  +977 9841…  ·  4 orders
  BRANDS (1) · CATEGORIES (1) · DISCOUNT CODES (0)
  BLOG POSTS (1) · REPAIR JOBS (0) · PC BUILDS (2)
```

Order numbers, phone numbers, and product codes match exactly and jump straight to the record. Results are permission-filtered. Debounced 200 ms, p95 < 150 ms.

---

## 10. In-product help

The software teaches while it is used. No external manual is required for routine work.

| Layer | Implementation |
|---|---|
| **Field helper text** | Always visible under the field. Not a tooltip — tooltips are invisible on touch devices. |
| **Section explainers** | One short paragraph at the top of every screen: *"This is where you add and change the products on your website. Customers see everything marked 'Live'."* |
| **Info bubbles** | A small `?` next to genuinely technical concepts, opening a short popover with an example |
| **First-time guidance** | On first visit to a screen, a short 3–4 step coach mark walkthrough with "Skip" and "Don't show again", replayable from Help |
| **Empty states that teach** | "You haven't added any products yet. Adding a product takes about 3 minutes. **[Add your first product]** · [Watch how it works]" |
| **Learn more** | Links to `/admin/help/{topic}` — plain-language articles written as part of the build, stored in `docs/admin-help/` and rendered in-app |
| **Contextual examples** | Where a format matters, show one: *Example: HP-VIC15-001* |
| **Checklists** | Publish readiness, first-week setup, monthly tasks |
| **Success confirmations** | Always say what happened and where to see it |

### Help content to be authored (each ≤ 400 words, screenshots included)

Adding your first product · Understanding stock · What "Live" and "Not published" mean · Processing an order start to finish · Checking a bank transfer safely · What Page Title and Search Description do · Adding photos that look good · Creating a discount code · Understanding the Today page · Managing repair jobs · Adding a new staff member and what each role can do · What to do when something looks wrong.

---

## 11. Accessibility and comfort

The primary user is over 50 and may use this on a phone in a shop.

| Requirement | Value |
|---|---|
| Base font size | 16px minimum; 18px for form labels and table content |
| Touch targets | 48×48 CSS px minimum |
| Contrast | 4.5:1 body, 3:1 UI. The dark theme must be verified — light-blue-on-dark is the risky combination in this palette. |
| Spacing | Generous. Never more than ~7 fields visible in one group. |
| Text scaling | Usable at 200% browser zoom with no horizontal scroll |
| Colour independence | Status always icon + text |
| Consistency | The same action lives in the same place on every screen. Primary action bottom-right on desktop, full-width sticky bottom on mobile. |
| Mobile | The admin is fully usable on a phone. The sidebar becomes a sheet. Order processing and stock updates are optimised for one thumb. |
| Keyboard | Full keyboard operation, visible focus, `/` to search, `Esc` to close |
| Language | The admin is available in Nepali as well as English |
| No timeouts without warning | A 2-minute warning before session expiry with a "Stay signed in" button |

---

## 12. Roles and permissions in plain language

The `/admin/users` screen describes roles the way a shop owner thinks about them:

| Role shown as | Description shown | Internal role |
|---|---|---|
| **Owner** | "Can do everything, including changing settings and adding staff." | `OWNER` |
| **Manager** | "Can manage products, orders, stock and content. Cannot change settings or add staff." | `MANAGER` |
| **Shop staff** | "Can process orders and update stock. Cannot change prices or delete anything." | `STAFF` |
| **Content writer** | "Can write blog posts and edit website pages. Cannot see orders or customers." | `CONTENT_EDITOR` |
| **Customer support** | "Can view orders and customers and reply to messages. Cannot change anything else." | `SUPPORT` |
| **Repair technician** | "Can manage repair jobs only." | `TECHNICIAN` |

Adding a staff member asks for a name, a phone or email, and a role — with each role's description visible while choosing. Two-factor authentication is required for Owner and Manager and is explained as *"a code from your phone, so nobody else can sign in as you."*

---

## 13. Activity History

`/admin/activity`, Owner only. Plain-language, filterable, searchable, exportable:

> **Sita Karki** changed the price of *HP Victus 15* from रु 129,900 to रु 124,900 — 27 Jul, 14:32
> **Ramesh Shrestha** approved a bank transfer payment of रु 245,000 for order CC-2607-0038 — 27 Jul, 11:05
> **Sita Karki** added 5 to stock of *Logitech G102* (Received new stock) — 27 Jul, 09:41

Every admin mutation writes an entry with before/after values. The log is append-only at the database-permission level.

---

## 14. Admin acceptance criteria

- [ ] A user who has never seen the system can add a complete, publishable product in under 5 minutes without asking for help.
- [ ] Every input field on every screen has either an obvious label or helper text.
- [ ] No forbidden word from §2.1 appears anywhere in the admin UI (enforced by an automated copy lint over `messages/*.json`).
- [ ] Every destructive action has a confirmation; every status change has an undo window.
- [ ] Every stock change has a recorded reason and appears in Activity History.
- [ ] The dashboard answers all twelve business questions enumerated in `12 §12` above the fold or one click away.
- [ ] Global search returns products, orders, customers, brands, categories, discount codes, blog posts, and PC builds from a single query.
- [ ] Every screen is usable on a 375px-wide phone.
- [ ] Axe reports zero violations on every admin route.
- [ ] All twelve help articles exist and are reachable in context.
- [ ] A staff-role user cannot see or reach any owner-only action.
