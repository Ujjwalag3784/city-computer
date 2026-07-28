"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadPhoto, UnsupportedPhotoTypeError } from "@/lib/client/photo-upload";
import { cn } from "@/lib/utils";
import { requestUploadAction, completeUploadAction } from "../_actions";

/**
 * `/admin/media`'s own uploader — docs/09-ADMIN-DAD-MODE.md §3's "Photos"
 * screen. Deliberately a separate, simpler component from `ImageDropzone`
 * (the product wizard's Photos step): that component's "first slot is the
 * main photo" concept and reorder controls are specific to a single
 * product's photo set and would be actively misleading painted onto a
 * flat, unordered library of every photo ever uploaded. This is just a
 * drop target — uploaded photos land in the grid below via
 * `router.refresh()`, since that grid is server-rendered from
 * `listMediaForAdmin` in `page.tsx`.
 */
export function MediaUploadZone() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingCount((count) => count + files.length);
    for (const file of files) {
      try {
        await uploadPhoto(file, {
          requestUpload: requestUploadAction,
          completeUpload: completeUploadAction,
        });
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
    router.refresh();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-glass-stroke bg-surface-container px-6 py-10 text-center transition-colors",
        "hover:border-primary-container hover:bg-surface-container-high",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isDragging && "border-primary-container bg-surface-container-high shadow-glow",
      )}
    >
      <Upload className="size-8 text-on-surface-variant" aria-hidden="true" />
      <p className="text-body-md text-on-surface">Drag photos here, or click to choose.</p>
      {uploadingCount > 0 && (
        <p className="text-body-sm text-on-surface-variant">
          Uploading {uploadingCount} photo{uploadingCount === 1 ? "" : "s"}…
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
