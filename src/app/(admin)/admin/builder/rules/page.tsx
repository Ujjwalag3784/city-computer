import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listRuleTesterPartOptions } from "@/server/services/admin/rule-tester";
import { RuleTesterForm } from "./_components/rule-tester-form";

export const metadata: Metadata = {
  title: "Rule Tester — Admin — City Computer Systems",
};

/**
 * `/admin/builder/rules` — docs §10's "Rule Tester" (Task #76): pick
 * sample parts per slot, run the real compatibility engine, see exactly
 * which rules fired and why, without needing a real persisted `Build`.
 * Gated on `builder-rule:write` (OWNER + TECHNICIAN), same permission the
 * (not-yet-built-this-pass) rule-authoring screen would use — there is no
 * narrower read-only variant seeded for "can look at rule test results."
 */
export default async function AdminBuilderRulesPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "builder-rule:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/auth/login?callbackUrl=/admin/builder/rules");
    }
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const partOptionsBySlot = await listRuleTesterPartOptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Rule Tester</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Pick a sample part for any of the 8 core slots and run the real compatibility engine
          against them — see exactly which rules fire, and why, before trusting a rule change or a a
          newly-added part&apos;s specs.
        </p>
        <Link href="/admin/builder/parts" className="text-body-sm text-primary underline">
          ← Back to Buildable Parts
        </Link>
      </div>

      <RuleTesterForm partOptionsBySlot={partOptionsBySlot} />
    </div>
  );
}
