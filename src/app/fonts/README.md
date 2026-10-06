# Self-hosted fonts

Manrope, Inter and JetBrains Mono (variable, Latin subset), copied from the
`@fontsource-variable/*` 5.3.0 packages. All three are licensed under the SIL
Open Font License 1.1; the licence for each is alongside its font file.

Loaded through `next/font/local` in `src/app/layout.tsx`.

Why not `next/font/google`: it downloads the fonts from Google at build time,
and Google intermittently returns a font URL without a file extension, which
crashes `next/font`'s loader ("Cannot read properties of null (reading '1')").
That failed the 2026-10-06 production deploy while an identical build on a
second Vercel project passed. Bundling the files removes the network from the
build entirely.
