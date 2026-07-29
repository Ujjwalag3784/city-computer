import { describe, expect, it } from "vitest";
import { InvalidMoneyError } from "@/lib/money";
import { toSchemaPrice } from "./money";

describe("toSchemaPrice", () => {
  it("converts whole-rupee paisa to a two-decimal rupee string", () => {
    expect(toSchemaPrice(164900_00)).toBe("164900.00");
  });

  it("converts paisa with a fractional rupee component correctly", () => {
    expect(toSchemaPrice(150050)).toBe("1500.50");
  });

  it("converts zero paisa to 0.00", () => {
    expect(toSchemaPrice(0)).toBe("0.00");
  });

  it("rejects a non-integer paisa value", () => {
    expect(() => toSchemaPrice(100.5)).toThrow(InvalidMoneyError);
  });

  it("rejects a negative paisa value", () => {
    expect(() => toSchemaPrice(-1)).toThrow(InvalidMoneyError);
  });
});
