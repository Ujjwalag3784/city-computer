import Link from "next/link";
import { ProductImage } from "@/components/commerce/product-image";
import { ProductCardAddToCart } from "@/components/commerce/product-card-add-to-cart";
import { PriceBlock } from "@/components/commerce/price-block";
import { RatingStars } from "@/components/commerce/rating-stars";
import { StockBadge } from "@/components/commerce/stock-badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
}

/** Shared focus ring for the plain, non-`Button` `Link`s below (docs/05 §5 A9). */
const linkFocusClassName =
  "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ProductCard({
  product,
  variant = "grid",
  className,
  priority = false,
}: ProductCardProps) {
  const href = `/p/${product.slug}`;
  const outOfStock = product.stockStatus === "out-of-stock";
  // Narrowed once here, rather than a `typeof` check plus an `as number`
  // cast at each render site below.
  const rating = typeof product.rating === "number" ? product.rating : null;

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
  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden transition-all duration-300 hover:border-primary-container/60 hover:shadow-glow",
        className,
      )}
    >
      <Link href={href} className={cn("flex flex-1 flex-col", linkFocusClassName)}>
        <div className="relative aspect-square w-full overflow-hidden bg-surface-container-high">
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            sizes="(min-width: 1024px) 33vw, 50vw"
            className="object-contain transition-transform duration-500 ease-out group-hover:scale-105"
            priority={priority}
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-1.5 pt-3">
          {product.brand && (
            <span className="text-label-mono-xs text-on-surface-variant">{product.brand}</span>
          )}
          <span className="line-clamp-2 text-body-md font-medium text-on-surface transition-colors group-hover:text-primary">
            {product.displayTitle}
          </span>
          {rating !== null && (
            <RatingStars rating={rating} count={product.reviewCount} size="sm" readOnly />
          )}
          <PriceBlock price={product.price} compareAtPrice={product.compareAtPrice} size="md" />
          <StockBadge status={product.stockStatus} quantity={product.stockQuantity} />
        </CardContent>
      </Link>

      <CardFooter className="pt-0">
        <ProductCardAddToCart
          variantId={product.variantId}
          outOfStock={outOfStock}
          className="w-full"
        />
      </CardFooter>
    </Card>
  );
}
