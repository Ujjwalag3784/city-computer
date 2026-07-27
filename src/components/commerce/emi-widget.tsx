"use client";

import * as React from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatNPR } from "@/lib/money";

/**
 * EmiWidget — docs/10-PAYMENTS-NEPAL.md §10 "EMI — content and lead
 * capture, not a payment method": "All Nepali bank EMI is a credit-card
 * conversion arranged by the issuing bank, completed on paper at a branch.
 * It is not an API." This widget is therefore a self-contained estimator,
 * never a checkout step, matching §10 implementation item 1: "EMI
 * calculator at /emi-calculator and as a PDP widget: amount, bank, tenure
 * → monthly payment, total fee, total payable. Rates and fees live in
 * `Setting` so the owner can update them without a deploy." No `Setting`
 * data model exists yet in this codebase (that ships in a later phase per
 * docs/10's own roadmap table), so this component is prop-driven and
 * self-contained: pass real rates via the `banks` prop once the
 * `Setting`-backed admin rate editor exists, and treat `DEFAULT_EMI_BANKS`
 * below as illustrative only until then.
 *
 * The calculation is a flat-rate approximation, not a real amortization
 * schedule — appropriate here because, per §10, this widget is "content
 * and lead capture, not a payment method": actual EMI terms are set by
 * the issuing bank on paper at a branch, so a precise schedule would be
 * false precision.
 */
export interface EmiBank {
  name: string;
  annualRatePercent: number;
  processingFeePercent: number;
}

/**
 * Illustrative placeholder bank terms only — NOT the real published rates.
 * docs/10 §10 explicitly warns that bank EMI terms "are commercial terms
 * that change without notice — reconfirm before publishing any figure on
 * the site, and store them in `Setting` rather than in code." These
 * round numbers exist purely so `EmiWidget` has a sensible default before
 * that `Setting`-backed rate source is built; replace via the `banks` prop
 * for anything user-facing.
 */
export const DEFAULT_EMI_BANKS: EmiBank[] = [
  { name: "NIC Asia Bank", annualRatePercent: 18, processingFeePercent: 1.5 },
  { name: "Global IME Bank", annualRatePercent: 19, processingFeePercent: 1.5 },
  { name: "Himalayan Bank", annualRatePercent: 20, processingFeePercent: 2 },
];

const TENURE_OPTIONS_MONTHS = [3, 6, 12, 24] as const;

export interface EmiWidgetProps {
  /** Product price being financed, as an integer number of paisa. */
  amount: number;
  /** Overrides `DEFAULT_EMI_BANKS` — pass real `Setting`-backed rates once available. */
  banks?: EmiBank[];
  className?: string;
}

export function EmiWidget({ amount, banks = DEFAULT_EMI_BANKS, className }: EmiWidgetProps) {
  const [bankIndex, setBankIndex] = React.useState(0);
  const [tenureMonths, setTenureMonths] = React.useState<number>(12);

  // Falls back through the selected index, the first configured bank, and
  // finally a zero-rate placeholder — the last fallback only matters if a
  // caller ever passes an empty `banks` array, which should not happen in
  // practice, but keeps `bank` provably non-undefined under strict mode
  // without an unsound array-index assumption.
  // `bankIndex` only ever comes from this component's own `Select`
  // (`onValueChange={(value) => setBankIndex(Number(value))}`), whose items
  // are generated 1:1 from `banks`' own indices — never arbitrary input.
  // eslint-disable-next-line security/detect-object-injection
  const bank = banks[bankIndex] ??
    banks[0] ?? { name: "—", annualRatePercent: 0, processingFeePercent: 0 };

  const { monthlyPaymentPaisa, totalInterestAndFeesPaisa, totalPayablePaisa } =
    React.useMemo(() => {
      // Flat-rate approximation (paisa arithmetic throughout, rounded to the
      // nearest whole paisa at the end — money is never a float rupee value).
      const totalInterest = amount * (bank.annualRatePercent / 100) * (tenureMonths / 12);
      const processingFee = amount * (bank.processingFeePercent / 100);
      const totalPayable = amount + totalInterest + processingFee;
      const monthlyPayment = totalPayable / tenureMonths;

      return {
        monthlyPaymentPaisa: Math.round(monthlyPayment),
        totalInterestAndFeesPaisa: Math.round(totalInterest + processingFee),
        totalPayablePaisa: Math.round(totalPayable),
      };
    }, [amount, bank.annualRatePercent, bank.processingFeePercent, tenureMonths]);

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-xl border border-glass-stroke bg-surface-container p-[--space-card-padding]",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-title text-on-surface">
        <Calculator className="size-5 text-primary-container" />
        EMI calculator
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          {/* A plain `<span>`, not `<label>` — `Select` is a Radix custom
             control, not a native labelable form element, so `htmlFor`
             association is meaningless here; `SelectTrigger`'s own
             `aria-label="Bank"` already gives it an accessible name. */}
          <span id="emi-bank-label" className="text-label-mono-xs text-on-surface-variant">
            Bank
          </span>
          <Select value={String(bankIndex)} onValueChange={(value) => setBankIndex(Number(value))}>
            <SelectTrigger aria-label="Bank">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b, index) => (
                <SelectItem key={b.name} value={String(index)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          {/* Same reasoning as the "Bank" span above — this heads a `role="group"`
             of toggle buttons, not a single native form control. */}
          <span id="emi-tenure-label" className="text-label-mono-xs text-on-surface-variant">
            Tenure
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="emi-tenure-label">
            {TENURE_OPTIONS_MONTHS.map((months) => (
              <Button
                key={months}
                type="button"
                size="md"
                variant={months === tenureMonths ? "primary" : "outline"}
                aria-pressed={months === tenureMonths}
                onClick={() => setTenureMonths(months)}
              >
                {months}mo
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-glass-stroke pt-4">
        <div>
          <div className="text-label-mono-xs text-on-surface-variant">Monthly payment</div>
          <div className="text-price text-on-surface">{formatNPR(monthlyPaymentPaisa)}</div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-label-mono-xs text-on-surface-variant">
              Total interest &amp; fees
            </div>
            <div className="text-body-md text-on-surface">
              {formatNPR(totalInterestAndFeesPaisa)}
            </div>
          </div>
          <div>
            <div className="text-label-mono-xs text-on-surface-variant">Total payable</div>
            <div className="text-body-md text-on-surface">{formatNPR(totalPayablePaisa)}</div>
          </div>
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Estimate only. EMI is arranged directly with your bank at the time of purchase — final terms
        depend on your bank&apos;s approval.
      </p>
    </div>
  );
}
