import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listAuthorsForAdmin } from "@/server/services/admin/blog";
import { PostForm, EMPTY_POST_FORM } from "../_components/post-form";

export const metadata: Metadata = { title: "Write a post — Admin — City Computer Systems" };

export default async function NewPostPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "post:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/blog/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const authors = await listAuthorsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Write a post</h1>
      </div>
      <PostForm
        initialValues={EMPTY_POST_FORM}
        authors={authors.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
