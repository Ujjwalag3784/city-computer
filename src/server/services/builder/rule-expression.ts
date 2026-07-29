/**
 * The declarative rule expression language — docs/08-PC-BUILDER-ENGINE.md
 * §4.1: "Rules are rows in `CompatibilityRule` with a declarative JSONB
 * `expression`. No rule logic is hardcoded." This file is the interpreter
 * for that JSON dialect — every `CompatibilityRule.expression` in the
 * database is a tree of the node shapes defined here, and this module's
 * `evaluateRuleExpression` is the only function that ever reads one.
 *
 * Two node families, matching how the docs' own operator list splits
 * naturally into "things that produce a value" and "things that produce a
 * yes/no":
 *
 * - `ValueNode` — a ref (`subject.specs.socket`), a literal, or a small
 *   arithmetic/aggregate op (`COUNT_OF`, `SUM_OF`, `ADD`, `MULTIPLY`,
 *   `SUBTRACT`) that reduces to a value a comparison can use.
 * - `BoolNode` — the comparisons (`EQ`/`NEQ`/`GT`/`GTE`/`LT`/`LTE`), the
 *   set ops (`IN`/`NOT_IN`/`CONTAINS`/`NOT_CONTAINS`/`SUBSET_OF`), the
 *   boolean combinators (`AND`/`OR`/`NOT`), `EXISTS`, `FITS_WITHIN` (does
 *   any item in a collection satisfy a sub-expression, binding it as
 *   `item.*`), and `CONNECTOR_SATISFIED` (reads a precomputed connector
 *   balance the dedicated §4.3 pass already computed — see
 *   `connector-check.ts` — rather than re-deriving it per rule).
 *
 * `SUM_OF`/`COUNT_OF` are docs §4.1's own operator names, but this
 * interpreter does not support arbitrary collection *selection* syntax
 * (e.g. "every storage BuildItem across slots storage_1..4, filtered to
 * NVMe") — instead, `build-context.ts` precomputes the handful of
 * cross-slot aggregates the real rule catalogue actually needs
 * (`build.m2DriveCount`, `build.totalFanCount`, `build.sataDriveCount`,
 * ...) as plain numbers on `build.*`, and rules compare against those
 * directly with `GTE`/`LTE`. `COUNT_OF`/`SUM_OF` remain available here for
 * the simpler in-expression case (counting/summing a literal array
 * embedded in the rule itself, or a short array already resolved onto one
 * ref), which is what every rule actually seeded this pass needs.
 *
 * Determinism (docs §4.4's own requirement — "no randomness, no
 * wall-clock dependence, no network calls"): every function in this file
 * is pure. `evaluateRuleExpression` never throws for a missing ref — a
 * path that resolves to `undefined` simply makes most comparisons `false`
 * (never a crash that would take down the whole validation pass over one
 * malformed or not-yet-applicable rule).
 */

export type RuleRefContext = Record<string, unknown>;

export interface RefNode {
  ref: string;
}

export interface LiteralNode {
  literal: unknown;
}

export interface CountOfNode {
  op: "COUNT_OF";
  collection: ValueNode;
  where?: BoolNode;
}

export interface SumOfNode {
  op: "SUM_OF";
  collection: ValueNode;
  field: string;
}

export interface ArithmeticNode {
  op: "ADD" | "MULTIPLY" | "SUBTRACT";
  args: ValueNode[];
}

export type ValueNode =
  | RefNode
  | LiteralNode
  | CountOfNode
  | SumOfNode
  | ArithmeticNode
  | string
  | number
  | boolean
  | null
  | unknown[];

export interface ComparisonNode {
  op:
    | "EQ"
    | "NEQ"
    | "GT"
    | "GTE"
    | "LT"
    | "LTE"
    | "IN"
    | "NOT_IN"
    | "CONTAINS"
    | "NOT_CONTAINS"
    | "SUBSET_OF";
  left: ValueNode;
  right: ValueNode;
}

export interface AndOrNode {
  op: "AND" | "OR";
  clauses: BoolNode[];
}

export interface NotNode {
  op: "NOT";
  clause: BoolNode;
}

export interface ExistsNode {
  op: "EXISTS";
  ref: string;
}

export interface FitsWithinNode {
  op: "FITS_WITHIN";
  collection: ValueNode;
  where: BoolNode;
}

export interface ConnectorSatisfiedNode {
  op: "CONNECTOR_SATISFIED";
  connectorType: string;
}

export type BoolNode =
  | ComparisonNode
  | AndOrNode
  | NotNode
  | ExistsNode
  | FitsWithinNode
  | ConnectorSatisfiedNode;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Dot-path lookup against the ref context — `"subject.specs.socket"` -> `context.subject.specs.socket`. Never throws; an absent path resolves to `undefined`. */
export function resolveRef(path: string, context: RuleRefContext): unknown {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    // eslint-disable-next-line security/detect-object-injection -- this dot-path walk is the interpreter's entire purpose (docs §4.1's declarative ref system); `path` comes from an admin-authored `CompatibilityRule.expression` row, not end-user input, and a missing segment already safely resolves to `undefined` rather than throwing.
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

export function resolveValue(node: ValueNode, context: RuleRefContext): unknown {
  if (
    node === null ||
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"
  ) {
    return node;
  }
  if (Array.isArray(node)) return node;

  if ("ref" in node && typeof node.ref === "string") {
    return resolveRef(node.ref, context);
  }
  if ("literal" in node) {
    return node.literal;
  }
  if ("op" in node) {
    switch (node.op) {
      case "COUNT_OF": {
        const collection = toArray(resolveValue(node.collection, context));
        if (!node.where) return collection.length;
        return collection.filter((item) =>
          evaluateRuleExpression(node.where as BoolNode, { ...context, item }),
        ).length;
      }
      case "SUM_OF": {
        const collection = toArray(resolveValue(node.collection, context));
        return collection.reduce((sum: number, item) => {
          const fieldValue = isPlainObject(item) ? item[node.field] : undefined;
          const numeric = toNumber(fieldValue);
          return sum + (Number.isFinite(numeric) ? numeric : 0);
        }, 0);
      }
      case "ADD":
        return node.args.reduce(
          (sum: number, arg) => sum + toNumber(resolveValue(arg, context)),
          0,
        );
      case "MULTIPLY":
        return node.args.reduce(
          (product: number, arg) => product * toNumber(resolveValue(arg, context)),
          1,
        );
      case "SUBTRACT": {
        const [first, ...rest] = node.args;
        const start = toNumber(resolveValue(first ?? 0, context));
        return rest.reduce((acc: number, arg) => acc - toNumber(resolveValue(arg, context)), start);
      }
      default:
        return undefined;
    }
  }
  return undefined;
}

function toComparableArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

/** The one function every caller (the rule engine, the connector pass, tests) uses to fire a boolean node against a build's ref context. */
export function evaluateRuleExpression(node: BoolNode, context: RuleRefContext): boolean {
  switch (node.op) {
    case "EQ":
      return resolveValue(node.left, context) === resolveValue(node.right, context);
    case "NEQ":
      return resolveValue(node.left, context) !== resolveValue(node.right, context);
    case "GT":
      return (
        toNumber(resolveValue(node.left, context)) > toNumber(resolveValue(node.right, context))
      );
    case "GTE":
      return (
        toNumber(resolveValue(node.left, context)) >= toNumber(resolveValue(node.right, context))
      );
    case "LT":
      return (
        toNumber(resolveValue(node.left, context)) < toNumber(resolveValue(node.right, context))
      );
    case "LTE":
      return (
        toNumber(resolveValue(node.left, context)) <= toNumber(resolveValue(node.right, context))
      );
    case "IN": {
      const left = resolveValue(node.left, context);
      const right = toComparableArray(resolveValue(node.right, context));
      return right.includes(left);
    }
    case "NOT_IN": {
      const left = resolveValue(node.left, context);
      const right = toComparableArray(resolveValue(node.right, context));
      return !right.includes(left);
    }
    case "CONTAINS": {
      const left = toComparableArray(resolveValue(node.left, context));
      const right = resolveValue(node.right, context);
      return left.includes(right);
    }
    case "NOT_CONTAINS": {
      const left = toComparableArray(resolveValue(node.left, context));
      const right = resolveValue(node.right, context);
      return !left.includes(right);
    }
    case "SUBSET_OF": {
      const left = toComparableArray(resolveValue(node.left, context));
      const right = toComparableArray(resolveValue(node.right, context));
      return left.every((item) => right.includes(item));
    }
    case "AND":
      return node.clauses.every((clause) => evaluateRuleExpression(clause, context));
    case "OR":
      return node.clauses.some((clause) => evaluateRuleExpression(clause, context));
    case "NOT":
      return !evaluateRuleExpression(node.clause, context);
    case "EXISTS": {
      const value = resolveRef(node.ref, context);
      return value !== undefined && value !== null;
    }
    case "FITS_WITHIN": {
      const collection = toArray(resolveValue(node.collection, context));
      return collection.some((item) => evaluateRuleExpression(node.where, { ...context, item }));
    }
    case "CONNECTOR_SATISFIED": {
      // `build.connectorBalance` is precomputed by `connector-check.ts` —
      // `{ [connectorType]: { required, provided, satisfied } }`. Reading
      // it here (rather than re-running the connector algorithm per rule)
      // keeps the "single generic check" from docs §4.3 as the one place
      // that logic lives, while still letting a rule row reference it.
      const balance = resolveRef(`build.connectorBalance.${node.connectorType}.satisfied`, context);
      return balance === true;
    }
    default:
      return false;
  }
}
