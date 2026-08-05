/* eslint-disable security/detect-non-literal-fs-filename -- every path this
   file touches is one it discovered itself by walking `src/`, `prisma/` and
   package.json. There is no user input, no network input and no test
   fixture anywhere in here. */
/**
 * Architecture guard rather than a unit test. It walks the real import
 * graph and fails when a module ends up somewhere it cannot run. Two
 * directions of the same mistake are checked, because this project has hit
 * both:
 *
 *   1. Client -> server. Starting from every `"use client"` module under
 *      `src/`, fail if any of them can reach server-side-only code through
 *      a runtime (non-type-only) import.
 *   2. Script -> `server-only`. Starting from every `tsx`-run entry point
 *      in package.json's `scripts` (`pnpm db:seed`, `pnpm db:create-admin`),
 *      fail if any of them can reach a module carrying
 *      `import "server-only"`.
 *
 * Why this exists as a *test*: both classes of mistake are invisible to
 * `pnpm typecheck` (the imports are perfectly valid TypeScript), invisible
 * to `pnpm lint` (ESLint's `no-restricted-imports` boundary rules only see
 * one file's own import list, never a transitive chain three modules deep),
 * and invisible to the rest of the unit-test suite (Vitest replaces
 * `server-only` with `vitest.server-only-shim.ts`, precisely so service
 * modules stay testable, and Vitest runs in Node so `node:` builtins
 * resolve fine). The only tools that catch any of it are a real
 * `next build` and a real `pnpm db:*` run against a real database, neither
 * of which this project has in CI.
 *
 * ── Direction 1: `"use client"` -> server-side-only code ──
 *
 * "Server-side-only code" means any of:
 *   - a module carrying `import "server-only"`;
 *   - a module on the `SERVER_ONLY_MODULES` list below — the guard-free
 *     cores that exist so `tsx` scripts can import them (`@/env-core`,
 *     `@/lib/logger-core`) plus Prisma's generated client. None of these
 *     carries a `server-only` marker, by design, so nothing but this list
 *     stops a Client Component from reaching them;
 *   - a module that pulls in a Node-only runtime: a `node:` builtin, the
 *     Prisma query-engine runtime, or a package with no browser build at
 *     all (`SERVER_ONLY_PACKAGES`).
 * All three fail a production `next build`, or (for `pino`, which does ship
 * a browser shim) quietly bloat the client bundle with the whole
 * environment schema. Only the first class fails with a message that names
 * the problem.
 *
 * That list of guard-free cores is load-bearing and must grow whenever
 * another `-core` module is split out. The `server-only` marker used to be
 * the only thing this walk looked for, which was fine while every route to
 * `pino`/the env schema happened to pass through `@/env`. It no longer
 * does: `lib/logger.ts` was split into a guarded re-export plus
 * `lib/logger-core.ts` so `prisma/seed/create-admin.ts` could run under
 * plain `tsx` (see `lib/logger-core.ts`'s header). Without `@/env-core`,
 * `@/lib/logger-core` and `pino` on these lists, that split would have
 * silently deleted the protection this test was providing.
 *
 * The two `next build` failures that originally prompted this file:
 *
 * 1. `seo-preview.tsx` → `lib/seo/serp-hint.ts` → `lib/seo/metadata.ts` →
 *    `lib/seo/site.ts` → `@/env`. Fixed by extracting the shared length
 *    maxima into `lib/seo/limits.ts`, an import-free leaf.
 * 2. `staff-role-select.tsx` → `server/services/admin/staff.ts`. Fixed by
 *    moving `STAFF_ROLE_DESCRIPTIONS` to `lib/validation/admin/staff.ts`.
 *
 * Queued up behind those two, and only found by running this walk plus a
 * real webpack pass, were 19 more files importing a Prisma *enum value*
 * from `@/generated/prisma/client`. Prisma's own generated header says that
 * file is server-side only ("If you're looking for something you can import
 * in the client-side of your application, please refer to the `browser.ts`
 * file instead") — it opens with `import * as process from "node:process"`
 * and reaches `@prisma/client/runtime/client`. They now import from
 * `@/generated/prisma/enums`, which the generator emits as a plain
 * import-free `as const` catalogue. `@/generated/prisma/client` is named
 * explicitly on `SERVER_ONLY_MODULES` rather than being caught through its
 * own `node:process` import, because `src/generated/**` is gitignored: on a
 * fresh clone the specifier does not resolve, and a walk that relied on
 * following it would pass vacuously.
 *
 * All of these fixes are one-line import changes that are trivially easy to
 * undo by accident, which is exactly why the check is pinned down here.
 *
 * What the walk models, and where it is deliberately approximate:
 * - `"use server"` modules are a hard boundary. Next replaces an import of
 *   a Server Action with a client-side RPC stub, so nothing behind one ever
 *   enters the client bundle — a Client Component importing an action from
 *   `_actions.ts` is correct and must not be flagged.
 * - `import type { … }` and inline `import { type X }` are erased before
 *   bundling, so they are not edges. A non-type import whose bindings are
 *   never referenced in a value position is likewise elided by SWC, so it
 *   is not an edge either — that is how `import { ProductStatus } from
 *   "@/generated/prisma/client"` stays legal in a `"use client"` file when
 *   only used as a type.
 * - Bare package specifiers are not followed (no `node_modules`
 *   traversal); the lists above stand in for that.
 *
 * ── Direction 2: `tsx` script -> `server-only` ──
 *
 * `import "server-only"` works by package export conditions: Next's
 * bundler resolves it to an empty module on the server and to a
 * throw-on-load module in the client bundle. Plain Node/`tsx` sets neither
 * condition, so it gets the throwing variant — which means a one-shot
 * script crashes with "This module cannot be imported from a Client
 * Component module" the moment *anything* in its import graph reaches a
 * guarded module, however deep. That is the mirror image of direction 1,
 * and it has bitten this repo twice:
 *
 * 1. `pnpm db:seed`: `prisma/seed/index.ts` → `@/server/db` → `@/env`.
 *    Fixed in 506e22e by splitting `env.ts`/`env-core.ts` and
 *    `server/db.ts`/`server/db/create-client.ts` + `seed-client.ts`.
 * 2. `pnpm db:create-admin`: `prisma/seed/create-admin.ts` →
 *    `@/lib/password` → `@/lib/logger` → `@/env`. Not caught by (1)
 *    because `db:seed`'s graph never touches the logger, while
 *    `create-admin`'s does via `password.ts`'s two `logger.warn` calls.
 *    Fixed by the same split: `lib/logger.ts` + `lib/logger-core.ts`.
 *
 * The script walk deliberately differs from the client walk in three ways:
 * `node:` builtins and native packages are perfectly legal in a script, so
 * only the `server-only` guard itself is a violation; `"use server"` is not
 * a boundary (nothing rewrites imports for a plain Node process); and an
 * unreferenced-but-non-type import still counts as an edge, because Node
 * executes every `import` statement for its side effects whether or not
 * the bindings get used.
 *
 * The script entry points are read out of package.json rather than
 * hard-coded, so a newly added `tsx` script is covered automatically.
 *
 * Not done as a subprocess test (`tsx --eval "import(…)"`), even though
 * that would be the most faithful check: both seed entry points call
 * `main()` at module scope, so merely importing one would run the seed and
 * try to write to whatever database `DATABASE_URL` points at. A static
 * walk cannot be tricked into that, needs no environment, and models the
 * only failure mode that is actually at issue here — module resolution.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_DIR = path.resolve(SRC_DIR, "..");

/** Extension order a bundler would try for an extensionless specifier. */
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Bare packages that can only ever run on a server. Most have no browser
 * build at all; `pino` technically ships one, but reaching it from a Client
 * Component still means the whole logger — and, through
 * `lib/logger-core.ts`, the whole environment schema — lands in the browser
 * bundle, which is the bug this list is here to catch. None of these is
 * behind a `server-only` guard of its own.
 */
const SERVER_ONLY_PACKAGES = new Set([
  "ioredis",
  "argon2",
  "pg",
  "nodemailer",
  "pino",
  "@prisma/adapter-pg",
]);

/**
 * First-party modules that are server-side-only in reality but carry no
 * `server-only` guard, because a guard would break the `tsx` scripts that
 * need them (see this file's header). Reaching one of these from a Client
 * Component is exactly as wrong as reaching its guarded counterpart
 * (`@/env`, `@/lib/logger`, `@/server/db`) — it just fails less loudly, so
 * it has to fail here instead.
 */
const SERVER_ONLY_MODULES = new Set([
  "@/env-core",
  "@/lib/logger-core",
  "@/generated/prisma/client",
]);

/**
 * True for specifiers no client bundle may reach: `node:` builtins,
 * Prisma's query-engine runtime, the native/server packages above, and the
 * guard-free first-party cores above.
 */
function isClientForbiddenSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("node:") ||
    specifier.startsWith("@prisma/client/runtime") ||
    SERVER_ONLY_PACKAGES.has(specifier) ||
    SERVER_ONLY_MODULES.has(specifier)
  );
}

interface ImportEdge {
  specifier: string;
  /** `import type …` / `export type … from …` — erased by every toolchain. */
  typeOnly: boolean;
  /**
   * At least one binding is used in a value position. A non-type import
   * whose bindings are only used as types is elided by SWC when bundling,
   * but Node still executes it for its side effects — so this flag matters
   * to the client walk and not to the script walk.
   */
  referenced: boolean;
}

interface ModuleFacts {
  isClientEntry: boolean;
  isServerOnly: boolean;
  /** A `"use server"` module — an RPC boundary, not something the client bundle inlines. */
  isServerAction: boolean;
  edges: ImportEdge[];
}

const factsCache = new Map<string, ModuleFacts>();

/** Resolves a relative or `@/`-aliased specifier to an absolute file path, or null for bare packages and unresolvable paths (e.g. the gitignored `src/generated/**` on a fresh clone). */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = path.join(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const extension of RESOLVABLE_EXTENSIONS) {
      const candidate = path.join(base, `index${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return fs.existsSync(base) && fs.statSync(base).isFile() ? base : null;
}

/** True when this identifier occurrence sits in a type position (and is therefore erased before bundling). */
function isInTypePosition(identifier: ts.Identifier): boolean {
  let node: ts.Node | undefined = identifier.parent;
  while (node) {
    // An identifier inside the import/export declaration itself is the
    // binding, not a use of it.
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node)
    ) {
      return true;
    }
    if (
      ts.isTypeNode(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeParameterDeclaration(node)
    ) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function readFacts(file: string): ModuleFacts {
  const cached = factsCache.get(file);
  if (cached) return cached;

  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const valueIdentifiers = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !isInTypePosition(node)) valueIdentifiers.add(node.text);
    ts.forEachChild(node, collect);
  };
  collect(source);

  const hasDirective = (directive: string): boolean =>
    source.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === directive,
    );

  const edges: ImportEdge[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (!clause) {
        // Bare side-effect import — always emitted.
        edges.push({ specifier, typeOnly: false, referenced: true });
        continue;
      }
      if (clause.isTypeOnly) {
        edges.push({ specifier, typeOnly: true, referenced: false });
        continue;
      }
      const bindings: { name: string; typeOnly: boolean }[] = [];
      if (clause.name) bindings.push({ name: clause.name.text, typeOnly: false });
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          bindings.push({ name: clause.namedBindings.name.text, typeOnly: false });
        } else {
          for (const element of clause.namedBindings.elements) {
            bindings.push({ name: element.name.text, typeOnly: element.isTypeOnly });
          }
        }
      }
      edges.push({
        specifier,
        typeOnly: false,
        referenced: bindings.some((b) => !b.typeOnly && valueIdentifiers.has(b.name)),
      });
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      // `export … from "x"` / `export * from "x"` re-emit the module.
      edges.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly: statement.isTypeOnly,
        referenced: true,
      });
    }
  }

  const facts: ModuleFacts = {
    isClientEntry: hasDirective("use client"),
    isServerOnly: hasDirective("server-only") || edges.some((e) => e.specifier === "server-only"),
    isServerAction: hasDirective("use server"),
    edges,
  };
  factsCache.set(file, facts);
  return facts;
}

/**
 * Every `.ts`/`.tsx` under `src/`, used only to pick the `"use client"`
 * entry points. `src/generated/**` is excluded here because it holds no
 * Client Components, but the walk itself *does* follow imports into it —
 * that is where the Prisma runtime leak lived. Note `src/generated/**` is
 * gitignored (`pnpm db:generate` recreates it), so on a fresh clone those
 * specifiers simply fail to resolve and are skipped rather than failing
 * this test spuriously.
 */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "generated") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** `src/`-relative for app modules, repo-relative for anything outside it (the `prisma/seed/**` script entry points). */
const relative = (file: string): string => {
  const fromSrc = path.relative(SRC_DIR, file);
  if (!fromSrc.startsWith("..")) return fromSrc.split(path.sep).join("/") || file;
  return path.relative(ROOT_DIR, file).split(path.sep).join("/") || file;
};

/**
 * Breadth-first search for the shortest import chain from `entry` to a
 * module that must not be reachable from it, or null if there is none.
 *
 * `mode` picks which of the two boundaries in this file's header is being
 * checked: `"client"` models Next's client bundler (unreferenced imports
 * elided, `"use server"` is an RPC boundary, and the whole
 * server-side-only surface is forbidden), `"script"` models plain
 * Node/`tsx` (every non-type import executes, no RPC boundaries, and only
 * the `server-only` guard itself is a problem).
 */
function findForbiddenChain(entry: string, mode: "client" | "script"): string[] | null {
  const seen = new Set<string>([entry]);
  const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [relative(entry)] }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of readFacts(current.file).edges) {
      if (edge.typeOnly) continue;
      if (mode === "client" && !edge.referenced) continue;

      if (mode === "client" && isClientForbiddenSpecifier(edge.specifier)) {
        return [...current.chain, `[server-side-only] ${edge.specifier}`];
      }
      if (mode === "script" && edge.specifier === "server-only") {
        return [...current.chain, `[server-only guard] ${edge.specifier}`];
      }

      const resolved = resolveSpecifier(edge.specifier, current.file);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);

      const facts = readFacts(resolved);
      const chain = [...current.chain, relative(resolved)];
      if (facts.isServerOnly) return chain;
      if (mode === "client" && facts.isServerAction) continue; // RPC boundary
      queue.push({ file: resolved, chain });
    }
  }
  return null;
}

const sourceFiles = collectSourceFiles(SRC_DIR);
const clientEntries = sourceFiles.filter((file) => readFacts(file).isClientEntry);

/**
 * Entry points of every package.json script run through `tsx`, so adding a
 * new one-shot script automatically brings it under this guard. Tokenised
 * rather than regexed so flags between `tsx` and the entry file (e.g.
 * `tsx --conditions=react-server foo.ts`) are skipped without a
 * nested-quantifier pattern.
 */
function collectTsxScriptEntries(): { script: string; entry: string }[] {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const found: { script: string; entry: string }[] = [];
  for (const [script, command] of Object.entries(packageJson.scripts ?? {})) {
    const tokens = command.split(/\s+/).filter(Boolean);
    const tsxIndex = tokens.indexOf("tsx");
    if (tsxIndex === -1) continue;
    const entryPath = tokens.slice(tsxIndex + 1).find((token) => token.endsWith(".ts"));
    if (!entryPath) continue;
    found.push({ script, entry: path.join(ROOT_DIR, entryPath) });
  }
  return found;
}

const tsxScriptEntries = collectTsxScriptEntries();

describe("client/server bundle boundary", () => {
  it("finds the `use client` modules to check", () => {
    // A tripwire on the walk itself: if the globbing or the directive
    // detection ever silently breaks, the real assertion below would pass
    // vacuously.
    expect(sourceFiles.length).toBeGreaterThan(400);
    expect(clientEntries.length).toBeGreaterThan(100);
  });

  it("has no `use client` module that transitively reaches server-side-only code", () => {
    const violations = clientEntries
      .map((entry) => ({ entry, chain: findForbiddenChain(entry, "client") }))
      .filter((result): result is { entry: string; chain: string[] } => result.chain !== null)
      .map((result) => result.chain.join("\n     -> "));

    // Asserting on the formatted chains rather than a count so a failure
    // prints the exact import path to fix, the way `next build` would.
    expect(violations).toEqual([]);
  });
});

describe("tsx script import boundary", () => {
  it("finds the `tsx` script entry points to check", () => {
    // Same tripwire idea: if the package.json parsing breaks, the check
    // below would pass with nothing to check. Both seed scripts must be
    // discovered, and each must point at a file that exists.
    expect(tsxScriptEntries.map((e) => e.script).sort()).toEqual(
      expect.arrayContaining(["db:create-admin", "db:seed"]),
    );
    for (const { entry } of tsxScriptEntries) {
      expect(fs.existsSync(entry), `${relative(entry)} should exist`).toBe(true);
    }
  });

  it("has no `tsx` script that transitively reaches a `server-only` module", () => {
    const violations = tsxScriptEntries
      .map(({ script, entry }) => ({ script, chain: findForbiddenChain(entry, "script") }))
      .filter((result): result is { script: string; chain: string[] } => result.chain !== null)
      .map((result) => `pnpm ${result.script}\n     -> ${result.chain.join("\n     -> ")}`);

    // Same reasoning as above: the formatted chain is the whole value of
    // the failure, because the fix is always "point one import at the
    // guard-free core instead".
    expect(violations).toEqual([]);
  });
});
