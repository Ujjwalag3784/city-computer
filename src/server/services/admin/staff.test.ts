import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, AppError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  db: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    role: { findUnique: vi.fn() },
    userRole: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { createStaffMember, updateStaffRole, setStaffStatus } = await import("./staff");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

const BASE_INPUT = {
  name: "Sita Karki",
  email: "sita@citycomputer.com.np",
  phone: "",
  roleKey: "STAFF" as const,
};

beforeEach(() => {
  vi.mocked(db.user.findMany).mockReset();
  vi.mocked(db.user.findUnique).mockReset();
  vi.mocked(db.user.create).mockReset();
  vi.mocked(db.user.update).mockReset();
  vi.mocked(db.role.findUnique).mockReset();
  vi.mocked(db.userRole.deleteMany).mockReset();
  vi.mocked(db.userRole.create).mockReset();
  vi.mocked(db.$transaction).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("createStaffMember", () => {
  it("rejects an email already in use", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "existing" } as never);

    await expect(createStaffMember(BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(AppError);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with a hashed temporary password and the chosen role", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.role.findUnique).mockResolvedValue({ id: "role_staff" } as never);
    vi.mocked(db.user.create).mockResolvedValue({ id: "u1", name: "Sita Karki" } as never);

    const result = await createStaffMember(BASE_INPUT, ACTOR);

    expect(result.id).toBe("u1");
    expect(result.temporaryPassword).toHaveLength(16);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "hashed",
          userRoles: { create: { roleId: "role_staff" } },
        }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "staff.created" }),
    );
  });
});

describe("updateStaffRole", () => {
  it("throws NotFoundError for a missing staff member", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never);

    await expect(updateStaffRole("missing", "MANAGER", ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("replaces every existing UserRole row rather than adding to them", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      userRoles: [{ role: { key: "STAFF" } }],
    } as never);
    vi.mocked(db.role.findUnique).mockResolvedValue({ id: "role_manager" } as never);
    vi.mocked(db.userRole.deleteMany).mockReturnValue("delete-op" as never);
    vi.mocked(db.userRole.create).mockReturnValue("create-op" as never);
    vi.mocked(db.$transaction).mockResolvedValue([]);

    await updateStaffRole("u1", "MANAGER", ACTOR);

    expect(db.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(db.userRole.create).toHaveBeenCalledWith({
      data: { userId: "u1", roleId: "role_manager" },
    });
    expect(db.$transaction).toHaveBeenCalledWith(["delete-op", "create-op"]);
  });
});

describe("setStaffStatus", () => {
  it("refuses to let an owner turn off their own account", async () => {
    await expect(setStaffStatus("user_owner", false, ACTOR)).rejects.toBeInstanceOf(AppError);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundError for a missing staff member", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never);

    await expect(setStaffStatus("missing", false, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("suspends an active account", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ status: "ACTIVE" } as never);
    vi.mocked(db.user.update).mockResolvedValue({} as never);

    await setStaffStatus("u2", false, ACTOR);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { status: "SUSPENDED" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "staff.suspended" }),
    );
  });
});
