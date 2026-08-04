import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCategoryTree } from "@/server/services/catalog/category";
import { listProducts } from "@/server/services/catalog/product";
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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const prismaLocale = toPrismaLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const [categoryTree, featured] = await Promise.all([
    getCategoryTree(prismaLocale),
    listProducts({ sort: "relevance", perPage: FEATURED_PRODUCT_COUNT }, prismaLocale),
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
              href={`/${locale}/build`}
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
          <ProductGrid products={featured.items.map(toProductCardData)} />
        </section>
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
