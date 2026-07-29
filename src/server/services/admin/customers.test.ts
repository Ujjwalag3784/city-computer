import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  db: {
    customer: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { listCustomersForAdmin, getCustomerForAdmin, setCustomerCodBlocked, updateCustomerNotes } =
  await import("./customers");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.customer.findMany).mockReset();
  vi.mocked(db.customer.count).mockReset();
  vi.mocked(db.customer.findUnique).mockReset();
  vi.mocked(db.customer.update).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("listCustomersForAdmin", () => {
  it("filters to only COD-blocked customers for the cod-blocked chip", async () => {
    vi.mocked(db.customer.findMany).mockResolvedValue([]);
    vi.mocked(db.customer.count).mockResolvedValue(0);

    await listCustomersForAdmin({ filter: "cod-blocked", page: 1 });

    const where = vi.mocked(db.customer.findMany).mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ AND: [{ codBlocked: true }] });
  });

  it("filters to customers created in the last 7 days for new-this-week", async () => {
    vi.mocked(db.customer.findMany).mockResolvedValue([]);
    vi.mocked(db.customer.count).mockResolvedValue(0);
    const now = new Date("2026-07-29T00:00:00Z");

    await listCustomersForAdmin({ filter: "new-this-week", page: 1 }, now);

    const where = vi.mocked(db.customer.findMany).mock.calls[0]?.[0]?.where as {
      AND: { createdAt: { gte: Date } }[];
    };
    expect(where.AND[0]?.createdAt.gte.toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("reports hasNext when more rows exist than the page size", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `c_${i}`,
      name: "Test",
      phone: null,
      email: null,
      tags: [],
      codBlocked: false,
      totalOrders: 0,
      totalSpentPaisa: 0,
      lastOrderAt: null,
      createdAt: new Date(),
    }));
    vi.mocked(db.customer.findMany).mockResolvedValue(rows as never);
    vi.mocked(db.customer.count).mockResolvedValue(21);

    const result = await listCustomersForAdmin({ filter: "all", page: 1 });

    expect(result.items).toHaveLength(20);
    expect(result.hasNext).toBe(true);
  });
});

describe("getCustomerForAdmin", () => {
  it("throws NotFoundError for a missing customer", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue(null as never);

    await expect(getCustomerForAdmin("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("marks the address matching defaultAddressId as default", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({
      id: "c1",
      name: "Ram",
      phone: null,
      email: null,
      tags: [],
      codBlocked: false,
      notes: null,
      totalOrders: 0,
      totalSpentPaisa: 0,
      lastOrderAt: null,
      createdAt: new Date(),
      defaultAddressId: "addr_2",
      addresses: [
        {
          id: "addr_1",
          label: "HOME",
          fullName: "Ram",
          phone: "1",
          province: "BAGMATI",
          district: "Kathmandu",
          municipality: "KMC",
          ward: 1,
          streetAddress: "St",
          landmark: null,
          latitude: null,
          longitude: null,
          isDefault: false,
        },
        {
          id: "addr_2",
          label: "WORK",
          fullName: "Ram",
          phone: "1",
          province: "BAGMATI",
          district: "Kathmandu",
          municipality: "KMC",
          ward: 1,
          streetAddress: "St 2",
          landmark: null,
          latitude: null,
          longitude: null,
          isDefault: true,
        },
      ],
      orders: [],
    } as never);

    const detail = await getCustomerForAdmin("c1");

    expect(detail.addresses.find((a) => a.id === "addr_2")?.isDefault).toBe(true);
    expect(detail.addresses.find((a) => a.id === "addr_1")?.isDefault).toBe(false);
  });
});

describe("setCustomerCodBlocked", () => {
  it("throws NotFoundError for a missing customer", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue(null as never);

    await expect(
      setCustomerCodBlocked("missing", true, "repeat refusals", ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates codBlocked and records an audit log entry with the reason", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ codBlocked: false } as never);
    vi.mocked(db.customer.update).mockResolvedValue({} as never);

    await setCustomerCodBlocked("c1", true, "Refused delivery twice", ACTOR);

    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { codBlocked: true },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.cod_blocked",
        before: { codBlocked: false },
        after: { codBlocked: true, reason: "Refused delivery twice" },
      }),
    );
  });

  it("records customer.cod_unblocked when lifting a block", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ codBlocked: true } as never);
    vi.mocked(db.customer.update).mockResolvedValue({} as never);

    await setCustomerCodBlocked("c1", false, "Spoke to them, all good now", ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.cod_unblocked" }),
    );
  });
});

describe("updateCustomerNotes", () => {
  it("throws NotFoundError for a missing customer", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue(null as never);

    await expect(updateCustomerNotes("missing", "note", ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("trims whitespace and stores null for an empty note", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ notes: "old" } as never);
    vi.mocked(db.customer.update).mockResolvedValue({} as never);

    await updateCustomerNotes("c1", "   ", ACTOR);

    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { notes: null },
    });
  });
});
