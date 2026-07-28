"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * The product list's search box — docs/09-ADMIN-DAD-MODE.md §5.2: "Big
 * search box at the top; results appear as you type." Debounces into a
 * `router.push` that sets the `q` query param (and resets `page` back to
 * 1, since a new search invalidates whatever page you were on) — the
 * list itself re-renders server-side from `listProductsForAdmin`, the
 * same server-driven-search shape `admin-topbar.tsx`'s global search
 * uses, just via the URL instead of a Server Action call.
 */
const SEARCH_DEBOUNCE_MS = 300;

export function ProductSearchBox({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes `searchParams`/`pathname`/`router`: re-running this debounce because the URL itself just changed (from this same effect) would fight itself.
  }, [value]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 size-4 text-on-surface-variant" aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products or product codes..."
        aria-label="Search products"
        className="pl-9"
      />
    </div>
  );
}
