import type { Metadata } from "next";
import { ContactForm } from "./_components/contact-form";

export const metadata: Metadata = {
  title: "Contact us — City Computer Systems",
  description: "Get in touch with City Computer Systems, New Road, Kathmandu.",
};

/** `/contact` — docs/02's route table: "RSC + Server Action." Creates a real `Enquiry` (Phase 9's admin inbox), not a mailto link. */
export default function ContactPage() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Contact us</h1>
        <p className="text-body-md text-on-surface-variant">
          Send us a message and our team will get back to you.
        </p>
      </div>
      <ContactForm />
    </div>
  );
}
