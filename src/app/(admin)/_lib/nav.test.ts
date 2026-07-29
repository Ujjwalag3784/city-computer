import { describe, expect, it } from "vitest";
import type { TodayDashboardData } from "@/server/services/admin/dashboard";
import { badgeCountsFromDashboard, buildAdminNavItems } from "./nav";

function dashboardWithTasks(counts: Record<string, number>): TodayDashboardData {
  return {
    tiles: {
      ordersToday: 0,
      ordersTodayHelper: "",
      moneyTodayPaisa: 0,
      moneyYesterdayPaisa: 0,
      needsAttentionCount: 0,
      needsAttentionHelper: "",
      almostOutOfStockCount: 0,
    },
    tasks: Object.entries(counts).map(([id, count]) => ({
      id,
      label: id,
      actionLabel: "Go",
      href: "/admin",
      count,
    })),
    trends: {
      thisWeek: {
        label: "This week",
        ordersCount: 0,
        revenuePaisa: 0,
        aovPaisa: 0,
        comparisonLabel: "the same as the period before",
        trendDirection: null,
        href: "/admin/orders",
      },
      thisMonth: {
        label: "This month",
        ordersCount: 0,
        revenuePaisa: 0,
        aovPaisa: 0,
        comparisonLabel: "the same as the period before",
        trendDirection: null,
        href: "/admin/orders",
      },
    },
    lists: { bestSellers: [], mostViewed: [], recentCustomers: [], recentOrders: [] },
  };
}

describe("buildAdminNavItems", () => {
  it("gives OWNER every nav row", () => {
    const items = buildAdminNavItems(["OWNER"]);
    expect(items.map((item) => item.label)).toEqual([
      "Today",
      "Orders",
      "Products",
      "Stock",
      "Customers",
      "Repairs",
      "Messages",
      "PC Builder",
      "Content",
      "Settings",
    ]);
  });

  it("hides rows a STAFF account cannot reach any page under", () => {
    const items = buildAdminNavItems(["STAFF"]);
    const labels = items.map((item) => item.label);
    expect(labels).toEqual(["Today", "Orders", "Products", "Stock", "Repairs"]);
    expect(labels).not.toContain("Customers");
    expect(labels).not.toContain("PC Builder");
    expect(labels).not.toContain("Content");
    expect(labels).not.toContain("Settings");
  });

  it("gives a TECHNICIAN only Today, Repairs, and PC Builder", () => {
    const items = buildAdminNavItems(["TECHNICIAN"]);
    expect(items.map((item) => item.label)).toEqual(["Today", "Repairs", "PC Builder"]);
  });

  it("gives a CUSTOMER-only session (no admin role at all) an empty nav", () => {
    expect(buildAdminNavItems(["CUSTOMER"])).toEqual([]);
  });

  it("unions roles across multiple held role keys", () => {
    const items = buildAdminNavItems(["SUPPORT", "TECHNICIAN"]);
    const labels = items.map((item) => item.label);
    // SUPPORT: Today, Orders, Customers, Messages. TECHNICIAN: Today, Repairs, PC Builder.
    expect(labels).toEqual(["Today", "Orders", "Customers", "Repairs", "Messages", "PC Builder"]);
  });

  it("attaches a badgeCount only when the mapped count is greater than zero", () => {
    const items = buildAdminNavItems(["OWNER"], { orders: 4, stock: 0 });
    const orders = items.find((item) => item.label === "Orders");
    const stock = items.find((item) => item.label === "Stock");
    expect(orders?.badgeCount).toBe(4);
    expect(stock?.badgeCount).toBeUndefined();
  });

  it("never attaches a badgeCount to rows with no mapped dashboard task (Products, Customers, PC Builder, Content, Settings, Today)", () => {
    const items = buildAdminNavItems(["OWNER"], { orders: 4, stock: 7, repairs: 2, messages: 3 });
    for (const label of ["Today", "Products", "Customers", "PC Builder", "Content", "Settings"]) {
      expect(items.find((item) => item.label === label)?.badgeCount).toBeUndefined();
    }
  });
});

describe("badgeCountsFromDashboard", () => {
  it("sums the two order-related tasks into a single 'orders' badge", () => {
    const counts = badgeCountsFromDashboard(
      dashboardWithTasks({ "bank-transfers": 2, "paid-not-sent": 3 }),
    );
    expect(counts.orders).toBe(5);
  });

  it("maps low-stock, ready-for-pickup, and unread-messages 1:1", () => {
    const counts = badgeCountsFromDashboard(
      dashboardWithTasks({ "low-stock": 7, "ready-for-pickup": 2, "unread-messages": 3 }),
    );
    expect(counts.stock).toBe(7);
    expect(counts.repairs).toBe(2);
    expect(counts.messages).toBe(3);
  });

  it("defaults every count to zero when the dashboard has no tasks at all", () => {
    const counts = badgeCountsFromDashboard(dashboardWithTasks({}));
    expect(counts).toEqual({ orders: 0, stock: 0, repairs: 0, messages: 0 });
  });
});
