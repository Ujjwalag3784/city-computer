import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Catches every `notFound()` call made anywhere under `(storefront)/`
 * (category/brand/product pages resolving an unknown slug or path) —
 * without this file, Next.js would fall back to its generic built-in
 * 404, untranslated and unstyled.
 */
export default async function StorefrontNotFound() {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 p-8 py-24 text-center">
      <p className="text-headline-sm text-on-surface">{t("notFound")}</p>
      <Button asChild>
        <Link href="/">{t("backToShop")}</Link>
      </Button>
    </div>
  );
}
