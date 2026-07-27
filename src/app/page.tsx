import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieConsent } from "@/components/layout/cookie-consent";

// Temporary Phase 2 checkpoint page — proves the Obsidian Peak theme, the
// restyled shadcn primitives, and the step-5 layout components all render
// and compose correctly end to end. Replaced by the real homepage in Phase 4
// (docs/17-ROADMAP-PHASES.md).
export default function HomePage() {
  return (
    <>
      <AnnouncementBar
        message="Free delivery inside Kathmandu Valley on orders over Rs. 5,000."
        href="/pages/warranty"
        linkLabel="Learn more"
      />
      <SiteHeader variant="with-search" cartCount={2} wishlistCount={1} />

      <main id="main-content" className="mx-auto flex max-w-[1280px] flex-col gap-8 p-8">
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            { label: "Laptops", href: "/c/laptops" },
            { label: "Phase 2 checkpoint" },
          ]}
        />

        <p className="text-label-mono-xs text-on-surface-variant">
          City Computer — Phase 2 design-system checkpoint
        </p>

        <h1 className="text-headline-lg text-on-surface">Obsidian Peak, rendering for real.</h1>

        <p className="text-body-lg text-on-surface-variant">
          If this page has a near-black background, silver body text, and the buttons below glow
          electric blue on hover, the theme tokens, fonts, and the restyled shadcn primitives are
          all wired correctly. The sticky glass header above, the breadcrumb trail below it, and the
          footer at the bottom of this page are the new step-5 layout components.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" glow>
            Primary + glow
          </Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="mono" size="sm">
            SKU-4471-A
          </Button>
          <Button variant="destructive" size="lg">
            Destructive
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Surface card</CardTitle>
              <CardDescription>Default variant, default border tone.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-price text-on-surface">रु 154,900</p>
            </CardContent>
          </Card>

          <Card variant="glass" borderTone="primary">
            <CardHeader>
              <CardTitle>Glass panel</CardTitle>
              <CardDescription>Glass variant, primary border tone + glow.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-label-mono text-on-surface-variant">RTX 4090 · 32GB RAM</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-body-sm text-on-surface-variant">
          The storefront, admin, and PC builder are built out phase by phase per{" "}
          <code className="text-label-mono-xs">docs/17-ROADMAP-PHASES.md</code>.
        </p>
      </main>

      <SiteFooter />
      <CookieConsent />
    </>
  );
}
