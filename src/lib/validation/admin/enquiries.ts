/**
 * `/admin/enquiries` ("Messages") — docs/09-ADMIN-DAD-MODE.md §3 (OWNER,
 * MANAGER, SUPPORT) over the existing `Enquiry` model. `Enquiry` has no
 * reply-text field (see `admin/enquiries.ts`'s own doc comment) — "reply"
 * here means contacting the customer by phone/email/WhatsApp outside the
 * system and then marking the message's status, not a stored transcript.
 */
import { z } from "zod";
import { EnquiryStatus } from "@/generated/prisma/client";

export const ADMIN_ENQUIRY_FILTERS = ["unread", "read", "replied", "closed", "all"] as const;
export type AdminEnquiryFilter = (typeof ADMIN_ENQUIRY_FILTERS)[number];

export const adminEnquiryListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(ADMIN_ENQUIRY_FILTERS).default("unread"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminEnquiryListQuery = z.infer<typeof adminEnquiryListQuerySchema>;

export const setEnquiryStatusSchema = z.object({
  enquiryId: z.string().min(1),
  status: z.nativeEnum(EnquiryStatus),
});
