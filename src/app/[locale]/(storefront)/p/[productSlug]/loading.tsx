import { Skeleton } from "@/components/ui/skeleton";

/** PDP-shaped skeleton — distinct from `_components/listing-loading.tsx`'s grid shape, since this route renders a gallery + buy-box layout, not a product grid. */
export default function ProductLoading() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-10 p-4 sm:p-8">
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-4 h-8 w-40" />
          <Skeleton className="h-11 w-full sm:w-48" />
        </div>
      </div>
    </div>
  );
}
