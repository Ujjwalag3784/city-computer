import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { STORE_MAPS_SHARE_URL } from "@/config/store";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { getStoreSettings, whatsappUrl } from "@/server/services/store-settings";
import { ContactForm } from "./_components/contact-form";

export const metadata: Metadata = {
  title: "Contact us — City Computer Systems",
  description: "Get in touch with City Computer Systems, New Road, Kathmandu.",
};

/** `/contact` — the shop's details (from Admin → Settings → Shop details) and a form that lands in the admin's Messages inbox. */
export default async function ContactPage() {
  const shop = await getStoreSettings();
  const items = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: formatNepalPhoneForDisplay(shop.whatsappE164),
      href: whatsappUrl(shop.whatsappE164),
    },
    ...(shop.phoneE164 !== shop.whatsappE164
      ? [
          {
            icon: Phone,
            label: "Phone",
            value: formatNepalPhoneForDisplay(shop.phoneE164),
            href: `tel:${shop.phoneE164}`,
          },
        ]
      : []),
    ...(shop.email
      ? [{ icon: Mail, label: "Email", value: shop.email, href: `mailto:${shop.email}` }]
      : []),
    {
      icon: MapPin,
      label: "Showroom",
      value: `${shop.address}, Nepal`,
      href: STORE_MAPS_SHARE_URL,
    },
  ];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Contact us</h1>
        <p className="text-body-md text-on-surface-variant">
          Message us on WhatsApp for the quickest reply, visit the showroom, or send a message
          below.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value, href }) => (
          <li key={label}>
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-body-sm text-on-surface-variant">{label}</span>
                <span className="text-body-md font-medium text-on-surface break-all">{value}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <ContactForm />
    </div>
  );
}
