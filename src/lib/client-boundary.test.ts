/* eslint-disable security/detect-non-literal-fs-filename -- every path this
   file touches is one it discovered itself by walking `src/`. There is no
   user input, no network input and no test fixture anywhere in here. */
/**
 * Architecture guard rather than a unit test: it walks the real import graph
 * outward from every `"use client"` module under `src/` and fails if any of
 * them can reach server-only code through a runtime (non-type-only) import.
 * "Server-only code" means either a module carrying `import "server-only"`,
 * or a module that pulls in a Node-only runtime (a `node:` builtin, the
 * Prisma query-engine runtime, or a native package like `argon2`). Both
 * classes fail a production `next build`; only the first one does so with a
 * message that names the problem.
 *
 * Why this exists as a *test*: that class of mistake is invisible to
 * `pnpm typecheck` (the imports are perfectly valid TypeScript), invisible
 * to `pnpm lint` (ESLint's `no-restricted-imports` boundary rules only see
 * one file's own import list, never a transitive chain three modules deep),
 * and invisible to the whole unit-test suite (Vitest replaces `server-only`
 * with `vitest.server-only-shim.ts`, precisely so service modules stay
 * testable, and Vitest runs in Node so `node:` builtins resolve fine). The
 * only tool that catches any of it is a real `next build`, and this project
 * has no build step in CI. So it went unnoticed until the first production
 * deploy, which failed with two "You're importing a component that needs
 * server-only" errors:
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
 * import-free `as const` catalogue.
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
 * - Bare package specifiers are not followed (no `node_modules` traversal),
 *   with the exception of a small allow-list of packages that can only ever
 *   run on a server; importing one of those from the client is the same bug
 *   wearing a different hat.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Extension order a bundler would try for an extensionless specifier. */
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Bare packages with no browser build at all. None of these is behind a
 * `server-only` guard of its own, so reaching one directly from a Client
 * Component would fail the build with a different message but the same
 * root cause.
 */
const SERVER_ONLY_PACKAGES = new Set(["ioredis", "argon2", "pg", "nodemailer"]);

/** True for specifiers that can only ever resolve on the server: `node:` builtins, Prisma's query-engine runtime, and the native packages above. */
function isServerOnlySpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("node:") ||
    specifier.startsWith("@prisma/client/runtime") ||
    SERVER_ONLY_PACKAGES.has(specifier)
  );
}

interface ImportEdge {
  specifier: string;
  /** False when the import is type-only, or when none of its bindings is used in a value position (both are erased before bundling). */
  runtime: boolean;
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
        edges.push({ specifier, runtime: true });
        continue;
      }
      if (clause.isTypeOnly) {
        edges.push({ specifier, runtime: false });
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
        runtime: bindings.some((b) => !b.typeOnly && valueIdentifiers.has(b.name)),
      });
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      // `export … from "x"` / `export * from "x"` re-emit the module.
      edges.push({ specifier: statement.moduleSpecifier.text, runtime: !statement.isTypeOnly });
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

const relative = (file: string): string =>
  path.relative(SRC_DIR, file).split(path.sep).join("/") || file;

/** The shortest runtime import chain from `entry` to a server-only module, or null if there is none. */
function findServerOnlyChain(entry: string): string[] | null {
  const seen = new Set<string>([entry]);
  const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [relative(entry)] }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of readFacts(current.file).edges) {
      if (!edge.runtime) continue;

      if (isServerOnlySpecifier(edge.specifier)) {
        return [...current.chain, `[server-only module] ${edge.specifier}`];
      }
      const resolved = resolveSpecifier(edge.specifier, current.file);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);

      const facts = readFacts(resolved);
      const chain = [...current.chain, relative(resolved)];
      if (facts.isServerOnly) return chain;
      if (facts.isServerAction) continue; // RPC boundary
      queue.push({ file: resolved, chain });
    }
  }
  return null;
}

const sourceFiles = collectSourceFiles(SRC_DIR);
const clientEntries = sourceFiles.filter((file) => readFacts(file).isClientEntry);

describe("client/server bundle boundary", () => {
  it("finds the `use client` modules to check", () => {
    // A tripwire on the walk itself: if the globbing or the directive
    // detection ever silently breaks, the real assertion below would pass
    // vacuously.
    expect(sourceFiles.length).toBeGreaterThan(400);
    expect(clientEntries.length).toBeGreaterThan(100);
  });

  it("has no `use client` module that transitively reaches server-only code", () => {
    const violations = clientEntries
      .map((entry) => ({ entry, chain: findServerOnlyChain(entry) }))
      .filter((result): result is { entry: string; chain: string[] } => result.chain !== null)
      .map((result) => result.chain.join("\n     -> "));

    // Asserting on the formatted chains rather than a count so a failure
    // prints the exact import path to fix, the way `next build` would.
    expect(violations).toEqual([]);
  });
});
