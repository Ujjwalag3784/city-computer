import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listMediaForAdmin } from "@/server/services/admin/media";
import { MediaUploadZone } from "./_components/media-upload-zone";
import { MediaGrid } from "./_components/media-grid";

export const metadata: Metadata = {
  title: "Photos — Admin — City Computer Systems",
};

/**
 * `/admin/media` — docs/09-ADMIN-DAD-MODE.md §3's "Photos" module (OWNER,
 * MANAGER, CONTENT_EDITOR — all three, and only those three, hold
 * `media:write`, per `prisma/seed/core.ts`). No search/filter in this
 * pass — see `server/services/admin/media.ts`'s own doc comment for the
 * fuller list of what Phase 5f still doesn't cover (server-side
 * derivatives, real vision-based alt text).
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "media:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/media");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
  const { items, hasNext } = await listMediaForAdmin(page);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Photos</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Every photo you&rsquo;ve uploaded, in one place. Add photos to a product from its own page
          — upload them here first if you want to prepare them ahead of time.
        </p>
      </div>

      <MediaUploadZone />
      <MediaGrid items={items} />

      <div className="flex items-center justify-end gap-2">
        {page > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/media?page=${page - 1}`}>Previous</Link>
          </Button>
        )}
        {hasNext && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/media?page=${page + 1}`}>Next</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
