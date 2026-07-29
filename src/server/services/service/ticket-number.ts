/**
 * Service ticket number generation — same Setting-row + Postgres advisory
 * lock technique as `commerce/order-number.ts` (see that file's own doc
 * comment for why a `Setting` row stands in for a real `CREATE SEQUENCE`
 * in this sandbox), applied to `ServiceTicket.ticketNumber`
 * (`SVC-YYMM-NNNN`, docs/06-DATA-MODEL.md §9). Kept as its own small
 * duplicate rather than a shared generic counter — same "small
 * duplication beats a forced abstraction" call `order-number.ts` already
 * makes for `receipt-upload.ts`.
 */
import "server-only";
import { db } from "@/server/db";
import { formatTicketNumber } from "@/lib/ids";

interface TicketNumberCounterValue {
  lastSequence: number;
}

function counterKeyFor(yearMonthKey: string): string {
  return `ticket_number_seq:${yearMonthKey}`;
}

function yearMonthKey(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export async function getNextTicketSequence(receivedAt: Date): Promise<number> {
  const key = counterKeyFor(yearMonthKey(receivedAt));

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;

    const existing = await tx.setting.findUnique({ where: { key } });
    const current =
      existing && typeof existing.value === "object" && existing.value !== null
        ? ((existing.value as unknown as TicketNumberCounterValue).lastSequence ?? 0)
        : 0;
    const next = current + 1;

    await tx.setting.upsert({
      where: { key },
      create: {
        key,
        value: { lastSequence: next } satisfies TicketNumberCounterValue,
        group: "service",
        label: `Repair job number counter (${key.split(":")[1]})`,
        helpText:
          "Internal counter — do not edit. Powers the SVC-YYMM-NNNN ticket number sequence.",
        dataType: "JSON",
        isPublic: false,
      },
      update: { value: { lastSequence: next } satisfies TicketNumberCounterValue },
    });

    return next;
  });
}

export async function generateTicketNumber(receivedAt: Date): Promise<string> {
  const sequence = await getNextTicketSequence(receivedAt);
  return formatTicketNumber(receivedAt.getFullYear(), receivedAt.getMonth() + 1, sequence);
}
