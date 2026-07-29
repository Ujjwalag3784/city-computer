import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminHelpArticle, ADMIN_HELP_ARTICLES } from "@/content/admin-help";

interface HelpArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: HelpArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getAdminHelpArticle(slug);
  return { title: `${article?.title ?? "Help"} — Admin — City Computer Systems` };
}

export function generateStaticParams() {
  return ADMIN_HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

/** `/admin/help/[slug]` — see `(admin)/admin/help/page.tsx`'s own doc comment on why this route has no extra permission check beyond the layout's admin-session gate. */
export default async function AdminHelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = getAdminHelpArticle(slug);
  if (!article) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/admin/help"
        className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All help articles
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">{article.title}</h1>
        <p className="text-body-md text-on-surface-variant">{article.summary}</p>
      </div>

      <div className="flex flex-col gap-5">
        {article.sections.map((section, index) => (
          <div key={index} className="flex flex-col gap-2">
            {section.heading && (
              <h2 className="text-body-lg font-medium text-on-surface">{section.heading}</h2>
            )}
            {section.paragraphs?.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="text-body-md text-on-surface-variant">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="ml-5 flex list-disc flex-col gap-1.5">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex} className="text-body-md text-on-surface-variant">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
