/**
 * docs/11-SEO-STRATEGY.md §4: "Money is serialised from integer paisa via
 * a single `toSchemaPrice()` helper (`164900.00`), never the display
 * string with `रु`." Mirrors this codebase's own money rule
 * (`src/lib/money.ts`: paisa is the only unit application code stores).
 */
import { assertPaisa } from "@/lib/money";

/** `164900` paisa → `"1649.00"` NPR string for schema.org `price`/`lowPrice`/`highPrice`. */
export function toSchemaPrice(pricePaisa: number): string {
  assertPaisa(pricePaisa, "toSchemaPrice input");
  const rupees = pricePaisa / 100;
  return rupees.toFixed(2);
}
