/**
 * Payment/checkout policy constants — docs/10-PAYMENTS-NEPAL.md §5 (tiered
 * checkout), §7 (COD controls), §8 (bank transfer two-person rule), and
 * docs/06-DATA-MODEL.md §13.3's seed-data note: "settings (contact, VAT
 * rate, COD cap, payment tiers)".
 *
 * JUDGMENT CALL: docs/06 §13.3 expects these to live in the `Setting`
 * table (owner-editable without a deploy) — the model already exists
 * (`prisma/schema/ops.prisma`'s `Setting`), but there is no seed data for
 * these keys and no admin Settings screen to edit them yet (that screen is
 * its own, separate piece of Phase 5/9 work this pass doesn't add).
 * Collected here, typed, with the same "placeholder until the real number
 * is confirmed" framing `config/site.ts` already uses — every value below
 * is read from exactly one place, so wiring a `Setting`-backed override
 * later is a small, contained change, not a hunt through the codebase.
 */
export const paymentConfig = {
  /** docs/06 §4: VAT is included in displayed prices in Nepal. */
  vatRatePercent: 13,

  /**
   * docs/10 §7: "Value cap | NPR 25,000 default (configurable)." Whole
   * rupees, converted to paisa at the one call site that needs it
   * (`lib/money.ts`'s `rupeesToPaisa`) rather than hand-multiplied here.
   */
  codValueCapRupees: 25000,

  /** docs/10 §7: "Velocity limits | Max 2 open COD orders per phone; max 3 per address per week." */
  codMaxOpenOrdersPerPhone: 2,
  codMaxOrdersPerAddressPerWeek: 3,

  /**
   * docs/10 §8: "Above a configurable threshold (default NPR 100,000),
   * approval requires an OWNER. Below it, MANAGER may approve."
   */
  bankTransferApprovalThresholdRupees: 100000,

  /** docs/10 §8: "Stock hold | 24-hour reservation, extendable once by an admin." / "Auto-cancel | 48 hours without approval." */
  bankTransferReservationHours: 24,
  bankTransferAutoCancelHours: 48,

  /**
   * docs/10 §8: bank details "rendered server-side from settings — never
   * hardcoded, never editable by non-owners." Genuinely placeholder until
   * the shop's real account is confirmed — the same "placeholder" framing
   * `config/site.ts` uses for `phone`.
   */
  bankTransferAccount: {
    bankName: "Nabil Bank",
    accountName: "City Computer Systems Pvt. Ltd.",
    accountNumber: "0000000000000000",
    branch: "New Road, Kathmandu",
  },
} as const;

export type PaymentConfig = typeof paymentConfig;
