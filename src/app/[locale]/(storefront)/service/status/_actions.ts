"use server";

/**
 * `/service/status` Server Action — the public repair-status lookup gate.
 * Same shape as `order/[orderNumber]/_actions.ts`'s `verifyOrderAccessAction`:
 * rate limited per IP (`ticketStatusLookup` preset — 10/hour, mirrors
 * `orderLookup`), and `getPublicTicketStatus` itself enforces the
 * ticket-number-plus-phone-digits gate with enumeration-resistant errors.
 */
import { validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { ticketStatusLookupSchema } from "@/lib/validation/service";
import {
  getPublicTicketStatus,
  type PublicTicketStatus,
} from "@/server/services/service/public-tickets";
import { runStorefrontAction, type ActionResult } from "../../_lib/action-result";

export async function lookupTicketStatusAction(
  input: unknown,
): Promise<ActionResult<PublicTicketStatus>> {
  return runStorefrontAction(async () => {
    const parsed = ticketStatusLookupSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const ip = await getRequestIpFromHeaders();
    await rateLimit("ticketStatusLookup", `ip:${ip}`);

    return getPublicTicketStatus(parsed.data.ticketNumber, parsed.data.phoneLastFour);
  });
}
