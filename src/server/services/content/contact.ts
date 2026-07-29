/**
 * Public contact form (docs/17 Phase 10). Feeds straight into the real
 * `Enquiry` model Phase 9's `/admin/enquiries` inbox already reads from —
 * that inbox previously had no public submission path at all (verified by
 * grepping for `enquiry.create` during this phase's own research pass:
 * only generated-client boilerplate comments matched). This is that path.
 */
import "server-only";
import { db } from "@/server/db";
import { EnquiryType } from "@/generated/prisma/client";
import type { ContactFormInput } from "@/lib/validation/content";

export async function submitContactForm(input: ContactFormInput): Promise<{ id: string }> {
  const enquiry = await db.enquiry.create({
    data: {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      subject: input.subject?.trim() || null,
      message: input.message.trim(),
      type: EnquiryType.GENERAL,
    },
  });
  return { id: enquiry.id };
}
