"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImageDropzone, type DropzoneImage } from "@/components/admin/image-dropzone";
import { uploadPhoto, UnsupportedPhotoTypeError } from "@/lib/client/photo-upload";
import { requestUploadAction, completeUploadAction } from "../../media/_actions";

/**
 * Step 2 — "Photos" (docs/09-ADMIN-DAD-MODE.md §5.1). Wraps `ImageDropzone`
 * (the drag-drop/reorder/description UI shell built in an earlier phase)
 * with the real upload pipeline: each dropped file is uploaded to S3 via
 * `uploadPhoto` (checksum + presign + PUT + complete), one at a time, and
 * appended to the product's photo list as it finishes.
 *
 * Sequential, not parallel: a phone camera photo can be several MB, and
 * uploading five at once would make the "Uploading…" state ambiguous
 * about which photo is done. One at a time keeps the dropzone's own list
 * simple to reason about and matches how a shop owner actually adds
 * photos (a few at a time, watching them land).
 *
 * No per-tile progress bar (`uploadPhoto`'s own doc comment: a single
 * `fetch` PUT doesn't expose progress) — just a small "Uploading N
 * photo(s)…" line while any upload is in flight.
 */
export interface PhotosStepProps {
  photos: DropzoneImage[];
  onPhotosChange: (photos: DropzoneImage[]) => void;
  /** Used to build a fallback photo description ("HP Victus 15 photo") when the owner hasn't written one yet. */
  altTextHint?: string;
}

export function PhotosStep({ photos, onPhotosChange, altTextHint }: PhotosStepProps) {
  const [uploadingCount, setUploadingCount] = useState(0);

  async function handleFilesAdded(files: File[]) {
    setUploadingCount((count) => count + files.length);
    let current = photos;
    for (const file of files) {
      try {
        const uploaded = await uploadPhoto(
          file,
          { requestUpload: requestUploadAction, completeUpload: completeUploadAction },
          altTextHint,
        );
        if (current.some((photo) => photo.id === uploaded.id)) {
          toast("You've already uploaded this photo. Using the existing one.");
        } else {
          current = [
            ...current,
            {
              id: uploaded.id,
              url: uploaded.url,
              description: uploaded.altText ?? "",
              isMain: current.length === 0,
            },
          ];
          onPhotosChange(current);
        }
      } catch (error) {
        const message =
          error instanceof UnsupportedPhotoTypeError
            ? error.message
            : "Couldn't upload that photo. Please try again.";
        toast(message);
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ImageDropzone
        images={photos}
        onFilesAdded={(files) => void handleFilesAdded(files)}
        onReorder={onPhotosChange}
        onRemove={(id) => onPhotosChange(photos.filter((photo) => photo.id !== id))}
        onDescriptionChange={(id, description) =>
          onPhotosChange(
            photos.map((photo) => (photo.id === id ? { ...photo, description } : photo)),
          )
        }
      />
      {uploadingCount > 0 && (
        <p className="text-body-sm text-on-surface-variant">
          Uploading {uploadingCount} photo{uploadingCount === 1 ? "" : "s"}…
        </p>
      )}
    </div>
  );
}
