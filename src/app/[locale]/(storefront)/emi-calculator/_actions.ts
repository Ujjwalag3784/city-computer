"use server";

/**
 * `/emi-calculator` lead-capture Server Action — docs/10-PAYMENTS-NEPAL.md
 * §10 item 3: "card issuer + preferred tenure + phone → routed to sales,"
 * not a checkout step. Rate limited per IP, same shape as every other
 * public form this phase adds.
 */
import { validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { emiLeadFormSchema } from "@/lib/validation/emi";
import { submitEmiLead, type EmiLeadResult } from "@/server/services/content/emi";
import { runStorefrontAction, type ActionResult } from "../_lib/action-result";

export async function submitEmiLeadAction(input: unknown): Promise<ActionResult<EmiLeadResult>> {
  return runStorefrontAction(async () => {
    const parsed = emiLeadFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    // Honeypot: a filled `companyWebsite` field silently no-ops as if the
    // submission succeeded, rather than surfacing an error that would tip
    // a bot off — it never reaches `submitEmiLead`. Same convention as
    // `contact/_actions.ts`'s `submitContactFormAction`.
    if (parsed.data.companyWebsite) return { id: "" };

    const ip = await getRequestIpFromHeaders();
    await rateLimit("emiLead", `ip:${ip}`);

    return submitEmiLead(parsed.data);
  });
}
