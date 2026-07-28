import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * docs/04-REPOSITORY-STRUCTURE.md: `[locale]/layout.tsx` — "locale
 * provider, direction, hreflang." This is the provider piece: everything
 * under `[locale]/` (the entire storefront, and eventually `(builder)`/
 * `(checkout)`/`(account)`/`(auth)`) gets translated strings via
 * `NextIntlClientProvider`. `<html>`/`<body>` live one level up in the
 * true root layout (`src/app/layout.tsx`) — see that file's own comment
 * for why. hreflang alternates are emitted per-page via `generateMetadata`
 * (`lib/seo/metadata.ts`, not yet built), not here.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The `[locale]` segment is effectively a catch-all for any first path
  // segment — a request for `/xx/whatever` where `xx` isn't a configured
  // locale would otherwise render with a nonsensical locale rather than
  // 404ing. `middleware.ts`'s next-intl middleware already redirects
  // unknown locales before this ever runs in the normal request path;
  // this guard is the defence for anything that reaches the page tree
  // without going through middleware (e.g. `generateStaticParams`-driven
  // prerendering).
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
