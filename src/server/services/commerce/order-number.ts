/**
 * Order number generation — docs/06-DATA-MODEL.md §6: `Order.orderNumber`,
 * "Unique, `CC-2607-0001`. Monthly sequence via a DB sequence + advisory
 * lock — see src/lib/ids.ts formatOrderNumber for the string format."
 *
 * `lib/ids.ts`'s `formatOrderNumber`/`isValidOrderNumber` already own the
 * string-format half of that sentence (pure, DB-free, unit-tested). This
 * file owns the other half: producing the next sequence number for a
 * given month, safely under concurrent order placements.
 *
 * WHY THE `Setting` TABLE, NOT A REAL POSTGRES SEQUENCE: the doc's literal
 * wording ("a DB sequence") suggests `CREATE SEQUENCE`, but a real
 * sequence object needs a schema migration, and this sandbox has no live
 * Postgres to run one against (the same constraint already flagged for
 * the deferred `RecoveryCode` model). `Setting` (`prisma/schema/ops.prisma`)
 * already exists with exactly the shape a counter needs — `key` (unique)
 * and `value` (JSONB) — so this uses one `Setting` row per month
 * (`key: "order_number_seq:2607"`) as the counter, guarded by a
 * transaction-scoped Postgres advisory lock (`pg_advisory_xact_lock`) so
 * two concurrent order placements in the same month can never read the
 * same "current" value and both increment to the same next number — the
 * exact class of race `stock-reservation.ts`'s atomic guard exists to
 * prevent, applied here to a counter instead of a stock level. The lock
 * auto-releases at transaction end; no separate unlock call is needed.
 */
import "server-only";
import { db } from "@/server/db";
import { formatOrderNumber } from "@/lib/ids";

interface OrderNumberCounterValue {
  lastSequence: number;
}

function counterKeyFor(yearMonthKey: string): string {
  return `order_number_seq:${yearMonthKey}`;
}

/** `YYMM` — matches `formatOrderNumber`'s own zero-padded 2-digit year/month, so the counter key and the visible order number always agree on which "month" a given `Date` belongs to. */
function yearMonthKey(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

/**
 * Atomically returns the next sequence number for the calendar month
 * `placedAt` falls in (Kathmandu-local — callers should pass an
 * already-Kathmandu-adjusted date, matching `formatOrderNumber`'s own
 * documented expectation). Never returns the same number twice for the
 * same month, even under concurrent callers.
 */
export async function getNextOrderSequence(placedAt: Date): Promise<number> {
  const key = counterKeyFor(yearMonthKey(placedAt));

  return db.$transaction(async (tx) => {
    // Transaction-scoped advisory lock, keyed by this month's counter —
    // serializes concurrent order placements in the *same* month only;
    // different months never contend with each other. `hashtext` maps the
    // text key to a 32-bit int, widened to bigint for the lock call.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;

    const existing = await tx.setting.findUnique({ where: { key } });
    const current =
      existing && typeof existing.value === "object" && existing.value !== null
        ? ((existing.value as unknown as OrderNumberCounterValue).lastSequence ?? 0)
        : 0;
    const next = current + 1;

    await tx.setting.upsert({
      where: { key },
      create: {
        key,
        value: { lastSequence: next } satisfies OrderNumberCounterValue,
        group: "orders",
        label: `Order number counter (${key.split(":")[1]})`,
        helpText: "Internal counter — do not edit. Powers the CC-YYMM-NNNN order number sequence.",
        dataType: "JSON",
        isPublic: false,
      },
      update: { value: { lastSequence: next } satisfies OrderNumberCounterValue },
    });

    return next;
  });
}

/** Convenience wrapper combining `getNextOrderSequence` with `formatOrderNumber` — the one function order placement actually calls. */
export async function generateOrderNumber(placedAt: Date): Promise<string> {
  const sequence = await getNextOrderSequence(placedAt);
  return formatOrderNumber(placedAt.getFullYear(), placedAt.getMonth() + 1, sequence);
}
