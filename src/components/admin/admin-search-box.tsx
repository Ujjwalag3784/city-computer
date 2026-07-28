"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * A debounced search box driving the `?q=` query param — the shared
 * shape behind docs/09-ADMIN-DAD-MODE.md §5.2's product-list search box
 * and §6's inventory-screen search box: "results appear as you type,"
 * server-rendered from the URL rather than client state (see
 * `admin/products/page.tsx`'s own doc comment for why). Promoted here
 * from `admin/products/_components/product-search-box.tsx` on its
 * second consumer (`admin/inventory/page.tsx`) per docs/04-REPOSITORY-
 * STRUCTURE.md §3's "a component is promoted to `src/components/` only
 * on its second consumer."
 */
const SEARCH_DEBOUNCE_MS = 300;

export interface AdminSearchBoxProps {
  initialValue: string;
  placeholder: string;
  "aria-label"?: string;
}

export function AdminSearchBox({ initialValue, placeholder, ...aria }: AdminSearchBoxProps) {
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
        placeholder={placeholder}
        aria-label={aria["aria-label"] ?? placeholder}
        className="pl-9"
      />
    </div>
  );
}
