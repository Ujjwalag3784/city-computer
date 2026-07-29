/**
 * Checkout pricing — docs/17-ROADMAP-PHASES.md Phase 7: "Nepal address
 * model with zone resolution · delivery vs pickup · shipping rates ·
 * VAT-inclusive totals." Every number this file produces is recomputed
 * from the live cart and the live `DeliveryZone`/`ShippingRate` rows —
 * nothing here ever trusts a client-sent price, discount, or total
 * (this session's standing constraint, and docs/17's own acceptance
 * criterion: "no client-supplied price or discount is ever honoured").
 */
import "server-only";
import { db } from "@/server/db";
import { rupeesToPaisa } from "@/lib/money";
import { paymentConfig } from "@/config/payment";
import type { CartView } from "./cart";
import type { DeliveryZone, ShippingRate } from "@/generated/prisma/client";

export interface OrderTotals {
  subtotalPaisa: number;
  discountPaisa: number;
  shippingPaisa: number;
  /**
   * Informational only — the VAT component *within* the already-inclusive
   * subtotal, for the invoice's "VAT 13% (included)" line. Never added to
   * `totalPaisa` a second time: `Order.taxInclusive` is `true` (docs/06
   * §4: "VAT 13% is included in displayed prices in Nepal"), and the
   * schema's own arithmetic invariant (`prisma/schema/commerce.prisma`'s
   * TODO comment) only adds `taxPaisa` to the total when `NOT
   * tax_inclusive`.
   */
  taxPaisa: number;
  totalPaisa: number;
}

/**
 * docs/06 §6's `DeliveryZone.districts` match — case/whitespace-insensitive
 * since shoppers and the seed data won't always agree on capitalisation
 * ("kathmandu" vs "Kathmandu"). Returns `null` for a district with no
 * configured zone yet (the seed only covers 13 of Nepal's 77 districts —
 * see `prisma/seed/core.ts`'s own comment on that), which callers should
 * treat as "ask the shopper to contact us" rather than a hard checkout
 * failure.
 */
export async function resolveDeliveryZoneForDistrict(
  district: string,
): Promise<DeliveryZone | null> {
  const normalized = district.trim().toLowerCase();
  const zones = await db.deliveryZone.findMany({ where: { isActive: true } });
  return zones.find((zone) => zone.districts.some((d) => d.toLowerCase() === normalized)) ?? null;
}

async function getActiveRatesForZone(zoneId: string): Promise<ShippingRate[]> {
  return db.shippingRate.findMany({ where: { zoneId, isActive: true } });
}

/** Total weight of a cart, in grams — `Variant.weightGrams` is optional, so a cart of unweighed items falls back to 0 (no weight-based surcharge) rather than blocking checkout on missing data admin hasn't filled in yet. */
async function getCartWeightGrams(cartView: CartView): Promise<number> {
  if (cartView.items.length === 0) return 0;
  const variants = await db.variant.findMany({
    where: { id: { in: cartView.items.map((item) => item.variantId) } },
    select: { id: true, weightGrams: true },
  });
  const weightByVariant = new Map(variants.map((v) => [v.id, v.weightGrams ?? 0]));
  return cartView.items.reduce(
    (sum, item) => sum + (weightByVariant.get(item.variantId) ?? 0) * item.quantity,
    0,
  );
}

function costForRate(rate: ShippingRate, subtotalPaisa: number, weightGrams: number): number {
  switch (rate.type) {
    case "FLAT":
      return rate.basePaisa;
    case "FREE_ABOVE":
      return rate.freeAbovePaisa !== null && subtotalPaisa >= rate.freeAbovePaisa
        ? 0
        : rate.basePaisa;
    case "WEIGHT_BASED": {
      const weightKg = weightGrams / 1000;
      return rate.basePaisa + Math.round(weightKg * (rate.perKgPaisa ?? 0));
    }
  }
}

/**
 * Picks the cheapest currently-applicable rate for the zone — a zone can
 * have more than one active `ShippingRate` (e.g. a flat rate and a
 * promotional free-above-threshold rate); the shopper should always see
 * whichever is currently lowest, not whichever row happens to sort first.
 */
export async function computeShippingPaisa(
  zone: DeliveryZone | null,
  cartView: CartView,
  fulfilmentType: "DELIVERY" | "PICKUP",
): Promise<number> {
  if (fulfilmentType === "PICKUP") return 0;
  if (!zone) return 0;
  const rates = await getActiveRatesForZone(zone.id);
  if (rates.length === 0) return 0;
  const weightGrams = await getCartWeightGrams(cartView);
  return Math.min(...rates.map((rate) => costForRate(rate, cartView.subtotalPaisa, weightGrams)));
}

/**
 * Extracts the VAT component from an already-VAT-inclusive amount:
 * `amount * rate / (100 + rate)`, not `amount * rate / 100` (which would
 * be the tax on top of the price, the wrong direction for an inclusive
 * price). JUDGMENT CALL, flagged rather than silently assumed
 * authoritative: computed against the post-discount product subtotal
 * only, not the shipping fee — confirm the exact VAT treatment of
 * shipping and of discounts with an accountant before this figure is
 * relied on for real tax filing; it is correct for *displaying* an
 * informational "VAT included" line on the invoice, which is this pass's
 * only use for it.
 */
export function computeVatPaisa(vatInclusiveBasePaisa: number): number {
  return Math.round(
    (vatInclusiveBasePaisa * paymentConfig.vatRatePercent) / (100 + paymentConfig.vatRatePercent),
  );
}

/**
 * The one function order placement and the checkout review step both call
 * — recomputes every figure from the live cart, never from anything the
 * client sent. `discountPaisa` is the caller's job to have already
 * re-validated via `coupon.ts`'s `previewCoupon` against this same
 * `cartView`, not re-derived here (coupon eligibility and pricing math are
 * separate concerns already owned by that file).
 */
export function buildOrderTotals(
  cartView: CartView,
  discountPaisa: number,
  shippingPaisa: number,
): OrderTotals {
  const subtotalPaisa = cartView.subtotalPaisa;
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa + shippingPaisa);
  const taxPaisa = computeVatPaisa(Math.max(0, subtotalPaisa - discountPaisa));
  return { subtotalPaisa, discountPaisa, shippingPaisa, taxPaisa, totalPaisa };
}

export type CheckoutPaymentMethod = "COD" | "BANK_TRANSFER";

export interface PaymentMethodOption {
  method: CheckoutPaymentMethod;
  available: boolean;
  /** Shown next to a hidden/disabled method — docs/10 §5's UI rule: "Never show a method that will fail... with one line of explanation." */
  reason?: string;
}

/**
 * docs/10 §5's tiered checkout, narrowed to just the two rails this pass
 * builds (COD, Bank Transfer) — eSewa/Khalti/Fonepay/connectIPS tiers are
 * not implemented yet (flagged in this file's header and in
 * PROGRESS.md), so this only ever returns these two.
 */
export function getAvailablePaymentMethods(totalPaisa: number): PaymentMethodOption[] {
  const codCapPaisa = rupeesToPaisa(paymentConfig.codValueCapRupees);
  return [
    {
      method: "COD",
      available: totalPaisa <= codCapPaisa,
      reason:
        totalPaisa > codCapPaisa
          ? `Cash on delivery is only available for orders up to रु ${paymentConfig.codValueCapRupees.toLocaleString("en-IN")}.`
          : undefined,
    },
    { method: "BANK_TRANSFER", available: true },
  ];
}

export interface CheckoutQuote {
  zone: DeliveryZone | null;
  totals: OrderTotals;
  paymentMethods: PaymentMethodOption[];
}

/** Step 1/2's live preview — same math `placeOrder` will re-run at commit time, so nothing the shopper sees here can drift from what actually gets charged. */
export async function getCheckoutQuote(
  cartView: CartView,
  district: string,
  fulfilmentType: "DELIVERY" | "PICKUP",
  discountPaisa = 0,
): Promise<CheckoutQuote> {
  const zone =
    fulfilmentType === "DELIVERY" ? await resolveDeliveryZoneForDistrict(district) : null;
  const shippingPaisa = await computeShippingPaisa(zone, cartView, fulfilmentType);
  const totals = buildOrderTotals(cartView, discountPaisa, shippingPaisa);
  return { zone, totals, paymentMethods: getAvailablePaymentMethods(totals.totalPaisa) };
}
