import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidOrderNumber } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Track your order — City Computer Systems",
  robots: { index: false },
};

interface TrackPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderNumber?: string }>;
}

/** Trims, upper-cases and normalises dashes so "cc 2610 0042" style typing still finds the order. */
function normaliseOrderNumber(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s_–—]+/g, "-");
}

/**
 * `/track` — "Track an order" from the footer and mobile menu.
 *
 * WHY. Both links pointed here, but tracking only ever existed at
 * `/order/[orderNumber]`, so the link was a 404 on the live site. This is a
 * plain GET form (works with JavaScript off): a well-formed order number is
 * forwarded to the order page, which keeps its own phone-number check —
 * nothing about an order is revealed here, so it cannot be used to probe
 * which order numbers exist.
 */
export default async function TrackOrderPage({ params, searchParams }: TrackPageProps) {
  const { locale } = await params;
  const { orderNumber: raw } = await searchParams;
  const orderNumber = raw ? normaliseOrderNumber(raw) : "";
  const submitted = raw !== undefined;

  if (orderNumber && isValidOrderNumber(orderNumber)) {
    const prefix = locale === "en" ? "" : `/${locale}`;
    redirect(`${prefix}/order/${encodeURIComponent(orderNumber)}`);
  }

  const showError = submitted;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Track your order</h1>
        <p className="text-body-md text-on-surface-variant">
          Enter the order number from your confirmation. It looks like CC-2610-0042. On the next
          screen, confirm it with the phone number you ordered with.
        </p>
      </div>

      <form method="get" className="flex max-w-sm flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="track-order-number">Order number</Label>
          <Input
            id="track-order-number"
            name="orderNumber"
            defaultValue={raw ?? ""}
            placeholder="CC-2610-0042"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            aria-invalid={showError || undefined}
            aria-describedby={showError ? "track-order-error" : undefined}
          />
          <p
            id="track-order-error"
            role="status"
            aria-live="polite"
            className="min-h-5 text-body-sm text-error"
          >
            {showError ? "That doesn't look like an order number. Check it and try again." : ""}
          </p>
        </div>
        <Button type="submit" variant="primary">
          Track order
        </Button>
      </form>
    </div>
  );
}
