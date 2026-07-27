import { RadioCard } from "@/components/commerce/radio-card";

/**
 * PaymentMethodTile — docs/10-PAYMENTS-NEPAL.md §5 "Tiered checkout
 * strategy" / §7 / §8: a single payment-method option (eSewa, Khalti,
 * Fonepay, bank transfer, Cash on Delivery, ...) for the checkout page's
 * payment step. A thin, semantically-named wrapper around `RadioCard` —
 * `<PaymentMethodTile value="esewa" label="eSewa" .../>` reads better in
 * the checkout page's JSX than a bare `RadioCard`, but no markup is
 * duplicated here.
 *
 * Deliberately has no payment eligibility/business logic (e.g. amount
 * thresholds, "eSewa only under NPR 45,000") — that data-driven decision
 * belongs to whichever page assembles the actual list of tiles; this
 * component only renders whatever `disabled` it's given.
 *
 * Same composition contract as `RadioCard`: not a `RadioGroup.Root` itself,
 * render one or more inside the existing `RadioGroup` primitive:
 * ```tsx
 * <RadioGroup value={method} onValueChange={setMethod}>
 *   <PaymentMethodTile value="esewa" label="eSewa" description="Redirects to eSewa to complete payment" />
 *   <PaymentMethodTile value="cod" label="Cash on Delivery" />
 * </RadioGroup>
 * ```
 */
export interface PaymentMethodTileProps {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function PaymentMethodTile({
  value,
  label,
  description,
  disabled,
  className,
}: PaymentMethodTileProps) {
  return (
    <RadioCard
      value={value}
      title={label}
      description={description}
      disabled={disabled}
      className={className}
    />
  );
}
