import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { db } from "@/server/db";
import { NewTicketForm } from "../_components/new-ticket-form";

export const metadata: Metadata = { title: "New repair job — Admin — City Computer Systems" };

export default async function NewServiceTicketPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "service-ticket:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/service/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const branches = await db.branch.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">New repair job</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Fill this in while the customer is with you — it takes about a minute.
        </p>
      </div>
      <NewTicketForm branches={branches} />
    </div>
  );
}
