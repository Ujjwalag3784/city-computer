import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { PageForm, EMPTY_PAGE_FORM } from "../_components/page-form";

export const metadata: Metadata = { title: "Add a page — Admin — City Computer Systems" };

export default async function NewPagePage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "page:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/pages/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-md text-on-surface">Add a page</h1>
      <PageForm initialValues={EMPTY_PAGE_FORM} />
    </div>
  );
}
