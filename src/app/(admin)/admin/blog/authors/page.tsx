import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listAuthorsForAdmin } from "@/server/services/admin/blog";
import { AuthorList } from "./_components/author-list";

export const metadata: Metadata = { title: "Authors — Admin — City Computer Systems" };

/** `/admin/blog/authors` — a minimal name+bio directory (docs/17 Phase 10: "Blog with categories, authors..."). No `userId`-linking UI yet — see PROGRESS.md. */
export default async function AuthorsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "post:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/blog/authors");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const authors = await listAuthorsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Authors</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          The bylines that can be picked when writing a blog post.
        </p>
      </div>
      <AuthorList authors={authors} />
    </div>
  );
}
