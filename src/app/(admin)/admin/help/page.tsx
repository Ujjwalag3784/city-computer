import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ADMIN_HELP_ARTICLES } from "@/content/admin-help";

export const metadata: Metadata = { title: "Help — Admin — City Computer Systems" };

/**
 * `/admin/help` — docs/09-ADMIN-DAD-MODE.md §3's "Help" nav item, "always
 * visible" at the bottom of the sidebar (`admin-sidebar.tsx`'s
 * `HELP_ITEM`, wired since Phase 2 but pointing at a route that never
 * existed until now). No permission check of its own: `(admin)/layout.tsx`
 * already gates every `/admin/*` route to a signed-in admin session
 * (`requireAdminSession`) before this page ever renders, and help content
 * itself isn't tied to any one capability — every role that can reach the
 * admin at all should be able to reach Help, same as the Today page's own
 * no-extra-check pattern.
 */
export default function AdminHelpIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Help</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Short guides for the things you&apos;ll do most often.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_HELP_ARTICLES.map((article) => (
          <Link key={article.slug} href={`/admin/help/${article.slug}`}>
            <Card
              variant="surface"
              className="h-full transition-colors hover:border-primary-container"
            >
              <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
                <p className="text-body-lg font-medium text-on-surface">{article.title}</p>
                <p className="text-body-sm text-on-surface-variant">{article.summary}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
