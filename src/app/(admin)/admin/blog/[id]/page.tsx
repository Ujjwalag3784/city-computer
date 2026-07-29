import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError, NotFoundError } from "@/lib/errors";
import { getPostForAdmin, listAuthorsForAdmin } from "@/server/services/admin/blog";
import { PostForm, type PostFormValues } from "../_components/post-form";

export const metadata: Metadata = { title: "Edit post — Admin — City Computer Systems" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "post:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/blog/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let post;
  try {
    post = await getPostForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const authors = await listAuthorsForAdmin();

  const initialValues: PostFormValues = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content,
    authorId: post.authorId,
    status: post.status,
    categorySlugsText: post.categorySlugs.join(", "),
    tagsText: post.tags.join(", "),
    relatedProductSlugsText: post.relatedProductSlugs.join(", "),
    coverMediaId: post.coverMediaId ?? "",
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Edit post</h1>
        {post.readingMinutes && (
          <p className="text-body-sm text-on-surface-variant">
            Estimated reading time: {post.readingMinutes} min (recalculated automatically on save)
          </p>
        )}
      </div>
      <PostForm
        postId={id}
        initialValues={initialValues}
        authors={authors.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
