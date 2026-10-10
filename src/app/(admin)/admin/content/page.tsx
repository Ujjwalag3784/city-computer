import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  BadgePercent,
  FileText,
  FolderTree,
  HelpCircle,
  Images,
  Megaphone,
  Menu,
  Newspaper,
  Star,
  Tags,
} from "lucide-react";
import { HubLinkGrid, type HubLink } from "@/components/admin/hub-link-grid";
import { auth } from "@/server/auth";
import { permissionSetHas } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Content — Admin — City Computer Systems" };

type GatedLink = HubLink & { permission: string };

const SHOP_LINKS: GatedLink[] = [
  {
    href: "/admin/categories",
    title: "Categories",
    description: "The departments products are sorted into: Laptops, Monitors, and so on.",
    icon: <FolderTree />,
    permission: "category:write",
  },
  {
    href: "/admin/brands",
    title: "Brands",
    description: "Add a new brand before adding its first product.",
    icon: <Tags />,
    permission: "brand:write",
  },
  {
    href: "/admin/coupons",
    title: "Discount codes",
    description: "Codes customers type at checkout for money off.",
    icon: <BadgePercent />,
    permission: "coupon:write",
  },
  {
    href: "/admin/campaigns",
    title: "Offers & banners",
    description: "Automatic discounts that apply without a code.",
    icon: <Megaphone />,
    permission: "promotion:write",
  },
  {
    href: "/admin/reviews",
    title: "Customer reviews",
    description: "Approve or hide what customers write about products.",
    icon: <Star />,
    permission: "review:moderate",
  },
];

const WEBSITE_LINKS: GatedLink[] = [
  {
    href: "/admin/media",
    title: "Photo library",
    description: "Every photo uploaded to the website.",
    icon: <Images />,
    permission: "media:write",
  },
  {
    href: "/admin/blog",
    title: "Blog",
    description: "Buying guides and news posts.",
    icon: <Newspaper />,
    permission: "post:write",
  },
  {
    href: "/admin/pages",
    title: "Pages",
    description: "About us, warranty policy, and other information pages.",
    icon: <FileText />,
    permission: "page:write",
  },
  {
    href: "/admin/faqs",
    title: "Questions & answers",
    description: "The FAQ page customers read before calling.",
    icon: <HelpCircle />,
    permission: "faq:write",
  },
  {
    href: "/admin/menus",
    title: "Website menus",
    description: "The links across the top and bottom of the website.",
    icon: <Menu />,
    permission: "menu:write",
  },
];

/**
 * `/admin/content` — the sidebar's "Content" row. Before this page existed
 * the row went straight to the blog and nothing linked to categories,
 * brands, discount codes, reviews, the photo library, pages, FAQs or menus.
 * Tiles are filtered by the same permission each destination page checks.
 */
export default async function AdminContentPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?callbackUrl=/admin/content");
  const keys = session.user.permissionKeys;
  const allowed = (links: GatedLink[]) =>
    links.filter((link) => permissionSetHas(keys, link.permission));

  const shop = allowed(SHOP_LINKS);
  const website = allowed(WEBSITE_LINKS);
  if (shop.length === 0 && website.length === 0) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Content</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Everything on the website that isn&rsquo;t a product or an order.
        </p>
      </div>
      <HubLinkGrid title="Shop" links={shop} />
      <HubLinkGrid title="Website" links={website} />
    </div>
  );
}
