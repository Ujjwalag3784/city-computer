import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { adminEnquiryListQuerySchema } from "@/lib/validation/admin/enquiries";
import { listEnquiriesForAdmin } from "@/server/services/admin/enquiries";
import { EnquiryRow } from "./_components/enquiry-row";

export const metadata: Metadata = { title: "Messages — Admin — City Computer Systems" };

const ENQUIRY_FILTER_OPTIONS = [
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

/** `/admin/enquiries` — docs/09-ADMIN-DAD-MODE.md §3 ("Messages" — OWNER, MANAGER, SUPPORT). See `admin/enquiries.ts`'s doc comment for why "reply" here is a status flip plus tel:/mailto: links, not a stored transcript. */
export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "enquiry:reply");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/enquiries");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminEnquiryListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listEnquiriesForAdmin(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Messages</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Questions customers sent through the website. Call or email them back, then mark it
          replied.
        </p>
      </div>

      <AdminSearchBox
        initialValue={query.q ?? ""}
        placeholder="Search name, email, phone, or message..."
      />
      <AdminFilterChips
        options={ENQUIRY_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/enquiries"
        defaultValue="unread"
        q={query.q}
      />

      {result.items.length === 0 ? (
        <p className="py-12 text-center text-body-lg text-on-surface-variant">
          {query.filter === "unread"
            ? "No unread messages right now."
            : "No messages match this view."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {result.items.map((enquiry) => (
            <EnquiryRow key={enquiry.id} enquiry={enquiry} />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} message{result.total === 1 ? "" : "s"}
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
  if (query.filter !== "unread") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/enquiries?${params.toString()}`;
}
