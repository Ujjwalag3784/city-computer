/**
 * Content seed: the eight policy pages listed in docs/06-DATA-MODEL.md §8,
 * plus the standard Menu/MenuItem set (HEADER, FOOTER_COMPANY,
 * FOOTER_CATEGORIES, MOBILE).
 *
 * Copy below is real, Nepal-retail-appropriate placeholder text — not
 * lorem ipsum — written to be genuinely publishable as a first draft, but
 * it has not been reviewed by anyone with legal authority to approve a
 * privacy policy or terms of service. Treat as a starting point requiring
 * sign-off before go-live, per docs/06 §13.2 step 3's spirit ("owner
 * sign-off") even though that step is about the taxonomy, not policy text.
 */
import { db } from "@/server/db/seed-client";

function tiptapDoc(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

interface PageInput {
  slug: string;
  title: string;
  template: "DEFAULT" | "POLICY";
  paragraphs: string[];
  metaDescription: string;
}

// Slugs are hand-typed literals, not `slugify(title)` — docs/06-DATA-MODEL.md
// §8 names the exact required slugs ("shipping-policy" etc.), and at least
// one title chosen for readability ("Delivery") would slugify to something
// else entirely ("delivery") if derived automatically. Every other seed
// file in this directory derives slugs from names via src/lib/slug.ts;
// this file is the deliberate exception, because the identifiers here are
// fixed contract, not freely-chosen display names.
const PAGES: PageInput[] = [
  {
    slug: "about",
    title: "About City Computer",
    template: "DEFAULT",
    metaDescription:
      "City Computer Systems has been selling and repairing computers in Kathmandu since we opened our doors at New Road.",
    paragraphs: [
      "City Computer Systems started as a small computer shop in New Road, Kathmandu, and has grown into one of the city's trusted names for laptops, desktops, components, and PC repairs.",
      "We believe buying a computer in Nepal should be as straightforward as buying one anywhere else — clear prices, honest advice, and support that doesn't disappear after you've paid. Every product we sell comes with the manufacturer's official warranty, and our own repair technicians are on hand at our New Road store if anything goes wrong.",
      "Whether you're a student looking for your first laptop, a gamer building a new PC, or a business fitting out an office, our team is happy to talk through what actually suits your needs and budget — in person, over the phone, or here on the website.",
    ],
  },
  {
    slug: "contact",
    title: "Contact us",
    template: "DEFAULT",
    metaDescription:
      "Visit City Computer at New Road, Kathmandu, or reach us by phone, email, or WhatsApp.",
    paragraphs: [
      "Our store is at Ganga Path, New Road, Kathmandu, open Sunday to Friday, 10am to 7pm. We're closed on Saturdays.",
      "Call us on +977-1-4123456, WhatsApp us on +977 9841-000000, or email support@citycomputer.com.np. For product questions, the fastest way to get an answer is usually WhatsApp — send us a photo of what you're looking at and we'll tell you honestly whether it's a good fit.",
      "For repairs, you're welcome to walk in with your device, or book a repair online first so we know to expect you.",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    template: "POLICY",
    metaDescription: "How City Computer collects, uses, and protects your personal information.",
    paragraphs: [
      "This policy explains what information City Computer Systems ('we', 'us') collects when you use citycomputer.com.np, and what we do with it.",
      "We collect the information you give us directly — your name, phone number, email, and delivery address when you place an order or book a repair — and some information collected automatically, like the pages you visit and the device you're browsing from, which helps us keep the site working well and secure.",
      "We use this information to process your orders, keep you updated on delivery and repair status, respond to your questions, and — only if you've opted in — send you occasional offers by email or SMS. We do not sell your personal information to anyone.",
      "We share order details with the delivery partners and payment providers (eSewa, Khalti, banks) needed to actually get your order to you and confirm payment. We keep order records for as long as Nepali tax law requires, and you can ask us to delete other personal information at any time by emailing support@citycomputer.com.np.",
      "If you have questions about this policy or want to see what information we hold about you, contact us using the details on our Contact page.",
    ],
  },
  {
    slug: "terms-conditions",
    title: "Terms & Conditions",
    template: "POLICY",
    metaDescription:
      "The terms that apply when you buy from City Computer, online or in our New Road store.",
    paragraphs: [
      "By placing an order with City Computer Systems, either on this website or in our New Road store, you agree to these terms.",
      "Prices on this website are shown in Nepali Rupees and, unless stated otherwise, already include VAT. We reserve the right to correct a listed price if it was published in error, and we'll always contact you before charging a corrected amount — we will never silently charge more than the price you agreed to.",
      "Stock levels shown on the website reflect what we believe is available at the time, but on rare occasions an item may sell out before your order is confirmed. If that happens, we'll offer a full refund or a suitable alternative — we won't leave you waiting indefinitely for something we can't deliver.",
      "All products are covered by the manufacturer's official warranty stated on the product page, honoured either directly by the manufacturer's Nepal service centre or, for many products, by our own technicians at New Road.",
      "We reserve the right to refuse an order — for example, where we suspect fraud, or where Cash on Delivery has been repeatedly refused on previous orders from the same customer.",
    ],
  },
  {
    slug: "refund-returns",
    title: "Refunds & Returns",
    template: "POLICY",
    metaDescription:
      "Our policy for returning a product or requesting a refund from City Computer.",
    paragraphs: [
      "If a product arrives faulty or not as described, tell us within 7 days of delivery and we will arrange a replacement, repair, or refund at no cost to you.",
      "For a genuine change of mind (not a fault), unopened products in their original packaging can be returned within 7 days of delivery for a refund, minus the cost of return delivery. Opened software, and components that have already been installed, cannot be returned for change-of-mind reasons once installed, as we cannot resell them as new.",
      "Refunds are made using the same method you paid with wherever possible. eSewa, Khalti, Fonepay, and connectIPS do not currently offer us a way to refund automatically through their systems, so most refunds are processed as a bank transfer to an account you provide — we'll ask for your bank details once your refund is approved, and it will typically reach you within 5 working days.",
      "To start a return or refund, contact us on WhatsApp or by phone with your order number, and we'll guide you through the next steps.",
    ],
  },
  {
    slug: "shipping-policy",
    title: "Delivery",
    template: "POLICY",
    metaDescription:
      "Delivery costs and timelines for orders inside and outside the Kathmandu Valley.",
    paragraphs: [
      "We deliver across Nepal. Delivery inside the Kathmandu Valley (Kathmandu, Lalitpur, and Bhaktapur districts) costs रु 150 and typically arrives within 1-2 days of your order being confirmed.",
      "Delivery outside the valley costs रु 350 and typically takes 2-5 days depending on your district, using a trusted courier partner.",
      "You can also choose free pickup from our New Road store — just select 'Pickup' at checkout and we'll message you once your order is ready to collect.",
      "We'll keep you updated by SMS or WhatsApp at each step, from confirmation through to delivery, and every order can be tracked from the Track Order page using your order number.",
    ],
  },
  {
    slug: "warranty",
    title: "Warranty",
    template: "POLICY",
    metaDescription: "How manufacturer warranty and City Computer's own repair support works.",
    paragraphs: [
      "Every product we sell includes the official manufacturer warranty stated on its product page — usually 1 to 3 years depending on the brand and product type.",
      "For most laptop, desktop, and component brands, warranty claims can be handled directly at our New Road store — bring the product along with your invoice (we can also look up your order by phone number if you've lost it), and we'll either repair it ourselves or forward it to the manufacturer's service centre, whichever is faster.",
      "Warranty does not cover accidental damage, liquid damage, or issues caused by unauthorised repair attempts. For anything outside warranty, our repair team can still help — see our Repairs page for a paid quote.",
    ],
  },
  {
    slug: "emi",
    title: "EMI — Buy Now, Pay Monthly",
    template: "DEFAULT",
    metaDescription:
      "Estimate monthly instalments for laptops, desktops, and other purchases at City Computer.",
    paragraphs: [
      "Selected banks and finance partners in Nepal offer EMI (Equal Monthly Instalment) plans on qualifying purchases at City Computer, letting you spread the cost of a laptop, desktop, or larger order over several months.",
      "Use our EMI calculator to get an estimate of your monthly payment based on the purchase price, down payment, and tenure — the exact rate and approval depend on your bank's own terms, and our staff can point you to which of our partner banks currently offer EMI when you visit or call.",
      "EMI is arranged directly with your bank at the time of purchase; City Computer does not charge any additional fee for choosing to pay this way.",
    ],
  },
];

export async function seedContent() {
  await seedPages();
  await seedMenus();
}

async function seedPages() {
  for (const page of PAGES) {
    await db.page.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        content: tiptapDoc(page.paragraphs),
        template: page.template,
        status: "PUBLISHED",
        metaTitle: `${page.title} | City Computer`,
        metaDescription: page.metaDescription,
      },
      update: {
        title: page.title,
        content: tiptapDoc(page.paragraphs),
        metaDescription: page.metaDescription,
      },
    });
  }
}

async function upsertMenu(
  key: "HEADER" | "FOOTER_COMPANY" | "FOOTER_CATEGORIES" | "MOBILE",
  name: string,
) {
  return db.menu.upsert({ where: { key }, create: { key, name }, update: { name } });
}

async function addMenuItem(
  menuId: string,
  position: number,
  input: { label: string; url?: string; categorySlug?: string; pageSlug?: string },
) {
  const categoryId = input.categorySlug
    ? (await db.category.findUnique({ where: { slug: input.categorySlug } }))?.id
    : undefined;
  const pageId = input.pageSlug
    ? (await db.page.findUnique({ where: { slug: input.pageSlug } }))?.id
    : undefined;

  const existing = await db.menuItem.findFirst({ where: { menuId, label: input.label } });
  const data = {
    menuId,
    label: input.label,
    url: input.url,
    categoryId,
    pageId,
    position,
    isActive: true,
  };
  if (existing) {
    return db.menuItem.update({ where: { id: existing.id }, data });
  }
  return db.menuItem.create({ data });
}

async function seedMenus() {
  const header = await upsertMenu("HEADER", "Header navigation");
  const headerItems = [
    { label: "Laptops", categorySlug: "laptops" },
    { label: "Desktops & Prebuilts", categorySlug: "desktops-prebuilts" },
    { label: "Components", categorySlug: "components" },
    { label: "Monitors", categorySlug: "monitors" },
    { label: "Peripherals", categorySlug: "peripherals" },
    { label: "CCTV & Security", categorySlug: "cctv-security" },
    { label: "PC Builder", url: "/build" },
  ];
  for (const [i, item] of headerItems.entries()) await addMenuItem(header.id, i, item);

  const footerCompany = await upsertMenu("FOOTER_COMPANY", "Footer — company");
  const footerCompanyItems = [
    { label: "About us", pageSlug: "about" },
    { label: "Contact us", pageSlug: "contact" },
    { label: "Warranty", pageSlug: "warranty" },
    { label: "EMI", pageSlug: "emi" },
    { label: "Delivery", pageSlug: "shipping-policy" },
    { label: "Refunds & Returns", pageSlug: "refund-returns" },
    { label: "Terms & Conditions", pageSlug: "terms-conditions" },
    { label: "Privacy Policy", pageSlug: "privacy-policy" },
  ];
  for (const [i, item] of footerCompanyItems.entries())
    await addMenuItem(footerCompany.id, i, item);

  const footerCategories = await upsertMenu("FOOTER_CATEGORIES", "Footer — categories");
  const footerCategoryItems = [
    { label: "Laptops", categorySlug: "laptops" },
    { label: "Desktops & Prebuilts", categorySlug: "desktops-prebuilts" },
    { label: "Components", categorySlug: "components" },
    { label: "Monitors", categorySlug: "monitors" },
    { label: "Networking", categorySlug: "networking" },
    { label: "Printers", categorySlug: "printers" },
    { label: "Accessories", categorySlug: "accessories" },
    { label: "Apple & Mac", categorySlug: "apple-mac" },
  ];
  for (const [i, item] of footerCategoryItems.entries())
    await addMenuItem(footerCategories.id, i, item);

  const mobile = await upsertMenu("MOBILE", "Mobile navigation");
  for (const [i, item] of headerItems.entries()) await addMenuItem(mobile.id, i, item);
}
