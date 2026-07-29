import { describe, expect, it } from "vitest";
import { formatPeriodComparison } from "./dashboard";

describe("formatPeriodComparison", () => {
  it("reports an increase in plain language", () => {
    const result = formatPeriodComparison(11_200_00, 10_000_00);
    expect(result.direction).toBe("up");
    expect(result.label).toBe("up 12% from the period before");
  });

  it("reports a decrease in plain language", () => {
    const result = formatPeriodComparison(8_000_00, 10_000_00);
    expect(result.direction).toBe("down");
    expect(result.label).toBe("down 20% from the period before");
  });

  it("treats a zero-percent change as flat, not up or down", () => {
    const result = formatPeriodComparison(10_000_00, 10_000_00);
    expect(result.direction).toBeNull();
    expect(result.label).toBe("about the same as the period before");
  });

  it("never divides by zero when the prior period had nothing", () => {
    const result = formatPeriodComparison(5_000_00, 0);
    expect(result.direction).toBe("up");
    expect(result.label).toBe("more than the period before (which had none)");
  });

  it("treats two empty periods as flat, not a fake percentage", () => {
    const result = formatPeriodComparison(0, 0);
    expect(result.direction).toBeNull();
    expect(result.label).toBe("the same as the period before");
  });

  it("rounds to the nearest whole percent", () => {
    const result = formatPeriodComparison(10_100_00, 10_000_00);
    expect(result.label).toBe("up 1% from the period before");
  });
});
