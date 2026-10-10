import { BrandMark } from "@/components/layout/brand-mark";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";

/** Shown to customers while Admin → Settings → Maintenance mode is on. */
export function MaintenancePage({
  whatsappE164,
  phoneE164,
}: {
  whatsappE164: string;
  phoneE164: string;
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-16 text-center"
    >
      <BrandMark />
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="font-display text-headline-md text-on-surface">We&rsquo;ll be back soon</h1>
        <p className="text-body-md text-on-surface-variant">
          We&rsquo;re updating the website. Our New Road showroom is open as usual, and you can
          reach us any time on WhatsApp or by phone.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={`https://wa.me/${whatsappE164.replace(/[^\d]/g, "")}`}
          className="rounded-md bg-primary px-5 py-3 text-body-md font-medium text-on-primary"
        >
          WhatsApp {formatNepalPhoneForDisplay(whatsappE164)}
        </a>
        <a
          href={`tel:${phoneE164}`}
          className="rounded-md border border-outline-variant px-5 py-3 text-body-md text-on-surface"
        >
          Call {formatNepalPhoneForDisplay(phoneE164)}
        </a>
      </div>
    </main>
  );
}
