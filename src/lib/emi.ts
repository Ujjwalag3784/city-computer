/**
 * EMI (equated monthly installment) math — docs/10-PAYMENTS-NEPAL.md §10:
 * "content and lead capture, not a payment method." All Nepali bank EMI is
 * a credit-card conversion arranged by the issuing bank on paper at a
 * branch, never an API this codebase calls — so this is a flat-rate
 * *estimate*, not a real amortisation schedule (a precise schedule would
 * be false precision the bank itself doesn't commit to until approval).
 *
 * Kept in `lib/` (pure, no DB) rather than `server/services/content/emi.ts`
 * so the calculation itself is trivially unit-testable and — if a future
 * pass wants it — usable client-side without a round trip. The *data* that
 * feeds it (per-bank tenures, sourced from `Setting`) lives in
 * `server/services/content/emi.ts`, which is the DB-touching half.
 *
 * Money is always integer paisa (docs/00 §5) — `calculateEmi` asserts its
 * principal via `assertPaisa` and rounds every paisa amount it produces
 * with `Math.round`, never returning a fractional paisa value.
 */
import { assertPaisa } from "@/lib/money";

export interface EmiTenureOption {
  months: number;
  /** Annual interest rate as a percentage, e.g. `6.99` for 6.99%. */
  interestRatePercent: number;
  /** One-off processing/handling fee as a percentage of the principal. */
  processingFeePercent: number;
}

export interface EmiBankSchedule {
  bank: string;
  tenures: EmiTenureOption[];
}

export interface EmiCalculation {
  monthlyPaymentPaisa: number;
  totalInterestAndFeesPaisa: number;
  totalPayablePaisa: number;
}

/**
 * Flat-rate estimate: simple (not compound) interest pro-rated to the
 * tenure length, plus a one-off processing fee, spread evenly across the
 * months. Matches the calculation `components/commerce/emi-widget.tsx`
 * already did inline before this module existed — extracted here so the
 * public `/emi-calculator` route (which reads real per-bank tenures from
 * `Setting`, not that component's illustrative placeholder banks) can
 * share the exact same math rather than re-deriving it.
 */
export function calculateEmi(principalPaisa: number, tenure: EmiTenureOption): EmiCalculation {
  assertPaisa(principalPaisa, "calculateEmi principalPaisa");
  if (!Number.isInteger(tenure.months) || tenure.months <= 0) {
    throw new RangeError(
      `calculateEmi tenure.months must be a positive integer, got ${tenure.months}`,
    );
  }
  if (!Number.isFinite(tenure.interestRatePercent) || tenure.interestRatePercent < 0) {
    throw new RangeError(
      `calculateEmi tenure.interestRatePercent must be a non-negative number, got ${tenure.interestRatePercent}`,
    );
  }
  if (!Number.isFinite(tenure.processingFeePercent) || tenure.processingFeePercent < 0) {
    throw new RangeError(
      `calculateEmi tenure.processingFeePercent must be a non-negative number, got ${tenure.processingFeePercent}`,
    );
  }

  const totalInterest = principalPaisa * (tenure.interestRatePercent / 100) * (tenure.months / 12);
  const processingFee = principalPaisa * (tenure.processingFeePercent / 100);
  const totalPayable = principalPaisa + totalInterest + processingFee;
  const monthlyPayment = totalPayable / tenure.months;

  return {
    monthlyPaymentPaisa: Math.round(monthlyPayment),
    totalInterestAndFeesPaisa: Math.round(totalInterest + processingFee),
    totalPayablePaisa: Math.round(totalPayable),
  };
}
