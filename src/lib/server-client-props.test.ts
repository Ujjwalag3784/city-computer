/* eslint-disable security/detect-non-literal-fs-filename -- every path this
   file touches is one it discovered itself by walking `src/`. There is no
   user input, no network input and no fixture anywhere in here. */
/**
 * Architecture guard, and the sibling of `client-boundary.test.ts`. That
 * file checks whether a *module* can end up on the wrong side of the
 * client/server split. This one checks whether a *prop* can: it fails when
 * a Server Component hands a function value to a Client Component.
 *
 * ── The bug this exists for ──
 *
 * React has to serialise every prop a Server Component passes into a Client
 * Component so the value can travel in the RSC payload. Functions cannot be
 * serialised, so the render throws at request time:
 *
 *     Error: Event handlers cannot be passed to Client Component props.
 *       {onAddToCart: function onAddToCart, outOfStock: …, className: …}
 *     If you need interactivity, consider converting part of this to a
 *     Client Component.
 *
 * There is no compile-time signal for this. The prop types match perfectly,
 * so `pnpm typecheck` is happy; the imports are all legal, so `pnpm lint`
 * and `client-boundary.test.ts` are happy; and `next build` is happy too,
 * because whether a given module renders on the server depends on which
 * *route* reaches it, not on anything visible in the module itself. The
 * first thing that notices is a real request — which is exactly how it was
 * found: the very first production traffic this project ever served got
 * HTTP 500 on `GET /`, and a walk written to answer "where else?" turned up
 * **22 crossings in 11 files**, taking down the storefront homepage, the
 * PDP, blog posts, and all ten `/admin` list screens:
 *
 *   - `commerce/product-card.tsx` forwarded `onAddToCart={() => …}` to the
 *     `"use client"` `AddToCartButton` (×2, one per card variant). Fixed by
 *     moving the handler into `commerce/product-card-add-to-cart.tsx`, a
 *     client leaf that calls the cart Server Action itself, so only
 *     `variantId`/`outOfStock`/`className` cross the boundary.
 *   - ten `app/(admin)/admin/&ast;/page.tsx` Server Components passed
 *     `columns` (whose every entry holds a `render: (row) => ReactNode`)
 *     and `getRowId={(row) => row.id}` to the `"use client"` `DataTable`
 *     (×2 each). Fixed by `admin/data-table-static.tsx`, a server-rendered
 *     read-only twin — those pages needed none of `DataTable`'s
 *     interactivity.
 *
 * ── How the walk works, and where it is deliberately approximate ──
 *
 * 1. **Which modules render on the server.** Breadth-first from every
 *    file-convention entry point under `src/app/` (`page`, `layout`,
 *    `route`, `opengraph-image`, …) plus `middleware.ts`, skipping any
 *    entry that is itself `"use client"`. Traversal stops at a
 *    `"use client"` module (everything beyond it is client-side, where
 *    function props are fine) and at a `"use server"` module (an RPC
 *    boundary, not a render tree). Whatever is reached is a module that
 *    React will render on the server for at least one route. Note a module
 *    can legitimately be in *both* graphs — `product-card.tsx` is reached
 *    from the server homepage and from the client `CatalogListing` — and
 *    being in this one at all is what makes a function prop a bug.
 *
 * 2. **Which JSX tags are Client Components.** A tag whose name resolves,
 *    through this module's own import list, to a file carrying
 *    `"use client"`. Bare-package tags are not followed, so a function
 *    prop passed to a third-party client component is out of scope.
 *
 * 3. **Which prop values are functions.** Only values whose function-ness
 *    is visible in the syntax, so there are no false positives to argue
 *    with:
 *      - an inline arrow/function expression (`onX={() => …}`);
 *      - an identifier bound in this module to an arrow/function
 *        expression or a `function` declaration;
 *      - an object/array literal (or an identifier bound to one) with a
 *        function *value* structurally inside it — `columns` above.
 *        `containsFunctionValue` descends only through the literal shapes
 *        React itself walks (object properties, array elements, ternary
 *        branches, spreads, casts) and treats a call expression as opaque,
 *        so `hours.map((h) => ({ … }))` is correctly not a violation: the
 *        arrow is consumed by `map`, and the value that reaches the prop is
 *        plain objects. That exact pattern in
 *        `admin/branches/[id]/page.tsx` was the one false positive an
 *        earlier, cruder version of this walk produced.
 *
 *    **What it therefore does NOT catch**, stated plainly rather than
 *    papered over: a function that arrives through a parameter, an import,
 *    a call's return value, or a `Map`/`class` instance. Catching those
 *    needs real type-level flow analysis, and a guard that half-works while
 *    claiming otherwise is worse than one with a documented edge. The two
 *    shapes above are what the 22 real bugs looked like, and they are what
 *    a future regression would almost certainly look like too.
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
 * Next.js file-convention entry points — the roots React renders a route
 * from. Read as a pattern rather than a list so a newly added route is
 * covered automatically.
 */
const ENTRY_CONVENTION =
  /(^|\/)(page|layout|template|default|loading|error|not-found|global-error|route|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots)\.tsx?$/;

interface ModuleFacts {
  isClientEntry: boolean;
  isServerAction: boolean;
  /** Local binding name → module specifier, for non-type imports only. */
  importedFrom: Map<string, string>;
  /** Every specifier this module pulls in, type-only ones excluded. */
  specifiers: string[];
  source: ts.SourceFile;
}

const factsCache = new Map<string, ModuleFacts>();

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

function readFacts(file: string): ModuleFacts {
  const cached = factsCache.get(file);
  if (cached) return cached;

  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const hasDirective = (directive: string): boolean =>
    source.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === directive,
    );

  const importedFrom = new Map<string, string>();
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      specifiers.push(specifier);
      if (!clause) continue;
      if (clause.name) importedFrom.set(clause.name.text, specifier);
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          importedFrom.set(clause.namedBindings.name.text, specifier);
        } else {
          for (const element of clause.namedBindings.elements) {
            if (!element.isTypeOnly) importedFrom.set(element.name.text, specifier);
          }
        }
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      !statement.isTypeOnly
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }

  const facts: ModuleFacts = {
    isClientEntry: hasDirective("use client"),
    isServerAction: hasDirective("use server"),
    importedFrom,
    specifiers,
    source,
  };
  factsCache.set(file, facts);
  return facts;
}

/** Every `.ts`/`.tsx` under `src/`, excluding the gitignored generated Prisma client. */
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

const allSourceFiles = collectSourceFiles(SRC_DIR);

const serverEntryPoints = allSourceFiles.filter((file) => {
  const rel = relative(file);
  if (!rel.startsWith("app/") && rel !== "middleware.ts") return false;
  return ENTRY_CONVENTION.test(rel) && !readFacts(file).isClientEntry;
});

/**
 * Every module React renders on the server for at least one route: the
 * transitive closure of `serverEntryPoints`, stopping at `"use client"`
 * (past that, function props are legal) and at `"use server"` (an RPC
 * boundary, not a render tree).
 */
function collectServerRenderedModules(): Set<string> {
  const reached = new Set<string>(serverEntryPoints);
  const queue = [...serverEntryPoints];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const specifier of readFacts(current).specifiers) {
      const resolved = resolveSpecifier(specifier, current);
      if (!resolved || reached.has(resolved)) continue;
      const facts = readFacts(resolved);
      if (facts.isClientEntry || facts.isServerAction) continue;
      reached.add(resolved);
      queue.push(resolved);
    }
  }
  return reached;
}

const serverRenderedModules = collectServerRenderedModules();

/**
 * True when `node` structurally holds a function *value*. Descends only
 * through the literal shapes React itself walks while serialising; a call
 * expression is opaque, because its result — not the callback written
 * inside it — is what reaches the prop.
 */
function containsFunctionValue(node: ts.Expression): boolean {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return true;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return containsFunctionValue(node.expression);
  }
  if (ts.isConditionalExpression(node)) {
    return containsFunctionValue(node.whenTrue) || containsFunctionValue(node.whenFalse);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isPropertyAssignment(property)) return containsFunctionValue(property.initializer);
      if (ts.isMethodDeclaration(property)) return true;
      if (ts.isSpreadAssignment(property)) return containsFunctionValue(property.expression);
      return false;
    });
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) =>
      ts.isSpreadElement(element)
        ? containsFunctionValue(element.expression)
        : containsFunctionValue(element),
    );
  }
  return false;
}

/** Module-local bindings, so `{columns}` and `{handleClick}` can be looked through. */
function collectLocalBindings(source: ts.SourceFile): {
  functions: Set<string>;
  initialisers: Map<string, ts.Expression>;
} {
  const functions = new Set<string>();
  const initialisers = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) functions.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        functions.add(node.name.text);
      } else {
        initialisers.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { functions, initialisers };
}

/** The JSX tag's root identifier — `Foo` for both `<Foo />` and `<Foo.Bar />`. */
function tagRootName(tagName: ts.JsxTagNameExpression): string | null {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.expression)) {
    return tagName.expression.text;
  }
  return null;
}

function findFunctionPropCrossings(file: string): string[] {
  const facts = readFacts(file);
  const { functions, initialisers } = collectLocalBindings(facts.source);
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningLikeElement(node)) {
      const name = tagRootName(node.tagName);
      const specifier = name ? facts.importedFrom.get(name) : undefined;
      const target = specifier ? resolveSpecifier(specifier, file) : null;
      if (target && readFacts(target).isClientEntry) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
          if (!ts.isJsxExpression(attribute.initializer)) continue;
          const value = attribute.initializer.expression;
          if (!value) continue;

          let reason: string | null = null;
          if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
            reason = "an inline function";
          } else if (ts.isIdentifier(value) && functions.has(value.text)) {
            reason = `the local function \`${value.text}\``;
          } else if (containsFunctionValue(value)) {
            reason = "an inline literal holding a function";
          } else if (ts.isIdentifier(value)) {
            const initialiser = initialisers.get(value.text);
            if (initialiser && containsFunctionValue(initialiser)) {
              reason = `local \`${value.text}\`, which holds a function`;
            }
          }

          if (reason) {
            const { line } = facts.source.getLineAndCharacterOfPosition(
              attribute.getStart(facts.source),
            );
            found.push(
              `${relative(file)}:${line + 1} — <${name} ${attribute.name.getText(
                facts.source,
              )}> is ${reason}, but ${relative(target)} is a Client Component`,
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(facts.source);
  return found;
}

describe("server -> client function props", () => {
  it("finds the server-rendered modules to check", () => {
    // Tripwire on the walk itself: if the entry-point globbing or the
    // directive detection silently broke, the real assertion below would
    // pass vacuously. Both numbers were comfortably above these floors
    // when the guard was written (94 entry points, 361 modules).
    expect(serverEntryPoints.length).toBeGreaterThan(50);
    expect(serverRenderedModules.size).toBeGreaterThan(200);
    // The two components the original 22 violations lived in must actually
    // be in the graph, or the guard is watching the wrong tree.
    const reached = new Set([...serverRenderedModules].map(relative));
    expect(reached).toContain("components/commerce/product-card.tsx");
    expect(reached).toContain("app/(admin)/admin/products/page.tsx");
  });

  it("recognises a function prop crossing into a Client Component", () => {
    // Proves the detector detects, rather than trivially finding nothing.
    // `add-to-cart-button.tsx` is a real `"use client"` module and
    // `product-card.tsx` is real server-rendered code, so this asserts on
    // exactly the shape the production 500 had.
    const source = ts.createSourceFile(
      path.join(SRC_DIR, "components/commerce/__detector-probe.tsx"),
      `import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
       const columns = [{ key: "a", render: (row: string) => row }];
       export function Probe() {
         return <>
           <AddToCartButton onAddToCart={() => {}} />
           <AddToCartButton onAddToCart={handler} />
           <AddToCartButton data-columns={columns} />
           <AddToCartButton className="ok" outOfStock={true} />
         </>;
       }
       function handler() {}`,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TSX,
    );
    const probePath = path.join(SRC_DIR, "components/commerce/__detector-probe.tsx");
    factsCache.set(probePath, {
      isClientEntry: false,
      isServerAction: false,
      importedFrom: new Map([["AddToCartButton", "@/components/commerce/add-to-cart-button"]]),
      specifiers: ["@/components/commerce/add-to-cart-button"],
      source,
    });

    const crossings = findFunctionPropCrossings(probePath);
    factsCache.delete(probePath);

    // Three of the four elements are violations; the serialisable one is not.
    expect(crossings).toHaveLength(3);
    expect(crossings[0]).toContain("onAddToCart> is an inline function");
    expect(crossings[1]).toContain("onAddToCart> is the local function `handler`");
    expect(crossings[2]).toContain("data-columns> is local `columns`, which holds a function");
  });

  it("has no Server Component passing a function to a Client Component", () => {
    const violations = [...serverRenderedModules]
      .sort()
      .flatMap((file) => findFunctionPropCrossings(file));

    // Asserting on the formatted list rather than a count so a failure
    // prints the file, line and prop to fix — the way the runtime error
    // never did.
    expect(violations).toEqual([]);
  });
});
