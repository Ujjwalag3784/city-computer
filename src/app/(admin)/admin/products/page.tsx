import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableStatic, type DataTableColumn } from "@/components/admin/data-table-static";
import { auth } from "@/server/auth";
import { permissionSetHas, requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { productListQuerySchema, type ProductListQuery } from "@/lib/validation/admin/product";
import { listProductsForAdmin, type AdminProductListItem } from "@/server/services/admin/product";
import { ProductSearchBox } from "./_components/product-search-box";
import { FilterChips } from "./_components/filter-chips";
import { InlinePriceCell } from "./_components/inline-price-cell";
import { InlineStockCell } from "./_components/inline-stock-cell";

export const metadata: Metadata = {
  title: "Products — Admin — City Computer Systems",
};

function pageHref(query: ProductListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.filter !== "all") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/products?${params.toString()}`;
}

function ProductThumb({ url }: { url: string | null }) {
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-high">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN/S3 host is environment-configured (env.NEXT_PUBLIC_CDN_URL), not a fixed domain next/image's remotePatterns can be set to ahead of time.
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-5 text-on-surface-variant" aria-hidden="true" />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminProductListItem["status"] }) {
  return (
    <Badge variant={status === "ACTIVE" ? "success" : "glass"} className="shrink-0">
      {status === "ACTIVE" ? "Live" : "Not published yet"}
    </Badge>
  );
}

/**
 * `/admin/products` — docs/09-ADMIN-DAD-MODE.md §5.2 "Product list".
 * Search (`ProductSearchBox`) and the filter chips (`FilterChips`) both
 * drive plain URL query params rather than client state, so the whole
 * page — including which rows show — is server-rendered from
 * `listProductsForAdmin` on every navigation; only the two inline
 * quick-edit cells are client islands.
 *
 * Bulk select/actions (docs/09 §5.2's "Bulk select -> change price by %,
 * change category, publish, hide, export") are NOT built in this pass —
 * out of this session's stated scope ("inline price & stock quick-editing"
 * only) — which is also why this page renders the server-side
 * `DataTableStatic` rather than the interactive `DataTable`: it needs
 * neither row selection nor click-to-sort.
 * `product:view`-only roles (STAFF) still see this whole page — the
 * per-cell `canEditPrice`/`canEditStock` checks are what actually
 * enforces "STAFF ... no price edit" (docs/09 §3), not a page-level gate.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "product:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/products");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = productListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listProductsForAdmin(query);
  const permissionKeys = session!.user.permissionKeys;
  const canCreate = permissionSetHas(permissionKeys, "product:create");
  const canEditPrice = permissionSetHas(permissionKeys, "price:update");
  const canEditStock = permissionSetHas(permissionKeys, "stock:update");

  const emptyMessage = canCreate
    ? "You haven't added any products yet. Adding a product takes about 3 minutes."
    : "No products yet.";

  const columns: DataTableColumn<AdminProductListItem>[] = [
    {
      key: "photo",
      header: "Photo",
      render: (row) => <ProductThumb url={row.photoUrl} />,
    },
    {
      key: "name",
      header: "Product",
      render: (row) => (
        <Link href={`/admin/products/${row.id}/edit`} className="flex flex-col hover:underline">
          <span className="font-medium text-on-surface">{row.name}</span>
          <span className="text-body-sm text-on-surface-variant">{row.brandName}</span>
        </Link>
      ),
    },
    { key: "category", header: "Category", render: (row) => row.categoryName },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (row) => (
        <InlinePriceCell
          variantId={row.variantId}
          pricePaisa={row.pricePaisa}
          compareAtPricePaisa={row.compareAtPricePaisa}
          canEditPrice={canEditPrice}
        />
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) => (
        <InlineStockCell
          variantId={row.variantId}
          quantity={row.stockQuantity}
          canEditStock={canEditStock}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Link
          href={`/admin/products/${row.id}/edit`}
          className="text-body-sm text-primary-container underline"
        >
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Products</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            This is where you add and change the products on your website. Customers see everything
            marked &ldquo;Live&rdquo;.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus />
              Add a product
            </Link>
          </Button>
        )}
      </div>

      <ProductSearchBox initialValue={query.q ?? ""} />
      <FilterChips active={query.filter} q={query.q} />

      {/* Phones: one card per product instead of a sideways-scrolling table. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {result.items.length === 0 && (
          <li className="rounded-lg border border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
            {emptyMessage}
          </li>
        )}
        {result.items.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3"
          >
            <Link href={`/admin/products/${row.id}/edit`} className="flex items-start gap-3">
              <ProductThumb url={row.photoUrl} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium leading-snug text-on-surface">{row.name}</span>
                <span className="text-body-sm text-on-surface-variant">
                  {row.brandName} · {row.categoryName}
                </span>
              </span>
              <StatusBadge status={row.status} />
            </Link>
            <div className="flex items-center justify-between gap-4 border-t border-outline-variant pt-3">
              <InlinePriceCell
                variantId={row.variantId}
                pricePaisa={row.pricePaisa}
                compareAtPricePaisa={row.compareAtPricePaisa}
                canEditPrice={canEditPrice}
              />
              <div className="w-36">
                <InlineStockCell
                  variantId={row.variantId}
                  quantity={row.stockQuantity}
                  canEditStock={canEditStock}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <DataTableStatic
          columns={columns}
          rows={result.items}
          getRowId={(row) => row.id}
          emptyMessage={emptyMessage}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} product{result.total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          {query.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(query, query.page - 1)}>Previous</Link>
            </Button>
          )}
          {result.hasNext && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(query, query.page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
