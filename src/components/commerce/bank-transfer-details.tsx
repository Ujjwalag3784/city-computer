"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { formatNPR } from "@/lib/money";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { cn } from "@/lib/utils";

export interface BankAccountView {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
}

export interface BankTransferDetailsProps {
  /** `null` until the owner fills in Settings → Bank account. */
  account: BankAccountView | null;
  whatsappE164: string;
  /** Shown as "Amount to send" when known (on the order page). */
  amountPaisa?: number;
  /** The order number customers should write as the transfer remark. */
  reference?: string;
  className?: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-body-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Where to send a bank transfer — shown at checkout and on the order page. */
export function BankTransferDetails({
  account,
  whatsappE164,
  amountPaisa,
  reference,
  className,
}: BankTransferDetailsProps) {
  const whatsappHref = `https://wa.me/${whatsappE164.replace(/[^\d]/g, "")}`;

  if (!account) {
    return (
      <div
        className={cn(
          "rounded-lg border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant",
          className,
        )}
      >
        {reference
          ? "We'll send you our bank account details on WhatsApp shortly. For a quicker reply, message us on "
          : "We'll send you our bank account details on WhatsApp after you place the order. You can also message us now on "}
        <a href={whatsappHref} className="text-primary underline" target="_blank" rel="noreferrer">
          {formatNepalPhoneForDisplay(whatsappE164)}
        </a>
        .
      </div>
    );
  }

  const rows: { label: string; value: string; copy?: boolean }[] = [
    { label: "Bank", value: account.bankName },
    { label: "Account name", value: account.accountName },
    { label: "Account number", value: account.accountNumber, copy: true },
    { label: "Branch", value: account.branch },
  ].filter((row) => row.value);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4",
        className,
      )}
    >
      <p className="text-body-sm font-medium text-on-surface">Send the payment to</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <dt className="text-on-surface-variant">{row.label}</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
              <span className={row.copy ? "font-mono tracking-wide" : undefined}>{row.value}</span>
              {row.copy && <CopyButton value={row.value} label={row.label.toLowerCase()} />}
            </dd>
          </React.Fragment>
        ))}
        {amountPaisa !== undefined && (
          <>
            <dt className="text-on-surface-variant">Amount</dt>
            <dd className="font-medium text-on-surface">{formatNPR(amountPaisa)}</dd>
          </>
        )}
        {reference && (
          <>
            <dt className="text-on-surface-variant">Remarks</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
              <span className="font-mono">{reference}</span>
              <CopyButton value={reference} label="order number" />
            </dd>
          </>
        )}
      </dl>
      <p className="text-body-sm text-on-surface-variant">
        {reference
          ? "Write the order number as the remark, then upload a screenshot of the transfer below. "
          : "You'll see these details again on your order page after you place the order. "}
        We confirm your order as soon as the money arrives.
      </p>
    </div>
  );
}
