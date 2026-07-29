/**
 * Bank-transfer receipt storage — docs/10-PAYMENTS-NEPAL.md §8's "receipt
 * image is a claim, not a payment" flow, storefront-facing counterpart to
 * `admin/media.ts`'s product-photo uploader.
 *
 * DELIBERATELY PRIVATE, unlike `admin/media.ts`: `completeUpload` there
 * builds a public-style `url` via `publicUrlForKey` because product
 * photos are meant to be rendered on public PDPs. A bank receipt must
 * never be reachable that way — this file never constructs or stores a
 * public URL, and `getReceiptViewUrl` below is the only way to ever see
 * the file's bytes: a short-lived presigned GET, minted on demand for an
 * admin who has already passed the bank-transfer approval permission
 * check (`admin/orders` route handles that gate — this file only knows
 * how to mint the URL, not who's allowed to ask for one).
 *
 * The S3 client setup below duplicates `admin/media.ts`'s own
 * `requireS3Config`/`getS3Client` rather than importing them — those
 * aren't exported (module-private by design there), and refactoring a
 * second, already-shipped upload path to share a client helper mid-Phase-7
 * is more risk than this pass needs; the duplication is ~20 lines and one
 * clear place to look if the two ever need to diverge (e.g. a different
 * bucket for receipts later).
 *
 * NOT BUILT, flagged rather than faked (matches `payments/bank-transfer.ts`'s
 * own header): magic-byte sniffing, EXIF stripping, virus scanning. The
 * MIME/size checks here are the same client-declared-content-type trust
 * level `admin/media.ts` already has.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/server/db";
import { env } from "@/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { PaymentProvider } from "@/generated/prisma/client";
import type {
  RequestReceiptUploadInput,
  CompleteReceiptUploadInput,
} from "@/lib/validation/receipt";
import { attachReceipt } from "@/server/services/commerce/payments/bank-transfer";

const PRESIGNED_PUT_TTL_SECONDS = 300;
const PRESIGNED_GET_TTL_SECONDS = 300;

function requireS3Config() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new AppError("DEPENDENCY_UNAVAILABLE", "Receipt storage isn't set up yet.", {
      detail: "Ask whoever manages the server to add the S3_* settings, then try again.",
    });
  }
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? "us-east-1",
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}

let cachedClient: S3Client | null = null;

function getS3Client(config: ReturnType<typeof requireS3Config>): S3Client {
  cachedClient ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
  return cachedClient;
}

function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const ext =
    lastDot > 0
      ? fileName
          .slice(lastDot)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "")
      : "";
  return `${randomUUID()}${ext}`;
}

export interface RequestedReceiptUpload {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
}

/** Mints a presigned PUT URL for a specific order's bank-transfer payment — callers must have already re-verified the requester owns this order (see the checkout-order `_actions.ts` layer, which does that before calling in). */
export async function requestReceiptUpload(
  orderId: string,
  input: RequestReceiptUploadInput,
): Promise<RequestedReceiptUpload> {
  const payment = await db.payment.findFirst({
    where: { orderId, provider: PaymentProvider.BANK_TRANSFER },
  });
  if (!payment) {
    throw new AppError(
      "VALIDATION_FAILED",
      "This order doesn't have a bank transfer payment to attach a receipt to.",
    );
  }

  const config = requireS3Config();
  const client = getS3Client(config);

  const now = new Date();
  const datePrefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `receipts/${datePrefix}/${orderId}/${sanitizeFileName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGNED_PUT_TTL_SECONDS });
  return { uploadUrl, key, expiresInSeconds: PRESIGNED_PUT_TTL_SECONDS };
}

export interface CompletedReceiptUpload {
  mediaId: string;
  paymentId: string;
}

/**
 * Called once the browser's direct-to-S3 PUT has finished — creates the
 * private `Media` row (no public URL, see file doc comment) and attaches
 * it to the order's bank-transfer payment via `bank-transfer.ts`'s own
 * `attachReceipt` (which also logs the `receipt_attached` `PaymentEvent`).
 */
export async function completeReceiptUpload(
  orderId: string,
  uploaderUserId: string | null,
  input: CompleteReceiptUploadInput,
): Promise<CompletedReceiptUpload> {
  const payment = await db.payment.findFirst({
    where: { orderId, provider: PaymentProvider.BANK_TRANSFER },
  });
  if (!payment) {
    throw new AppError(
      "VALIDATION_FAILED",
      "This order doesn't have a bank transfer payment to attach a receipt to.",
    );
  }

  const config = requireS3Config();
  // Never publicUrlForKey here — see file doc comment. This "url" is a
  // private, never-linked reference; `Media.url` is a required column, so
  // it needs *some* string, but nothing storefront-facing ever renders it.
  const privateUrl = `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${input.key}`;

  const media = await db.media.create({
    data: {
      key: input.key,
      url: privateUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      // Prefixed with `orderId` (not just a `receipt:` tag) so the same
      // physical receipt re-uploaded for a different order — or re-
      // uploaded again after a rejection — never collides with
      // `Media.checksum`'s `@@unique` constraint, which this table shares
      // with product-photo deduplication.
      checksum: `receipt:${orderId}:${input.checksum}:${randomUUID()}`,
      altText: "Bank transfer receipt",
      uploadedById: uploaderUserId,
    },
  });

  await attachReceipt(payment.id, media.id);

  return { mediaId: media.id, paymentId: payment.id };
}

/** Short-lived presigned GET for an admin reviewing a receipt — the only way this file's stored objects are ever read back. */
export async function getReceiptViewUrl(mediaId: string): Promise<string> {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new NotFoundError("Receipt");

  const config = requireS3Config();
  const client = getS3Client(config);
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: media.key });
  return getSignedUrl(client, command, { expiresIn: PRESIGNED_GET_TTL_SECONDS });
}
