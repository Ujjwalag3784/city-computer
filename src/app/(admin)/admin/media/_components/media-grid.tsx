import type { AdminMediaItem } from "@/server/services/admin/media";
import { AltTextField } from "./alt-text-field";

/**
 * The Photo Library's grid — one card per already-uploaded `Media` row.
 * `usageCount` (docs/09 §5.1's savePhotos doc comment: photos are shared
 * and de-duplicated by checksum) is surfaced so an owner editing a
 * description here understands it may change what other products show
 * too, rather than assuming a description here is private to one photo.
 */
export function MediaGrid({ items }: { items: AdminMediaItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-body-lg text-on-surface-variant">
        You haven&rsquo;t uploaded any photos yet.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-2 rounded-lg border border-glass-stroke bg-surface-container p-2"
        >
          <div className="aspect-square overflow-hidden rounded bg-surface-container-high">
            {/* eslint-disable-next-line @next/next/no-img-element -- CDN/S3 host is environment-configured, not a fixed domain next/image's remotePatterns can be set to ahead of time (same reasoning as image-dropzone.tsx). */}
            <img src={item.url} alt={item.altText ?? ""} className="size-full object-cover" />
          </div>
          <AltTextField mediaId={item.id} initialValue={item.altText ?? ""} />
          <p className="text-label-mono-xs text-on-surface-variant">
            {item.usageCount > 0
              ? `Used on ${item.usageCount} product${item.usageCount === 1 ? "" : "s"}`
              : "Not used yet"}
          </p>
        </li>
      ))}
    </ul>
  );
}
