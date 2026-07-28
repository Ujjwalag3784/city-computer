import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Gallery } from "@/components/commerce/gallery";
import { SpecTable, type SpecGroup, type SpecRow } from "@/components/commerce/spec-table";
import { ProductGrid } from "@/components/commerce/product-grid";
import { getProductBySlug, type ProductDetail } from "@/server/services/catalog/product";
import { NotFoundError } from "@/lib/errors";
import { toPrismaLocale, toProductCardData } from "../../_lib/catalog-view";
import { BuyBox } from "./_components/buy-box";

/**
 * `/p/[productSlug]` — docs/07-API-DESIGN.md §3.1's `GET
 * /api/v1/products/{slug}` ("Includes variants, media, specs, stock
 * summary, related"), rendered directly from the catalog service layer.
 *
 * NOT YET HERE, flagged rather than silently dropped: `ReviewList`
 * (docs/05 §6). `catalog/product.ts`'s `getProductBySlug` doesn't fetch
 * `Review` rows at all — Task 31 scoped the catalog service layer to
 * exactly product/category/brand/facet/search per docs/04's file list,
 * and reviews weren't one of the five. Adding a reviews read path is a
 * small, separate piece of work, not something to bolt directly onto a
 * page component (docs/04 §3: "No business logic in `app/**\/page.tsx` —
 * pages orchestrate, services decide").
 */
interface ProductPageProps {
  params: Promise<{ locale: string; productSlug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productSlug } = await params;
  try {
    const product = await getProductBySlug(productSlug, toPrismaLocale(locale));
    return {
      title: product.metaTitle ?? `${product.displayTitle} — City Computer Systems`,
      description: product.metaDescription ?? product.shortDescription,
    };
  } catch {
    return {};
  }
}

function groupSpecs(specs: ProductDetail["specs"]): SpecGroup[] {
  const groups = new Map<string, SpecRow[]>();
  for (const spec of specs) {
    const groupName = spec.group ?? "General";
    const rows = groups.get(groupName) ?? [];
    rows.push({ label: spec.label, value: spec.unit ? `${spec.value}` : spec.value });
    groups.set(groupName, rows);
  }
  return [...groups.entries()].map(([title, rows]) => ({ title, rows }));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, productSlug } = await params;
  const prismaLocale = toPrismaLocale(locale);
  const t = await getTranslations("product");

  let product: ProductDetail;
  try {
    product = await getProductBySlug(productSlug, prismaLocale);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const specGroups = groupSpecs(product.specs);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 p-4 sm:p-8">
      <Breadcrumbs
        items={[
          { label: product.primaryCategory.name, href: `/c/${product.primaryCategory.path}` },
          { label: product.displayTitle },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Gallery images={product.media.map((media) => ({ src: media.url, alt: media.alt }))} />

        <div className="flex flex-col gap-3">
          <span className="text-label-mono-xs text-on-surface-variant">{product.brand.name}</span>
          <h1 className="text-headline-md text-on-surface">{product.h1}</h1>
          <p className="text-body-md text-on-surface-variant">{product.shortDescription}</p>
          <BuyBox variants={product.variants} />
        </div>
      </div>

      {specGroups.length > 0 && (
        <section aria-labelledby="specs-heading" className="flex flex-col gap-4">
          <h2 id="specs-heading" className="text-headline-sm text-on-surface">
            {t("specifications")}
          </h2>
          <SpecTable groups={specGroups} />
        </section>
      )}

      {product.relatedProducts.length > 0 && (
        <section aria-labelledby="related-heading" className="flex flex-col gap-4">
          <h2 id="related-heading" className="text-headline-sm text-on-surface">
            {t("relatedProducts")}
          </h2>
          <ProductGrid products={product.relatedProducts.map(toProductCardData)} />
        </section>
      )}
    </div>
  );
}
