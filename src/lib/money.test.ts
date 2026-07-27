import { describe, expect, it } from "vitest";
import {
  InvalidMoneyError,
  addPaisa,
  assertPaisa,
  discountPercent,
  formatNPR,
  isValidCompareAtPrice,
  multiplyPaisa,
  paisaToRupees,
  percentageOfPaisa,
  rupeesToPaisa,
  subtractPaisaClamped,
} from "./money";

describe("assertPaisa", () => {
  it("accepts a non-negative integer", () => {
    expect(assertPaisa(15490000)).toBe(15490000);
    expect(assertPaisa(0)).toBe(0);
  });

  it("rejects a non-integer", () => {
    expect(() => assertPaisa(100.5)).toThrow(InvalidMoneyError);
  });

  it("rejects a negative number", () => {
    expect(() => assertPaisa(-1)).toThrow(InvalidMoneyError);
  });

  it("rejects an unsafe integer", () => {
    expect(() => assertPaisa(Number.MAX_SAFE_INTEGER + 10)).toThrow(InvalidMoneyError);
  });

  it("includes the label in the error message", () => {
    expect(() => assertPaisa(-1, "totalPaisa")).toThrow(/totalPaisa/);
  });
});

describe("rupeesToPaisa", () => {
  it("converts whole rupees to paisa", () => {
    expect(rupeesToPaisa(1549)).toBe(154900);
    expect(rupeesToPaisa(0)).toBe(0);
  });

  it("rejects fractional rupees", () => {
    expect(() => rupeesToPaisa(10.5)).toThrow(InvalidMoneyError);
  });

  it("rejects negative rupees", () => {
    expect(() => rupeesToPaisa(-5)).toThrow(InvalidMoneyError);
  });

  it("rejects non-finite input", () => {
    expect(() => rupeesToPaisa(Number.POSITIVE_INFINITY)).toThrow(InvalidMoneyError);
  });
});

describe("paisaToRupees", () => {
  it("converts paisa to a decimal rupee value", () => {
    expect(paisaToRupees(154900)).toBe(1549);
    expect(paisaToRupees(50)).toBe(0.5);
  });

  it("rejects invalid paisa", () => {
    expect(() => paisaToRupees(-1)).toThrow(InvalidMoneyError);
  });
});

describe("addPaisa", () => {
  it("adds two paisa amounts", () => {
    expect(addPaisa(100, 200)).toBe(300);
    expect(addPaisa(0, 0)).toBe(0);
  });

  it("rejects invalid operands", () => {
    expect(() => addPaisa(-1, 100)).toThrow(InvalidMoneyError);
    expect(() => addPaisa(100, -1)).toThrow(InvalidMoneyError);
  });
});

describe("subtractPaisaClamped", () => {
  it("subtracts normally when the result is non-negative", () => {
    expect(subtractPaisaClamped(500, 200)).toBe(300);
  });

  it("clamps at zero when b exceeds a", () => {
    expect(subtractPaisaClamped(100, 500)).toBe(0);
  });

  it("rejects invalid operands", () => {
    expect(() => subtractPaisaClamped(-1, 100)).toThrow(InvalidMoneyError);
    expect(() => subtractPaisaClamped(100, -1)).toThrow(InvalidMoneyError);
  });
});

describe("multiplyPaisa", () => {
  it("multiplies and rounds to the nearest paisa", () => {
    expect(multiplyPaisa(100, 0.5)).toBe(50);
    expect(multiplyPaisa(3, 0.335)).toBe(1); // 1.005 rounds to 1
  });

  it("rejects an invalid rate", () => {
    expect(() => multiplyPaisa(100, -0.1)).toThrow(InvalidMoneyError);
    expect(() => multiplyPaisa(100, Number.NaN)).toThrow(InvalidMoneyError);
  });

  it("rejects invalid paisa", () => {
    expect(() => multiplyPaisa(-1, 0.5)).toThrow(InvalidMoneyError);
  });
});

describe("percentageOfPaisa", () => {
  it("computes a percentage amount", () => {
    expect(percentageOfPaisa(10000, 13)).toBe(1300); // VAT-style calc
    expect(percentageOfPaisa(10000, 0)).toBe(0);
    expect(percentageOfPaisa(10000, 100)).toBe(10000);
  });

  it("rejects an out-of-range percent", () => {
    expect(() => percentageOfPaisa(10000, -1)).toThrow(InvalidMoneyError);
    expect(() => percentageOfPaisa(10000, 101)).toThrow(InvalidMoneyError);
  });
});

describe("isValidCompareAtPrice", () => {
  it("allows a null compare-at price", () => {
    expect(isValidCompareAtPrice(10000, null)).toBe(true);
  });

  it("requires compareAt to be strictly greater than price", () => {
    expect(isValidCompareAtPrice(10000, 12000)).toBe(true);
    expect(isValidCompareAtPrice(10000, 10000)).toBe(false);
    expect(isValidCompareAtPrice(10000, 9000)).toBe(false);
  });

  it("validates the inputs", () => {
    expect(() => isValidCompareAtPrice(-1, null)).toThrow(InvalidMoneyError);
    expect(() => isValidCompareAtPrice(10000, -1)).toThrow(InvalidMoneyError);
  });
});

describe("discountPercent", () => {
  it("computes the rounded discount percentage", () => {
    expect(discountPercent(15490000, 16900000)).toBe(8);
    expect(discountPercent(9000, 10000)).toBe(10);
  });

  it("returns null when there is no valid compare-at price", () => {
    expect(discountPercent(10000, null)).toBeNull();
    expect(discountPercent(10000, 9000)).toBeNull();
    expect(discountPercent(10000, 10000)).toBeNull();
  });
});

describe("formatNPR", () => {
  it("formats whole rupees with the Devanagari sign and no decimals", () => {
    expect(formatNPR(15490000)).toBe("रु 154,900");
  });

  it("formats fractional paisa with two decimals", () => {
    expect(formatNPR(1050)).toBe("रु 10.50");
  });

  it("formats zero correctly", () => {
    expect(formatNPR(0)).toBe("रु 0");
  });

  it("can omit the currency sign", () => {
    expect(formatNPR(15490000, { showSign: false })).toBe("154,900");
  });

  it("rejects invalid paisa", () => {
    expect(() => formatNPR(-1)).toThrow(InvalidMoneyError);
    expect(() => formatNPR(1.5)).toThrow(InvalidMoneyError);
  });
});
