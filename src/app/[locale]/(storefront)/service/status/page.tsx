import type { Metadata } from "next";
import { StatusLookupForm } from "./_components/status-lookup-form";

export const metadata: Metadata = {
  title: "Check repair status — City Computer Systems",
  robots: { index: false },
};

interface ServiceStatusPageProps {
  searchParams: Promise<{ ticketNumber?: string }>;
}

/** `/service/status` — docs/02's route table. `robots: index: false`, same as `/order/[orderNumber]`, since this is a private lookup tool, not indexable content. */
export default async function ServiceStatusPage({ searchParams }: ServiceStatusPageProps) {
  const { ticketNumber } = await searchParams;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Check repair status</h1>
        <p className="text-body-md text-on-surface-variant">
          Enter your ticket number and the last 4 digits of the phone number you booked with.
        </p>
      </div>
      <StatusLookupForm initialTicketNumber={ticketNumber} />
    </div>
  );
}
