/**
 * Bank-transfer receipt upload validation — docs/10-PAYMENTS-NEPAL.md §8's
 * "receipt image is a claim, not a payment" flow. Mirrors `lib/validation/
 * admin/media.ts`'s `requestUploadSchema`/`completeUploadSchema` shape
 * (same presigned-PUT-then-confirm round trip), kept as its own file
 * rather than imported from the admin one since this is a storefront-
 * facing, non-admin upload with a different accepted-type list (a bank
 * receipt is as likely to be a PDF as a photo).
 */
import { z } from "zod";

const ACCEPTED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Same 15 MB ceiling as the admin photo upload — a phone photo or a bank app's PDF both comfortably fit. */
const MAX_RECEIPT_UPLOAD_BYTES = 15 * 1024 * 1024;

export const requestReceiptUploadSchema = z.object({
  orderNumber: z.string().trim().min(1),
  /** Required only when the requester isn't the signed-in owner — re-verified server-side against `Order.phone`, never trusted alone. */
  phone: z.string().trim().optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ACCEPTED_RECEIPT_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_RECEIPT_UPLOAD_BYTES, "That file is too large. Please use one under 15 MB."),
});
export type RequestReceiptUploadInput = z.infer<typeof requestReceiptUploadSchema>;

export const completeReceiptUploadSchema = z.object({
  orderNumber: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  key: z.string().trim().min(1).max(500),
  mimeType: z.enum(ACCEPTED_RECEIPT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_RECEIPT_UPLOAD_BYTES),
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "Invalid checksum."),
});
export type CompleteReceiptUploadInput = z.infer<typeof completeReceiptUploadSchema>;
