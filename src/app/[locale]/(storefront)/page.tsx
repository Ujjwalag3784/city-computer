import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * The real homepage route (`/`, or `/ne` for Nepali) — replaces the old
 * bare `src/app/page.tsx` Phase 2 checkpoint (deleted; its job of proving
 * the theme/primitives/layout components render was done, and is now
 * superseded by every other page under this route tree doing the same).
 *
 * Deliberately a minimal placeholder, not yet the real
 * `HomeSection`-driven page docs/17's Phase 4 deliverables call for
 * ("Home page with typed `HomeSection` blocks") — that needs
 * `server/services/content/` (a content service reading the
 * `HomeSection` model) which doesn't exist yet. This page exists to prove
 * the i18n routing/middleware/provider chain built in this pass actually
 * works end to end (locale resolution, translated strings rendering,
 * `Link` navigation) before building real data-driven sections on top of
 * it — the next piece of Phase 4 work.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: `${t("featuredProducts")} — City Computer`,
  };
}

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 p-8">
      <h1 className="text-headline-lg text-on-surface">{t("shopByCategory")}</h1>

      <p className="text-body-lg text-on-surface-variant">
        The real homepage (hero slider, category bento, featured product carousel — every typed{" "}
        <code className="text-label-mono-xs">HomeSection</code> block per docs/06
        &sect;&ldquo;Content&rdquo;) lands once the catalog and content service layers exist. This
        placeholder confirms locale routing, translated strings, and the storefront layout all
        render correctly together.
      </p>
    </div>
  );
}
