import Link from "next/link";
import { BookOpen } from "lucide-react";

/**
 * "Learn more" — docs/09-ADMIN-DAD-MODE.md §10's in-product help table:
 * "Links to `/admin/help/{topic}`... rendered in-app." A plain link, not
 * a popover — unlike `HelpBubble` (a short inline example), this always
 * points at a full article.
 */
export function LearnMoreLink({ slug, label = "Learn more" }: { slug: string; label?: string }) {
  return (
    <Link
      href={`/admin/help/${slug}`}
      className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:underline"
    >
      <BookOpen className="size-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
