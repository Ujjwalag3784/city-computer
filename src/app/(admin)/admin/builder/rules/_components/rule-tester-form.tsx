"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SLOT_MODEL } from "@/lib/builder/slots";
import type { RuleTesterPartOption } from "@/server/services/admin/rule-tester";
import type { BuildValidationReport } from "@/server/services/builder/validate-build";
import { runRuleTesterAction } from "../_actions";

export interface RuleTesterFormProps {
  /** `slotKey -> every active part of that slot's PartType` — see `listRuleTesterPartOptions`'s own doc comment. */
  partOptionsBySlot: Record<string, RuleTesterPartOption[]>;
}

const SEVERITY_BADGE_VARIANT: Record<string, "danger" | "warning" | "primary"> = {
  ERROR: "danger",
  WARNING: "warning",
  INFO: "primary",
};

/**
 * The Rule Tester's client half (Task #76, docs §10): eight per-slot
 * `Select`s (this pass's 8 core `SLOT_MODEL` slots, same narrowing as the
 * rest of the builder UI — see `rule-tester.ts`'s own header comment),
 * a "Run test" button calling `runRuleTesterAction`, and a plain
 * diagnostic table of every fired rule/connector-shortfall — deliberately
 * NOT the polished customer-facing `CompatibilityPanel`/`IssueRow` this
 * codebase already has for the storefront builder, since a technician
 * sanity-checking a rule wants the raw `ruleCode` and both slot keys
 * (`IssueRow`'s whole point is to hide exactly that from a shopper).
 */
export function RuleTesterForm({ partOptionsBySlot }: RuleTesterFormProps) {
  const [selections, setSelections] = React.useState<Record<string, string>>({});
  const [report, setReport] = React.useState<BuildValidationReport | null>(null);
  const [running, setRunning] = React.useState(false);

  function handleSlotChange(slotKey: string, partId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      // `slotKey` always comes from this file's own `SLOT_MODEL`-derived callers, never arbitrary input.
      // eslint-disable-next-line security/detect-object-injection
      if (partId === "none") delete next[slotKey];
      // eslint-disable-next-line security/detect-object-injection
      else next[slotKey] = partId;
      return next;
    });
  }

  async function handleRun() {
    setRunning(true);
    const result = await runRuleTesterAction(selections);
    setRunning(false);
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't run the rule tester.");
      return;
    }
    setReport(result.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card variant="glass">
        <CardHeader>
          <span className="text-title text-on-surface">Sample parts</span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SLOT_MODEL.map((slot) => {
            const options = partOptionsBySlot[slot.slotKey] ?? [];
            const value = selections[slot.slotKey] ?? "none";
            return (
              <div key={slot.slotKey} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`rule-tester-${slot.slotKey}`}
                  className="text-label-mono-xs text-on-surface-variant"
                >
                  {slot.label}
                </label>
                <Select
                  value={value}
                  onValueChange={(next) => handleSlotChange(slot.slotKey, next)}
                >
                  <SelectTrigger id={`rule-tester-${slot.slotKey}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.manufacturer} {option.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button
        type="button"
        variant="primary"
        onClick={() => void handleRun()}
        disabled={running}
        className="w-fit"
      >
        {running ? "Running…" : "Run test"}
      </Button>

      {report && (
        <Card variant="glass">
          <CardHeader>
            <span className="text-title text-on-surface">
              Result — compatibility score {report.compatibilityScore}/100
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-body-sm text-on-surface-variant">
              {report.errorCount} error{report.errorCount === 1 ? "" : "s"} · {report.warningCount}{" "}
              warning{report.warningCount === 1 ? "" : "s"} · {report.infoCount} info
            </p>

            {report.issues.length === 0 && report.connectorShortfalls.length === 0 && (
              <p className="text-body-sm text-on-surface-variant">
                No rules fired against this sample set.
              </p>
            )}

            {report.issues.map((issue, index) => (
              <div
                key={`${issue.ruleId}-${index}`}
                className="flex flex-col gap-1 rounded-lg border border-glass-stroke bg-surface-container p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_BADGE_VARIANT[issue.severity] ?? "primary"}>
                    {issue.severity}
                  </Badge>
                  <span className="text-label-mono-xs text-on-surface-variant">
                    {issue.ruleCode} · {issue.subjectSlotKey} ↔ {issue.objectSlotKey}
                  </span>
                </div>
                <p className="text-body-sm text-on-surface">{issue.message}</p>
              </div>
            ))}

            {report.connectorShortfalls.map((shortfall, index) => (
              <div
                key={`shortfall-${index}`}
                className="flex flex-col gap-1 rounded-lg border border-glass-stroke bg-surface-container p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_BADGE_VARIANT[shortfall.severity] ?? "primary"}>
                    {shortfall.severity}
                  </Badge>
                  <span className="text-label-mono-xs text-on-surface-variant">
                    {shortfall.connectorType} connector
                  </span>
                </div>
                <p className="text-body-sm text-on-surface">{shortfall.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
