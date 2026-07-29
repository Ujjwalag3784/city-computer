"use server";

/**
 * Server Action backing `/admin/builder/rules`'s Rule Tester (Task #76).
 * Same shape as every other admin route's `_actions.ts`: permission check
 * -> validate -> call the service -> plain `ActionResult`. Gated on
 * `builder-rule:write` (OWNER + TECHNICIAN per `prisma/seed/core.ts`) —
 * the narrowest permission this screen's audience actually holds; there
 * is no separate read-only "view a rule test" permission seeded.
 */
import { z } from "zod";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { runRuleTester } from "@/server/services/admin/rule-tester";
import type { BuildValidationReport } from "@/server/services/builder/validate-build";
import { runAdminAction, type ActionResult } from "../../../_lib/action-result";

const runRuleTesterSchema = z.record(z.string(), z.string());

export async function runRuleTesterAction(
  input: unknown,
): Promise<ActionResult<BuildValidationReport>> {
  return runAdminAction(async () => {
    await requireAdminPermission("builder-rule:write");
    const parsed = runRuleTesterSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    return runRuleTester(parsed.data);
  });
}
