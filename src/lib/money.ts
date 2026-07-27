/**
 * Money handling for City Computer.
 *
 * Rule (docs/00-MASTER-INDEX.md §5, C1 in docs/18-SONNET-HANDOFF.md):
 * money is ALWAYS an integer number of paisa (1 NPR = 100 paisa). Never a
 * float, never a Decimal, in application code. Formatting to a human-
 * readable rupee string happens only at the edge, via `formatNPR`.
 */

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

const PAISA_PER_RUPEE = 100;

/** Asserts `value` is a safe, non-negative integer number of paisa. */
export function assertPaisa(value: number, label = "amount"): number {
  if (!Number.isInteger(value)) {
    throw new InvalidMoneyError(`${label} must be an integer number of paisa, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(`${label} exceeds the safe integer range`);
  }
  if (value < 0) {
    throw new InvalidMoneyError(`${label} must not be negative, got ${value}`);
  }
  return value;
}

/** Converts a whole-rupee integer to paisa. Rejects non-integer rupees. */
export function rupeesToPaisa(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new InvalidMoneyError(`rupees must be a finite number, got ${rupees}`);
  }
  if (!Number.isInteger(rupees)) {
    throw new InvalidMoneyError(
      `rupees must be a whole number — pass paisa directly for fractional amounts, got ${rupees}`,
    );
  }
  if (rupees < 0) {
    throw new InvalidMoneyError(`rupees must not be negative, got ${rupees}`);
  }
  return assertPaisa(rupees * PAISA_PER_RUPEE, "rupeesToPaisa result");
}

/** Converts paisa to a decimal rupee number. For display/analytics only — never re-store this. */
export function paisaToRupees(paisa: number): number {
  assertPaisa(paisa, "paisaToRupees input");
  return paisa / PAISA_PER_RUPEE;
}

export function addPaisa(a: number, b: number): number {
  assertPaisa(a, "addPaisa a");
  assertPaisa(b, "addPaisa b");
  return assertPaisa(a + b, "addPaisa result");
}

/** Subtracts b from a, clamping at zero per docs/06-DATA-MODEL.md §12 #15. */
export function subtractPaisaClamped(a: number, b: number): number {
  assertPaisa(a, "subtractPaisaClamped a");
  assertPaisa(b, "subtractPaisaClamped b");
  return Math.max(0, a - b);
}

/**
 * Multiplies paisa by a rate (e.g. a percentage as 0–1) using round-half-up
 * on the smallest unit, so totals never drift under repeated operations.
 */
export function multiplyPaisa(paisa: number, rate: number): number {
  assertPaisa(paisa, "multiplyPaisa paisa");
  if (!Number.isFinite(rate) || rate < 0) {
    throw new InvalidMoneyError(`rate must be a finite, non-negative number, got ${rate}`);
  }
  return assertPaisa(Math.round(paisa * rate), "multiplyPaisa result");
}

/** Computes a percentage discount amount in paisa, rounded to the nearest paisa. */
export function percentageOfPaisa(paisa: number, percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new InvalidMoneyError(`percent must be between 0 and 100, got ${percent}`);
  }
  return multiplyPaisa(paisa, percent / 100);
}

/**
 * Validates a compare-at (strike-through) price against docs/06-DATA-MODEL.md §4:
 * `compareAtPricePaisa` must be null or strictly greater than `pricePaisa`.
 */
export function isValidCompareAtPrice(pricePaisa: number, compareAtPaisa: number | null): boolean {
  assertPaisa(pricePaisa, "isValidCompareAtPrice pricePaisa");
  if (compareAtPaisa === null) return true;
  assertPaisa(compareAtPaisa, "isValidCompareAtPrice compareAtPaisa");
  return compareAtPaisa > pricePaisa;
}

/** Returns the discount percentage (0–100, rounded) implied by a compare-at price, or null. */
export function discountPercent(pricePaisa: number, compareAtPaisa: number | null): number | null {
  if (!isValidCompareAtPrice(pricePaisa, compareAtPaisa) || compareAtPaisa === null) {
    return null;
  }
  return Math.round(((compareAtPaisa - pricePaisa) / compareAtPaisa) * 100);
}

/**
 * Formats paisa as a Nepali rupee string with the Devanagari sign, Western
 * thousands grouping, and no decimals for whole rupees — per
 * docs/05-DESIGN-SYSTEM.md §9 and docs/09-ADMIN-DAD-MODE.md §2.2.
 * This is the ONE currency formatter in the codebase.
 */
export function formatNPR(paisa: number, options: { showSign?: boolean } = {}): string {
  assertPaisa(paisa, "formatNPR paisa");
  const rupees = paisa / PAISA_PER_RUPEE;
  const hasFraction = paisa % PAISA_PER_RUPEE !== 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
  const sign = options.showSign === false ? "" : "रु ";
  return `${sign}${formatted}`;
}
