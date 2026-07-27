# 05 — Design System: "Obsidian Peak"

Translation of the approved Google Stitch exports into an implementable Tailwind v4 + shadcn/ui system.

**Depends on:** `01 Part C`, `03`. **Feeds into:** every UI phase.
**Source of truth for visuals:** `stitch_city_computer_premium_redesign/obsidian_peak/DESIGN.md` + the six `code.html` exports and screenshots.

> The prototypes are a **reference, not a codebase**. `01 §C.3` lists 14 defects that MUST be corrected. Do not copy markup verbatim.

---

## 1. Colour tokens

Declared as CSS custom properties in `src/app/globals.css` and exposed to Tailwind via `@theme inline`. Names are Material-3-style semantic roles and are used verbatim in class strings (`bg-surface-container-high`, `text-on-surface-variant`), which is what makes the prototype markup transferable.

### 1.1 Surfaces and elevation

| Token | Hex | Use |
|---|---|---|
| `--background` | `#09090B` | Page base. **Resolves the conflict in the exports** — this wins. |
| `--surface` | `#131315` | Default surface |
| `--surface-dim` | `#131315` | Recessed areas |
| `--surface-container-lowest` | `#0E0E10` | Table zebra (even rows) |
| `--surface-container-low` | `#1C1B1D` | |
| `--surface-container` | `#201F22` | Cards, inputs |
| `--surface-container-high` | `#2A2A2C` | Raised cards, hover |
| `--surface-container-highest` | `#353437` | Pressed, active |
| `--surface-bright` | `#39393B` | Hover on dark rows |
| `--surface-variant` | `#353437` | |
| `--obsidian-surface` | `#121417` | Brand card fill, admin sidebar |

### 1.2 Primary (electric blue)

| Token | Hex | Use |
|---|---|---|
| `--primary` | `#A4E6FF` | Button fill, accent text |
| `--on-primary` | `#003543` | Text on primary |
| `--primary-container` | `#00D1FF` | The true glow blue — borders, hover, focus |
| `--on-primary-container` | `#00566A` | |
| `--primary-fixed` | `#B7EAFF` | |
| `--primary-fixed-dim` / `--surface-tint` | `#4CD6FF` | Chart strokes |
| `--on-primary-fixed` | `#001F28` | |
| `--on-primary-fixed-variant` | `#004E60` | |
| `--inverse-primary` | `#00677F` | |

### 1.3 Text and outlines

| Token | Hex | Use |
|---|---|---|
| `--on-surface` | `#E5E1E4` | Primary text |
| `--on-surface-variant` | `#BBC9CF` | Secondary text |
| `--silver-text` | `#E4E4E7` | Brand text alias |
| `--outline` | `#859399` | Borders, disabled text |
| `--outline-variant` | `#3C494E` | Subtle dividers |
| `--glass-stroke` | `rgba(255,255,255,0.10)` | Glass panel borders |

### 1.4 Secondary / tertiary / error

| Token | Hex |
|---|---|
| `--secondary` `#C5C6CC` · `--secondary-container` `#46494E` |
| `--tertiary` `#DCDBE5` · `--tertiary-container` `#C0BFC9` |
| `--error` `#FFB4AB` · `--on-error` `#690005` · `--error-container` `#93000A` · `--on-error-container` `#FFDAD6` |

### 1.5 Semantic status colours (ADDED — the exports lack these)

| Token | Value | Use |
|---|---|---|
| `--success` | `#7BE8A8` | In stock, paid, delivered, compatible |
| `--warning` | `#FFD48A` | Low stock, pending payment, compatibility warning |
| `--info` | `#A4E6FF` | Informational notes (aliases `--primary`) |
| `--danger` | `#FFB4AB` | Out of stock, cancelled, blocking error (aliases `--error`) |

Every status must be conveyed by **icon + text**, never colour alone (WCAG 1.4.1).

### 1.6 Effects

| Token | Value |
|---|---|
| `--glass-bg` | `rgba(18,20,23,0.75)` — **one value**, replacing the three in the exports |
| `--glass-blur` | `12px` — **one value** |
| `--shadow-glow` | `0 0 20px rgba(0,209,255,0.15)` |
| `--shadow-glow-strong` | `0 0 20px rgba(0,209,255,0.35)` |
| `--nav-h` | `72px` — **one value**, replacing 64/72/80 |

> **Light theme:** none exists and none ships in v1. `next-themes` is wired anyway so a light ramp can be added without refactoring. Every colour is referenced through a token, never a literal hex, so a second theme is a CSS change only.

---

## 2. Typography

Three families, loaded with `next/font` (self-hosted, `display: swap`, subset `latin` + `devanagari` for Inter):

| Variable | Family | Weights | Use |
|---|---|---|---|
| `--font-display` | **Geist** | 600, 700, 800 | Headings, prices |
| `--font-sans` | **Inter** | 400, 500, 600 | Body, UI |
| `--font-mono` | **JetBrains Mono** | 400, 500, 700 | Specs, SKUs, labels, wattage, part numbers |

### Type scale

| Utility | Size / line-height | Weight | Tracking | Family |
|---|---|---|---|---|
| `.text-display-lg` | 64 / 72 (clamp to 40 on mobile) | 700 | −0.02em | display |
| `.text-headline-lg` | 40 / 48 (32/40 mobile) | 600 | −0.01em | display |
| `.text-headline-md` | 24 / 32 | 600 | — | display |
| `.text-title` | 20 / 28 | 600 | — | display |
| `.text-body-lg` | 18 / 28 | 400 | — | sans |
| `.text-body-md` | 16 / 24 | 400 | — | sans |
| `.text-body-sm` | 14 / 20 | 400 | — | sans |
| `.text-label-mono` | 14 / 20 | 500 | +0.05em | mono |
| `.text-label-mono-xs` | 12 / 16 | 500 | +0.1em, uppercase | mono |
| `.text-price` | 28 / 32 | 700, `tabular-nums` | — | display |
| `.text-price-lg` | 40 / 44 | 700, `tabular-nums` | — | display |

**Corrections to the exports:**
- Do **not** double-key fonts as both `fontFamily` and `fontSize` (`font-headline-lg text-headline-lg`). That is a Stitch artefact. One utility per style.
- The hero's `md:text-[84px]` becomes `clamp(2.5rem, 8vw, 5.25rem)`.
- The builder's 64px price estimate overflows its panel in the export. Cap the summary figure at `.text-price-lg` (40px) with `tabular-nums` and `truncate`.
- Every number that changes (prices, wattage, stock, totals) uses `tabular-nums` to prevent width jitter.

---

## 3. Spacing, radii, layout

### Spacing scale

| Token | Value | Use |
|---|---|---|
| `--space-unit` | 4px | Base |
| `--space-gutter` | 24px | Grid gap, card gap |
| `--space-card-padding` | 24px | Card interior |
| `--space-margin-safe` | 32px | Page edge (desktop) |
| `--space-section-gap` | 80px | Between page sections (48px mobile) |

Standard Tailwind spacing remains available; the named tokens are for layout rhythm.

### Radii — CORRECTED

The exports remap Tailwind's radius scale, redefining `rounded-full` as **12px, not a pill**. This silently breaks avatars, status chips, and progress bars. Corrected scale:

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 2px | Inline tags |
| `rounded` | 4px | **Buttons, inputs** |
| `rounded-lg` | 4px | Alias for buttons (keeps prototype classes working) |
| `rounded-xl` | 8px | **Cards, panels** |
| `rounded-2xl` | 12px | Large panels, media containers, the stepper nodes |
| `rounded-full` | 9999px | **Restored.** Status pills, avatars, progress bars, FAB |

**Migration action:** audit every `rounded-full` in the prototypes. If it was meant as a 12px panel → `rounded-2xl`. If it was meant as a pill → leave it.

### Layout

| Constraint | Value |
|---|---|
| Content max width | 1280px |
| App shell max width | 1440px |
| Grid | 12 col desktop / 8 tablet / 4 mobile |
| Admin sidebar | 256px fixed (desktop), off-canvas sheet below `lg` |
| Nav height | `--nav-h` = 72px, sticky, glass |
| Breakpoints | `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536 |

---

## 4. Motion and interaction

| Property | Value |
|---|---|
| Standard duration | 200ms |
| Emphasised (image scale, panel entry) | 400–700ms |
| Easing | `cubic-bezier(0.2, 0, 0, 1)` |
| Button press | `active:scale-[0.98]` |
| Card hover | border → `--primary-container`, `shadow-glow` |
| Image hover | `scale-105`, 700ms |
| Focus | `focus-visible:ring-2 ring-[--primary-container] ring-offset-2 ring-offset-[--background]` — **on every interactive element**, not just inputs |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables all transforms and transitions; the cursor-glow effect never runs |

---

## 5. Accessibility requirements

The Stitch designs are aesthetically strong and accessibility-poor. These are **gates, not aspirations**.

| # | Requirement |
|---|---|
| A1 | WCAG 2.2 AA. Body text ≥ 4.5:1, large text and UI borders ≥ 3:1. **Verify `--primary` `#A4E6FF` on `--on-primary` `#003543` and every glass-panel text combination** — none were verified in the exports. |
| A2 | Every icon-only button has an `aria-label`. The exports have none. |
| A3 | Visible `focus-visible` ring everywhere. |
| A4 | Full keyboard operability: filter rail, part picker combobox, gallery thumbnails, stepper, admin tables, mobile drawer. |
| A5 | Radix primitives for every composite widget — no hand-rolled comboboxes or dialogs. |
| A6 | Status never communicated by colour alone. |
| A7 | Live regions (`aria-live="polite"`) for cart updates, compatibility results, stock changes, and toasts. |
| A8 | One `<h1>` per page; heading levels never skipped. Product `<h1>` uses `displayTitle`, not the 200-char catalogue name. |
| A9 | Minimum touch target 44×44 CSS px. Admin targets 48×48 (P1 persona). |
| A10 | Forms: `<label>` for every field, `aria-describedby` for helper text, `aria-invalid` + `role="alert"` for errors. |
| A11 | Skip-to-content link. |
| A12 | `@axe-core/playwright` runs on every key route in CI; **any violation fails the build**. |
| A13 | Admin honours OS text scaling to 200% without loss of function. |

---

## 6. Component inventory

`P` = shadcn primitive (in `components/ui/`) · `D` = domain component · **Bold** = not in the Stitch designs, must be designed.

### Primitives (P)

`Button` (primary/ghost/outline/mono/destructive/icon × sm/md/lg × `glow`) · `Input` · `Textarea` · `Select` · `Checkbox` · `RadioGroup` · `Switch` · `Slider` · `Badge` (primary/success/warning/danger/glass) · `Card`/`GlassPanel` (`blur`, `borderTone`) · `Separator` · `Tabs` · `Table` · `Dialog` · **`Sheet`** (mobile nav + part picker) · `DropdownMenu` · `Tooltip` · `Popover` · `Progress` · **`Skeleton`** · **`Toast`/Sonner** · `Accordion` · `Pagination` · `Breadcrumb` · `Avatar` · `Command` (⌘K admin search) · `Combobox` · `Calendar` · **`EmptyState`** · **`Alert`**

### Layout (D)

`SiteHeader` (full / with-search / minimal) · **`MobileNav`** · `SiteFooter` (one, unified) · `AnnouncementBar` · `Breadcrumbs` · **`LocaleSwitcher`** · **`CookieConsent`** · `AdminShell` · `AdminSidebar` · `AdminTopBar`

### Commerce (D)

`ProductCard` (grid/list/compact) · `ProductGrid` · `PriceBlock` (**with compare-at strike-through — missing from the designs**) · `StockBadge` (in stock / low / out / preorder / pickup-only) · `FilterRail` + `FilterGroup` (range/checkbox/radio/chip/pill) · **`MobileFilterSheet`** · `SortSelect` · `ResultCount` · `Gallery` + `ThumbStrip` · `VariantSelector` · `SpecTable` · `TrustRow` · `FeatureCard` · `AddToCartButton` · `QuantityStepper` · `CartLineItem` · **`MiniCartDrawer`** · `OrderSummaryPanel` · `StepperNav` · `RadioCard` · `PaymentMethodTile` · **`OrderStatusTracker`** · **`ReviewList` / `ReviewForm` / `RatingStars`** · **`CompareTable`** · `EmiWidget` · `NewsletterForm` · **`StockAlertForm`** · **`BranchAvailability`**

### Builder (D)

**`ModeSelect`** · `StepRail` (vertical) + **`MobileStepBar`** · `BuilderSlotCard` (filled / empty-required / empty-optional / incompatible / recommended) · **`PartPickerDrawer`** (virtualised, faceted, sortable, with thumbnails and spec columns) · **`PartRow`** · **`CompatibilityPanel`** · **`IssueRow`** (error/warning/info) · **`FixDrawer`** · **`PowerMeter`** · **`BalanceMeter`** · `BuildSummaryPanel` · **`BuildShareDialog`** · **`BuildCompare`** · **`UpgradeSuggestionCard`** · `ExpertTipCard`

### Content (D)

`RichText` (Tiptap JSON renderer, sanitised) · `BlogCard` · **`TableOfContents`** · **`FaqAccordion`** · **`StoreCard` / `StoreMap`** · **`ServiceBookingForm`** · **`TicketStatusTracker`**

### Admin (D)

`DataTable` · `MetricTile` · `StockLevelBar` · `ActivityFeedItem` · **`HelpBubble`** · **`GuidedForm` + `StepIndicator`** · **`ImageDropzone`** · **`ConfirmDialog`** · **`UndoToast`** · **`SeoPreview`** · **`StockAdjuster`** · **`GlobalSearch`** · **`SpecTemplateEditor`** · **`RuleBuilder`** · `BarChart` / `Sparkline` (Recharts)

---

## 7. States every component must define

Missing states are the largest gap in the delivered designs. No component is "done" until all applicable states exist.

| State | Requirement |
|---|---|
| Default / hover / active / focus-visible / disabled | All interactive elements |
| Loading | Skeleton matching the final layout — never a spinner where content will appear |
| Empty | Illustration + plain-language explanation + a primary action ("No products match these filters. Clear filters") |
| Error | Human message + retry + a support route. Never a raw error string. |
| Partial | e.g. some cart items out of stock |
| Optimistic | Add-to-cart and admin status changes update immediately and roll back on failure |
| Offline | Banner; cart and builder state preserved locally |
| RTL | Not required (no RTL locale), but do not hardcode `left`/`right` — use logical properties |

---

## 8. Page-level layout specifications

Derived from the exports, with the corrections applied.

| Page | Structure |
|---|---|
| **Home** | Hero (`min-h-[85dvh]`, not `h-screen`) → category bento (4-col, collapses to 2/1) → builder teaser → trending products → value props → brand wordmarks → footer |
| **Category / Shop** | Breadcrumb → H1 + count + sort → `lg:` [288px sticky filter rail ‖ 3-col grid] / `<lg:` [filter button → sheet, 2-col grid] → pagination |
| **PDP** | `lg:grid-cols-12` → 7-col gallery ‖ 5-col sticky buy column → spec tabs → warranty/EMI cards → reviews → related bento. **Mobile: gallery → title → price → variants → add-to-cart before the fold.** |
| **Builder** | `lg:` [2-col step rail ‖ 7-col slot workspace ‖ 3-col sticky summary]. `<lg:` [horizontal step bar → slot stack → **sticky bottom summary bar** that expands to a sheet] |
| **Cart** | 8/4 split: line items ‖ sticky summary |
| **Checkout** | 3-step stepper, 8/4 split, minimal chrome, no nav links out |
| **Admin** | 256px sidebar (sheet below `lg`) + 80px top bar + scroll area |

---

## 9. Content and copy rules

| Rule | Detail |
|---|---|
| Currency | **One helper, `formatNPR(paisa)`.** Output `रु 154,900` — Devanagari sign, Western grouping (never lakh grouping), no decimals for whole rupees, `tabular-nums`. The exports use four different formats; all are wrong. |
| Numbers | Western grouping throughout. Wattage as `750 W`. Storage as `512 GB` / `1 TB`. |
| Dates | `27 Jul 2026` in UI; `2026-07-27` in exports and filenames. Asia/Kathmandu. |
| Phone | Display `+977 98-XXXX-XXXX`; store E.164. |
| Product titles | Four fields: `name` (full catalogue string), `displayTitle` (≤ 70, card title), `h1` (≤ 70, page heading), `metaTitle` (SEO `<title>`). See `06 §4`. Fixes defect `01 A.4 #13`. |
| Sentence case | All UI copy. `UPPERCASE` reserved for mono eyebrow labels only. |
| Voice — storefront | Confident, specific, no hype. "In stock at New Road" beats "Available now!" |
| Voice — admin | Plain, warm, instructional. See `09`. |
| Voice — errors | State what happened, why, and what to do. "We couldn't reach eSewa. Your order is saved — try again or choose another payment method." |
| No hardcoded strings | Everything through `next-intl`. |

---

## 10. Implementation order

| Step | Deliverable | Gate |
|---|---|---|
| 1 | `globals.css` with the full `@theme` token map | Every token renders; contrast audit passes |
| 2 | `next/font` setup, typography utilities | No CLS; no Google Fonts network request |
| 3 | shadcn init + restyle every primitive | Storybook-equivalent page renders all variants and states |
| 4 | Radius/glass/glow consolidation | No literal hex in any component; one glass definition |
| 5 | Layout components (header, mobile nav, footer, shells) | Mobile nav works; nav height uniform |
| 6 | Commerce components | All states present |
| 7 | Builder components | All states present |
| 8 | Admin components | 48px targets, 200% text scaling |
| 9 | Axe + contrast audit in CI | Zero violations |

**Definition of done for the design system phase:** a single internal `/_design` route renders every component in every variant and every state, passes axe with zero violations, and contains no hardcoded colour, radius, or font value.
