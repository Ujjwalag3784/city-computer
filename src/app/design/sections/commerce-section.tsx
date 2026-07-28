"use client";

import * as React from "react";
import { ShieldCheck, Truck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { BranchAvailability, type BranchStock } from "@/components/commerce/branch-availability";
import { CartLineItem, type CartLineItemData } from "@/components/commerce/cart-line-item";
import { CompareTable, type CompareProduct } from "@/components/commerce/compare-table";
import { EmiWidget } from "@/components/commerce/emi-widget";
import { FeatureCard } from "@/components/commerce/feature-card";
import { FilterGroup, type FilterGroupProps } from "@/components/commerce/filter-group";
import { FilterRail } from "@/components/commerce/filter-rail";
import { Gallery } from "@/components/commerce/gallery";
import { MiniCartDrawer } from "@/components/commerce/mini-cart-drawer";
import { MobileFilterSheet } from "@/components/commerce/mobile-filter-sheet";
import { NewsletterForm } from "@/components/commerce/newsletter-form";
import {
  OrderStatusTracker,
  type OrderVisibleStatus,
} from "@/components/commerce/order-status-tracker";
import { OrderSummaryPanel } from "@/components/commerce/order-summary-panel";
import { PaymentMethodTile } from "@/components/commerce/payment-method-tile";
import { PriceBlock } from "@/components/commerce/price-block";
import { ProductCard, type ProductCardData } from "@/components/commerce/product-card";
import { ProductGrid } from "@/components/commerce/product-grid";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { RadioCard } from "@/components/commerce/radio-card";
import { RatingStars } from "@/components/commerce/rating-stars";
import { ResultCount } from "@/components/commerce/result-count";
import { ReviewForm } from "@/components/commerce/review-form";
import { ReviewList, type ReviewData } from "@/components/commerce/review-list";
import { SortSelect, type SortOption } from "@/components/commerce/sort-select";
import { SpecTable, type SpecGroup } from "@/components/commerce/spec-table";
import { StepperNav, type StepperStep } from "@/components/commerce/stepper-nav";
import { StockAlertForm } from "@/components/commerce/stock-alert-form";
import { StockBadge } from "@/components/commerce/stock-badge";
import { ThumbStrip } from "@/components/commerce/thumb-strip";
import { TrustRow } from "@/components/commerce/trust-row";
import { VariantSelector, type VariantAttribute } from "@/components/commerce/variant-selector";

/**
 * CommerceSection — docs/05-DESIGN-SYSTEM.md §10 "Implementation order":
 * the `/design` showcase route's commerce batch. Renders every component in
 * `src/components/commerce/` against realistic Nepali laptop/PC-shop fake
 * data so the showcase proves real component behaviour — including the
 * loading/empty states docs/05 §7 requires — rather than a frozen render.
 *
 * Image URLs use `https://placehold.co/...` — no product-image CDN is wired
 * up yet, and no other page in this codebase has established a different
 * placeholder convention.
 */

// ---------------------------------------------------------------------------
// Static fake data (module scope — nothing here depends on component state).
// ---------------------------------------------------------------------------

const PRODUCTS: ProductCardData[] = [
  {
    slug: "asus-tuf-gaming-f15",
    imageUrl: "https://placehold.co/400x400?text=ASUS+TUF+F15",
    imageAlt: "ASUS TUF Gaming F15 laptop",
    displayTitle: "ASUS TUF Gaming F15 (i5-12500H, RTX 3050)",
    brand: "ASUS",
    price: 12850000,
    compareAtPrice: 13990000,
    rating: 4.5,
    reviewCount: 132,
    stockStatus: "in-stock",
  },
  {
    slug: "hp-pavilion-15",
    imageUrl: "https://placehold.co/400x400?text=HP+Pavilion+15",
    imageAlt: "HP Pavilion 15 laptop",
    displayTitle: "HP Pavilion 15 (Ryzen 5 7530U, 16GB)",
    brand: "HP",
    price: 8290000,
    rating: 4.1,
    reviewCount: 47,
    stockStatus: "low-stock",
    stockQuantity: 2,
  },
  {
    slug: "dell-inspiron-15-3520",
    imageUrl: "https://placehold.co/400x400?text=Dell+Inspiron+15",
    imageAlt: "Dell Inspiron 15 3520 laptop",
    displayTitle: "Dell Inspiron 15 3520",
    brand: "Dell",
    price: 7650000,
    compareAtPrice: 7990000,
    rating: 3.9,
    reviewCount: 21,
    stockStatus: "out-of-stock",
  },
  {
    slug: "lenovo-loq-15irh9",
    imageUrl: "https://placehold.co/400x400?text=Lenovo+LOQ+15",
    imageAlt: "Lenovo LOQ 15IRH9 laptop",
    displayTitle: "Lenovo LOQ 15IRH9 (i7-13650HX, RTX 4050)",
    brand: "Lenovo",
    price: 14500000,
    rating: 4.7,
    reviewCount: 9,
    stockStatus: "preorder",
  },
  {
    slug: "city-computer-custom-ryzen-desktop",
    imageUrl: "https://placehold.co/400x400?text=Custom+Ryzen+PC",
    imageAlt: "City Computer custom Ryzen desktop tower",
    displayTitle: "City Computer Custom Ryzen 5600 Desktop",
    brand: "City Computer",
    price: 9800000,
    rating: 4.8,
    reviewCount: 15,
    stockStatus: "pickup-only",
  },
  {
    slug: "acer-aspire-7",
    imageUrl: "https://placehold.co/400x400?text=Acer+Aspire+7",
    imageAlt: "Acer Aspire 7 laptop",
    displayTitle: "Acer Aspire 7 (Ryzen 5, GTX 1650)",
    brand: "Acer",
    price: 8990000,
    compareAtPrice: 9490000,
    rating: 4.0,
    reviewCount: 63,
    stockStatus: "in-stock",
  },
];

const PDP_IMAGES: { src: string; alt: string }[] = [
  { src: "https://placehold.co/800x800?text=Front", alt: "ASUS TUF Gaming F15 — front view" },
  { src: "https://placehold.co/800x800?text=Side", alt: "ASUS TUF Gaming F15 — side view" },
  { src: "https://placehold.co/800x800?text=Ports", alt: "ASUS TUF Gaming F15 — ports" },
  { src: "https://placehold.co/800x800?text=Keyboard", alt: "ASUS TUF Gaming F15 — keyboard" },
];

const SPEC_GROUPS: SpecGroup[] = [
  {
    title: "Processor & memory",
    rows: [
      { label: "Processor", value: "Intel Core i5-12500H" },
      { label: "RAM", value: "16GB DDR5 (2933MHz)" },
    ],
  },
  {
    title: "Storage & display",
    rows: [
      { label: "Storage", value: "512GB NVMe SSD" },
      { label: "Display", value: '15.6" FHD 144Hz IPS' },
    ],
  },
];

const BRANCHES: BranchStock[] = [
  {
    name: "City Computer — New Road",
    address: "New Road, Kathmandu",
    slug: "new-road",
    inStock: true,
    quantity: 4,
  },
  {
    name: "City Computer — Lazimpat",
    address: "Lazimpat, Kathmandu",
    slug: "lazimpat",
    inStock: false,
  },
];

const VARIANT_ATTRIBUTES: VariantAttribute[] = [
  {
    name: "RAM",
    options: [
      { label: "8GB", value: "8gb", available: true },
      { label: "16GB", value: "16gb", available: true },
      { label: "32GB", value: "32gb", available: false },
    ],
  },
  {
    name: "Storage",
    options: [
      { label: "512GB SSD", value: "512gb", available: true },
      { label: "1TB SSD", value: "1tb", available: true },
    ],
  },
];

const REVIEWS: ReviewData[] = [
  {
    id: "rev-1",
    authorName: "Sujata K.",
    rating: 5,
    title: "Great value for the price",
    body: "Runs every game I throw at it without heating up too much. Delivery to Pokhara took 3 days.",
    isVerifiedPurchase: true,
    createdAt: "2026-05-02T09:15:00.000Z",
    helpfulCount: 14,
  },
  {
    id: "rev-2",
    authorName: "Bipin R.",
    rating: 4,
    body: "Solid laptop, battery life could be better.",
    isVerifiedPurchase: true,
    createdAt: "2026-04-18T12:00:00.000Z",
    adminReply: "Thanks for the feedback, Bipin — we've passed this on to the brand.",
    helpfulCount: 3,
  },
  {
    id: "rev-3",
    authorName: "Anonymous",
    rating: 3,
    title: "Average",
    body: "Does the job for office use.",
    isVerifiedPurchase: false,
    createdAt: "2026-03-30T08:00:00.000Z",
  },
];

const CHECKOUT_STEPS: StepperStep[] = [
  { label: "Contact", status: "complete" },
  { label: "Delivery", status: "current" },
  { label: "Payment", status: "upcoming" },
];

const BUILDER_STEPS: StepperStep[] = [
  { label: "CPU", status: "complete" },
  { label: "Motherboard", status: "current" },
  { label: "RAM", status: "upcoming" },
  { label: "Storage", status: "upcoming" },
];

const ORDER_STATUSES: OrderVisibleStatus[] = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

const BRAND_FILTER_OPTIONS = [
  { label: "ASUS", value: "asus", count: 12 },
  { label: "HP", value: "hp", count: 8 },
  { label: "Dell", value: "dell", count: 5 },
  { label: "Lenovo", value: "lenovo", count: 9 },
];

const AVAILABILITY_FILTER_OPTIONS = [
  { label: "In stock", value: "in-stock" },
  { label: "Pickup only", value: "pickup-only" },
];

const PROCESSOR_FILTER_OPTIONS = [
  { label: "Intel Core i5", value: "i5" },
  { label: "Intel Core i7", value: "i7" },
  { label: "AMD Ryzen 5", value: "ryzen5" },
];

const TAG_FILTER_OPTIONS = [
  { label: "Gaming", value: "gaming" },
  { label: "Student", value: "student" },
];

const PRICE_FILTER_MIN = 50000;
const PRICE_FILTER_MAX = 250000;

function formatFilterRupees(value: number): string {
  return `Rs ${value.toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Local showcase-only presentation helpers (Tailwind tokens only — no raw
// colour/hex/px values).
// ---------------------------------------------------------------------------

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-8 border-b border-glass-stroke pb-12">
      <h2 className="text-headline-md text-on-surface">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function ComponentDemo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-glass-stroke bg-surface-container p-6">
      <h3 className="text-title text-on-surface">{label}</h3>
      {children}
    </div>
  );
}

export function CommerceSection() {
  // -- Product display state -----------------------------------------------
  const [interactiveRating, setInteractiveRating] = React.useState(0);

  // -- PDP state --------------------------------------------------------------
  const [thumbActiveIndex, setThumbActiveIndex] = React.useState(0);
  const [variantSelected, setVariantSelected] = React.useState<Record<string, string>>({
    RAM: "16gb",
    Storage: "512gb",
  });

  // -- Filtering & sorting state ----------------------------------------------
  const [brandSelected, setBrandSelected] = React.useState<string[]>(["asus"]);
  const [availabilitySelected, setAvailabilitySelected] = React.useState<string | null>("in-stock");
  const [priceRange, setPriceRange] = React.useState<[number, number]>([80000, 180000]);
  const [processorSelected, setProcessorSelected] = React.useState<string[]>(["i5"]);
  const [tagSelected, setTagSelected] = React.useState<string[]>(["gaming"]);
  const [sortValue, setSortValue] = React.useState<SortOption>("relevance");

  const handleClearAllFilters = React.useCallback(() => {
    setBrandSelected([]);
    setAvailabilitySelected(null);
    setPriceRange([PRICE_FILTER_MIN, PRICE_FILTER_MAX]);
    setProcessorSelected([]);
  }, []);

  const filterRailGroups: FilterGroupProps[] = [
    {
      type: "checkbox",
      title: "Brand",
      options: BRAND_FILTER_OPTIONS,
      selected: brandSelected,
      onChange: setBrandSelected,
    },
    {
      type: "radio",
      title: "Availability",
      options: AVAILABILITY_FILTER_OPTIONS,
      selected: availabilitySelected,
      onChange: setAvailabilitySelected,
    },
    {
      type: "range",
      title: "Price (NPR)",
      min: PRICE_FILTER_MIN,
      max: PRICE_FILTER_MAX,
      value: priceRange,
      onChange: setPriceRange,
      formatValue: formatFilterRupees,
    },
    {
      type: "chip",
      title: "Processor",
      options: PROCESSOR_FILTER_OPTIONS,
      selected: processorSelected,
      onChange: setProcessorSelected,
    },
  ];

  // -- Cart & checkout state ---------------------------------------------------
  const [quantity, setQuantity] = React.useState(1);

  const [cartLineItem, setCartLineItem] = React.useState<CartLineItemData | null>({
    variantId: "variant_demo_asus_tuf_1",
    productSlug: "asus-tuf-gaming-f15",
    imageUrl: "https://placehold.co/160x160?text=ASUS+TUF",
    imageAlt: "ASUS TUF Gaming F15 laptop",
    displayTitle: "ASUS TUF Gaming F15",
    variantLabel: "16GB RAM · 512GB SSD",
    unitPrice: 12850000,
    quantity: 1,
    maxQuantity: 5,
  });

  const [miniCartOpen, setMiniCartOpen] = React.useState(false);
  const [miniCartItems, setMiniCartItems] = React.useState<CartLineItemData[]>([
    {
      variantId: "variant_demo_asus_tuf_1",
      productSlug: "asus-tuf-gaming-f15",
      imageUrl: "https://placehold.co/160x160?text=ASUS+TUF",
      imageAlt: "ASUS TUF Gaming F15 laptop",
      displayTitle: "ASUS TUF Gaming F15",
      variantLabel: "16GB RAM · 512GB SSD",
      unitPrice: 12850000,
      quantity: 1,
      maxQuantity: 5,
    },
    {
      variantId: "variant_demo_dell_inspiron_1",
      productSlug: "dell-inspiron-15-3520",
      imageUrl: "https://placehold.co/160x160?text=Dell+Inspiron",
      imageAlt: "Dell Inspiron 15 3520 laptop",
      displayTitle: "Dell Inspiron 15 3520",
      unitPrice: 7650000,
      quantity: 2,
      isOutOfStock: true,
    },
  ]);
  const miniCartSubtotal = miniCartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const [couponCode, setCouponCode] = React.useState<string | undefined>(undefined);

  const [deliveryZone, setDeliveryZone] = React.useState("inside-valley");
  const [paymentMethod, setPaymentMethod] = React.useState("esewa");

  async function handleApplyCoupon(code: string) {
    if (code === "") {
      setCouponCode(undefined);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (code.toUpperCase() !== "SAVE10") {
      throw new Error("Invalid coupon code");
    }
    setCouponCode(code.toUpperCase());
  }

  // -- Orders & reviews state ---------------------------------------------------
  const [compareProducts, setCompareProducts] = React.useState<CompareProduct[]>([
    {
      slug: "asus-tuf-gaming-f15",
      imageUrl: "https://placehold.co/200x200?text=ASUS+TUF",
      imageAlt: "ASUS TUF Gaming F15 laptop",
      displayTitle: "ASUS TUF Gaming F15",
      price: 12850000,
      compareAtPrice: 13990000,
      specRows: [
        { label: "Processor", values: ["Intel Core i5-12500H", "", ""] },
        { label: "RAM", values: ["16GB DDR5", "", ""] },
        { label: "Storage", values: ["512GB NVMe SSD", "", ""] },
        { label: "Graphics", values: ["RTX 3050 6GB", "", ""] },
      ],
    },
    {
      slug: "hp-pavilion-15",
      imageUrl: "https://placehold.co/200x200?text=HP+Pavilion",
      imageAlt: "HP Pavilion 15 laptop",
      displayTitle: "HP Pavilion 15",
      price: 8290000,
      specRows: [
        { label: "Processor", values: ["", "AMD Ryzen 5 7530U", ""] },
        { label: "RAM", values: ["", "16GB DDR4", ""] },
        { label: "Storage", values: ["", "512GB SSD", ""] },
      ],
    },
    {
      slug: "lenovo-loq-15irh9",
      imageUrl: "https://placehold.co/200x200?text=Lenovo+LOQ",
      imageAlt: "Lenovo LOQ 15IRH9 laptop",
      displayTitle: "Lenovo LOQ 15IRH9",
      price: 14500000,
      specRows: [
        { label: "Processor", values: ["", "", "Intel Core i7-13650HX"] },
        { label: "RAM", values: ["", "", "16GB DDR5"] },
        { label: "Storage", values: ["", "", "1TB SSD"] },
        { label: "Graphics", values: ["", "", "RTX 4050 6GB"] },
        { label: "Display", values: ["", "", '15.6" 144Hz FHD'] },
      ],
    },
  ]);

  const [lastSubmittedReview, setLastSubmittedReview] = React.useState<{
    rating: number;
    title: string;
    body: string;
  } | null>(null);

  async function handleReviewSubmit(review: { rating: number; title: string; body: string }) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLastSubmittedReview(review);
  }

  async function handleNewsletterSubmit(email: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (email.trim().length === 0) {
      throw new Error("Email is required");
    }
  }

  async function handleStockAlertSubmit(contact: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (contact.trim().length === 0) {
      throw new Error("Contact is required");
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="Product display">
        <ComponentDemo label="ProductCard — grid / list / compact">
          <div className="grid gap-6 sm:grid-cols-3">
            <ProductCard
              product={PRODUCTS[0]!}
              variant="grid"
              onAddToCart={async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }}
            />
            <ProductCard
              product={PRODUCTS[1]!}
              variant="list"
              onAddToCart={async () => {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }}
              className="sm:col-span-2"
            />
          </div>
          <ProductCard product={PRODUCTS[2]!} variant="compact" className="max-w-48" />
        </ComponentDemo>

        <ComponentDemo label="ProductGrid — populated">
          <ProductGrid
            products={PRODUCTS}
            onAddToCart={async () => {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }}
          />
        </ComponentDemo>

        <ComponentDemo label="ProductGrid — loading state">
          <ProductGrid products={PRODUCTS} loading />
        </ComponentDemo>

        <ComponentDemo label="ProductGrid — empty state">
          <ProductGrid
            products={[]}
            emptyAction={
              <Button variant="outline" size="sm" onClick={handleClearAllFilters}>
                Clear filters
              </Button>
            }
          />
        </ComponentDemo>

        <ComponentDemo label="PriceBlock">
          <div className="flex flex-wrap items-end gap-8">
            <PriceBlock price={12850000} compareAtPrice={13990000} size="sm" />
            <PriceBlock price={8290000} size="md" />
            <PriceBlock price={14500000} compareAtPrice={15900000} size="lg" />
          </div>
        </ComponentDemo>

        <ComponentDemo label="StockBadge — every status">
          <div className="flex flex-wrap gap-3">
            <StockBadge status="in-stock" />
            <StockBadge status="low-stock" quantity={2} />
            <StockBadge status="out-of-stock" />
            <StockBadge status="preorder" />
            <StockBadge status="pickup-only" />
          </div>
        </ComponentDemo>

        <ComponentDemo label="RatingStars — read-only and interactive">
          <div className="flex flex-col gap-3">
            <RatingStars rating={4.5} count={132} size="md" />
            <RatingStars rating={3.5} size="sm" />
            <div className="flex items-center gap-3">
              <RatingStars
                rating={interactiveRating}
                readOnly={false}
                onRatingChange={setInteractiveRating}
              />
              <span className="text-body-sm text-on-surface-variant">
                Selected: {interactiveRating || "none"}
              </span>
            </div>
          </div>
        </ComponentDemo>
      </ShowcaseSection>

      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="PDP">
        <ComponentDemo label="Gallery">
          <Gallery images={PDP_IMAGES} className="max-w-md" />
        </ComponentDemo>

        <ComponentDemo label="ThumbStrip">
          <div className="flex flex-col gap-3">
            <ThumbStrip
              images={PDP_IMAGES}
              activeIndex={thumbActiveIndex}
              onSelect={setThumbActiveIndex}
            />
            <span className="text-body-sm text-on-surface-variant">
              Active image: {thumbActiveIndex + 1} of {PDP_IMAGES.length}
            </span>
          </div>
        </ComponentDemo>

        <ComponentDemo label="VariantSelector">
          <VariantSelector
            attributes={VARIANT_ATTRIBUTES}
            selected={variantSelected}
            onChange={(attributeName, value) =>
              setVariantSelected((prev) => ({ ...prev, [attributeName]: value }))
            }
          />
        </ComponentDemo>

        <ComponentDemo label="SpecTable">
          <SpecTable groups={SPEC_GROUPS} />
        </ComponentDemo>

        <ComponentDemo label="BranchAvailability">
          <BranchAvailability branches={BRANCHES} />
        </ComponentDemo>
      </ShowcaseSection>

      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="Filtering & sorting">
        <ComponentDemo label="FilterGroup — checkbox">
          <FilterGroup
            type="checkbox"
            title="Brand"
            options={BRAND_FILTER_OPTIONS}
            selected={brandSelected}
            onChange={setBrandSelected}
          />
        </ComponentDemo>

        <ComponentDemo label="FilterGroup — radio">
          <FilterGroup
            type="radio"
            title="Availability"
            options={AVAILABILITY_FILTER_OPTIONS}
            selected={availabilitySelected}
            onChange={setAvailabilitySelected}
          />
        </ComponentDemo>

        <ComponentDemo label="FilterGroup — range">
          <FilterGroup
            type="range"
            title="Price (NPR)"
            min={PRICE_FILTER_MIN}
            max={PRICE_FILTER_MAX}
            value={priceRange}
            onChange={setPriceRange}
            formatValue={formatFilterRupees}
          />
        </ComponentDemo>

        <ComponentDemo label="FilterGroup — chip">
          <FilterGroup
            type="chip"
            title="Processor"
            options={PROCESSOR_FILTER_OPTIONS}
            selected={processorSelected}
            onChange={setProcessorSelected}
          />
        </ComponentDemo>

        <ComponentDemo label="FilterGroup — pill">
          <FilterGroup
            type="pill"
            title="Tags"
            options={TAG_FILTER_OPTIONS}
            selected={tagSelected}
            onChange={setTagSelected}
          />
        </ComponentDemo>

        <ComponentDemo label="FilterRail (desktop sticky rail)">
          <FilterRail groups={filterRailGroups} onClearAll={handleClearAllFilters} />
        </ComponentDemo>

        <ComponentDemo label="MobileFilterSheet (renders its own trigger)">
          <MobileFilterSheet
            groups={filterRailGroups}
            onClearAll={handleClearAllFilters}
            resultCount={PRODUCTS.length}
          />
        </ComponentDemo>

        <ComponentDemo label="SortSelect + ResultCount">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ResultCount count={128} />
            <SortSelect value={sortValue} onChange={setSortValue} />
          </div>
        </ComponentDemo>
      </ShowcaseSection>

      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="Cart & checkout">
        <ComponentDemo label="QuantityStepper">
          <div className="flex items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={10} />
            <span className="text-body-sm text-on-surface-variant">Quantity: {quantity}</span>
          </div>
        </ComponentDemo>

        <ComponentDemo label="AddToCartButton — idle / out of stock / disabled / failing">
          <div className="flex flex-wrap gap-4">
            <AddToCartButton
              onAddToCart={async () => {
                await new Promise((resolve) => setTimeout(resolve, 600));
              }}
            />
            <AddToCartButton onAddToCart={async () => {}} outOfStock />
            <AddToCartButton onAddToCart={async () => {}} disabled />
            <AddToCartButton
              onAddToCart={async () => {
                await new Promise((_resolve, reject) =>
                  setTimeout(() => reject(new Error("Network error")), 600),
                );
              }}
            />
          </div>
        </ComponentDemo>

        <ComponentDemo label="CartLineItem">
          {cartLineItem ? (
            <CartLineItem
              item={cartLineItem}
              onQuantityChange={(nextQuantity) =>
                setCartLineItem((prev) => (prev ? { ...prev, quantity: nextQuantity } : prev))
              }
              onRemove={() => setCartLineItem(null)}
            />
          ) : (
            <p className="text-body-sm text-on-surface-variant">
              Removed from cart. (Refresh the page to restore this demo item.)
            </p>
          )}
        </ComponentDemo>

        <ComponentDemo label="MiniCartDrawer (externally controlled open state)">
          <Button variant="outline" onClick={() => setMiniCartOpen(true)}>
            Open cart
          </Button>
          <MiniCartDrawer
            open={miniCartOpen}
            onOpenChange={setMiniCartOpen}
            items={miniCartItems}
            subtotal={miniCartSubtotal}
            onQuantityChange={(variantId, nextQuantity) =>
              setMiniCartItems((prev) =>
                prev.map((item) =>
                  item.variantId === variantId ? { ...item, quantity: nextQuantity } : item,
                ),
              )
            }
            onRemove={(variantId) =>
              setMiniCartItems((prev) => prev.filter((item) => item.variantId !== variantId))
            }
          />
        </ComponentDemo>

        <ComponentDemo label="OrderSummaryPanel">
          <OrderSummaryPanel
            subtotal={20500000}
            discount={couponCode ? 1000000 : undefined}
            total={couponCode ? 19500000 : 20500000}
            couponCode={couponCode}
            onApplyCoupon={handleApplyCoupon}
            taxInclusiveNote
            primaryAction={
              <Button variant="primary" glow className="w-full">
                Proceed to checkout
              </Button>
            }
            className="max-w-md"
          />
        </ComponentDemo>

        <ComponentDemo label="StepperNav — horizontal (checkout) / vertical (builder)">
          <div className="flex flex-col gap-6">
            <StepperNav steps={CHECKOUT_STEPS} orientation="horizontal" />
            <StepperNav steps={BUILDER_STEPS} orientation="vertical" />
          </div>
        </ComponentDemo>

        <ComponentDemo label="RadioCard (delivery zone)">
          <RadioGroup
            value={deliveryZone}
            onValueChange={setDeliveryZone}
            className="flex flex-col gap-2"
          >
            <RadioCard
              value="inside-valley"
              title="Inside Valley"
              description="NPR 150 delivery fee"
              trailing={<span className="text-body-sm text-on-surface-variant">1–2 days</span>}
            />
            <RadioCard
              value="outside-valley"
              title="Outside Valley"
              description="NPR 350 delivery fee"
              trailing={<span className="text-body-sm text-on-surface-variant">3–5 days</span>}
            />
          </RadioGroup>
        </ComponentDemo>

        <ComponentDemo label="PaymentMethodTile">
          <RadioGroup
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            className="flex flex-col gap-2"
          >
            <PaymentMethodTile
              value="esewa"
              label="eSewa"
              description="Redirects to eSewa to complete payment"
            />
            <PaymentMethodTile
              value="khalti"
              label="Khalti"
              description="Redirects to Khalti to complete payment"
            />
            <PaymentMethodTile value="cod" label="Cash on Delivery" />
          </RadioGroup>
        </ComponentDemo>
      </ShowcaseSection>

      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="Orders & reviews">
        <ComponentDemo label="OrderStatusTracker — every status">
          <div className="flex flex-col gap-6">
            {ORDER_STATUSES.map((status) => (
              <div key={status} className="flex flex-col gap-2">
                <span className="text-label-mono-xs text-on-surface-variant">{status}</span>
                <OrderStatusTracker status={status} />
              </div>
            ))}
          </div>
        </ComponentDemo>

        <ComponentDemo label="ReviewList">
          <ReviewList reviews={REVIEWS} />
        </ComponentDemo>

        <ComponentDemo label="ReviewForm">
          <div className="flex flex-col gap-3">
            <ReviewForm onSubmit={handleReviewSubmit} className="max-w-md" />
            {lastSubmittedReview && (
              <p className="text-body-sm text-on-surface-variant">
                Last submitted: {lastSubmittedReview.rating}★ —{" "}
                {lastSubmittedReview.title || "(no title)"}
              </p>
            )}
          </div>
        </ComponentDemo>

        <ComponentDemo label="CompareTable">
          <CompareTable
            products={compareProducts}
            onRemove={(slug) =>
              setCompareProducts((prev) => prev.filter((product) => product.slug !== slug))
            }
          />
        </ComponentDemo>
      </ShowcaseSection>

      {/* ---------------------------------------------------------------- */}
      <ShowcaseSection title="Marketing & trust">
        <ComponentDemo label="TrustRow">
          <TrustRow />
        </ComponentDemo>

        <ComponentDemo label="FeatureCard">
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={Truck}
              title="Nationwide delivery"
              description="Delivered inside the Valley in 1–2 days, outside in 3–5 days."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Genuine products"
              description="Every laptop and part is sourced directly from authorised distributors."
            />
            <FeatureCard
              icon={Wrench}
              title="Free setup & support"
              description="Free OS setup and a walk-through call for every new machine."
            />
          </div>
        </ComponentDemo>

        <ComponentDemo label="EmiWidget">
          <EmiWidget amount={12850000} className="max-w-md" />
        </ComponentDemo>

        <ComponentDemo label="NewsletterForm — zero-wiring / with onSubmit">
          <div className="flex flex-col gap-6">
            <NewsletterForm className="max-w-md" />
            <NewsletterForm onSubmit={handleNewsletterSubmit} className="max-w-md" />
          </div>
        </ComponentDemo>

        <ComponentDemo label="StockAlertForm">
          <StockAlertForm
            productName="ASUS TUF Gaming F15"
            onSubmit={handleStockAlertSubmit}
            className="max-w-md"
          />
        </ComponentDemo>
      </ShowcaseSection>
    </div>
  );
}
