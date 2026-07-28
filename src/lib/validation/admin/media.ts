/**
 * `/admin/media` and the product wizard's Photos step — docs/09-ADMIN-
 * DAD-MODE.md §5.1 Step 2's "presigned direct-to-S3" upload flow: the
 * browser asks the server for a presigned PUT URL (`requestUploadSchema`),
 * uploads the file straight to S3 with it, then tells the server the
 * upload finished (`completeUploadSchema`) so a `Media` row can be
 * created. Neither schema carries the file bytes themselves — those go
 * browser-to-S3 directly, never through a Server Action's payload.
 */
import { z } from "zod";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** docs/09 §5.1's upload pipeline strips EXIF and regenerates derivatives server-side regardless of the original size, but the presign step itself still refuses anything absurd up front — matching `lib/errors.ts`'s existing `UPLOAD_TOO_LARGE` error code. 15 MB comfortably covers a phone photo. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const requestUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ACCEPTED_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, "That photo is too large. Please use one under 15 MB."),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const completeUploadSchema = z.object({
  /** The S3 object key the presigned URL was issued for. */
  key: z.string().trim().min(1).max(500),
  mimeType: z.enum(ACCEPTED_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** SHA-256 hex digest, computed client-side before upload — the input the checksum-dedup check runs against (docs/09 §5.1: "Duplicate detection by checksum"). */
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "Invalid checksum."),
  altText: z.string().trim().max(300).optional(),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
