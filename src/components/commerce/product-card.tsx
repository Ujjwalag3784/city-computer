import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
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
 * composition around a `next/link`. It renders `AddToCartButton`, itself a
 * client component, as a child — a server/plain component can render a
 * client child without becoming one itself.
 *
 * The card's `Link` to `/p/${product.slug}` wraps only the non-interactive
 * "go to PDP" content (image, brand, title, rating, price, stock). Per the
 * spec's own warning, nesting a real `<button>` inside an `<a>` is invalid
 * HTML that breaks keyboard/screen-reader semantics (docs/05 §5 A5/A9), so
 * `AddToCartButton` always sits as a sibling outside the `Link`, inside an
 * outer non-link container (`Card` for `variant="grid"`, a plain `div` for
 * `list`) — never `<a><button /></a>`.
 */
export interface ProductCardData {
  slug: string;
  imageUrl: string;
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
  onAddToCart?: () => void | Promise<void>;
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
  onAddToCart,
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
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
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
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
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

          <AddToCartButton
            onAddToCart={() => onAddToCart?.()}
            outOfStock={outOfStock}
            className="mt-1 w-full sm:w-fit"
          />
        </div>
      </div>
    );
  }

  // variant === "grid" (default) — built on the shared `Card` primitive.
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <Link href={href} className={cn("flex flex-1 flex-col", linkFocusClassName)}>
        <div className="relative aspect-square w-full overflow-hidden bg-surface-container-high">
          <Image
            src={product.imageUrl}
            alt={product.imageAlt}
            fill
            sizes="(min-width: 1024px) 33vw, 50vw"
            className="object-contain"
            priority={priority}
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-1.5 pt-3">
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
        </CardContent>
      </Link>

      <CardFooter className="pt-0">
        <AddToCartButton
          onAddToCart={() => onAddToCart?.()}
          outOfStock={outOfStock}
          className="w-full"
        />
      </CardFooter>
    </Card>
  );
}
