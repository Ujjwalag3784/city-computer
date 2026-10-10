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
    // Product photos uploaded from the admin live in Vercel Blob
    // (server/services/admin/media.ts); every store's public host has this
    // shape. Nothing else is allowed through the optimiser: storefront
    // placeholders are local files, and S3/CDN media (if ever configured)
    // renders as plain <img> because its host is only known at runtime.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    // NOT set: `dangerouslyAllowSVG`. The one SVG the app serves
    // (`public/images/placeholder/product.svg`) is rendered `unoptimized` by
    // `ProductImage` instead, so the optimiser never has to accept scriptable
    // SVG input.
  },
  // Next.js does not generate a `/sitemap.xml` index for a sitemap that uses
  // `generateSitemaps()`; this serves the one `robots.ts` advertises. See
  // `src/app/api/sitemap-index/route.ts`.
  async redirects() {
    return [
      // The seeded "Contact" info page carried made-up phone numbers; the
      // real contact page reads the owner's Settings.
      { source: "/pages/contact", destination: "/contact", permanent: false },
      { source: "/ne/pages/contact", destination: "/ne/contact", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/sitemap.xml", destination: "/api/sitemap-index" }];
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
