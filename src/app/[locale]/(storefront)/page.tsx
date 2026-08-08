import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCategoryTree } from "@/server/services/catalog/category";
import { listProducts } from "@/server/services/catalog/product";
import { getTrendingProductSummaries } from "@/server/services/catalog/trending";
import { getDefaultDeliveryPromise } from "@/server/services/commerce/delivery-promise";
import { ProductGrid } from "@/components/commerce/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { buildItemListJsonLd } from "@/lib/seo/jsonld/item-list";
import { buildCanonical, buildHreflangAlternates, buildOpenGraph } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { CategoryGrid } from "./_components/category-grid";
import { toPrismaLocale, toProductCardData } from "./_lib/catalog-view";

// The homepage itself is a fully bilingual shell (chrome is translated via
// next-intl messages, not entity content) — `/ne` is a real, intentional
// page, not an English-fallback shell, so it's the one route in this pass
// that legitimately claims a `ne` hreflang alternate.
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
const RAIL_PRODUCT_COUNT = 8;
const TRENDING_PRODUCT_COUNT = 4;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const prismaLocale = toPrismaLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const [categoryTree, featured, trending, newArrivals, saleItems, deliveryPromise] =
    await Promise.all([
      getCategoryTree(prismaLocale),
      listProducts({ sort: "relevance", perPage: FEATURED_PRODUCT_COUNT }, prismaLocale),
      getTrendingProductSummaries(TRENDING_PRODUCT_COUNT, prismaLocale),
      listProducts({ sort: "-createdAt", perPage: RAIL_PRODUCT_COUNT }, prismaLocale),
      listProducts({ sort: "-discount", onSale: true, perPage: RAIL_PRODUCT_COUNT }, prismaLocale),
      getDefaultDeliveryPromise(),
    ]);

  // Homepage tiles are top-level categories only (`depth === 0`) —
  // sub-categories like "Gaming Laptops" belong one click deeper, inside
  // their parent's own listing, not competing for space on the homepage.
  const topLevelCategories = categoryTree.filter((category) => category.depth === 0);

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section matching Obsidian Peak Landing Page Spec */}
      <section className="relative flex min-h-[75vh] items-center justify-center overflow-hidden border-b border-glass-stroke bg-obsidian-surface px-4 py-16 sm:px-8">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-container/15 via-background to-background" />
        <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center text-center">
          <span className="mb-4 inline-block font-mono text-label-mono-xs tracking-[0.2em] text-primary">
            PREMIUM TECH HARDWARE
          </span>
          <h1 className="mb-6 font-display text-display-lg text-on-surface">
            Nepal&apos;s Ultimate <span className="text-primary">Tech Authority.</span>
          </h1>
          <p className="mb-8 max-w-2xl text-body-lg text-on-surface-variant">
            From professional workstation components to enthusiast-grade gaming laptops. Precision
            engineered for those who demand excellence.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={`/${locale}/build/new`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded bg-primary px-8 font-mono text-label-mono font-semibold text-on-primary transition-all hover:bg-primary-container hover:shadow-glow-strong active:scale-95"
            >
              BUILD YOUR AI PC
            </a>
            <a
              href="#shop-by-category-heading"
              className="inline-flex h-12 items-center justify-center gap-2 rounded border border-glass-stroke bg-transparent px-8 font-mono text-label-mono font-medium text-on-surface transition-colors hover:border-primary-container hover:bg-surface-container-high"
            >
              EXPLORE CATALOG
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-16 px-4 sm:px-8">
        <section aria-labelledby="shop-by-category-heading" className="flex flex-col gap-6">
          <div className="flex items-end justify-between border-b border-glass-stroke pb-4">
            <div>
              <h2
                id="shop-by-category-heading"
                className="font-display text-headline-lg text-on-surface"
              >
                {t("shopByCategory")}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Curated hardware ecosystems categorized for your performance needs.
              </p>
            </div>
          </div>
          {topLevelCategories.length > 0 ? (
            <CategoryGrid categories={topLevelCategories} />
          ) : (
            <p className="text-body-md text-on-surface-variant">{tc("noResults")}</p>
          )}
        </section>

        <section aria-labelledby="featured-products-heading" className="flex flex-col gap-6">
          <div className="flex items-end justify-between border-b border-glass-stroke pb-4">
            <div>
              <h2
                id="featured-products-heading"
                className="font-display text-headline-lg text-on-surface"
              >
                {t("featuredProducts")}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Hand-picked gear and flagship performance components.
              </p>
            </div>
          </div>
          <ProductGrid
            products={featured.items.map(toProductCardData)}
            deliveryPromise={deliveryPromise ?? undefined}
          />
        </section>

        {trending.length > 0 && (
          <HomeRailSection
            id="trending-now-heading"
            title="Trending now"
            description="What's actually selling this week, ranked by real orders."
            // No "View all" here on purpose: this ranking is computed from
            // recent sales, not a `/shop` sort option a link could
            // reproduce (see `trending.ts`'s own comment on why `-sales`
            // isn't reused) — there is nowhere honest to send "View all".
          >
            <ProductGrid
              products={trending.map(toProductCardData)}
              deliveryPromise={deliveryPromise ?? undefined}
            />
          </HomeRailSection>
        )}

        {newArrivals.items.length > 0 && (
          <HomeRailSection
            id="new-arrivals-heading"
            title="New arrivals"
            description="The newest products added to the catalogue."
            viewAllHref="/shop?sort=-createdAt"
          >
            <ProductGrid
              products={newArrivals.items.map(toProductCardData)}
              deliveryPromise={deliveryPromise ?? undefined}
            />
          </HomeRailSection>
        )}

        {saleItems.items.length > 0 && (
          <HomeRailSection
            id="sale-items-heading"
            title="Sale items"
            description="Products currently marked down from their regular price."
            viewAllHref="/shop?sort=-discount&onSale=true"
          >
            <ProductGrid
              products={saleItems.items.map(toProductCardData)}
              deliveryPromise={deliveryPromise ?? undefined}
            />
          </HomeRailSection>
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

/**
 * Shared heading + optional "View all" link for the three merchandising
 * rails below Featured Products — same `border-b` heading shape that
 * section already used, pulled out once these rails made it a
 * three-times-repeated block instead of a one-off.
 */
function HomeRailSection({
  id,
  title,
  description,
  viewAllHref,
  children,
}: {
  id: string;
  title: string;
  description: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <div className="flex items-end justify-between border-b border-glass-stroke pb-4">
        <div>
          <h2 id={id} className="font-display text-headline-lg text-on-surface">
            {title}
          </h2>
          <p className="text-body-sm text-on-surface-variant">{description}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="rounded text-body-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
