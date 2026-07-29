import type { Metadata } from "next";
import Link from "next/link";
import { MetricTile } from "@/components/admin/metric-tile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/money";
import { getTodayDashboardForRequest } from "@/server/services/admin/dashboard";
import { LearnMoreLink } from "@/components/admin/learn-more-link";

/**
 * `/admin` — "Today" (docs/09-ADMIN-DAD-MODE.md §3/§4). Row 1 (four
 * `MetricTile`s), Row 2 (the "what to do next" task list), Row 3 (this
 * week/this month vs. the period before), and Row 4 (best sellers, most
 * viewed, new customers, recent orders). Row 5 (the optional collapsible
 * 30-day charts) is deliberately not built — see
 * `server/services/admin/dashboard.ts`'s top-of-file note and
 * PROGRESS.md's Phase 9 section for why that's a flagged deferral, not an
 * oversight.
 *
 * §1's "section explainer" rule ("One short paragraph at the top of
 * every screen") is the `<p>` under the heading below.
 */
export const metadata: Metadata = {
  title: "Today — Admin — City Computer Systems",
};

export default async function AdminTodayPage() {
  const { tiles, tasks, trends, lists } = await getTodayDashboardForRequest();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Today</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          This is where you can see how the shop is doing today and what needs your attention.
        </p>
        <LearnMoreLink slug="understanding-the-today-page" />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[trends.thisWeek, trends.thisMonth].map((trend) => (
          <MetricTile
            key={trend.label}
            label={trend.label}
            value={formatNPR(trend.revenuePaisa)}
            helperLine={`${trend.ordersCount} order${trend.ordersCount === 1 ? "" : "s"} · Average order value ${formatNPR(trend.aovPaisa)}`}
            href={trend.href}
            trend={
              trend.trendDirection
                ? { direction: trend.trendDirection, label: trend.comparisonLabel }
                : undefined
            }
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <DashboardListCard
          title="Best sellers this week"
          items={lists.bestSellers}
          emptyMessage="Nothing has sold yet this week."
        />
        <DashboardListCard
          title="Most viewed this week"
          items={lists.mostViewed}
          emptyMessage="No view data yet."
        />
        <DashboardListCard
          title="New customers"
          items={lists.recentCustomers}
          emptyMessage="No customers yet."
        />
        <DashboardListCard
          title="Recent orders"
          items={lists.recentOrders}
          emptyMessage="No orders yet."
        />
      </div>
    </div>
  );
}

/**
 * One Row-4 card — a title, a short plain-language list, and a
 * "See all" link. `amountPaisa` is formatted here (`formatNPR`), never in
 * the service, per `lib/money.ts`'s "formatting happens only at the edge"
 * rule.
 */
function DashboardListCard({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: {
    id: string;
    primaryLabel: string;
    secondaryLabel: string;
    amountPaisa?: number;
    href: string;
  }[];
  emptyMessage: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-[--space-card-padding]">
      <h2 className="text-title text-on-surface">{title}</h2>
      {items.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-col gap-0.5 rounded px-1 py-1 text-body-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              >
                <span className="text-on-surface">{item.primaryLabel}</span>
                <span className="text-body-sm text-on-surface-variant">
                  {item.secondaryLabel}
                  {typeof item.amountPaisa === "number" ? ` · ${formatNPR(item.amountPaisa)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
