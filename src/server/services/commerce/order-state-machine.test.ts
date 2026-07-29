import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { OrderActorType, OrderStatus } from "@/generated/prisma/client";

function makeTx() {
  return {
    order: { update: vi.fn().mockResolvedValue({ id: "order_1", status: "CONFIRMED" }) },
    orderStatusEvent: { create: vi.fn() },
  };
}

let tx = makeTx();

vi.mock("@/server/db", () => ({
  db: {
    order: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/services/admin/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("@/server/services/admin/audit-log");
const {
  isTerminalOrderStatus,
  findTransitionRule,
  canTransition,
  availableTransitions,
  applyOrderTransition,
  applyOrderTransitionAsAdmin,
} = await import("./order-state-machine");

beforeEach(() => {
  tx = makeTx();
  vi.mocked(db.order.findUnique).mockReset();
  vi.mocked(db.$transaction)
    .mockReset()
    .mockImplementation(async (callback: unknown) => (callback as (tx: unknown) => unknown)(tx));
  vi.mocked(recordAuditLog).mockReset();
});

describe("isTerminalOrderStatus", () => {
  it("is true only for CANCELLED and REFUNDED", () => {
    expect(isTerminalOrderStatus(OrderStatus.CANCELLED)).toBe(true);
    expect(isTerminalOrderStatus(OrderStatus.REFUNDED)).toBe(true);
    expect(isTerminalOrderStatus(OrderStatus.CONFIRMED)).toBe(false);
    expect(isTerminalOrderStatus(OrderStatus.PENDING_PAYMENT)).toBe(false);
  });
});

describe("findTransitionRule / canTransition", () => {
  it("finds a real edge and allows it for a listed actor type", () => {
    const rule = findTransitionRule(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED);
    expect(rule).toBeDefined();
    expect(
      canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED, OrderActorType.SYSTEM),
    ).toBe(true);
  });

  it("rejects an actor type not listed for a real edge", () => {
    expect(
      canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED, OrderActorType.CUSTOMER),
    ).toBe(false);
  });

  it("returns undefined/false for an edge that doesn't exist in the table at all", () => {
    expect(findTransitionRule(OrderStatus.DELIVERED, OrderStatus.CONFIRMED)).toBeUndefined();
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CONFIRMED, OrderActorType.ADMIN)).toBe(
      false,
    );
  });
});

describe("availableTransitions", () => {
  it("narrows PENDING_PAYMENT's three possible edges down to just CANCELLED for a CUSTOMER actor", () => {
    expect(availableTransitions(OrderStatus.PENDING_PAYMENT, OrderActorType.CUSTOMER)).toEqual([
      OrderStatus.CANCELLED,
    ]);
  });

  it("gives ADMIN both CONFIRMED and PAYMENT_FAILED (plus CANCELLED) from PENDING_PAYMENT", () => {
    const result = availableTransitions(OrderStatus.PENDING_PAYMENT, OrderActorType.ADMIN);
    expect(result).toEqual(
      expect.arrayContaining([
        OrderStatus.CONFIRMED,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.CANCELLED,
      ]),
    );
  });

  it("returns an empty array for a terminal status", () => {
    expect(availableTransitions(OrderStatus.CANCELLED, OrderActorType.ADMIN)).toEqual([]);
    expect(availableTransitions(OrderStatus.REFUNDED, OrderActorType.ADMIN)).toEqual([]);
  });
});

describe("applyOrderTransition", () => {
  it("throws NotFoundError when the order doesn't exist", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    await expect(
      applyOrderTransition("missing", OrderStatus.CONFIRMED, { type: OrderActorType.SYSTEM }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws CONFLICT_VERSION for an edge that isn't in the transition table", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order_1",
      status: OrderStatus.DELIVERED,
    } as never);
    await expect(
      applyOrderTransition("order_1", OrderStatus.CONFIRMED, {
        type: OrderActorType.ADMIN,
        id: "admin_1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT_VERSION" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when the edge exists but this actor type isn't allowed to use it", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order_1",
      status: OrderStatus.PENDING_PAYMENT,
    } as never);
    await expect(
      applyOrderTransition("order_1", OrderStatus.CONFIRMED, {
        type: OrderActorType.CUSTOMER,
        id: "cust_1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("writes the new status, its timestamp column, and an OrderStatusEvent in one transaction", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order_1",
      status: OrderStatus.PENDING_PAYMENT,
    } as never);

    await applyOrderTransition("order_1", OrderStatus.CONFIRMED, { type: OrderActorType.SYSTEM });

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: expect.objectContaining({
          status: OrderStatus.CONFIRMED,
          confirmedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.orderStatusEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order_1",
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.CONFIRMED,
          actorType: OrderActorType.SYSTEM,
        }),
      }),
    );
    // Non-admin transitions never touch the separate AuditLog — OrderStatusEvent is their own record.
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("records a cancellation reason from the note when transitioning to CANCELLED", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order_1",
      status: OrderStatus.PENDING_PAYMENT,
    } as never);

    await applyOrderTransition(
      "order_1",
      OrderStatus.CANCELLED,
      { type: OrderActorType.CUSTOMER, id: "cust_1" },
      "Changed my mind",
    );

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          cancellationReason: "Changed my mind",
        }),
      }),
    );
  });

  it("mirrors an ADMIN-performed transition into the shared AuditLog", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order_1",
      status: OrderStatus.CONFIRMED,
    } as never);

    await applyOrderTransitionAsAdmin("order_1", OrderStatus.PREPARING, {
      id: "admin_1",
      email: "a@b.com",
    });

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin_1",
        actorEmail: "a@b.com",
        action: "order.statusChanged",
        entityType: "Order",
        entityId: "order_1",
      }),
    );
  });
});
