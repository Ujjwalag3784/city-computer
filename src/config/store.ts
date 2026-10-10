/**
 * The shop's public contact details, shared by the header's utility strip
 * and the footer so they can never disagree. Moved here unchanged from
 * `site-footer.tsx`, where they were first set.
 */
export const STORE_WHATSAPP_E164 = "+9779741661095";
/**
 * Empty until the owner sets a public shop email under Admin → Settings →
 * Shop details (the footer hides the row while it's empty). It used to be
 * the developer's personal address.
 */
export const STORE_EMAIL = "";
export const STORE_ADDRESS_LABEL = "New Road, Kathmandu";

/**
 * The shop's real Google Maps share link (provided directly), plus an
 * embed URL built from a text query (no API key needed).
 */
export const STORE_MAPS_SHARE_URL = "https://share.google/QWyBLoc2x6WksRaAN";
export const STORE_MAPS_EMBED_SRC =
  "https://www.google.com/maps?q=City+Computer+Systems,+New+Road,+Kathmandu,+Nepal&output=embed";

export const STORE_WHATSAPP_URL = `https://wa.me/${STORE_WHATSAPP_E164.replace("+", "")}`;

/**
 * Printed at the top of every invoice PDF. `panVatNumber` stays empty until
 * the owner confirms it; while it is empty the PDF is titled "INVOICE"
 * rather than "TAX INVOICE", since a Nepali tax invoice must show the
 * seller's PAN/VAT number.
 */
export const STORE_INVOICE_DETAILS = {
  legalName: "City Computer Systems",
  address: STORE_ADDRESS_LABEL + ", Nepal",
  panVatNumber: "",
} as const;
