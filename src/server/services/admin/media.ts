/**
 * The Photo Library — docs/09-ADMIN-DAD-MODE.md §5.1 Step 2 and the
 * standalone `/admin/media` screen ("Photos" in the module map, docs/09
 * §3). Presigned direct-to-S3 upload is real: `requestUpload` genuinely
 * calls the AWS SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-
 * presigner`, added this session) to mint a real presigned PUT URL —
 * this is not a stub.
 *
 * WHAT IS NOT YET BUILT, flagged rather than faked:
 * - **Server-side derivative generation** (docs/09 §5.1: "automatically:
 *   resize, generate AVIF + WebP + JPEG, produce thumbnails and a blur
 *   placeholder, strip EXIF"). That needs an image-processing library
 *   (`sharp`, a native binding) and a background job to run it after the
 *   browser's direct-to-S3 PUT completes — real, separate work. Every
 *   `Media` row this file creates has `variants: null` and
 *   `blurDataUrl: null` until that job exists.
 * - **Auto alt text** is a deterministic template
 *   (`{productName} photo` — see `buildFallbackAltText`), not real
 *   image-content description. docs/09 §5.1's example ("HP Victus 15
 *   gaming laptop, front view") implies actual vision analysis; this is
 *   an honest placeholder the owner is expected to edit, not an attempt
 *   at the real thing.
 *
 * WHAT IS real: the presigned-URL round trip, checksum-based duplicate
 * detection (docs/09 §5.1: "Duplicate detection by checksum... 'You've
 * already uploaded this photo. Use the existing one?'"), and the `Media`
 * row itself.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/server/db";
import { env } from "@/env";
import { AppError, NotFoundError } from "@/lib/errors";
import type { CompleteUploadInput, RequestUploadInput } from "@/lib/validation/admin/media";
import { recordAuditLog, type AuditActor } from "./audit-log";

const PRESIGNED_URL_TTL_SECONDS = 300;

function requireS3Config() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    // docs/07-API-DESIGN.md's `DEPENDENCY_UNAVAILABLE` (503) code exists
    // for exactly this: a real, external dependency this feature needs
    // isn't configured in this environment. No S3 credentials are set in
    // this sandbox's `.env` — same "flag it, don't fake it" treatment as
    // the Prisma migration and pg_trgm gaps elsewhere in this codebase.
    throw new AppError("DEPENDENCY_UNAVAILABLE", "Photo storage isn't set up yet.", {
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
    // MinIO (this project's local S3-compatible store — docs/03) needs
    // path-style addressing; real AWS S3 works with either.
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

export interface RequestedUpload {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
}

/** Mints a presigned S3 PUT URL the browser uploads directly to — the file's bytes never pass through this Next.js server. */
export async function requestUpload(input: RequestUploadInput): Promise<RequestedUpload> {
  const config = requireS3Config();
  const client = getS3Client(config);

  const now = new Date();
  const datePrefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `products/${datePrefix}/${sanitizeFileName(input.fileName)}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });

  return { uploadUrl, key, expiresInSeconds: PRESIGNED_URL_TTL_SECONDS };
}

function publicUrlForKey(key: string, bucket: string, endpoint: string): string {
  if (env.NEXT_PUBLIC_CDN_URL) return `${env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "")}/${key}`;
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}

/** See the module doc comment's "auto alt text" note — a deterministic placeholder, not real image analysis. */
function buildFallbackAltText(hint?: string): string {
  return hint ? `${hint} photo` : "Product photo";
}

export interface CompletedUpload {
  id: string;
  url: string;
  altText: string | null;
  /** True if this matched an already-uploaded photo by checksum rather than creating a new row — docs/09 §5.1's "Use the existing one?" case. */
  deduplicated: boolean;
}

/**
 * Called once the browser's direct-to-S3 PUT (using the URL from
 * `requestUpload`) has finished. Checksum dedup runs first: if a `Media`
 * row with this exact checksum already exists, that row is returned
 * as-is (the just-uploaded S3 object at `input.key` is simply never
 * referenced by anything — an orphaned but harmless object, cheaper to
 * accept than to also wire up a delete-on-dedup call for this pass).
 */
export async function completeUpload(
  input: CompleteUploadInput,
  actor: AuditActor,
  altTextHint?: string,
): Promise<CompletedUpload> {
  // `checksum` carries `@@unique` in the schema, so this is a direct
  // lookup, not a scan.
  const existing = await db.media.findUnique({ where: { checksum: input.checksum } });
  if (existing) {
    return { id: existing.id, url: existing.url, altText: existing.altText, deduplicated: true };
  }

  const config = requireS3Config();
  const url = publicUrlForKey(input.key, config.bucket, config.endpoint);
  const altText = input.altText?.trim() || buildFallbackAltText(altTextHint);

  const media = await db.media.create({
    data: {
      key: input.key,
      url,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      checksum: input.checksum,
      altText,
      uploadedById: actor.id,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "media.uploaded",
    entityType: "Media",
    entityId: media.id,
    after: { key: input.key, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
  });

  return { id: media.id, url: media.url, altText: media.altText, deduplicated: false };
}

export interface AdminMediaItem {
  id: string;
  url: string;
  altText: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  /** How many products currently use this photo — surfaced so the library can warn before letting someone lose track of a shared photo (no delete UI ships in this pass either way; see the file doc comment). */
  usageCount: number;
}

const MEDIA_LIBRARY_PAGE_SIZE = 60;

/** `/admin/media` — most recently uploaded first. No search/filtering in this pass (the library is a flat recency-ordered grid); see the file doc comment for the fuller list of what Phase 5f still doesn't cover. */
export async function listMediaForAdmin(
  page = 1,
): Promise<{ items: AdminMediaItem[]; hasNext: boolean }> {
  const rows = await db.media.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * MEDIA_LIBRARY_PAGE_SIZE,
    take: MEDIA_LIBRARY_PAGE_SIZE + 1,
    include: { _count: { select: { productMedia: true } } },
  });

  const hasNext = rows.length > MEDIA_LIBRARY_PAGE_SIZE;
  const items = rows.slice(0, MEDIA_LIBRARY_PAGE_SIZE).map((row) => ({
    id: row.id,
    url: row.url,
    altText: row.altText,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    usageCount: row._count.productMedia,
  }));

  return { items, hasNext };
}

export async function updateMediaAltText(
  id: string,
  altText: string,
  actor: AuditActor,
): Promise<void> {
  const media = await db.media.findUnique({ where: { id } });
  if (!media) throw new NotFoundError("Photo");

  await db.media.update({ where: { id }, data: { altText } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "media.altTextUpdated",
    entityType: "Media",
    entityId: id,
    before: { altText: media.altText },
    after: { altText },
  });
}

// Surfaced so callers (the presign Server Action) can log a clear,
// specific warning rather than an opaque AWS SDK stack trace when S3
// simply isn't configured in this environment.
export function isS3Configured(): boolean {
  return Boolean(
    env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
}
