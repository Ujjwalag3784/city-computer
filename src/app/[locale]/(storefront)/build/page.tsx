import { redirect } from "next/navigation";

/**
 * `/build` — the PC Builder's landing address.
 *
 * WHY. The header's "Build a PC" (`config/navigation.ts`), the footer's
 * "PC builder" link and the admin menu editor's suggested target all point
 * at `/build`, but the builder only ever had `/build/new` and
 * `/build/[shortId]` — so every one of those links was a 404 on the live
 * site. This sends them to the place a shopper actually starts a build.
 */
export default async function BuildIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(locale === "en" ? "/build/new" : `/${locale}/build/new`);
}
