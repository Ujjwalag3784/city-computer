import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { adminReviewListQuerySchema } from "@/lib/validation/admin/reviews";
import { listReviewsForAdmin } from "@/server/services/admin/reviews";
import { ReviewRow } from "./_components/review-row";

export const metadata: Metadata = { title: "Reviews — Admin — City Computer Systems" };

const REVIEW_FILTER_OPTIONS = [
  { value: "needs-approval", label: "Needs approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/**
 * `/admin/reviews` — docs/09-ADMIN-DAD-MODE.md §3 ("Reviews" — OWNER,
 * MANAGER) and docs/13 §5's review-spam moderation queue. Defaults to
 * "Needs approval" rather than "All" — the whole point of a moderation
 * queue is to empty it, and that's the view that should greet you.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "review:moderate");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/reviews");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminReviewListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listReviewsForAdmin(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Reviews</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          New reviews wait here before they show up on the website. Approve the good ones, reject
          spam, and reply to anything that needs a public response.
        </p>
      </div>

      <AdminSearchBox
        initialValue={query.q ?? ""}
        placeholder="Search product, name, or review text..."
      />
      <AdminFilterChips
        options={REVIEW_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/reviews"
        defaultValue="needs-approval"
        q={query.q}
      />

      {result.items.length === 0 ? (
        <p className="py-12 text-center text-body-lg text-on-surface-variant">
          {query.filter === "needs-approval"
            ? "Nothing waiting for approval right now."
            : "No reviews match this view."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.items.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} review{result.total === 1 ? "" : "s"}
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
  if (query.filter !== "needs-approval") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/reviews?${params.toString()}`;
}
