import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableStatic, type DataTableColumn } from "@/components/admin/data-table-static";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { ContentSubNav } from "@/components/admin/content-sub-nav";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { adminPostListQuerySchema } from "@/lib/validation/admin/blog";
import { listPostsForAdmin, type AdminPostListItem } from "@/server/services/admin/blog";

export const metadata: Metadata = { title: "Blog — Admin — City Computer Systems" };

const POST_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "archived", label: "Archived" },
];

const STATUS_BADGE: Record<string, "success" | "glass" | "warning"> = {
  PUBLISHED: "success",
  DRAFT: "glass",
  SCHEDULED: "warning",
  ARCHIVED: "glass",
};

/** `/admin/blog` — docs/17 Phase 10: "Blog with categories, authors, Tiptap editor... related products." Same list-page shape as `admin/coupons`. */
export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "post:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/blog");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminPostListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listPostsForAdmin(query);

  const columns: DataTableColumn<AdminPostListItem>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <Link
          href={`/admin/blog/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    { key: "author", header: "Author", render: (row) => row.authorName },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge variant={STATUS_BADGE[row.status] ?? "glass"}>{row.status}</Badge>,
    },
    {
      key: "published",
      header: "Published",
      render: (row) => (row.publishedAt ? row.publishedAt.toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ContentSubNav active="blog" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Blog</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Buying guides and articles. Published posts show up at /blog for anyone to read.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">Write a post</Link>
        </Button>
      </div>

      <AdminSearchBox initialValue={query.q ?? ""} placeholder="Search title or URL slug..." />
      <AdminFilterChips
        options={POST_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/blog"
        q={query.q}
      />

      <DataTableStatic
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No posts yet. Write your first one to get started."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} post{result.total === 1 ? "" : "s"}
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

function pageHref(query: { q?: string; filter: string }, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.filter !== "all") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/blog?${params.toString()}`;
}
