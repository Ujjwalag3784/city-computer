/**
 * Public content forms — contact, newsletter, and (this session's own
 * naming for the "greenfield" surfaces `PROGRESS.md`'s Phase 10 research
 * pass flagged as having zero existing validation) — kept in `lib/
 * validation/` at the top level, not under `admin/`, since these are all
 * customer-facing, unauthenticated submissions (docs/06 §3's own
 * `lib/validation/` split: admin-only schemas nest under `admin/`,
 * everything else sits flat).
 */
import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Tell us a bit more — at least a sentence or two."),
  // Honeypot — a real visitor never fills this in; a bot filling every
  // field usually does. Silently accepted-but-dropped, never surfaced as a
  // validation error (that would tip a bot off that it's being filtered).
  companyWebsite: z.string().max(0).optional().or(z.literal("")),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
