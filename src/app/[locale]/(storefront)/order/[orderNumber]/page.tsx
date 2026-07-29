import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { isValidOrderNumber } from "@/lib/ids";
import { getOrderDetailIfOwner } from "@/server/services/commerce/order-lookup";
import { OrderTrackingClient } from "./_components/order-tracking-client";

export const metadata: Metadata = {
  title: "Track your order — City Computer Systems",
  robots: { index: false },
};

interface OrderPageProps {
  params: Promise<{ orderNumber: string }>;
}

/**
 * `/order/[orderNumber]` — docs/17-ROADMAP-PHASES.md Phase 7's customer
 * order tracking page (see `order-lookup.ts`'s own doc comment for the
 * flagged deviation from docs/02's fuller three-route split).
 *
 * Server Component: a malformed order number (doesn't match `CC-YYMM-NNNN`
 * at all) 404s immediately — no point rendering a phone-gate for a string
 * that could never be a real order number. Otherwise it tries the
 * signed-in-owner path server-side (skips the phone gate entirely for a
 * shopper viewing their own order while logged in); if that comes back
 * empty (guest, or a different signed-in shopper), the client component
 * renders the phone-gate form instead of the page ever revealing whether
 * the order exists.
 */
export default async function OrderTrackingPage({ params }: OrderPageProps) {
  const { orderNumber } = await params;
  if (!isValidOrderNumber(orderNumber)) notFound();

  const session = await auth();
  const initialDetail = await getOrderDetailIfOwner(orderNumber, session?.user?.id);

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-headline-md text-on-surface">Order {orderNumber}</h1>
      <OrderTrackingClient orderNumber={orderNumber} initialDetail={initialDetail} />
    </div>
  );
}
