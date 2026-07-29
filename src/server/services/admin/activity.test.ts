import { describe, expect, it } from "vitest";
import { toActivityHistoryRow } from "./activity";
import type { AuditLogEntry } from "./audit-log";

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "log_1",
    actorId: "user_1",
    actorEmail: "sita@citycomputer.com.np",
    action: "product.priceChanged",
    entityType: "Product",
    entityId: "product_1",
    before: { pricePaisa: 12990000 },
    after: { pricePaisa: 12490000 },
    createdAt: new Date(Date.now() - 60_000),
    ...overrides,
  };
}

describe("toActivityHistoryRow", () => {
  it("uses the curated sentence for a known action", () => {
    const row = toActivityHistoryRow(entry());
    expect(row.sentence).toBe("changed the price of a product");
    expect(row.actorName).toBe("sita@citycomputer.com.np");
  });

  it("falls back to a humanised sentence for an unknown action", () => {
    const row = toActivityHistoryRow(
      entry({
        action: "brand.updated",
        entityType: "Brand",
        before: { name: "Old" },
        after: { name: "New" },
      }),
    );
    expect(row.sentence).toBe("updated a brand");
    expect(row.diff).toBe("name: Old → New");
  });

  it("shows 'Someone' when actorEmail is null (a system-initiated change)", () => {
    const row = toActivityHistoryRow(entry({ actorEmail: null }));
    expect(row.actorName).toBe("Someone");
  });

  it("returns no diff line when before/after aren't both plain objects", () => {
    const row = toActivityHistoryRow(entry({ before: null, after: null }));
    expect(row.diff).toBeNull();
  });

  it("only shows fields that actually changed", () => {
    const row = toActivityHistoryRow(entry({ before: { a: 1, b: 2 }, after: { a: 1, b: 3 } }));
    expect(row.diff).toBe("b: 2 → 3");
  });
});
