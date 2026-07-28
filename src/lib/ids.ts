/**
 * Human-safe public identifiers, distinct from internal cuid primary keys.
 * See docs/00-MASTER-INDEX.md §5 and docs/06-DATA-MODEL.md §1.
 *
 * Internal PKs are never exposed in URLs. These generators produce the
 * identifiers that ARE: order numbers, ticket numbers, and build shortIds.
 */

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(length: number, randomBytes: () => Uint8Array): string {
  const bytes = randomBytes();
  let result = "";
  for (let i = 0; i < length; i++) {
    // Index is `crypto`-derived byte modulo the alphabet length — always an
    // in-range integer, never attacker-controlled input.
    // eslint-disable-next-line security/detect-object-injection
    result += BASE58_ALPHABET[bytes[i]! % BASE58_ALPHABET.length];
  }
  return result;
}

function getRandomValues(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  // `crypto` is available in both the Next.js Edge/Node runtime and in
  // Vitest's node environment via globalThis.
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** Generates an 8-character base58 short ID for shareable PC builds (`/build/[shortId]`). */
export function generateBuildShortId(): string {
  return randomBase58(8, () => getRandomValues(8));
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Formats an order number as `CC-YYMM-NNNN`, given the placement date (in
 * Kathmandu time — callers should pass the Kathmandu-local year/month) and
 * a monthly sequence number from the database (docs/06-DATA-MODEL.md §6).
 */
export function formatOrderNumber(year: number, month: number, sequence: number): string {
  const yy = pad(year % 100, 2);
  const mm = pad(month, 2);
  const nnnn = pad(sequence, 4);
  return `CC-${yy}${mm}-${nnnn}`;
}

const ORDER_NUMBER_PATTERN = /^CC-(\d{2})(\d{2})-(\d{4,})$/;

export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(value);
}

/** Formats a service ticket number as `SVC-YYMM-NNNN` (docs/06-DATA-MODEL.md §9). */
export function formatTicketNumber(year: number, month: number, sequence: number): string {
  const yy = pad(year % 100, 2);
  const mm = pad(month, 2);
  const nnnn = pad(sequence, 4);
  return `SVC-${yy}${mm}-${nnnn}`;
}

const TICKET_NUMBER_PATTERN = /^SVC-(\d{2})(\d{2})-(\d{4,})$/;

export function isValidTicketNumber(value: string): boolean {
  return TICKET_NUMBER_PATTERN.test(value);
}

/**
 * The deterministic `BRAND-MODEL` half of docs/09-ADMIN-DAD-MODE.md §5.1
 * Step 1's "Product Code": "Auto-generated `BRAND-MODEL-NNN`; uniqueness
 * checked live." This builds only the prefix — a pure function of the
 * brand and product name, with no database access — because the `-NNN`
 * suffix that makes the whole thing unique needs a live query against
 * every `Variant.sku` already using this prefix, which is
 * `server/services/admin/product.ts`'s job, not this file's (this module
 * has no `"server-only"` guard and is unit-tested without a database on
 * purpose — see `ids.test.ts`).
 */
export function buildProductCodePrefix(brandName: string, productName: string): string {
  const brandPart =
    brandName
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 10)
      .toUpperCase() || "BRAND";
  const modelPart =
    productName
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 12)
      .toUpperCase() || "MODEL";
  return `${brandPart}-${modelPart}`;
}
