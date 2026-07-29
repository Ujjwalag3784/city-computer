"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MenuLinkCheckResult } from "@/server/services/admin/menus";
import { checkMenuLinksAction } from "../_actions";

const STATUS_BADGE = {
  ok: "success",
  broken: "warning",
  unknown: "glass",
} as const;

/** The "broken-link check" docs/17 Phase 10 names — real, on-demand (see `admin/menus.ts`'s own doc comment for why this isn't an actual nightly cron in this codebase yet). */
export function LinkChecker() {
  const [results, setResults] = useState<MenuLinkCheckResult[] | null>(null);
  const [running, setRunning] = useState(false);

  async function handleCheck() {
    setRunning(true);
    try {
      const result = await checkMenuLinksAction();
      if (!result.ok) {
        toast(result.message ?? "Couldn't check links.");
        return;
      }
      setResults(result.data ?? []);
    } finally {
      setRunning(false);
    }
  }

  const brokenCount = results?.filter((r) => r.status === "broken").length ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-glass-stroke p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body-md font-medium text-on-surface">Broken-link check</p>
          <p className="text-body-sm text-on-surface-variant">
            Checks every menu item still points somewhere real.
          </p>
        </div>
        <Button type="button" onClick={handleCheck} disabled={running}>
          {running ? "Checking…" : "Check now"}
        </Button>
      </div>

      {results && (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-on-surface-variant">
            {brokenCount === 0 ? "No broken links found." : `${brokenCount} broken link(s) found.`}
          </p>
          {results
            .filter((r) => r.status !== "ok")
            .map((r) => (
              <div
                key={r.itemId}
                className="flex items-center justify-between gap-3 rounded border border-glass-stroke px-3 py-2"
              >
                <div>
                  <p className="text-body-sm font-medium text-on-surface">
                    {r.menuKey}: {r.label}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">{r.reason}</p>
                </div>
                <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
