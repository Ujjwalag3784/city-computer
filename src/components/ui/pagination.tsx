import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Pagination — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "Pagination". No Radix primitive exists for this; built from semantic
 * `<nav aria-label="pagination">` + `<ul>`/`<li>` per standard practice,
 * composed from the `Button` primitive (a compositional dependency, unlike
 * `EmptyState`'s decoupled action slot).
 *
 * `PaginationLink`/`PaginationPrevious`/`PaginationNext` use `size="md"`
 * (44px) to satisfy docs/05 §5 A9's 44x44 minimum touch target for
 * storefront-facing controls.
 */
export const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

export const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
  ),
);
PaginationContent.displayName = "PaginationContent";

export const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />,
);
PaginationItem.displayName = "PaginationItem";

export interface PaginationLinkProps extends React.ComponentProps<"button"> {
  isActive?: boolean;
}

export const PaginationLink = ({ className, isActive, ...props }: PaginationLinkProps) => (
  <Button
    aria-current={isActive ? "page" : undefined}
    variant={isActive ? "outline" : "ghost"}
    size="md"
    iconOnly
    className={cn(isActive && "border-primary-container bg-primary-container/20", className)}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

export const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button
    aria-label="Previous page"
    variant="ghost"
    size="md"
    iconOnly
    className={cn(className)}
    {...props}
  >
    <ChevronLeft className="size-4" />
  </Button>
);
PaginationPrevious.displayName = "PaginationPrevious";

export const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    aria-label="Next page"
    variant="ghost"
    size="md"
    iconOnly
    className={cn(className)}
    {...props}
  >
    <ChevronRight className="size-4" />
  </Button>
);
PaginationNext.displayName = "PaginationNext";

export const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex size-11 items-center justify-center text-on-surface-variant", className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";
