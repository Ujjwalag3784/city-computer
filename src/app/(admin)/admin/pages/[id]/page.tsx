import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError, NotFoundError } from "@/lib/errors";
import { getPageForAdmin } from "@/server/services/admin/pages";
import { PageForm, type PageFormValues } from "../_components/page-form";

export const metadata: Metadata = { title: "Edit page — Admin — City Computer Systems" };

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "page:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/pages/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let page;
  try {
    page = await getPageForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const initialValues: PageFormValues = {
    title: page.title,
    slug: page.slug,
    content: page.content,
    template: page.template as PageFormValues["template"],
    status: page.status as PageFormValues["status"],
    metaTitle: page.metaTitle ?? "",
    metaDescription: page.metaDescription ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-md text-on-surface">Edit page</h1>
      <PageForm pageId={id} initialValues={initialValues} />
    </div>
  );
}
