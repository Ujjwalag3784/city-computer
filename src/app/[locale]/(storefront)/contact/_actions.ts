"use server";

import { validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import { contactFormSchema } from "@/lib/validation/content";
import { submitContactForm } from "@/server/services/content/contact";
import { runStorefrontAction, type ActionResult } from "../_lib/action-result";

/** `/contact` — docs/02's route table: "RSC + Server Action." Rate limited per IP, same shape as every other public form this phase adds. */
export async function submitContactFormAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runStorefrontAction(async () => {
    const parsed = contactFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    // Honeypot: a filled `companyWebsite` field silently no-ops as if the
    // submission succeeded, rather than surfacing an error that would tip
    // a bot off — it never reaches `submitContactForm`.
    if (parsed.data.companyWebsite) return { id: "" };

    const ip = await getRequestIpFromHeaders();
    await rateLimit("contactForm", `ip:${ip}`);

    return submitContactForm(parsed.data);
  });
}
