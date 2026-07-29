import { describe, expect, it } from "vitest";
import { calculateEmi } from "./emi";

describe("calculateEmi", () => {
  it("returns the principal itself, spread evenly, at 0% interest and 0% fee", () => {
    const result = calculateEmi(1_200_00, {
      months: 12,
      interestRatePercent: 0,
      processingFeePercent: 0,
    });
    expect(result.monthlyPaymentPaisa).toBe(10_000);
    expect(result.totalInterestAndFeesPaisa).toBe(0);
    expect(result.totalPayablePaisa).toBe(1_200_00);
  });

  it("adds pro-rated simple interest for the tenure length", () => {
    // Rs 100,000 at 12% annual interest over 12 months → Rs 12,000 interest.
    const result = calculateEmi(100_000_00, {
      months: 12,
      interestRatePercent: 12,
      processingFeePercent: 0,
    });
    expect(result.totalInterestAndFeesPaisa).toBe(12_000_00);
    expect(result.totalPayablePaisa).toBe(112_000_00);
    expect(result.monthlyPaymentPaisa).toBe(Math.round(112_000_00 / 12));
  });

  it("pro-rates interest to a shorter tenure — 6 months at 12% annual is half the 12-month interest", () => {
    const result = calculateEmi(100_000_00, {
      months: 6,
      interestRatePercent: 12,
      processingFeePercent: 0,
    });
    expect(result.totalInterestAndFeesPaisa).toBe(6_000_00);
  });

  it("adds the one-off processing fee on top of interest", () => {
    const result = calculateEmi(100_000_00, {
      months: 12,
      interestRatePercent: 0,
      processingFeePercent: 1.5,
    });
    expect(result.totalInterestAndFeesPaisa).toBe(1_500_00);
    expect(result.totalPayablePaisa).toBe(101_500_00);
  });

  it("rounds the monthly payment to the nearest whole paisa", () => {
    const result = calculateEmi(100_00, {
      months: 3,
      interestRatePercent: 0,
      processingFeePercent: 0,
    });
    // 10,000 paisa / 3 = 3333.33... → rounds to 3333.
    expect(result.monthlyPaymentPaisa).toBe(3333);
  });

  it("rejects a non-integer or non-positive tenure", () => {
    expect(() =>
      calculateEmi(100_00, { months: 0, interestRatePercent: 0, processingFeePercent: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      calculateEmi(100_00, { months: 3.5, interestRatePercent: 0, processingFeePercent: 0 }),
    ).toThrow(RangeError);
  });

  it("rejects a negative interest or fee rate", () => {
    expect(() =>
      calculateEmi(100_00, { months: 3, interestRatePercent: -1, processingFeePercent: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      calculateEmi(100_00, { months: 3, interestRatePercent: 0, processingFeePercent: -1 }),
    ).toThrow(RangeError);
  });

  it("rejects a non-integer principal — money is always integer paisa", () => {
    expect(() =>
      calculateEmi(100.5, { months: 3, interestRatePercent: 0, processingFeePercent: 0 }),
    ).toThrow();
  });
});
