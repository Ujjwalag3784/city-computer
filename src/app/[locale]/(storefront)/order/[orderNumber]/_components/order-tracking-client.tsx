"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { OrderStatusTracker } from "@/components/commerce/order-status-tracker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatNPR } from "@/lib/money";
import type { OrderDetail } from "@/server/services/commerce/order-lookup";
import {
  verifyOrderAccessAction,
  requestReceiptUploadAction,
  completeReceiptUploadAction,
  downloadInvoiceAction,
} from "../_actions";

export interface OrderTrackingClientProps {
  orderNumber: string;
  initialDetail: OrderDetail | null;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function triggerBase64Download(fileName: string, base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    // eslint-disable-next-line security/detect-object-injection -- `i` is a bounded numeric loop counter over `bytes`'s own length, never arbitrary input.
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function PaymentStatusLabel({ status }: { status: string }) {
  const label =
    status === "PAID"
      ? "Paid"
      : status === "FAILED"
        ? "Not accepted"
        : status === "PENDING"
          ? "Pending"
          : status;
  return <span className="text-body-sm text-on-surface">{label}</span>;
}

/**
 * `/order/[orderNumber]`'s interactive half. Two modes: `initialDetail`
 * present (server already confirmed this session owns the order — see
 * the page's own doc comment) skips straight to the full view; `null`
 * renders the phone-gate form, and a successful `verifyOrderAccessAction`
 * call swaps in the same detail shape client-side. The verified phone is
 * kept in local state only (never a cookie) so receipt-upload/invoice
 * actions can keep re-proving access per docs/13-SECURITY.md's "every
 * fetch re-checks ownership" rule — a page refresh re-gates, which is an
 * accepted, flagged trade-off (see `_actions.ts`'s own doc comment).
 */
export function OrderTrackingClient({ orderNumber, initialDetail }: OrderTrackingClientProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(initialDetail);
  const [verifiedPhone, setVerifiedPhone] = useState<string | undefined>(undefined);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleVerify() {
    setGateError(null);
    if (phoneDraft.trim() === "") {
      setGateError("Enter the phone number used for this order.");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyOrderAccessAction({ orderNumber, phone: phoneDraft.trim() });
      if (!result.ok || !result.data) {
        setGateError(
          result.message ?? "We couldn't find that order. Please check the number and phone.",
        );
        return;
      }
      setDetail(result.data);
      setVerifiedPhone(phoneDraft.trim());
    } finally {
      setVerifying(false);
    }
  }

  async function handleReceiptUpload(file: File) {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const checksum = await sha256Hex(buffer);

      const presign = await requestReceiptUploadAction({
        orderNumber,
        phone: verifiedPhone,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (!presign.ok || !presign.data) {
        toast(presign.message ?? "Couldn't start the upload. Please try again.");
        return;
      }

      const putResponse = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) {
        toast("The upload didn't go through. Please try again.");
        return;
      }

      const complete = await completeReceiptUploadAction({
        orderNumber,
        phone: verifiedPhone,
        key: presign.data.key,
        mimeType: file.type,
        sizeBytes: file.size,
        checksum,
      });
      if (!complete.ok || !complete.data) {
        toast(complete.message ?? "Couldn't save the receipt. Please try again.");
        return;
      }

      toast("Receipt uploaded — we'll review it shortly.");
      const mediaId = complete.data.mediaId;
      setDetail((prev) =>
        prev && prev.payment
          ? {
              ...prev,
              payment: { ...prev.payment, receiptMediaId: mediaId, rejectionReason: null },
            }
          : prev,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadInvoice() {
    setDownloading(true);
    try {
      const result = await downloadInvoiceAction({ orderNumber, phone: verifiedPhone });
      if (!result.ok || !result.data) {
        toast(result.message ?? "Couldn't generate the invoice. Please try again.");
        return;
      }
      triggerBase64Download(result.data.fileName, result.data.base64);
    } finally {
      setDownloading(false);
    }
  }

  if (!detail) {
    return (
      <Card variant="surface">
        <CardContent className="flex flex-col gap-4 pt-[--space-card-padding]">
          <p className="text-body-md text-on-surface-variant">
            Enter the phone number used when this order was placed to view its status.
          </p>
          {gateError && (
            <Alert variant="destructive">
              <AlertDescription>{gateError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="tracking-phone">Mobile number</Label>
            <Input
              id="tracking-phone"
              type="tel"
              placeholder="98XXXXXXXX"
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value)}
            />
          </div>
          <Button
            variant="primary"
            glow
            className="w-full sm:w-auto"
            disabled={verifying}
            onClick={() => void handleVerify()}
          >
            {verifying ? "Checking…" : "View order"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const shipping = detail.addresses.find((a) => a.type === "SHIPPING");
  const showReceiptUpload =
    detail.payment?.provider === "BANK_TRANSFER" &&
    detail.payment.status !== "PAID" &&
    !detail.payment.receiptMediaId;

  return (
    <div className="flex flex-col gap-6">
      <Card variant="surface">
        <CardContent className="flex flex-col gap-4 pt-[--space-card-padding]">
          <OrderStatusTracker status={detail.visibleStatus} />
          {detail.extraStatusNote && (
            <p className="text-body-sm text-on-surface-variant">{detail.extraStatusNote}</p>
          )}
          {detail.cancellationReason && (
            <Alert variant="destructive">
              <AlertDescription>{detail.cancellationReason}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Items</h2>
          <ul className="flex flex-col divide-y divide-glass-stroke">
            {detail.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-body-md text-on-surface">{item.productName}</p>
                  {item.variantLabel && (
                    <p className="text-body-sm text-on-surface-variant">{item.variantLabel}</p>
                  )}
                  <p className="text-body-sm text-on-surface-variant">Qty {item.quantity}</p>
                </div>
                <p className="text-body-md text-on-surface">{formatNPR(item.lineTotalPaisa)}</p>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-body-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatNPR(detail.totals.subtotalPaisa)}</span>
            </div>
            {detail.totals.discountPaisa > 0 && (
              <div className="flex items-baseline justify-between text-body-sm text-success">
                <span>Discount</span>
                <span>-{formatNPR(detail.totals.discountPaisa)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between text-body-sm text-on-surface-variant">
              <span>Shipping</span>
              <span>{formatNPR(detail.totals.shippingPaisa)}</span>
            </div>
            <div className="flex items-baseline justify-between text-body-md font-medium text-on-surface">
              <span>Total</span>
              <span>{formatNPR(detail.totals.totalPaisa)}</span>
            </div>
            <p className="text-body-sm text-on-surface-variant">VAT included</p>
          </div>

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={downloading}
            onClick={() => void handleDownloadInvoice()}
          >
            <Download aria-hidden="true" />
            {downloading ? "Preparing invoice…" : "Download invoice"}
          </Button>
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-4 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">
            {detail.fulfilmentType === "PICKUP" ? "Pickup" : "Delivery address"}
          </h2>
          {shipping && (
            <div className="text-body-sm text-on-surface-variant">
              <p>{shipping.fullName}</p>
              <p>{shipping.phone}</p>
              {detail.fulfilmentType === "PICKUP" && detail.branch ? (
                <p>
                  {detail.branch.name} — {detail.branch.addressLine}, {detail.branch.district}
                </p>
              ) : (
                <p>
                  {shipping.streetAddress}, {shipping.municipality}
                  {shipping.ward ? ` (Ward ${shipping.ward})` : ""}, {shipping.district}
                </p>
              )}
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <h2 className="text-body-lg font-medium text-on-surface">Payment</h2>
            {detail.payment && <PaymentStatusLabel status={detail.payment.status} />}
          </div>
          {detail.payment && (
            <p className="text-body-sm text-on-surface-variant">
              {detail.payment.provider === "COD" ? "Cash on Delivery" : "Bank Transfer"} —{" "}
              {formatNPR(detail.payment.amountPaisa)}
            </p>
          )}
          {detail.payment?.status === "FAILED" && detail.payment.rejectionReason && (
            <Alert variant="destructive">
              <AlertDescription>{detail.payment.rejectionReason}</AlertDescription>
            </Alert>
          )}
          {detail.payment?.receiptMediaId && detail.payment.status !== "FAILED" && (
            <p className="text-body-sm text-on-surface-variant">
              Receipt uploaded — awaiting review.
            </p>
          )}

          {showReceiptUpload && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-upload">Upload your bank transfer receipt</Label>
              <input
                id="receipt-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleReceiptUpload(file);
                }}
                className="text-body-sm text-on-surface-variant file:mr-3 file:rounded file:border file:border-glass-stroke file:bg-surface-container file:px-3 file:py-2 file:text-body-sm file:text-on-surface"
              />
              {uploading && (
                <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Upload className="size-4 animate-pulse" aria-hidden="true" />
                  Uploading…
                </p>
              )}
            </div>
          )}

          {detail.customerNote && (
            <p className="text-body-sm text-on-surface-variant">Note: {detail.customerNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
