import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContentSubNav } from "@/components/admin/content-sub-nav";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listFaqsForAdmin } from "@/server/services/admin/faqs";
import { FaqList } from "./_components/faq-list";

export const metadata: Metadata = { title: "FAQs — Admin — City Computer Systems" };

export default async function AdminFaqsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "faq:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/faqs");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const faqs = await listFaqsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <ContentSubNav active="faqs" />
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">FAQs</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Shown at citycomputer.com.np/faq.
        </p>
      </div>
      <FaqList faqs={faqs} />
    </div>
  );
}
