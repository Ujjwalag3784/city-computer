/**
 * Pairs a build's selected parts against the active rule catalogue and
 * evaluates each — docs/08-PC-BUILDER-ENGINE.md §4.4 steps 4-6. A rule's
 * `expression` describes the condition that must hold for the
 * subject/object pair to be *compatible* (this is why the five rules
 * already seeded are named things like `CPU_SOCKET_MATCH` — the
 * expression states the match, not the mismatch); this engine therefore
 * emits an issue whenever `evaluateRuleExpression` returns `false`.
 *
 * Pairing strategy (not spelled out as pseudocode in the docs, so this is
 * this codebase's own resolution of "how do you turn a subjectType/
 * objectType pair into concrete parts"):
 * - `subjectType === objectType` and exactly one part of that type is
 *   selected (e.g. `PSU_WATTAGE_SUFFICIENT`, subject=object=PSU): the
 *   rule is really checking that one part against `build.*` aggregates,
 *   so it is evaluated once with subject and object both bound to it.
 * - `subjectType === objectType` and several parts share that type
 *   (multiple storage drives, multiple case fans): evaluated once per
 *   part (subject=object=that part) rather than as an n² cross product,
 *   since every rule in the real catalogue that targets a multi-slot
 *   type is a per-item check against build aggregates, not a pairwise
 *   comparison between two drives.
 * - `subjectType !== objectType`: evaluated for the full cross product of
 *   selected subjects × selected objects (almost always 1×1 — CPU vs
 *   Motherboard, GPU vs Case — but stays correct if a build ever has more
 *   than one of either side).
 */
import "server-only";
import { resolveRef, evaluateRuleExpression } from "./rule-expression";
import {
  contextForPair,
  partsOfType,
  type SelectedPart,
  type BuildSettings,
} from "./build-context";
import type { CompatibilityRuleRecord } from "./rules";

export interface FiredIssue {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: CompatibilityRuleRecord["severity"];
  message: string;
  fixHint: string | null;
  autoFixStrategy: CompatibilityRuleRecord["autoFixStrategy"];
  isBlocking: boolean;
  subjectPartId: string;
  subjectSlotKey: string;
  objectPartId: string;
  objectSlotKey: string;
}

const TEMPLATE_PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** `"{{subject.model}} needs {{object.model}}'s socket"` -> interpolated plain text, using the same dot-path resolver the expression language uses so template refs and rule refs never drift apart. */
function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(TEMPLATE_PLACEHOLDER, (match, path: string) => {
    const value = resolveRef(path, context);
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

function evaluateOne(
  rule: CompatibilityRuleRecord,
  subject: SelectedPart,
  object: SelectedPart,
  aggregates: Record<string, unknown>,
  settings: BuildSettings,
): FiredIssue | null {
  const context = contextForPair(subject, object, aggregates, settings);
  const compatible = evaluateRuleExpression(rule.expression, context);
  if (compatible) return null;

  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    ruleName: rule.name,
    severity: rule.severity,
    message: renderTemplate(rule.messageTemplate, context),
    fixHint: rule.fixHintTemplate ? renderTemplate(rule.fixHintTemplate, context) : null,
    autoFixStrategy: rule.autoFixStrategy,
    isBlocking: rule.isBlocking,
    subjectPartId: subject.part.id,
    subjectSlotKey: subject.slotKey,
    objectPartId: object.part.id,
    objectSlotKey: object.slotKey,
  };
}

/** Runs every active rule against a build's selected parts, returning every fired (i.e. violated) issue in rule-priority order. */
export function evaluateRules(
  rules: CompatibilityRuleRecord[],
  parts: SelectedPart[],
  aggregates: Record<string, unknown>,
  settings: BuildSettings,
): FiredIssue[] {
  const issues: FiredIssue[] = [];

  for (const rule of rules) {
    const subjects = partsOfType(parts, rule.subjectType);
    const objects = partsOfType(parts, rule.objectType);
    if (subjects.length === 0 || objects.length === 0) continue;

    if (rule.subjectType === rule.objectType) {
      for (const part of subjects) {
        const issue = evaluateOne(rule, part, part, aggregates, settings);
        if (issue) issues.push(issue);
      }
      continue;
    }

    for (const subject of subjects) {
      for (const object of objects) {
        const issue = evaluateOne(rule, subject, object, aggregates, settings);
        if (issue) issues.push(issue);
      }
    }
  }

  return issues;
}
