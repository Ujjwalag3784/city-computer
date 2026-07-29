import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ContentSubNavProps {
  active: "blog" | "pages" | "menus" | "faqs";
}

const TABS: { key: ContentSubNavProps["active"]; label: string; href: string }[] = [
  { key: "blog", label: "Blog", href: "/admin/blog" },
  { key: "pages", label: "Pages", href: "/admin/pages" },
  { key: "menus", label: "Menus", href: "/admin/menus" },
  { key: "faqs", label: "FAQs", href: "/admin/faqs" },
];

/**
 * A small shared tab strip across the "Content" nav row's four sibling
 * screens (Blog/Pages/Menus/FAQs — `(admin)/_lib/nav.ts`'s single
 * `content` row fans out to all four). Promoted straight to
 * `components/admin/` rather than route-private, since it has four
 * consumers from the moment it's introduced — past this codebase's own
 * "promote on second consumer" bar already.
 */
export function ContentSubNav({ active }: ContentSubNavProps) {
  return (
    <nav className="flex gap-2 border-b border-glass-stroke pb-2" aria-label="Content sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-t-lg px-3 py-2 text-body-sm font-medium transition-colors",
            tab.key === active
              ? "border-b-2 border-primary text-on-surface"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
