"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNPR } from "@/lib/money";
import { calculateEmi } from "@/lib/emi";
import type { EmiScheduleInput } from "@/lib/validation/emi";
import { submitEmiLeadAction } from "../_actions";

export interface EmiCalculatorClientProps {
  schedules: EmiScheduleInput;
}

/**
 * The public `/emi-calculator` calculator + lead-capture form. The
 * calculation itself (`calculateEmi`) runs client-side against the
 * already-fetched, already-validated `schedules` — there is nothing
 * secret about a monthly-payment estimate, so no round trip is needed for
 * that part; only the final "have someone call me" step is a Server
 * Action, per docs/10 §10 item 3 ("lead capture, not checkout").
 */
export function EmiCalculatorClient({ schedules }: EmiCalculatorClientProps) {
  const [bankIndex, setBankIndex] = useState(0);
  const [tenureIndex, setTenureIndex] = useState(0);
  const [amountRupees, setAmountRupees] = useState("100000");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSent, setLeadSent] = useState(false);

  // `bankIndex`/`tenureIndex` only ever come from this component's own
  // `Select`s, whose items are generated 1:1 from `schedules`'/`bank.tenures`'
  // own indices — never arbitrary input. Same reasoning as
  // `components/commerce/emi-widget.tsx`'s identical `bankIndex` lookup.
  // eslint-disable-next-line security/detect-object-injection
  const bank = schedules[bankIndex] ?? schedules[0];
  // eslint-disable-next-line security/detect-object-injection
  const tenure = bank?.tenures[tenureIndex] ?? bank?.tenures[0];

  const amountPaisa = useMemo(() => {
    const rupees = Math.round(Number(amountRupees));
    return Number.isFinite(rupees) && rupees > 0 ? rupees * 100 : 0;
  }, [amountRupees]);

  const result = useMemo(() => {
    if (!tenure || amountPaisa <= 0) return null;
    try {
      return calculateEmi(amountPaisa, tenure);
    } catch {
      return null;
    }
  }, [amountPaisa, tenure]);

  async function handleLeadSubmit() {
    if (!bank || !tenure) return;
    setLeadError(null);
    setSubmitting(true);
    try {
      const response = await submitEmiLeadAction({
        name: leadName,
        phone: leadPhone,
        email: leadEmail,
        bank: bank.bank,
        tenureMonths: tenure.months,
        amountPaisa,
      });
      if (!response.ok) {
        setLeadError(response.message ?? "We couldn't send that. Please try again.");
        return;
      }
      setLeadSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!bank || !tenure) {
    return (
      <p className="text-body-md text-on-surface-variant">
        No instalment plans are published right now — please check back later.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-xl border border-glass-stroke bg-surface-container p-[--space-card-padding]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emi-amount">Item price (NPR)</Label>
            <Input
              id="emi-amount"
              inputMode="numeric"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emi-bank">Bank</Label>
            <Select
              value={String(bankIndex)}
              onValueChange={(value) => {
                setBankIndex(Number(value));
                setTenureIndex(0);
              }}
            >
              <SelectTrigger id="emi-bank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((b, index) => (
                  <SelectItem key={b.bank} value={String(index)}>
                    {b.bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emi-tenure">Tenure</Label>
            <Select
              value={String(tenureIndex)}
              onValueChange={(value) => setTenureIndex(Number(value))}
            >
              <SelectTrigger id="emi-tenure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bank.tenures.map((t, index) => (
                  <SelectItem key={t.months} value={String(index)}>
                    {t.months} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && (
          <div className="flex flex-col gap-3 border-t border-glass-stroke pt-4">
            <div>
              <div className="text-label-mono-xs text-on-surface-variant">Monthly payment</div>
              <div className="text-price text-on-surface">
                {formatNPR(result.monthlyPaymentPaisa)}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-label-mono-xs text-on-surface-variant">
                  Total interest &amp; fees
                </div>
                <div className="text-body-md text-on-surface">
                  {formatNPR(result.totalInterestAndFeesPaisa)}
                </div>
              </div>
              <div>
                <div className="text-label-mono-xs text-on-surface-variant">Total payable</div>
                <div className="text-body-md text-on-surface">
                  {formatNPR(result.totalPayablePaisa)}
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-body-sm text-on-surface-variant">
          Estimate only. EMI is arranged directly with your bank at the time of purchase — final
          terms depend on your bank&apos;s approval.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-glass-stroke p-[--space-card-padding]">
        <h2 className="text-headline-sm text-on-surface">Want us to call you about this?</h2>
        {leadSent ? (
          <p className="text-body-md text-on-surface-variant">
            Thanks — someone from our team will reach out shortly.
          </p>
        ) : (
          <>
            {leadError && (
              <Alert variant="destructive">
                <AlertDescription>{leadError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emi-lead-name">Your name</Label>
                <Input
                  id="emi-lead-name"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emi-lead-phone">Phone number</Label>
                <Input
                  id="emi-lead-phone"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor="emi-lead-email">Email (optional)</Label>
              <Input
                id="emi-lead-email"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
              />
            </div>
            <Button
              disabled={submitting || !leadName || !leadPhone}
              onClick={() => void handleLeadSubmit()}
              className="self-start"
            >
              {submitting ? "Sending…" : "Request a call back"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
