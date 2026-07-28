"use client";

// Next.js's App Router requires the "use client" directive in the actual
// `error.tsx` file itself, not merely somewhere transitively imported —
// re-exporting a client component's default export from another module
// isn't enough for Next's convention-file boundary check to recognise
// this file as a Client Component (confirmed by `next build` rejecting
// this exact re-export without the directive present here too).
export { StorefrontError as default } from "../../_components/storefront-error";
