import type { Metadata } from "next";
import { PrimitivesSection } from "./sections/primitives-section";
import { LayoutSection } from "./sections/layout-section";
import { CommerceSection } from "./sections/commerce-section";
import { BuilderSection } from "./sections/builder-section";
import { AdminSection } from "./sections/admin-section";

/**
 * `/design` — the internal component-inventory showcase docs/05-DESIGN-
 * SYSTEM.md §10 calls "a `/_design` route": "a single internal `/_design`
 * route renders every component in every variant and every state, passes
 * axe with zero violations, and contains no hardcoded colour, radius, or
 * font value" — the "definition of done for the design system phase."
 *
 * Naming note: the docs' literal `/_design` name would be unroutable under
 * Next.js App Router's convention that any folder prefixed with `_` is a
 * "private folder," excluded entirely from the route tree (Next.js skips
 * it when building routes, the same way it skips `_lib`/`_components`
 * co-location folders) — a route at `src/app/_design/page.tsx` would 404,
 * not render. This page therefore lives at `src/app/design/page.tsx`
 * (served at `/design`) instead, with `noindex` metadata below standing in
 * for the "internal" intent the underscore was meant to signal. Worth
 * flagging back to whoever owns the docs in case they'd rather rename the
 * spec than the route.
 *
 * Coverage: every primitive in `src/components/ui/` (31 files), every
 * layout component in `src/components/layout/` plus the two layout-shaped
 * pieces of `src/components/admin/` (`AdminSidebar`/`AdminTopBar` — the
 * full `AdminShell` is intentionally excluded, see `layout-section.tsx`'s
 * own comment for why), every commerce component (32 files), every builder
 * component (16 files), and every remaining admin component (17 files) —
 * roughly 110 components across five sections below. Every interactive
 * component is wired to real local state in its own section file, not
 * frozen static markup, so this page is a genuine smoke test as well as a
 * visual reference.
 *
 * Not yet covered by this pass (honestly scoped, not silently dropped):
 * this shows every component and its *headline* states/variants, not an
 * exhaustive permutation of every prop combination — and the "passes axe
 * with zero violations" half of the definition-of-done has NOT been run,
 * because no axe-core/Playwright E2E harness exists in this codebase yet
 * (`docs/16-TESTING-QA.md` §"Accessibility" calls for `@axe-core/
 * playwright` on every route; that's a testing-infrastructure phase that
 * hasn't started). See `PROGRESS.md` for the full status.
 */
export const metadata: Metadata = {
  title: "Component showcase — City Computer (internal)",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  { id: "primitives", label: "Primitives" },
  { id: "layout", label: "Layout" },
  { id: "commerce", label: "Commerce" },
  { id: "builder", label: "PC Builder" },
  { id: "admin", label: "Admin" },
] as const;

export default function DesignShowcasePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-on-primary"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-glass-stroke bg-surface-container/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-4">
          <div>
            <p className="text-label-mono-xs text-on-surface-variant">City Computer — internal</p>
            <h1 className="text-headline-md text-on-surface">Component showcase</h1>
          </div>
          <nav aria-label="Showcase sections" className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded px-3 py-1.5 text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-24 px-6 py-12"
      >
        <section id="primitives" aria-labelledby="primitives-heading">
          <h2 id="primitives-heading" className="mb-8 text-headline-lg text-on-surface">
            Primitives
          </h2>
          <PrimitivesSection />
        </section>

        <section id="layout" aria-labelledby="layout-heading">
          <h2 id="layout-heading" className="mb-8 text-headline-lg text-on-surface">
            Layout
          </h2>
          <LayoutSection />
        </section>

        <section id="commerce" aria-labelledby="commerce-heading">
          <h2 id="commerce-heading" className="mb-8 text-headline-lg text-on-surface">
            Commerce
          </h2>
          <CommerceSection />
        </section>

        <section id="builder" aria-labelledby="builder-heading">
          <h2 id="builder-heading" className="mb-8 text-headline-lg text-on-surface">
            PC Builder
          </h2>
          <BuilderSection />
        </section>

        <section id="admin" aria-labelledby="admin-heading">
          <h2 id="admin-heading" className="mb-8 text-headline-lg text-on-surface">
            Admin
          </h2>
          <AdminSection />
        </section>
      </main>
    </div>
  );
}
