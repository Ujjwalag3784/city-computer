// Aliased over the real `server-only` package for the Vitest run (see
// `vitest.config.ts`'s `resolve.alias`). The real package unconditionally
// throws when its module body executes — Next.js makes that safe in
// practice by aliasing it to a no-op in its *server* webpack bundle and
// only letting the throw survive in the *client* bundle, so app code never
// actually hits it. Vitest doesn't run Next's webpack config at all, so
// without this shim, any test that transitively imports a module chain
// ending in `import "server-only"` (e.g. `server/services/**` -> `@/env`)
// fails immediately with that thrown error, regardless of whether the
// test itself does anything server-specific. This file intentionally
// exports nothing — importing it is a no-op, exactly what happens for real
// application code running on the server.
export {};
