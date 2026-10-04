import Link from "next/link";
import { Truck } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { ProductCardAddToCart } from "@/components/commerce/product-card-add-to-cart";
import { PriceBlock } from "@/components/commerce/price-block";
import { RatingStars } from "@/components/commerce/rating-stars";
import { StockBadge } from "@/components/commerce/stock-badge";
import { cn } from "@/lib/utils";

/**
 * ProductCard — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "ProductCard (grid/list/compact)". `product` is a clean, serializable
 * plain object (`ProductCardData`), never a Prisma type — no data-fetching
 * layer exists yet (docs/06-DATA-MODEL.md's catalogue tables ship in a
 * later phase), so whatever fetches real products later just maps its
 * result onto this shape.
 *
 * No `"use client"` here: the card shell is plain presentational
 * composition around a `next/link`. It renders a client component
 * (`ProductCardAddToCart`) as a child — a server/plain component can render
 * a client child without becoming one itself, **as long as every prop it
 * passes is serialisable**.
 *
 * That last clause is load-bearing and was the bug behind the first
 * production 500s. This component used to take an `onAddToCart` callback
 * and forward `onAddToCart={() => onAddToCart?.()}` to `AddToCartButton`.
 * A freshly-created arrow function is a function whether or not the caller
 * supplied one, so on every route that renders a card from a Server
 * Component (`/`, the PDP's related rail, a blog post's related rail) React
 * hit "Event handlers cannot be passed to Client Component props" while
 * serialising the RSC payload and the whole route returned HTTP 500.
 *
 * The prop is therefore gone. Quick-add is owned end-to-end by
 * `product-card-add-to-cart.tsx`, a `"use client"` leaf that calls
 * `addToCartAction` itself; this component hands it only
 * `product.variantId`, `outOfStock` and a `className`. Nothing
 * non-serialisable crosses the boundary, so a card renders identically from
 * a Server Component or from inside a Client Component (`CatalogListing`,
 * the `/design` showcase) with no caller-side wiring at all. See
 * `lib/server-client-props.test.ts` for the guard that keeps it that way.
 *
 * The card's `Link` to `/p/${product.slug}` wraps only the non-interactive
 * "go to PDP" content (image, brand, title, rating, price, stock). Per the
 * spec's own warning, nesting a real `<button>` inside an `<a>` is invalid
 * HTML that breaks keyboard/screen-reader semantics (docs/05 §5 A5/A9), so
 * the add-to-cart control always sits as a sibling outside the `Link`,
 * inside an outer non-link container (`Card` for `variant="grid"`, a plain
 * `div` for `list`) — never `<a><button /></a>`.
 */
export interface ProductCardData {
  slug: string;
  /**
   * The variant a quick-add from this card should add — the cheapest active
   * variant, i.e. the same row `price`/`compareAtPrice` below come from, so
   * the button adds exactly the item whose price the shopper just read.
   * Optional because a product with no active variant row still has to
   * render (`toProductSummary` logs that case) and because the `/design`
   * showcase's demo cards have no real catalogue behind them.
   */
  variantId?: string;
  /**
   * Optional: a product with no media row passes nothing and `ProductImage`
   * renders the committed placeholder. Callers must NOT invent a blank-pixel
   * data URL for this — that is what used to hide missing photos behind an
   * invisible box instead of showing a deliberate placeholder.
   */
  imageUrl?: string;
  imageAlt: string;
  displayTitle: string;
  brand?: string;
  /** Current price, integer paisa. */
  price: number;
  /** Original/compare-at price, integer paisa. */
  compareAtPrice?: number;
  rating?: number;
  reviewCount?: number;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock" | "preorder" | "pickup-only";
  stockQuantity?: number;
  /** Primary category name, shown in the card's mono kicker. */
  category?: string;
  /** Up to three short spec values rendered as mono chips, e.g. "RTX 4060", "16 GB". */
  specs?: string[];
}

export interface ProductCardProps {
  product: ProductCardData;
  variant?: "grid" | "list" | "compact";
  className?: string;
  /**
   * docs/11-SEO-STRATEGY.md §7's image-SEO acceptance item: the first
   * handful of above-the-fold cards in a grid/rail should set `priority`
   * on their `<Image>` so LCP doesn't wait on a lazy-loaded image. Callers
   * (`ProductGrid`, `CatalogListing`) set this for roughly the first row;
   * defaults to `false` so every existing call site is unaffected.
   */
  priority?: boolean;
  /**
   * A short, real delivery line — e.g. "Delivery in 1–2 days (Inside
   * Kathmandu Valley) · NPR 150" — from `server/services/commerce/
   * delivery-promise.ts`. Page-level context, not product data, so it's a
   * separate prop rather than a `ProductCardData` field: it's identical
   * for every card on a page and callers fetch it once (that service is
   * `cache()`-wrapped) rather than duplicating a query per product.
   * Omitted entirely (no fallback text) on `variant="compact"`, matching
   * that variant's own "image + title + price only" contract.
   */
  deliveryPromise?: string;
}

/** Shared focus ring for the plain, non-`Button` `Link`s below (docs/05 §5 A9). */
const linkFocusClassName =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ProductCard({
  product,
  variant = "grid",
  className,
  priority = false,
  deliveryPromise,
}: ProductCardProps) {
  const href = `/p/${product.slug}`;
  const outOfStock = product.stockStatus === "out-of-stock";
  // Narrowed once here, rather than a `typeof` check plus an `as number`
  // cast at each render site below.
  const rating = typeof product.rating === "number" ? product.rating : null;

  const deliveryLine = deliveryPromise ? (
    <p className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
      <Truck className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{deliveryPromise}</span>
    </p>
  ) : null;

  if (variant === "compact") {
    // Minimal — image + title + price only, no rating/stock/add-to-cart, so
    // nothing interactive lives inside this `Link` and it can safely wrap
    // the whole card (used for "recently viewed"/related-product rails).
    return (
      <Link href={href} className={cn("flex flex-col gap-2", linkFocusClassName, className)}>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-container-high">
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            sizes="(min-width: 1024px) 200px, 40vw"
            className="object-contain"
            priority={priority}
          />
        </div>
        <span className="line-clamp-2 text-body-sm font-medium text-on-surface">
          {product.displayTitle}
        </span>
        <PriceBlock price={product.price} compareAtPrice={product.compareAtPrice} size="sm" />
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <div
        className={cn(
          "flex gap-4 rounded-xl border border-glass-stroke bg-surface-container p-4",
          className,
        )}
      >
        <Link href={href} className={cn("shrink-0", linkFocusClassName)}>
          <div className="relative aspect-square w-32 overflow-hidden rounded-lg bg-surface-container-high">
            <ProductImage
              src={product.imageUrl}
              alt={product.imageAlt}
              sizes="128px"
              className="object-contain"
              priority={priority}
            />
          </div>
        </Link>

        <div className="flex flex-1 flex-col gap-1.5">
          <Link href={href} className={cn("flex flex-col gap-1.5", linkFocusClassName)}>
            {product.brand && (
              <span className="text-label-mono-xs text-on-surface-variant">{product.brand}</span>
            )}
            <span className="line-clamp-2 text-body-md font-medium text-on-surface">
              {product.displayTitle}
            </span>
            {rating !== null && (
              <RatingStars rating={rating} count={product.reviewCount} size="sm" readOnly />
            )}
            <PriceBlock price={product.price} compareAtPrice={product.compareAtPrice} size="md" />
            <StockBadge status={product.stockStatus} quantity={product.stockQuantity} />
            {deliveryLine}
          </Link>

          <ProductCardAddToCart
            variantId={product.variantId}
            outOfStock={outOfStock}
            className="mt-1 w-full sm:w-fit"
          />
        </div>
      </div>
    );
  }

  // variant === "grid" (default) — built on the shared `Card` primitive.
  const kicker = [product.brand, product.category].filter(Boolean).join(" // ");

  // DESIGN.md "Product Tiles": an Elevation 1 panel holding an inset
  // Elevation 2 image stage, a mono kicker, spec chips, the pricing
  // cluster and a full-width add-to-cart.
  return (
    <article
      className={cn(
        "group panel flex min-w-0 flex-col gap-4 p-3 transition-colors duration-150 hover:border-outline",
        className,
      )}
    >
      <Link href={href} className={cn("flex flex-1 flex-col gap-4", linkFocusClassName)}>
        <div className="tile relative aspect-[4/3] w-full overflow-hidden">
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            priority={priority}
          />
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            <StockBadge status={product.stockStatus} quantity={product.stockQuantity} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-1">
          {kicker && (
            <span className="truncate font-mono text-label-mono-xs text-on-surface-variant">
              {kicker}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary">
            {product.displayTitle}
          </h3>
          {product.specs && product.specs.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Key specifications">
              {product.specs.map((spec) => (
                <li
                  key={spec}
                  className="max-w-full truncate rounded border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.6875rem] text-on-surface-variant"
                >
                  {spec}
                </li>
              ))}
            </ul>
          )}
          {rating !== null && (
            <RatingStars rating={rating} count={product.reviewCount} size="sm" readOnly />
          )}
          <PriceBlock
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="md"
            className="mt-auto pt-1"
          />
          {deliveryPromise && (
            <p className="hidden items-center gap-1.5 font-mono text-[0.6875rem] text-on-surface-variant sm:flex">
              <Truck className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{deliveryPromise}</span>
            </p>
          )}
        </div>
      </Link>

      <ProductCardAddToCart
        variantId={product.variantId}
        outOfStock={outOfStock}
        className="w-full"
      />
    </article>
  );
}
