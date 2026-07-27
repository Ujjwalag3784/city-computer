import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok, unwrap } from "./result";

describe("ok / err", () => {
  it("wraps a success value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) expect(result.value).toBe(42);
  });

  it("wraps a failure value", () => {
    const result = err("boom");
    expect(result.ok).toBe(false);
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) expect(result.error).toBe("boom");
  });
});

describe("unwrap", () => {
  it("returns the value for a success result", () => {
    expect(unwrap(ok("value"))).toBe("value");
  });

  it("throws the error for a failure result", () => {
    const error = new Error("failed");
    expect(() => unwrap(err(error))).toThrow(error);
  });
});
