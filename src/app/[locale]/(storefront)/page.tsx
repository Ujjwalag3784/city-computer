import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Calculator,
  Cpu,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCategoryTree } from "@/server/services/catalog/category";
import { listBrands } from "@/server/services/catalog/brand";
import { listProducts, type ProductSummary } from "@/server/services/catalog/product";
import { getTrendingProductSummaries } from "@/server/services/catalog/trending";
import { getDefaultDeliveryPromise } from "@/server/services/commerce/delivery-promise";
import { ProductGrid } from "@/components/commerce/product-grid";
import { ProductImage } from "@/components/commerce/product-image";
import { PriceBlock } from "@/components/commerce/price-block";
import { StockBadge } from "@/components/commerce/stock-badge";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { buildItemListJsonLd } from "@/lib/seo/jsonld/item-list";
import { buildCanonical, buildHreflangAlternates, buildOpenGraph } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { cn } from "@/lib/utils";
import { CategoryGrid } from "./_components/category-grid";
import { toPrismaLocale, toProductCardData } from "./_lib/catalog-view";

const HAS_NE_TRANSLATION = true;

/**
 * The real homepage route (`/`, or `/ne` for Nepali) — replaces the
 * i18n-proving placeholder from Phase 4 task 1/3.
 *
 * Still not the `HomeSection`-driven page docs/17's Phase 4 deliverables
 * ultimately call for ("Home page with typed `HomeSection` blocks: hero
 * slider, category bento, featured carousel, builder teaser, promo
 * banner..."): that needs `server/services/content/` (a content service
 * reading the `HomeSection` model), which doesn't exist yet — flagged,
 * not silently substituted. What's here is real, though, not a mock:
 * live top-level categories and live featured products, both fetched
 * from the actual catalog service layer built in task 2/3.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = "City Computer Systems — Laptops, PCs, Components & Repairs in Kathmandu";
  const description =
    "Genuine laptops, desktops, PC components, and repair services in Kathmandu, Nepal. Best prices, real stock, and expert support.";
  const canonical = buildCanonical("/", locale);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates("/", { ne: HAS_NE_TRANSLATION }),
    },
    openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
  };
}

const FEATURED_PRODUCT_COUNT = 8;
const RAIL_PRODUCT_COUNT = 4;
const DEAL_PRODUCT_COUNT = 3;
const TRENDING_PRODUCT_COUNT = 4;
const SPOTLIGHT_SPEC_COUNT = 4;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The hero's spotlight: the most expensive in-stock featured product, falling back to the first. */
function pickSpotlight(products: ProductSummary[]): ProductSummary | undefined {
  const inStock = products.filter((product) => product.availability === "IN_STOCK");
  const pool = inStock.length > 0 ? inStock : products;
  return [...pool].sort((a, b) => b.priceFrom.amountPaisa - a.priceFrom.amountPaisa)[0];
}

/**
 * The homepage — 2026-10-04 "Obsidian Kinetic" redesign from the owner's
 * Stitch export (`city_computer_systems_flagship_homepage_2`): split hero
 * with a live product spotlight, numbered department tiles, a 4-up
 * featured grid, a PC-builder feature band, deals, new arrivals, a trust
 * strip and the brand row.
 *
 * Every figure on the page is real catalogue data or a real feature.
 * Stitch's mock copy (same-day delivery, 0% EMI from named banks, eSewa /
 * Khalti / Fonepay, ratings) describes things the shop does not offer yet,
 * so it was not carried over.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const prismaLocale = toPrismaLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const [categoryTree, featured, trending, newArrivals, saleItems, brands, deliveryPromise] =
    await Promise.all([
      getCategoryTree(prismaLocale),
      listProducts({ sort: "relevance", perPage: FEATURED_PRODUCT_COUNT }, prismaLocale),
      getTrendingProductSummaries(TRENDING_PRODUCT_COUNT, prismaLocale),
      listProducts({ sort: "-createdAt", perPage: RAIL_PRODUCT_COUNT }, prismaLocale),
      listProducts({ sort: "-discount", onSale: true, perPage: DEAL_PRODUCT_COUNT }, prismaLocale),
      listBrands(prismaLocale),
      getDefaultDeliveryPromise(),
    ]);

  const topLevelCategories = categoryTree.filter((category) => category.depth === 0);
  const spotlight = pickSpotlight(featured.items);
  const delivery = deliveryPromise ?? undefined;

  return (
    <div className="flex flex-col">
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-outline-variant">
        <div className="absolute inset-0 bg-grid-fade opacity-60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:px-12 lg:py-20">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1 font-mono text-label-mono-xs text-on-surface-variant">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Flagship showroom · New Road, Kathmandu
            </span>
            <h1 className="text-display-lg text-on-surface">
              Built for the work <span className="text-primary">you do.</span>
            </h1>
            <p className="max-w-xl text-body-lg text-on-surface-variant">
              Genuine laptops, PC components and Apple hardware with official warranty, from our
              showroom in New Road — delivered across Kathmandu Valley.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/c/laptops">
                  Shop laptops
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/build/new">
                  Build your PC
                  <Cpu aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <dl className="grid w-full max-w-xl grid-cols-1 gap-4 border-t border-outline-variant pt-6 sm:grid-cols-3">
              <HeroFact label="Delivery" value={delivery ?? "Across Kathmandu Valley"} />
              <HeroFact label="Payment" value="Cash on delivery or bank transfer" />
              <HeroFact label="Service" value="Walk-in repairs at New Road" />
            </dl>
          </div>

          {spotlight && <HeroSpotlight product={spotlight} />}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[var(--space-section-gap-mobile)] px-4 py-14 sm:px-6 lg:gap-[var(--space-section-gap)] lg:px-12 lg:pt-20 lg:pb-4">
        {/* -------------------------------------------------------------- */}
        {/* Departments                                                    */}
        {/* -------------------------------------------------------------- */}
        <HomeSection
          id="shop-by-category-heading"
          index="01"
          eyebrow="Departments"
          title={t("shopByCategory")}
          description="Everything we stock, from single components to complete workstations."
        >
          {topLevelCategories.length > 0 ? (
            <CategoryGrid categories={topLevelCategories} />
          ) : (
            <p className="text-body-md text-on-surface-variant">{tc("noResults")}</p>
          )}
        </HomeSection>

        {/* -------------------------------------------------------------- */}
        {/* Featured                                                       */}
        {/* -------------------------------------------------------------- */}
        <HomeSection
          id="featured-products-heading"
          index="02"
          eyebrow="Curated hardware"
          title={t("featuredProducts")}
          description="Genuine, sealed retail units with manufacturer-backed warranty."
          viewAllHref="/shop"
        >
          <ProductGrid
            products={featured.items.map(toProductCardData)}
            deliveryPromise={delivery}
            className="xl:grid-cols-4"
          />
        </HomeSection>

        {/* -------------------------------------------------------------- */}
        {/* PC builder band                                                */}
        {/* -------------------------------------------------------------- */}
        <BuilderBand />

        {saleItems.items.length > 0 && (
          <HomeSection
            id="sale-items-heading"
            index="04"
            eyebrow="Price drops"
            title="Hardware deals"
            description="Products currently marked down from their regular price."
            viewAllHref="/shop?sort=-discount&onSale=true"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {saleItems.items.map((product) => (
                <DealCard key={product.id} product={product} />
              ))}
            </div>
          </HomeSection>
        )}

        {trending.length > 0 && (
          <HomeSection
            id="trending-now-heading"
            index="05"
            eyebrow="Selling now"
            title="Trending this week"
            description="What's actually selling this week, ranked by real orders."
          >
            <ProductGrid
              products={trending.map(toProductCardData)}
              deliveryPromise={delivery}
              className="xl:grid-cols-4"
            />
          </HomeSection>
        )}

        {newArrivals.items.length > 0 && (
          <HomeSection
            id="new-arrivals-heading"
            index={trending.length > 0 ? "06" : "05"}
            eyebrow="Just landed"
            title={t("newArrivals")}
            description="The newest products added to the catalogue."
            viewAllHref="/shop?sort=-createdAt"
          >
            <ProductGrid
              products={newArrivals.items.map(toProductCardData)}
              deliveryPromise={delivery}
              className="xl:grid-cols-4"
            />
          </HomeSection>
        )}

        <TrustStrip />

        {brands.length > 0 && (
          <section aria-labelledby="brands-heading" className="flex flex-col gap-4">
            <h2
              id="brands-heading"
              className="font-mono text-label-mono-xs text-on-surface-variant"
            >
              Brands we carry
            </h2>
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-outline-variant bg-outline-variant sm:grid-cols-4 lg:grid-cols-8">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={`/b/${brand.slug}`}
                    className={cn(
                      "flex h-16 items-center justify-center bg-surface font-mono text-label-mono-xs text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
                      focusRing,
                    )}
                  >
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <JsonLd
        data={buildItemListJsonLd({
          locale,
          pageUrl: absoluteUrl("/", locale),
          items: featured.items.map((item) => ({
            href: `/p/${item.slug}`,
            name: item.displayTitle,
          })),
        })}
      />
    </div>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-label-mono-xs text-primary">{label}</dt>
      <dd className="text-body-sm text-on-surface-variant">{value}</dd>
    </div>
  );
}

/** Stitch's "Featured gaming workstation" panel, driven by a real product. */
function HeroSpotlight({ product }: { product: ProductSummary }) {
  const specs = product.specHighlights.slice(0, SPOTLIGHT_SPEC_COUNT);
  const href = `/p/${product.slug}`;

  return (
    <article className="panel flex flex-col gap-4 p-4 shadow-glow sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-label-mono-xs text-on-surface-variant">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Featured · {product.primaryCategory.name}
        </p>
        <StockBadge status={product.availability === "IN_STOCK" ? "in-stock" : "out-of-stock"} />
      </div>

      <Link
        href={href}
        className={cn("tile relative block aspect-[16/10] overflow-hidden", focusRing)}
      >
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.displayTitle}
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-contain p-6"
          priority
        />
      </Link>

      <div className="flex flex-col gap-1">
        <p className="font-mono text-label-mono-xs text-on-surface-variant">{product.brand.name}</p>
        <h2 className="text-headline-md text-on-surface">
          <Link href={href} className={cn("rounded hover:text-primary", focusRing)}>
            {product.displayTitle}
          </Link>
        </h2>
      </div>

      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-outline-variant bg-outline-variant">
          {specs.map((spec, index) => (
            <div
              key={spec.label}
              className={cn(
                "flex flex-col gap-0.5 bg-surface-container-high px-3 py-2.5",
                specs.length % 2 === 1 && index === specs.length - 1 && "col-span-2",
              )}
            >
              <dt className="font-mono text-label-mono-xs text-on-surface-variant">{spec.label}</dt>
              <dd className="truncate font-mono text-[0.8125rem] text-on-surface">{spec.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-outline-variant pt-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-label-mono-xs text-on-surface-variant">
            Price in Nepal
          </span>
          <PriceBlock
            price={product.priceFrom.amountPaisa}
            compareAtPrice={product.priceFrom.compareAtPaisa ?? undefined}
            size="lg"
          />
        </div>
        <Button asChild>
          <Link href={href}>
            View product
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function DealCard({ product }: { product: ProductSummary }) {
  const href = `/p/${product.slug}`;
  const inStock = product.availability === "IN_STOCK";

  return (
    <article className="group panel flex min-w-0 flex-col gap-4 p-5 transition-colors hover:border-outline">
      <div className="flex items-center justify-between gap-2">
        {product.priceFrom.discountPercent ? (
          <span className="rounded-full border border-primary/30 bg-primary/12 px-2.5 py-0.5 font-mono text-label-mono-xs text-primary">
            -{product.priceFrom.discountPercent}% off
          </span>
        ) : (
          <span />
        )}
        <StockBadge status={inStock ? "in-stock" : "out-of-stock"} />
      </div>

      <div className="flex gap-4">
        <div className="tile relative size-24 shrink-0 overflow-hidden">
          <ProductImage
            src={product.image?.url}
            alt={product.image?.alt ?? product.displayTitle}
            sizes="96px"
            className="object-contain p-2"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-mono text-label-mono-xs text-on-surface-variant">
            {product.brand.name}
          </p>
          <h3 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-on-surface group-hover:text-primary">
            <Link href={href} className={cn("rounded", focusRing)}>
              {product.displayTitle}
            </Link>
          </h3>
          {product.specHighlights.length > 0 && (
            <p className="truncate font-mono text-[0.6875rem] text-on-surface-variant">
              {product.specHighlights
                .slice(0, 3)
                .map((spec) => spec.value)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-outline-variant pt-4">
        <PriceBlock
          price={product.priceFrom.amountPaisa}
          compareAtPrice={product.priceFrom.compareAtPaisa ?? undefined}
        />
        <Button asChild variant="mono" size="sm">
          <Link href={href}>View deal</Link>
        </Button>
      </div>
    </article>
  );
}

/** The PC-builder feature band — describes what the builder really does. */
function BuilderBand() {
  const slots = [
    "Processor",
    "Motherboard",
    "Memory",
    "Graphics",
    "Storage",
    "Power supply",
    "Case",
    "Cooling",
  ];
  const facts = [
    { label: "Compatibility", value: "Checked on every part you add" },
    { label: "Power", value: "Wattage estimate for your PSU" },
    { label: "Share", value: "One link for the whole build" },
    { label: "Checkout", value: "Every part to cart in one click" },
  ];

  return (
    <section aria-labelledby="builder-band-heading" className="panel relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16 lg:p-12">
        <div className="flex flex-col items-start gap-5">
          <p className="eyebrow">[03] // PC builder</p>
          <h2 id="builder-band-heading" className="text-headline-lg text-on-surface">
            Build your own PC.
            <br />
            <span className="text-on-surface-variant">We check that every part fits.</span>
          </h2>
          <p className="max-w-xl text-body-lg text-on-surface-variant">
            Pick a processor, board, memory and the rest — the builder flags anything that
            won&apos;t work together, estimates your power draw, and lets you share or buy the whole
            build.
          </p>
          <dl className="grid w-full grid-cols-2 gap-4 border-t border-outline-variant pt-5 md:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <dt className="font-mono text-label-mono-xs text-primary">{fact.label}</dt>
                <dd className="text-body-sm text-on-surface-variant">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <Button asChild size="lg">
            <Link href="/build/new">
              Launch PC builder
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <ol
          className="tile hidden flex-col divide-y divide-outline-variant overflow-hidden p-0 lg:flex"
          aria-hidden="true"
        >
          {slots.map((slot, index) => (
            <li key={slot} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="flex items-center gap-3">
                <span className="font-mono text-label-mono-xs text-on-surface-variant">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-body-md text-on-surface">{slot}</span>
              </span>
              <span className="font-mono text-label-mono-xs text-primary">Choose +</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Official warranty",
      body: "Genuine products with the manufacturer's warranty, honoured at our New Road counter.",
      href: "/pages/warranty",
    },
    {
      icon: Banknote,
      title: "Cash on delivery",
      body: "Pay when your order arrives, on eligible orders inside Kathmandu Valley.",
      href: "/pages/shipping-policy",
    },
    {
      icon: Calculator,
      title: "EMI calculator",
      body: "See monthly instalments by bank before you buy.",
      href: "/emi-calculator",
    },
    {
      icon: Wrench,
      title: "Repairs in New Road",
      body: "Book a repair online and follow it with your ticket number.",
      href: "/service",
    },
  ];

  return (
    <section
      aria-label="Why buy from City Computer"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {items.map(({ icon: Icon, title, body, href }) => (
        <Link
          key={title}
          href={href}
          className={cn(
            "group panel flex gap-4 p-5 transition-colors hover:border-outline",
            focusRing,
          )}
        >
          <span className="tile flex size-10 shrink-0 items-center justify-center text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1 font-display text-[0.9375rem] font-semibold text-on-surface">
              {title}
              <ArrowUpRight
                className="size-3.5 text-on-surface-variant transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </span>
            <span className="text-body-sm text-on-surface-variant">{body}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

/**
 * Section shell: Stitch's "[01] // CURATED HARDWARE" mono eyebrow over a
 * Manrope heading, with an optional "View all" link on the right.
 */
function HomeSection({
  id,
  index,
  eyebrow,
  title,
  description,
  viewAllHref,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">
            [{index}] // {eyebrow}
          </p>
          <h2 id={id} className="text-headline-lg text-on-surface">
            {title}
          </h2>
          <p className="text-body-md text-on-surface-variant">{description}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded font-mono text-label-mono-xs text-on-surface-variant transition-colors hover:text-primary",
              focusRing,
            )}
          >
            View all <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
