import { describe, expect, it } from "vitest";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  isAppError,
  toSafeAppError,
} from "./errors";

describe("AppError", () => {
  it("maps a code to the correct HTTP status", () => {
    expect(new AppError("NOT_FOUND", "x").status).toBe(404);
    expect(new AppError("VALIDATION_FAILED", "x").status).toBe(422);
    expect(new AppError("RATE_LIMITED", "x").status).toBe(429);
    expect(new AppError("INTERNAL_ERROR", "x").status).toBe(500);
  });

  it("produces RFC 9457 Problem Details", () => {
    const error = new AppError("INSUFFICIENT_STOCK", "Not enough stock", {
      detail: "Only 2 left",
    });
    const problem = error.toProblemDetails("/api/v1/cart/items", "req_123");
    expect(problem).toMatchObject({
      title: "Not enough stock",
      status: 409,
      detail: "Only 2 left",
      instance: "/api/v1/cart/items",
      code: "INSUFFICIENT_STOCK",
      requestId: "req_123",
    });
    expect(problem.type).toContain("insufficient-stock");
  });

  it("includes field issues when present", () => {
    const error = new ValidationError([
      { field: "phone", code: "invalid", message: "Not a valid phone number" },
    ]);
    const problem = error.toProblemDetails("/api/v1/checkout/place", "req_1");
    expect(problem.errors).toHaveLength(1);
    expect(problem.errors?.[0]?.field).toBe("phone");
  });
});

describe("named error subclasses", () => {
  it("NotFoundError includes the entity name", () => {
    expect(new NotFoundError("Product").message).toBe("Product not found");
  });

  it("ForbiddenError and UnauthenticatedError have sensible defaults", () => {
    expect(new ForbiddenError().status).toBe(403);
    expect(new UnauthenticatedError().status).toBe(401);
  });
});

describe("isAppError", () => {
  it("identifies an AppError instance", () => {
    expect(isAppError(new NotFoundError("Order"))).toBe(true);
  });

  it("rejects a plain Error or other value", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError("not an error")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("toSafeAppError", () => {
  it("passes an existing AppError through unchanged", () => {
    const original = new NotFoundError("Product");
    expect(toSafeAppError(original)).toBe(original);
  });

  it("converts an unexpected error to a generic, safe INTERNAL_ERROR", () => {
    const safe = toSafeAppError(new Error("leaked SQL: DROP TABLE users"));
    expect(safe.code).toBe("INTERNAL_ERROR");
    expect(safe.message).not.toContain("DROP TABLE");
  });

  it("converts a non-Error throw to a safe AppError", () => {
    const safe = toSafeAppError("some string throw");
    expect(safe.code).toBe("INTERNAL_ERROR");
  });
});
