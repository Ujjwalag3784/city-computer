"use server";

import { validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { bookServiceTicketSchema } from "@/lib/validation/service";
import {
  createPublicServiceTicket,
  type BookServiceTicketResult,
} from "@/server/services/service/public-tickets";
import { runStorefrontAction, type ActionResult } from "../../_lib/action-result";

/** `/service/book` — docs/02's route table + journey 4.5. Rate limited per IP, same shape as every other public form this phase adds. */
export async function bookServiceTicketAction(
  input: unknown,
): Promise<ActionResult<BookServiceTicketResult>> {
  return runStorefrontAction(async () => {
    const parsed = bookServiceTicketSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const ip = await getRequestIpFromHeaders();
    await rateLimit("serviceBooking", `ip:${ip}`);

    return createPublicServiceTicket(parsed.data);
  });
}
