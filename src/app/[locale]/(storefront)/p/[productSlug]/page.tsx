import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Gallery } from "@/components/commerce/gallery";
import { SpecTable, type SpecGroup, type SpecRow } from "@/components/commerce/spec-table";
import { ProductGrid } from "@/components/commerce/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildProductJsonLd } from "@/lib/seo/jsonld/product";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildOpenGraph,
  buildTwitter,
  robotsForTranslationState,
  ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { isProductIndexable } from "@/lib/seo/thin-content";
import { getProductBySlug, type ProductDetail } from "@/server/services/catalog/product";
import { NotFoundError } from "@/lib/errors";
import { toPrismaLocale, toProductCardData } from "../../_lib/catalog-view";
import { BuyBox } from "./_components/buy-box";
import Link from "next/link";
import { Banknote, Calculator, ShieldCheck, Wrench } from "lucide-react";
import { getDefaultDeliveryPromise } from "@/server/services/commerce/delivery-promise";
import { parseTiptapDocument } from "@/lib/tiptap/schema";
import { TiptapContent } from "@/lib/tiptap/render";

// docs/11-SEO-STRATEGY.md §9.2/§9.4: no product in this catalogue has a
// real Nepali translation yet (PROGRESS.md Phase 4's own note — "nothing
// in the catalogue has Nepali translations yet either"), so `ne`
// hreflang/indexability is hardcoded false here rather than guessed at
// per product. When real `ProductTranslation` rows with locale `NE` start
// shipping, this should become a per-product check instead.
const HAS_NE_TRANSLATION = false;

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
 *
 * DELIBERATELY NO `loading.tsx` HERE. There was one (a page-shaped
 * skeleton matching this layout), removed after a real-browser test kept
 * showing it permanently: the route's own React streaming reveal script
 * (`$RC(...)`, present and correct in the raw SSR HTML — confirmed with
 * curl) never swapped the resolved content into `<main>`. The resolved
 * content *had* arrived — it sat, fully rendered, in a trailing orphaned
 * `<div id="S:N">` at the end of `<body>` instead of replacing the
 * fallback — so this was specifically the client-side reveal step
 * failing, not a slow or broken data fetch. Root cause not confirmed (a
 * connection-visibility artifact of the testing tool used was suspected
 * but not ruled out); rather than ship a page that can silently strand a
 * shopper on a permanent loading skeleton for an unconfirmed reason, this
 * route now renders fully server-side with no Suspense boundary to get
 * stuck in — slightly slower to first byte, never stuck. `params` has no
 * `searchParams` dependency here, so the render is a single bounded
 * `getProductBySlug` call, not a page whose latency this trade-off makes
 * meaningfully worse. Re-adding `loading.tsx` is safe once the streaming
 * failure above is actually reproduced and understood, not before.
 */
interface ProductPageProps {
  params: Promise<{ locale: string; productSlug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, productSlug } = await params;
  try {
    const product = await getProductBySlug(productSlug, toPrismaLocale(locale));
    const pathname = `/p/${productSlug}`;
    const title = product.metaTitle ?? `${product.displayTitle} — City Computer Systems`;
    const description = product.metaDescription ?? product.shortDescription;
    const canonical = buildCanonical(pathname, locale);
    const image = product.media[0]?.url;
    // docs/11 §6.5's PDP-specific thin-content row: 120 words of
    // description + >= 6 spec attributes + >= 2 photos, else `noindex`
    // regardless of what the translation-state check below would
    // otherwise allow — same "content gate wins over translation gate"
    // precedence already used on blog posts and CMS pages.
    const indexableContent = isProductIndexable({
      description: product.description,
      specCount: product.specs.length,
      photoCount: product.media.length,
    });

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      robots: indexableContent
        ? robotsForTranslationState(locale, HAS_NE_TRANSLATION)
        : ROBOTS_NOINDEX_FOLLOW,
      // `type: "website"`, never "article" — docs/11 §12's own acceptance
      // bar names this exact PDP defect by number (#1).
      openGraph: buildOpenGraph({
        title,
        description,
        url: canonical,
        locale,
        images: image ? [{ url: image, alt: product.displayTitle }] : undefined,
      }),
      twitter: buildTwitter({ title, description, images: image ? [image] : undefined }),
    };
  } catch {
    return {};
  }
}

/** The variant `BuyBox` shows by default — the same one this page's Product JSON-LD prices, so the visible price and the markup can never disagree. */
function pickPrimaryVariant(
  variants: ProductDetail["variants"],
): ProductDetail["variants"][number] | undefined {
  return (
    variants.find((variant) => variant.isDefault && variant.isActive) ??
    variants.find((v) => v.isActive) ??
    variants[0]
  );
}

function toSchemaAvailability(
  variant: ProductDetail["variants"][number] | undefined,
): "InStock" | "OutOfStock" | "PreOrder" {
  if (!variant) return "OutOfStock";
  if (variant.availableQuantity > 0) return "InStock";
  return variant.allowBackorder ? "PreOrder" : "OutOfStock";
}

/** docs/11 §4.5: "`now + 30 days`, computed by the caller — never a stale past date." */
function priceValidUntilIso(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

/** Concatenated text of a Tiptap JSON tree — only used to compare with the short description. */
function plainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const { text, content } = node as { text?: unknown; content?: unknown };
  const own = typeof text === "string" ? text : "";
  const children = Array.isArray(content) ? content.map(plainText).join(" ") : "";
  return `${own}${own && children ? " " : ""}${children}`.replace(/\s+/g, " ");
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
  const deliveryPromisePromise = getDefaultDeliveryPromise();
  try {
    product = await getProductBySlug(productSlug, prismaLocale);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const specGroups = groupSpecs(product.specs);

  // Single source of truth for both the visible breadcrumb trail and the
  // BreadcrumbList JSON-LD below — docs/11 §4.4's "footer Webcams→
  // motherboards" cautionary tale is exactly the drift this shared array
  // prevents.
  const breadcrumbItems = [
    { label: product.primaryCategory.name, href: `/c/${product.primaryCategory.path}` },
    { label: product.displayTitle },
  ];
  const pageUrl = absoluteUrl(`/p/${productSlug}`, locale);
  const primaryVariant = pickPrimaryVariant(product.variants);

  const deliveryPromise = (await deliveryPromisePromise) ?? undefined;
  const descriptionDoc = parseTiptapDocument(product.description);
  // Hidden when the long description says nothing the short one doesn't
  // (the seeded demo products, and any product entered with one paragraph).
  const hasDescription =
    Boolean(descriptionDoc?.content?.length) &&
    plainText(product.description).trim() !== product.shortDescription.trim();
  const warrantyLabel =
    product.warrantyText ??
    (product.warrantyMonths
      ? `${product.warrantyMonths} months warranty`
      : "Manufacturer warranty");
  const assurances = [
    { icon: ShieldCheck, label: warrantyLabel, href: "/pages/warranty" },
    { icon: Banknote, label: "Cash on delivery in the valley", href: "/pages/shipping-policy" },
    { icon: Calculator, label: "Work out EMI by bank", href: "/emi-calculator" },
    { icon: Wrench, label: "Repairs at our New Road service desk", href: "/service" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 py-8 sm:px-6 lg:gap-16 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
          <Gallery
            images={product.media.map((media) => ({ src: media.url, alt: media.alt }))}
            className="lg:sticky lg:top-32 lg:self-start"
          />

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="eyebrow">
                {[
                  product.brand.name,
                  product.primaryCategory.name,
                  product.conditionType === "REFURBISHED" ? "Refurbished" : null,
                ]
                  .filter(Boolean)
                  .join(" // ")}
              </p>
              <h1 className="text-display-sm text-on-surface">{product.h1}</h1>
              {product.shortDescription && (
                <p className="text-body-lg text-on-surface-variant">{product.shortDescription}</p>
              )}
            </div>

            <BuyBox variants={product.variants} deliveryPromise={deliveryPromise} />

            <ul className="grid grid-cols-1 gap-2 border-t border-outline-variant pt-5 sm:grid-cols-2">
              {assurances.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 rounded font-mono text-[0.75rem] text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {hasDescription && descriptionDoc && (
        <section aria-labelledby="overview-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">[01] // Overview</p>
            <h2 id="overview-heading" className="text-headline-lg text-on-surface">
              About this product
            </h2>
          </div>
          <div className="panel max-w-4xl p-6 text-body-lg text-on-surface-variant sm:p-8">
            <TiptapContent doc={descriptionDoc} />
          </div>
        </section>
      )}

      {specGroups.length > 0 && (
        <section aria-labelledby="specs-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">[{hasDescription ? "02" : "01"}] // Full specifications</p>
            <h2 id="specs-heading" className="text-headline-lg text-on-surface">
              {t("specifications")}
            </h2>
          </div>
          <SpecTable groups={specGroups} />
        </section>
      )}

      {product.relatedProducts.length > 0 && (
        <section aria-labelledby="related-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="eyebrow">Goes well with</p>
            <h2 id="related-heading" className="text-headline-lg text-on-surface">
              {t("relatedProducts")}
            </h2>
          </div>
          <ProductGrid
            products={product.relatedProducts.map(toProductCardData)}
            deliveryPromise={deliveryPromise}
            className="xl:grid-cols-4"
          />
        </section>
      )}

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      {primaryVariant && (
        <JsonLd
          data={buildProductJsonLd({
            slug: productSlug,
            locale,
            name: product.displayTitle,
            description: product.shortDescription,
            sku: primaryVariant.sku,
            brandName: product.brand.name,
            categoryPath: product.primaryCategory.name,
            images: product.media.map((media) => media.url),
            pricePaisa: primaryVariant.pricePaisa,
            availability: toSchemaAvailability(primaryVariant),
            itemCondition:
              product.conditionType === "REFURBISHED" ? "RefurbishedCondition" : "NewCondition",
            priceValidUntil: priceValidUntilIso(),
            // Zero-review suppression relies on this being exactly
            // `product.rating` (the same `{average, count}` the visible
            // page would show a star rating from, once one exists) —
            // never a hardcoded/guessed value. `reviews` is omitted: this
            // codebase doesn't fetch a public review list for the PDP yet
            // (see PROGRESS.md Phase 11), so there's nothing honest to
            // inline as review[] even when count > 0.
            rating:
              product.rating.count > 0
                ? { average: product.rating.average ?? 0, count: product.rating.count }
                : null,
          })}
        />
      )}
    </div>
  );
}
