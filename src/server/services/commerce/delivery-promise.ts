/**
 * A short, honest delivery-time/price line for product cards — the
 * "Free Home Delivery" / "Get it in same day" badges a competitor
 * (Hukut) shows on every card. Built from the real `DeliveryZone` /
 * `ShippingRate` data (docs/06 §6, seeded in `prisma/seed/core.ts`)
 * rather than copied marketing copy: this shop's real rates are NPR 150
 * / 1–2 days inside the valley, not free and not same-day, so the badge
 * says exactly that instead of a false claim. If a future zone or rate
 * changes in `/admin`, this reads it live rather than drifting out of
 * sync with a hardcoded string.
 */
import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { formatNPR } from "@/lib/money";

function formatDayRange(min: number, max: number): string {
  if (min === max) return `${min} day${min === 1 ? "" : "s"}`;
  return `${min}–${max} days`;
}

/**
 * The shop's fastest active delivery zone (lowest `position`, per
 * `seedDeliveryZones`'s own "Inside Kathmandu Valley" = 0 convention) and
 * its cheapest active rate. Returns `null` rather than a generic fallback
 * if no zone/rate is configured — an absent badge is honest; a guessed one
 * is not.
 */
async function getDefaultDeliveryPromiseUncached(): Promise<string | null> {
  const zone = await db.deliveryZone.findFirst({
    where: { isActive: true },
    orderBy: { position: "asc" },
    include: {
      rates: { where: { isActive: true }, orderBy: { basePaisa: "asc" }, take: 1 },
    },
  });
  if (!zone) return null;

  const days = formatDayRange(zone.estimatedDaysMin, zone.estimatedDaysMax);
  const rate = zone.rates[0];
  if (!rate) return `Delivery in ${days} (${zone.name})`;

  const priceLabel = rate.basePaisa === 0 ? "Free" : formatNPR(rate.basePaisa);
  return `Delivery in ${days} (${zone.name}) · ${priceLabel}`;
}

/** Per-request memoised (React `cache()`) — every rail on a page (home, category, PDP related) can call this without re-querying. */
export const getDefaultDeliveryPromise = cache(getDefaultDeliveryPromiseUncached);
