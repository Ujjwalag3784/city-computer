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
    <div className="mx-auto flex max-w-[1280px] flex-col gap-12 p-4 sm:p-8">
      <section aria-labelledby="shop-by-category-heading" className="flex flex-col gap-4">
        <h2 id="shop-by-category-heading" className="text-headline-sm text-on-surface">
          {t("shopByCategory")}
        </h2>
        {topLevelCategories.length > 0 ? (
          <CategoryGrid categories={topLevelCategories} />
        ) : (
          <p className="text-body-md text-on-surface-variant">{tc("noResults")}</p>
        )}
      </section>

      <section aria-labelledby="featured-products-heading" className="flex flex-col gap-4">
        <h2 id="featured-products-heading" className="text-headline-sm text-on-surface">
          {t("featuredProducts")}
        </h2>
        <ProductGrid products={featured.items.map(toProductCardData)} />
      </section>

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
