/**
 * Public EMI calculator data (docs/17 Phase 10, docs/10-PAYMENTS-NEPAL.md
 * §10). Reads the two `payments.emiEnabled` / `payments.emiRates` `Setting`
 * rows Phase 9 seeded — both were `isPublic: false` at the time (nothing
 * public read them yet); this phase's seed change flips both to
 * `isPublic: true` and reshapes `emiRates` into a per-bank tenure list
 * (see `prisma/seed/core.ts`'s own comment on that change) so the owner
 * can edit real bank terms "without a deploy," per docs/10 §10's own
 * requirement.
 *
 * This file is the one place that reads those two keys directly by
 * `key` (not through `admin/settings.ts`, which is admin-only and returns
 * every group's settings, not a public-safe filtered read) — scoped with
 * `isPublic: true` in the `WHERE` clause itself so a future unrelated
 * `Setting` row can never leak here by accident.
 */
import "server-only";
import { db } from "@/server/db";
import { EnquiryType } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import {
  emiScheduleSchema,
  type EmiLeadFormInput,
  type EmiScheduleInput,
} from "@/lib/validation/emi";
import { formatNPR } from "@/lib/money";

export interface PublicEmiData {
  enabled: boolean;
  schedules: EmiScheduleInput;
}

/**
 * Never throws on malformed admin-edited JSON — a typo in the settings
 * textarea should degrade to "EMI calculator shows no banks yet," never a
 * 500 on a public, SEO-indexed page.
 */
export async function getPublicEmiData(): Promise<PublicEmiData> {
  const [enabledSetting, ratesSetting] = await Promise.all([
    db.setting.findFirst({ where: { key: "payments.emiEnabled", isPublic: true } }),
    db.setting.findFirst({ where: { key: "payments.emiRates", isPublic: true } }),
  ]);

  const enabled = enabledSetting?.value === true;
  if (!enabled || !ratesSetting) {
    return { enabled: false, schedules: [] };
  }

  const parsed = emiScheduleSchema.safeParse(ratesSetting.value);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues },
      "getPublicEmiData: payments.emiRates failed schema validation — showing no banks rather than crashing",
    );
    return { enabled: false, schedules: [] };
  }

  return { enabled: true, schedules: parsed.data };
}

export interface EmiLeadResult {
  id: string;
}

/**
 * Lead capture, not checkout — docs/10 §10 item 3. Feeds the same
 * `Enquiry` inbox `submitContactForm` (content/contact.ts) already writes
 * to; there is no dedicated `EnquiryType` for this (adding one would mean
 * a schema migration, which this phase's own research pass found nothing
 * else in scope needs), so the bank/tenure/amount details are folded into
 * `subject`/`message` on a `GENERAL` enquiry instead.
 */
export async function submitEmiLead(input: EmiLeadFormInput): Promise<EmiLeadResult> {
  const enquiry = await db.enquiry.create({
    data: {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone.trim(),
      subject: `EMI enquiry — ${input.bank.trim()}, ${input.tenureMonths} months`,
      message: `Interested in an EMI plan with ${input.bank.trim()} over ${input.tenureMonths} months for an item priced at ${formatNPR(input.amountPaisa)}.`,
      type: EnquiryType.GENERAL,
    },
  });
  return { id: enquiry.id };
}
