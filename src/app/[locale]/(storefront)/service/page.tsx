import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Repairs — City Computer Systems",
  description:
    "Book a repair for your laptop, desktop, or other device, and track its progress online.",
};

/** `/service` — docs/02's route table. Landing page linking to booking + status lookup. */
export default function ServicePage() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Repairs</h1>
        <p className="text-body-md text-on-surface-variant">
          Bring your device in, or book online first so we know to expect you. Track any
          repair&apos;s progress with your ticket number.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/service/book">Book a repair</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/service/status">Check repair status</Link>
        </Button>
      </div>
    </div>
  );
}
