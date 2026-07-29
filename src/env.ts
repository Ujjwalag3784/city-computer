// The ONLY module app code should import for config, guarded so an
// accidental import into a Client Component bundle fails loudly at build
// time. The actual schema/parsing logic lives in `./env-core` (no guard),
// so that `src/server/db/seed-client.ts` — used by one-shot `tsx` scripts
// like `pnpm db:seed`, which never goes through Next.js's bundler and
// therefore can't rely on `server-only`'s bundler-condition trick — can
// read the exact same validated config without hitting the "This module
// cannot be imported from a Client Component module" crash. See
// `./env-core.ts`'s own header comment for the full explanation.
//
// docs/03-TECHNOLOGY-STACK.md §5.
import "server-only";

export { env, type Env } from "./env-core";
