"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * RuleBuilder — docs/08-PC-BUILDER-ENGINE.md §10 "Admin surface" table:
 * "**Build Rules** | List rules in plain language ('Processor and
 * motherboard must use the same socket'), toggle active, adjust severity,
 * edit the message. Advanced expression editing is behind a clearly-marked
 * technical section." | "**Rule Tester** | Pick sample parts, run the
 * engine, see what fires. **Mandatory before a rule can be activated.**"
 *
 * Rules are rows in the `CompatibilityRule` model with a declarative JSONB
 * `expression` (§4.1 — e.g. `{"op": "NEQ", "left": {"ref":
 * "subject.specs.socket"}, "right": {"ref": "object.specs.socket"}}`). This
 * component surfaces the plain-language summary as the primary row and
 * gates the raw expression behind a collapsed-by-default "Advanced"
 * section, the same "only change these if someone has asked you to"
 * framing already established elsewhere in this admin for the equivalent
 * raw/technical view (SEO meta fields) — plain language first, the
 * dangerous technical control tucked away and clearly marked.
 *
 * The doc's "mandatory rule test before activation" rule needs real
 * backend state (has *this* rule been tested *this* session?) that this
 * prop-driven component doesn't have and can't fabricate honestly. Rather
 * than half-enforcing a gate it can't actually verify, it always shows a
 * small reminder next to the active `Switch` — "Test this rule before
 * turning it on" — and leaves the real enforcement (disabling the switch
 * until `onTestRule` has actually run and passed) to a later phase that
 * has that state to check.
 *
 * The "Test this rule" button only calls `onTestRule(id)` as an entry
 * point — it does not render the test itself (sample-part picker, engine
 * run, fired-rules output). That's a separate, larger concern for a
 * future phase.
 *
 * `"use client"`: every control (`Switch`, `Select`, `Input`/`Textarea`,
 * the advanced-section disclosure, the test button) wires a handler
 * directly onto an element in this file's own render tree, plus the
 * per-row "is the advanced section open" state below.
 */
export interface CompatibilityRuleSummary {
  id: string;
  plainLanguageDescription: string;
  severity: "error" | "warning" | "info";
  message: string;
  active: boolean;
  /** Raw JSONB expression, shown only in the advanced/technical section. */
  expressionJson: string;
}

export interface RuleBuilderProps {
  rules: CompatibilityRuleSummary[];
  onToggleActive: (id: string, active: boolean) => void;
  onSeverityChange: (id: string, severity: CompatibilityRuleSummary["severity"]) => void;
  onMessageChange: (id: string, message: string) => void;
  onExpressionChange?: (id: string, expressionJson: string) => void;
  onTestRule: (id: string) => void;
  className?: string;
}

const SEVERITY_LABEL: Record<CompatibilityRuleSummary["severity"], string> = {
  error: "Error — blocks the build",
  warning: "Warning — allowed, but flagged",
  info: "Info — a note, no issue",
};

function RuleCard({
  rule,
  onToggleActive,
  onSeverityChange,
  onMessageChange,
  onExpressionChange,
  onTestRule,
}: {
  rule: CompatibilityRuleSummary;
  onToggleActive: RuleBuilderProps["onToggleActive"];
  onSeverityChange: RuleBuilderProps["onSeverityChange"];
  onMessageChange: RuleBuilderProps["onMessageChange"];
  onExpressionChange: RuleBuilderProps["onExpressionChange"];
  onTestRule: RuleBuilderProps["onTestRule"];
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-glass-stroke bg-surface-container p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex-1 text-body-lg text-on-surface">{rule.plainLanguageDescription}</p>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="flex items-center gap-2">
            <Switch
              aria-label={`Turn ${rule.plainLanguageDescription} on or off`}
              checked={rule.active}
              onCheckedChange={(checked) => onToggleActive(rule.id, checked)}
            />
            <span className="text-body-sm text-on-surface-variant">
              {rule.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Test this rule before turning it on.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`rule-severity-${rule.id}`}
            className="text-body-lg text-on-surface-variant"
          >
            Severity
          </label>
          <Select
            value={rule.severity}
            onValueChange={(value) =>
              onSeverityChange(rule.id, value as CompatibilityRuleSummary["severity"])
            }
          >
            <SelectTrigger id={`rule-severity-${rule.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTestRule(rule.id)}
            className="self-start"
          >
            <Play />
            Test this rule
          </Button>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label
            htmlFor={`rule-message-${rule.id}`}
            className="text-body-lg text-on-surface-variant"
          >
            Message shown to the customer
          </label>
          <Input
            id={`rule-message-${rule.id}`}
            value={rule.message}
            onChange={(event) => onMessageChange(rule.id, event.target.value)}
          />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className={cn(
            "flex items-center gap-1 text-body-sm text-on-surface-variant transition-colors hover:text-on-surface",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
          )}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Advanced: edit the raw rule expression
        </button>

        {advancedOpen && (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-body-sm text-on-surface-variant">
              Only change this if someone technical has asked you to. This is the raw rule the
              compatibility engine actually runs.
            </p>
            <Textarea
              value={rule.expressionJson}
              readOnly={!onExpressionChange}
              onChange={
                onExpressionChange
                  ? (event) => onExpressionChange(rule.id, event.target.value)
                  : undefined
              }
              className="min-h-32 font-mono text-label-mono-xs"
              aria-label={`Raw expression for ${rule.plainLanguageDescription}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function RuleBuilder({
  rules,
  onToggleActive,
  onSeverityChange,
  onMessageChange,
  onExpressionChange,
  onTestRule,
  className,
}: RuleBuilderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {rules.map((rule) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          onToggleActive={onToggleActive}
          onSeverityChange={onSeverityChange}
          onMessageChange={onMessageChange}
          onExpressionChange={onExpressionChange}
          onTestRule={onTestRule}
        />
      ))}
    </div>
  );
}
