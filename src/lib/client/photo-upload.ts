/**
 * Browser-side half of the presigned S3 upload round trip (docs/09-ADMIN-
 * DAD-MODE.md §5.1 Step 2 / `server/services/admin/media.ts`'s own doc
 * comment): compute a SHA-256 checksum and, where cheaply available,
 * pixel dimensions; ask the server for a presigned PUT URL; `fetch` the
 * file straight to S3 with it; then tell the server the upload finished
 * so it can create (or de-duplicate) the `Media` row.
 *
 * Shared by the product wizard's Photos step and the standalone Photo
 * Library (`/admin/media`) — both need the exact same three-call
 * sequence, just against a different pair of Server Actions and a
 * different alt-text hint. This file lives in `lib/` rather than
 * `components/` or a route's `_lib/` because it's used from two
 * different route subtrees; it takes the actual `requestUploadAction`/
 * `completeUploadAction` functions as parameters instead of importing
 * them itself, since `lib/**` must not import from `app/**`
 * (docs/04-REPOSITORY-STRUCTURE.md §3) and those are Server Actions
 * defined under `app/(admin)/admin/media/_actions.ts`.
 *
 * No progress percentage: a single `fetch` PUT doesn't expose upload
 * progress without switching to `XMLHttpRequest` — callers show an
 * indeterminate "Uploading…" state instead, which is enough for a photo
 * that's typically a few hundred KB to a few MB.
 */

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export class UnsupportedPhotoTypeError extends Error {}

type AcceptedMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export interface PresignedUploadRequest {
  fileName: string;
  mimeType: AcceptedMimeType;
  sizeBytes: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
}

export interface CompleteUploadPayload {
  key: string;
  mimeType: AcceptedMimeType;
  sizeBytes: number;
  width?: number;
  height?: number;
  checksum: string;
  altText?: string;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  altText: string | null;
  deduplicated: boolean;
}

interface ActionLikeResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

export interface PhotoUploadActions {
  requestUpload: (
    input: PresignedUploadRequest,
  ) => Promise<ActionLikeResult<PresignedUploadResult>>;
  completeUpload: (
    input: CompleteUploadPayload,
    altTextHint?: string,
  ) => Promise<ActionLikeResult<UploadedPhoto>>;
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Best-effort only — an unreadable/corrupt image still uploads, just without `width`/`height`. */
function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export async function uploadPhoto(
  file: File,
  actions: PhotoUploadActions,
  altTextHint?: string,
): Promise<UploadedPhoto> {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new UnsupportedPhotoTypeError("Please use a JPEG, PNG, WEBP, or AVIF photo.");
  }
  const mimeType = file.type as AcceptedMimeType;

  const [checksum, dimensions] = await Promise.all([sha256Hex(file), readImageDimensions(file)]);

  const presigned = await actions.requestUpload({
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  });
  if (!presigned.ok || !presigned.data) {
    throw new Error(presigned.message ?? "Couldn't start the photo upload. Please try again.");
  }

  const putResponse = await fetch(presigned.data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error("The photo upload didn't finish. Please try again.");
  }

  const completed = await actions.completeUpload(
    { key: presigned.data.key, mimeType, sizeBytes: file.size, checksum, ...dimensions },
    altTextHint,
  );
  if (!completed.ok || !completed.data) {
    throw new Error(completed.message ?? "Couldn't save the uploaded photo. Please try again.");
  }
  return completed.data;
}
