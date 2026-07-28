"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ImageIcon, Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * ImageDropzone — docs/09-ADMIN-DAD-MODE.md §5.1 Step 2 "Photos": "Large
 * drag-and-drop zone: 'Drag photos here, or click to choose. The first
 * photo is the main one.' ... Reorder by drag. The first slot is labelled
 * 'Main photo'. Each photo has an editable 'Photo description' field ...
 * Warning, not a block, if there are no photos ... Duplicate detection by
 * checksum."
 *
 * Scope note: the real upload pipeline described in docs/09 §5.1 (resize,
 * AVIF/WebP/JPEG generation, thumbnails, blur placeholder, EXIF stripping,
 * checksum, deterministic renaming, duplicate detection) is entirely
 * server-side and doesn't exist yet in this codebase — this component is
 * the **UI shell** only. It renders the drop target, hands the parent raw
 * `File[]` via `onFilesAdded` for the parent to actually upload, and then
 * renders/reorders/edits whatever already-uploaded `DropzoneImage[]` the
 * parent gives back. Clipboard-paste and mobile camera-capture (also
 * mentioned in §5.1) are deferred too — they only become meaningful once a
 * real upload endpoint exists to receive them. This component covers
 * drag-and-drop + click-to-choose only.
 *
 * Reorder mechanism: the doc says "reorder by drag" and suggests a
 * `GripVertical` handle, but a real pointer-event drag-and-drop
 * implementation (drag start/over/end, ghost preview, drop-index
 * calculation) is a lot of surface to get *correctly* right in one pass.
 * Per the task's own escape hatch, this ships small up/down arrow buttons
 * (`ArrowUp`/`ArrowDown`) per thumbnail instead — they call `onReorder`
 * with the array swapped, are fully keyboard-operable, and never look
 * draggable without actually being draggable. No `GripVertical` icon is
 * shown, since that icon specifically signals drag affordance this
 * component doesn't implement.
 *
 * The "Main photo" badge and the "first slot" concept are derived from
 * array position (`index === 0`) rather than trusted from the incoming
 * `image.isMain` flag, since a reorder always makes whichever image ends
 * up first the main one — position is the single source of truth. Every
 * `onReorder` call also normalises `isMain` on the array it passes back so
 * the parent's stored data can't drift from what's rendered.
 */

export interface DropzoneImage {
  id: string;
  /** Already-uploaded thumbnail/preview URL. */
  url: string;
  description: string;
  /** True only for the first slot (`images[0]`) conceptually — see note above. */
  isMain: boolean;
}

export interface ImageDropzoneProps {
  images: DropzoneImage[];
  onFilesAdded: (files: File[]) => void;
  onReorder: (images: DropzoneImage[]) => void;
  onRemove: (id: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
  className?: string;
}

export function ImageDropzone({
  images,
  onFilesAdded,
  onReorder,
  onRemove,
  onDescriptionChange,
  className,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFilesAdded(Array.from(fileList));
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    onReorder(next.map((image, i) => ({ ...image, isMain: i === 0 })));
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={handleZoneKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-glass-stroke bg-surface-container px-6 py-10 text-center transition-colors",
          "hover:border-primary-container hover:bg-surface-container-high",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDragging && "border-primary-container bg-surface-container-high shadow-glow",
        )}
      >
        <Upload className="size-8 text-on-surface-variant" aria-hidden="true" />
        <p className="text-body-md text-on-surface">
          Drag photos here, or click to choose. The first photo is the main one.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {images.length === 0 ? (
        <p className="flex items-center gap-2 text-body-sm text-warning">
          <ImageIcon className="size-4 shrink-0" aria-hidden="true" />
          Products with photos sell much better. Add at least one before publishing.
        </p>
      ) : (
        <>
          <p className="text-body-sm text-on-surface-variant">
            Describe what&rsquo;s in the photo. This helps people who can&rsquo;t see images, and
            helps Google.
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="flex flex-col gap-2 rounded-lg border border-glass-stroke bg-surface-container p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded bg-surface-container-high">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview/thumbnail
                      URLs may be local blob: URLs before a real upload endpoint exists (see
                      file doc comment); next/image's remote-pattern config can't cover those. */}
                  <img
                    src={image.url}
                    alt={image.description || "Product photo"}
                    className="h-full w-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary-container px-2 py-0.5 text-label-mono-xs text-on-primary-container">
                      Main photo
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => onRemove(image.id)}
                    className={cn(
                      "absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-surface-container/90 text-on-surface-variant transition-colors",
                      "hover:bg-surface-container-high hover:text-on-surface",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <Textarea
                  value={image.description}
                  onChange={(event) => onDescriptionChange(image.id, event.target.value)}
                  rows={2}
                  placeholder="Photo description"
                  aria-label={`Description for photo ${index + 1}`}
                  className="min-h-0 py-1.5 text-body-sm"
                />

                <div className="flex items-center justify-between">
                  <span className="text-label-mono-xs text-on-surface-variant">
                    Photo {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Move photo earlier"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded text-on-surface-variant transition-colors",
                        "hover:bg-surface-container-high hover:text-on-surface",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move photo later"
                      disabled={index === images.length - 1}
                      onClick={() => move(index, 1)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded text-on-surface-variant transition-colors",
                        "hover:bg-surface-container-high hover:text-on-surface",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
