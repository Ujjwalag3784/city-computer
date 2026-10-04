import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchFormProps {
  className?: string;
  /** Prefills the box (e.g. on `/search` itself). */
  defaultValue?: string;
  placeholder?: string;
  /** Distinguishes the header and mobile-menu instances for label/id purposes. */
  id?: string;
}

/**
 * The site search box. A plain GET form to `/search?q=…` so it works with
 * JavaScript off and needs no client bundle.
 *
 * WHY. The header and mobile-menu search inputs used to be bare <input>s
 * with no form, name or handler — typing and pressing Enter did nothing.
 */
export function SearchForm({
  className,
  defaultValue,
  placeholder = "Search laptops, GPUs, monitors, Apple…",
  id = "site-search",
}: SearchFormProps) {
  return (
    <form action="/search" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
        aria-hidden="true"
      />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          "h-10 w-full rounded-lg border border-outline-variant bg-surface-container-high pl-10 pr-4 text-body-md text-on-surface",
          "placeholder:text-on-surface-variant transition-colors",
          "focus-visible:border-primary focus-visible:outline-none",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
    </form>
  );
}
