/**
 * docs/11-SEO-STRATEGY.md §7.5's blog post OG image: "Cover image, title,
 * author, reading time" (falling back to this dynamic template when a
 * post has no hero image set — this codebase's `PublicPostDetail` doesn't
 * expose a cover image URL yet, see PROGRESS.md, so this is currently
 * always the text-only branded layout rather than a real photo).
 */
import { ImageResponse } from "next/og";
import { getPublicPostBySlug } from "@/server/services/content/blog";
import { OG_COLORS, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image-theme";

// NOT `runtime = "edge"`. This file reads live data through the catalog/content
// service layer, which reaches `@/server/db` -> `@prisma/adapter-pg` -> `pg`,
// and `pg` is a Node-only package: the edge runtime cannot resolve it
// (`Module not found: Can't resolve 'pg-native'`, then a 500 on every request
// for this image). It was declared `edge` from the moment it was written in
// Phase 11 and had never been exercised, because no build or dev server in any
// prior session got far enough to render it. `next/og`'s `ImageResponse` works
// on the Node.js runtime just as well, so the default runtime is simply
// correct here — only the static homepage OG image, which imports no services,
// can legitimately stay on the edge.
export const alt = "Blog post — City Computer Systems";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;

  let title = "City Computer Systems Blog";
  let authorName = "";
  let readingMinutes = 0;

  try {
    const post = await getPublicPostBySlug(slug);
    title = post.title;
    authorName = post.authorName;
    readingMinutes = post.readingMinutes;
  } catch {
    // Fall through with the generic defaults rather than 500ing an OG image request.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: OG_COLORS.background,
        }}
      >
        <div style={{ fontSize: 28, color: OG_COLORS.primary, display: "flex" }}>
          City Computer Systems Blog
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{ fontSize: 56, fontWeight: 700, color: OG_COLORS.onSurface, display: "flex" }}
          >
            {title}
          </div>
          {(authorName || readingMinutes > 0) && (
            <div style={{ fontSize: 28, color: OG_COLORS.onSurfaceVariant, display: "flex" }}>
              {[authorName, readingMinutes > 0 ? `${readingMinutes} min read` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
