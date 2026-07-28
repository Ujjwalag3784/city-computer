"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";

/**
 * The one piece of `SiteHeader` that actually needs to be a Client
 * Component (docs/17 Phase 6) — everything else about the header stays a
 * plain Server Component. Reads `stores/cart-store.ts` for the live item
 * count and opens `MiniCartDrawer` (mounted once by `cart-drawer-host.tsx`
 * in the storefront layout) on click.
 *
 * `fallbackCount`: before `cart-drawer-host.tsx` has hydrated the store on
 * mount (`view` is still `null`), and on the `/design` showcase route
 * which never mounts a `CartDrawerHost` at all, this prop's value is shown
 * instead — this is exactly `SiteHeaderProps.cartCount`'s pre-Phase-6
 * static-badge behaviour, preserved rather than replaced so the showcase
 * page needs no changes.
 */
export function CartHeaderButton({ fallbackCount = 0 }: { fallbackCount?: number }) {
  const view = useCartStore((state) => state.view);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const count = view ? view.itemCount : fallbackCount;

  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      iconOnly
      aria-label="Cart"
      className="relative"
      onClick={openDrawer}
    >
      <ShoppingCart />
      {count > 0 && (
        <Badge variant="primary" className="absolute -right-1 -top-1 min-w-4 justify-center px-1">
          {count}
        </Badge>
      )}
    </Button>
  );
}
