/**
 * Loads active `CompatibilityRule` rows and caches them in module scope —
 * docs/08-PC-BUILDER-ENGINE.md's own performance target (§7, "validation
 * p95 < 300ms") is dominated by the DB round-trip for ~50 rule rows, not
 * by evaluating them, so a simple TTL cache here removes that round-trip
 * from the hot path without the complexity of a versioned Redis
 * invalidation scheme. `invalidateRuleCache` is called by the admin rule
 * CRUD actions (task #76) whenever a rule row changes, so an edit takes
 * effect on the next validation rather than waiting out the TTL.
 */
import "server-only";
import { db } from "@/server/db";
import type { PartType, RuleSeverity, AutoFixStrategy } from "@/generated/prisma/client";
import type { BoolNode } from "./rule-expression";

export interface CompatibilityRuleRecord {
  id: string;
  code: string;
  name: string;
  severity: RuleSeverity;
  subjectType: PartType;
  objectType: PartType;
  expression: BoolNode;
  messageTemplate: string;
  fixHintTemplate: string | null;
  autoFixStrategy: AutoFixStrategy;
  isBlocking: boolean;
  isPreventive: boolean;
  priority: number;
}

const CACHE_TTL_MS = 30_000;

let cachedRules: CompatibilityRuleRecord[] | null = null;
let cachedAt = 0;

/** Active rules, ordered by `priority` ascending (docs §4.4 step 5: "evaluate in priority order so higher-priority issues are listed first"). Cached for `CACHE_TTL_MS`. */
export async function loadActiveRules(): Promise<CompatibilityRuleRecord[]> {
  const now = Date.now();
  if (cachedRules && now - cachedAt < CACHE_TTL_MS) {
    return cachedRules;
  }

  const rows = await db.compatibilityRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  cachedRules = rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    severity: row.severity,
    subjectType: row.subjectType,
    objectType: row.objectType,
    expression: row.expression as unknown as BoolNode,
    messageTemplate: row.messageTemplate,
    fixHintTemplate: row.fixHintTemplate,
    autoFixStrategy: row.autoFixStrategy,
    isBlocking: row.isBlocking,
    isPreventive: row.isPreventive,
    priority: row.priority,
  }));
  cachedAt = now;
  return cachedRules;
}

/** Call after any write to `CompatibilityRule` (admin rule CRUD, rule tester "save and re-run") so the next validation sees the change immediately instead of waiting out the TTL. */
export function invalidateRuleCache(): void {
  cachedRules = null;
  cachedAt = 0;
}
