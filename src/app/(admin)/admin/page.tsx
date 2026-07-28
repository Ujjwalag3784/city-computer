import type { Metadata } from "next";
import Link from "next/link";
import { MetricTile } from "@/components/admin/metric-tile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/money";
import { getTodayDashboardForRequest } from "@/server/services/admin/dashboard";

/**
 * `/admin` — "Today" (docs/09-ADMIN-DAD-MODE.md §3/§4). Row 1 (four
 * `MetricTile`s) and Row 2 (the "what to do next" task list) only, per
 * the JUDGMENT CALL noted on `server/services/admin/dashboard.ts`: Rows
 * 3–5 (weekly/monthly comparisons, top-seller/recent lists, and the
 * optional collapsible charts) are a separate, later pass, not silently
 * dropped — flagged here and in PROGRESS.md.
 *
 * §1's "section explainer" rule ("One short paragraph at the top of
 * every screen") is the `<p>` under the heading below.
 */
export const metadata: Metadata = {
  title: "Today — Admin — City Computer Systems",
};

export default async function AdminTodayPage() {
  const { tiles, tasks } = await getTodayDashboardForRequest();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Today</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          This is where you can see how the shop is doing today and what needs your attention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Orders today"
          value={String(tiles.ordersToday)}
          helperLine={tiles.ordersTodayHelper}
          href="/admin/orders"
        />
        <MetricTile
          label="Money today"
          value={formatNPR(tiles.moneyTodayPaisa)}
          helperLine={`Yesterday: ${formatNPR(tiles.moneyYesterdayPaisa)}`}
        />
        <MetricTile
          label="Needs your attention"
          value={String(tiles.needsAttentionCount)}
          helperLine={tiles.needsAttentionHelper}
        />
        <MetricTile
          label="Almost out of stock"
          value={String(tiles.almostOutOfStockCount)}
          helperLine="See the list"
          href="/admin/inventory?filter=low-stock"
        />
      </div>

      <Card className="flex flex-col gap-3 p-[--space-card-padding]">
        <h2 className="text-title text-on-surface">What to do next</h2>

        {tasks.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-glass-stroke px-3 py-2.5"
              >
                <span className="text-body-sm text-on-surface">{task.label}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={task.href}>{task.actionLabel}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
