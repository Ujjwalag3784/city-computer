"use server";

/**
 * `/order/[orderNumber]` Server Actions — docs/17-ROADMAP-PHASES.md Phase
 * 7's customer order tracking page. Four actions: the guest phone-gate
 * check, the two receipt-upload steps (bank transfer only), and the
 * on-demand invoice download.
 *
 * Every action beyond the phone-gate check itself re-derives access from
 * scratch via `resolveOrderDetail` below — nothing here trusts a
 * previous action's "you're allowed in" result across calls (there's no
 * server-side session for a guest's verified-phone state; the client
 * simply re-sends the phone it already collected). This matches docs/13-
 * SECURITY.md's "every fetch-by-identifier re-checks ownership" rule at
 * the cost of the guest re-entering their phone if, e.g., a receipt
 * upload's two calls land far enough apart that seems worth flagging: in
 * practice they're two calls a few seconds apart from the same page load,
 * so this is a non-issue in practice, not a real UX gap.
 */
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { AppError, validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import {
  getOrderDetailIfOwner,
  verifyOrderAccessByPhone,
  type OrderDetail,
} from "@/server/services/commerce/order-lookup";
import {
  requestReceiptUpload,
  completeReceiptUpload,
  type RequestedReceiptUpload,
} from "@/server/services/commerce/receipt-upload";
import { renderInvoicePdf } from "@/server/services/commerce/invoice";
import { requestReceiptUploadSchema, completeReceiptUploadSchema } from "@/lib/validation/receipt";
import { runStorefrontAction, type ActionResult } from "../../_lib/action-result";

/** Same header-trust reasoning as `lib/request-ip.ts`'s `getRequestIp` — duplicated here in `next/headers` terms (a Server Action has no raw `Request` object to hand that function) rather than refactoring that shared helper's signature mid-Phase-7. */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}

async function resolveOrderDetail(
  orderNumber: string,
  phone: string | undefined,
): Promise<OrderDetail> {
  const session = await auth();
  const owned = await getOrderDetailIfOwner(orderNumber, session?.user?.id);
  if (owned) return owned;

  if (phone) {
    const verified = await verifyOrderAccessByPhone(orderNumber, phone);
    if (verified) return verified;
  }

  throw new AppError("NOT_FOUND", "We couldn't find an order matching that number and phone.");
}

/** The guest phone-gate's own check — rate limited per IP (docs/07 §3.5's `POST /api/v1/track`: "10/hour/IP"), since this is the one action in this file that lets an attacker try many phone numbers against one order number. */
export async function verifyOrderAccessAction(input: unknown): Promise<ActionResult<OrderDetail>> {
  return runStorefrontAction(async () => {
    const parsed = requireOrderNumberAndPhone(input);
    const ip = await clientIp();
    await rateLimit("orderLookup", `ip:${ip}`);
    return resolveOrderDetail(parsed.orderNumber, parsed.phone);
  });
}

function requireOrderNumberAndPhone(input: unknown): { orderNumber: string; phone: string } {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof (input as Record<string, unknown>).orderNumber !== "string" ||
    typeof (input as Record<string, unknown>).phone !== "string"
  ) {
    throw new AppError("VALIDATION_FAILED", "An order number and phone number are required.");
  }
  return input as { orderNumber: string; phone: string };
}

export async function requestReceiptUploadAction(
  input: unknown,
): Promise<ActionResult<RequestedReceiptUpload>> {
  return runStorefrontAction(async () => {
    const parsed = requestReceiptUploadSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const detail = await resolveOrderDetail(parsed.data.orderNumber, parsed.data.phone);
    return requestReceiptUpload(detail.id, parsed.data);
  });
}

export interface CompleteReceiptResult {
  mediaId: string;
}

export async function completeReceiptUploadAction(
  input: unknown,
): Promise<ActionResult<CompleteReceiptResult>> {
  return runStorefrontAction(async () => {
    const parsed = completeReceiptUploadSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const detail = await resolveOrderDetail(parsed.data.orderNumber, parsed.data.phone);
    const session = await auth();
    const result = await completeReceiptUpload(detail.id, session?.user?.id ?? null, parsed.data);
    return { mediaId: result.mediaId };
  });
}

export interface InvoiceDownload {
  fileName: string;
  /** Base64-encoded PDF bytes — a Server Action can only return plain serialisable data, so the client decodes this into a `Blob` itself rather than this route streaming `application/pdf` directly (that would need a Route Handler, not a Server Action; kept as an Action for this pass to reuse the same `resolveOrderDetail` access check inline rather than duplicating it behind a second auth path). */
  base64: string;
}

export async function downloadInvoiceAction(
  input: unknown,
): Promise<ActionResult<InvoiceDownload>> {
  return runStorefrontAction(async () => {
    const parsed = requireOrderNumberAndOptionalPhone(input);
    const detail = await resolveOrderDetail(parsed.orderNumber, parsed.phone);
    const bytes = await renderInvoicePdf(detail);
    return {
      fileName: `${detail.orderNumber}-invoice.pdf`,
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
}

function requireOrderNumberAndOptionalPhone(input: unknown): {
  orderNumber: string;
  phone?: string;
} {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof (input as Record<string, unknown>).orderNumber !== "string"
  ) {
    throw new AppError("VALIDATION_FAILED", "An order number is required.");
  }
  const phone = (input as Record<string, unknown>).phone;
  return {
    orderNumber: (input as { orderNumber: string }).orderNumber,
    phone: typeof phone === "string" ? phone : undefined,
  };
}
