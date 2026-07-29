"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepperNav, type StepperStep } from "@/components/commerce/stepper-nav";
import { PaymentMethodTile } from "@/components/commerce/payment-method-tile";
import { OrderSummaryPanel } from "@/components/commerce/order-summary-panel";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioCard } from "@/components/commerce/radio-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatNPR } from "@/lib/money";
import { checkoutAddressSchema } from "@/lib/validation/checkout";
import type { CartView } from "@/server/services/commerce/cart";
import type { CheckoutQuote } from "@/server/services/commerce/checkout";
import { getCheckoutQuoteAction, placeOrderAction } from "../_actions";
import { AddressFields, EMPTY_ADDRESS, type AddressFormValue } from "./address-fields";

export interface PickupBranchOption {
  id: string;
  name: string;
  addressLine: string;
  district: string;
}

export interface CheckoutPageClientProps {
  cartView: CartView;
  branches: PickupBranchOption[];
}

type FulfilmentChoice = "DELIVERY" | "PICKUP";
type PaymentChoice = "COD" | "BANK_TRANSFER";

const STEP_LABELS = ["Address", "Payment", "Review"];

function addressErrorsFromZod(value: AddressFormValue): {
  errors: Partial<Record<keyof AddressFormValue, string>>;
  ok: boolean;
} {
  const parsed = checkoutAddressSchema.safeParse({
    fullName: value.fullName,
    phone: value.phone,
    alternatePhone: value.alternatePhone === "" ? undefined : value.alternatePhone,
    province: value.province,
    district: value.district,
    municipality: value.municipality,
    ward: value.ward === "" ? undefined : Number(value.ward),
    streetAddress: value.streetAddress,
    landmark: value.landmark === "" ? undefined : value.landmark,
  });
  if (parsed.success) return { errors: {}, ok: true };
  const errors: Partial<Record<keyof AddressFormValue, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof AddressFormValue] = issue.message;
    }
  }
  return { errors, ok: false };
}

/**
 * The 3-step checkout wizard — docs/05-DESIGN-SYSTEM.md §8's "3-step
 * stepper, minimal chrome, no nav links out", narrowed here to Address ->
 * Payment -> Review (the docs' own "Contact -> Delivery -> Payment" framing
 * is folded into a single Address step, since this codebase's guest
 * checkout has no separate account/contact step — name and phone are
 * already part of the one shipping-address form `placeOrderSchema`
 * requires regardless of fulfilment type).
 *
 * Every quote shown before "Place order" comes from `getCheckoutQuoteAction`
 * — a thin wrapper around `checkout.ts`'s server-side pricing — never
 * computed client-side, so nothing here can drift from what
 * `placeOrderAction` actually charges.
 */
export function CheckoutPageClient({ cartView, branches }: CheckoutPageClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentChoice>("DELIVERY");
  const [branchId, setBranchId] = useState<string | null>(null);

  const [shippingAddress, setShippingAddress] = useState<AddressFormValue>(EMPTY_ADDRESS);
  const [shippingErrors, setShippingErrors] = useState<
    Partial<Record<keyof AddressFormValue, string>>
  >({});
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState<AddressFormValue>(EMPTY_ADDRESS);
  const [billingErrors, setBillingErrors] = useState<
    Partial<Record<keyof AddressFormValue, string>>
  >({});

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice | null>(null);
  const [customerNote, setCustomerNote] = useState("");

  const steps: StepperStep[] = STEP_LABELS.map((label, index) => ({
    label,
    status: index < step ? "complete" : index === step ? "current" : "upcoming",
  }));

  function toAddressPayload(value: AddressFormValue) {
    return {
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      alternatePhone: value.alternatePhone.trim() === "" ? undefined : value.alternatePhone.trim(),
      province: value.province,
      district: value.district.trim(),
      municipality: value.municipality.trim(),
      ward: value.ward === "" ? undefined : Number(value.ward),
      streetAddress: value.streetAddress.trim(),
      landmark: value.landmark.trim() === "" ? undefined : value.landmark.trim(),
    };
  }

  async function handleAddressContinue() {
    setStepError(null);
    const shippingCheck = addressErrorsFromZod(shippingAddress);
    setShippingErrors(shippingCheck.errors);

    let billingOk = true;
    if (!billingSameAsShipping) {
      const billingCheck = addressErrorsFromZod(billingAddress);
      setBillingErrors(billingCheck.errors);
      billingOk = billingCheck.ok;
    } else {
      setBillingErrors({});
    }

    if (!shippingCheck.ok || !billingOk) {
      setStepError("Please fix the highlighted fields before continuing.");
      return;
    }

    if (fulfilmentType === "PICKUP" && !branchId) {
      setStepError("Pick which branch you'll collect this from.");
      return;
    }

    const result = await getCheckoutQuoteAction({
      district: shippingAddress.district.trim(),
      fulfilmentType,
    });

    if (!result.ok || !result.data) {
      setStepError(
        result.message ?? "Couldn't calculate shipping for this address. Please try again.",
      );
      return;
    }

    if (fulfilmentType === "DELIVERY" && !result.data.zone) {
      setStepError(
        "We don't have a delivery rate set up for this district yet — please contact us to arrange delivery, or choose branch pickup.",
      );
      return;
    }

    setQuote(result.data);
    // A method that was selected under a previous (now stale) quote may no
    // longer be available — never carry forward a choice that isn't in the
    // freshly-resolved list.
    if (
      paymentMethod &&
      !result.data.paymentMethods.some((m) => m.method === paymentMethod && m.available)
    ) {
      setPaymentMethod(null);
    }
    setStep(1);
  }

  function handlePaymentContinue() {
    setStepError(null);
    if (!paymentMethod) {
      setStepError("Choose how you'd like to pay.");
      return;
    }
    setStep(2);
  }

  async function handlePlaceOrder() {
    if (!quote || !paymentMethod) return;
    setStepError(null);
    setSubmitting(true);
    try {
      const result = await placeOrderAction({
        shippingAddress: toAddressPayload(shippingAddress),
        billingSameAsShipping,
        billingAddress: billingSameAsShipping ? undefined : toAddressPayload(billingAddress),
        fulfilmentType,
        branchId: fulfilmentType === "PICKUP" ? (branchId ?? undefined) : undefined,
        paymentMethod,
        customerNote: customerNote.trim() === "" ? undefined : customerNote.trim(),
      });

      if (!result.ok || !result.data) {
        setStepError(result.message ?? "Couldn't place your order. Please try again.");
        toast(result.message ?? "Couldn't place your order. Please try again.");
        return;
      }

      toast(`Order ${result.data.orderNumber} placed.`);
      router.push(`/order/${result.data.orderNumber}`);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <StepperNav steps={steps} className="mb-8" />

        {stepError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{stepError}</AlertDescription>
          </Alert>
        )}

        {step === 0 && (
          <Card variant="surface">
            <CardContent className="flex flex-col gap-6 pt-[--space-card-padding]">
              <div>
                <Label className="mb-2 block">How would you like to get your order?</Label>
                <RadioGroup
                  value={fulfilmentType}
                  onValueChange={(value) => setFulfilmentType(value as FulfilmentChoice)}
                >
                  <RadioCard
                    value="DELIVERY"
                    title="Delivery"
                    description="We ship to your address."
                  />
                  <RadioCard
                    value="PICKUP"
                    title="Branch pickup"
                    description="Collect your order from one of our branches, free."
                    disabled={branches.length === 0}
                  />
                </RadioGroup>
              </div>

              {fulfilmentType === "PICKUP" && (
                <div>
                  <Label className="mb-2 block">Pickup branch</Label>
                  {branches.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant">
                      No pickup branches are available right now — please choose delivery.
                    </p>
                  ) : (
                    <RadioGroup
                      value={branchId ?? ""}
                      onValueChange={(value) => setBranchId(value)}
                    >
                      {branches.map((branch) => (
                        <RadioCard
                          key={branch.id}
                          value={branch.id}
                          title={branch.name}
                          description={`${branch.addressLine}, ${branch.district}`}
                        />
                      ))}
                    </RadioGroup>
                  )}
                </div>
              )}

              <div>
                <h2 className="mb-3 text-body-lg font-medium text-on-surface">
                  {fulfilmentType === "PICKUP" ? "Contact details" : "Shipping address"}
                </h2>
                <AddressFields
                  idPrefix="shipping"
                  value={shippingAddress}
                  onChange={(patch) => setShippingAddress((prev) => ({ ...prev, ...patch }))}
                  errors={shippingErrors}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="billing-same"
                  checked={billingSameAsShipping}
                  onCheckedChange={(checked) => setBillingSameAsShipping(checked === true)}
                />
                <Label htmlFor="billing-same" className="cursor-pointer">
                  Billing address is the same as{" "}
                  {fulfilmentType === "PICKUP" ? "contact details" : "shipping"}
                </Label>
              </div>

              {!billingSameAsShipping && (
                <div>
                  <h2 className="mb-3 text-body-lg font-medium text-on-surface">Billing address</h2>
                  <AddressFields
                    idPrefix="billing"
                    value={billingAddress}
                    onChange={(patch) => setBillingAddress((prev) => ({ ...prev, ...patch }))}
                    errors={billingErrors}
                  />
                </div>
              )}

              <Button
                variant="primary"
                glow
                className="w-full sm:w-auto"
                onClick={() => void handleAddressContinue()}
              >
                Continue to payment
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && quote && (
          <Card variant="surface">
            <CardContent className="flex flex-col gap-4 pt-[--space-card-padding]">
              <RadioGroup
                value={paymentMethod ?? ""}
                onValueChange={(value) => setPaymentMethod(value as PaymentChoice)}
              >
                {quote.paymentMethods.map((option) => (
                  <PaymentMethodTile
                    key={option.method}
                    value={option.method}
                    label={option.method === "COD" ? "Cash on Delivery" : "Bank Transfer"}
                    description={
                      option.reason ??
                      (option.method === "COD"
                        ? "Pay in cash when your order arrives."
                        : "Transfer to our bank account and upload the receipt.")
                    }
                    disabled={!option.available}
                  />
                ))}
              </RadioGroup>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button variant="primary" glow onClick={handlePaymentContinue}>
                  Continue to review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && quote && paymentMethod && (
          <Card variant="surface">
            <CardContent className="flex flex-col gap-6 pt-[--space-card-padding]">
              <div>
                <h2 className="mb-2 text-body-lg font-medium text-on-surface">
                  {fulfilmentType === "PICKUP" ? "Pickup" : "Delivery address"}
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  {shippingAddress.fullName} · {shippingAddress.phone}
                </p>
                {fulfilmentType === "PICKUP" ? (
                  <p className="text-body-sm text-on-surface-variant">
                    {selectedBranch?.name} — {selectedBranch?.addressLine},{" "}
                    {selectedBranch?.district}
                  </p>
                ) : (
                  <p className="text-body-sm text-on-surface-variant">
                    {shippingAddress.streetAddress}, {shippingAddress.municipality}
                    {shippingAddress.ward ? ` (Ward ${shippingAddress.ward})` : ""},{" "}
                    {shippingAddress.district}
                  </p>
                )}
              </div>

              <div>
                <h2 className="mb-2 text-body-lg font-medium text-on-surface">Payment method</h2>
                <p className="text-body-sm text-on-surface-variant">
                  {paymentMethod === "COD" ? "Cash on Delivery" : "Bank Transfer"}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-note">Order note (optional)</Label>
                <Textarea
                  id="customer-note"
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                  placeholder="Anything we should know about this order?"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-4">
        <OrderSummaryPanel
          subtotal={quote?.totals.subtotalPaisa ?? cartView.subtotalPaisa}
          discount={
            quote && quote.totals.discountPaisa > 0 ? quote.totals.discountPaisa : undefined
          }
          shipping={quote ? quote.totals.shippingPaisa : undefined}
          total={quote?.totals.totalPaisa ?? cartView.subtotalPaisa}
          taxInclusiveNote
          primaryAction={
            step === 2 ? (
              <Button
                variant="primary"
                glow
                className="w-full"
                disabled={submitting}
                onClick={() => void handlePlaceOrder()}
              >
                {submitting
                  ? "Placing order…"
                  : `Place order — ${formatNPR(quote?.totals.totalPaisa ?? 0)}`}
              </Button>
            ) : undefined
          }
          className="sticky top-24"
        />
      </div>
    </div>
  );
}
