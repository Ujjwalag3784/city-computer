import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Intentionally empty, and it is not the cause of the `/_next/image 404`s
    // in the first deploy's logs: every `next/image` `src` in the app is a
    // local path, and the optimiser was faithfully relaying the 404 of the
    // placeholder file behind it (fixed in `prisma/seed/catalog.ts` +
    // `components/commerce/product-image.tsx`). Uploaded S3/CDN media
    // deliberately does not go through the optimiser either — the host comes
    // from `env.NEXT_PUBLIC_CDN_URL` at runtime and cannot be enumerated
    // here, so the admin media screens render plain `<img>` with a scoped
    // eslint-disable (see `admin/image-dropzone.tsx`). Add a pattern here
    // only once a single fixed image host is committed to.
    remotePatterns: [],
    // NOT set: `dangerouslyAllowSVG`. The one SVG the app serves
    // (`public/images/placeholder/product.svg`) is rendered `unoptimized` by
    // `ProductImage` instead, so the optimiser never has to accept scriptable
    // SVG input.
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
