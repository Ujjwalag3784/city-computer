import type { Metadata } from "next";
import { listActiveBranches } from "@/server/services/content/stores";
import { BookingForm } from "./_components/booking-form";

export const metadata: Metadata = {
  title: "Book a repair — City Computer Systems",
  description:
    "Book a repair drop-off online and get a ticket number to track your device's progress.",
};

/** `/service/book` — docs/02's route table + journey 4.5. Server Component fetches the active-branch list for the form's selector; the booking itself happens via `bookServiceTicketAction`. */
export default async function ServiceBookPage() {
  const branches = await listActiveBranches();

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Book a repair</h1>
        <p className="text-body-md text-on-surface-variant">
          Tell us about your device and pick a branch to bring it to. We&apos;ll give you a ticket
          number you can use to check progress at any time.
        </p>
      </div>
      <BookingForm branches={branches.map((b) => ({ slug: b.slug, name: b.name }))} />
    </div>
  );
}
