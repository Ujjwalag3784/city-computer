/**
 * EMI calculator (docs/17 Phase 10). Two distinct schemas here:
 *
 * `emiScheduleSchema` validates the *admin-edited* `Setting.value` JSON for
 * `payments.emiRates` before the public `/emi-calculator` route ever
 * touches it — `admin/settings.ts`'s JSON editor is a raw textarea (see
 * that file's own `setting-row.tsx`), so a typo there must never crash a
 * public page; `server/services/content/emi.ts` treats a failed parse as
 * "no schedules available" rather than throwing.
 *
 * `emiLeadFormSchema` is the public lead-capture form — docs/10 §10 item 3:
 * "card issuer + preferred tenure + phone → routed to sales," not a
 * checkout step.
 */
import { z } from "zod";

export const emiTenureOptionSchema = z.object({
  months: z.number().int().positive(),
  interestRatePercent: z.number().min(0),
  processingFeePercent: z.number().min(0),
});

export const emiBankScheduleSchema = z.object({
  bank: z.string().trim().min(1),
  tenures: z.array(emiTenureOptionSchema).min(1),
});

export const emiScheduleSchema = z.array(emiBankScheduleSchema);
export type EmiScheduleInput = z.infer<typeof emiScheduleSchema>;

export const emiLeadFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(7, "Enter a phone number."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  bank: z.string().trim().min(1, "Choose a bank."),
  tenureMonths: z.number().int().positive(),
  amountPaisa: z.number().int().positive(),
  // Honeypot, same convention as `contactFormSchema`.
  companyWebsite: z.string().max(0).optional().or(z.literal("")),
});
export type EmiLeadFormInput = z.infer<typeof emiLeadFormSchema>;
