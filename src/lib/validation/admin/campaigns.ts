/**
 * `/admin/campaigns` — docs/09-ADMIN-DAD-MODE.md §3 calls this screen
 * "Offers & banners", backed by the `Promotion` model (docs/06 §6:
 * "automatic discounts requiring no code... powers 'Save up to 40% on
 * Headphones' banners that currently link nowhere"). Scope note lives on
 * `admin/campaigns.ts`'s own doc comment — this schema only covers the
 * `Promotion` row itself (name/type/priority/dates/active), not its
 * `PromotionRule` targeting, which stays schema-only this pass.
 */
import { z } from "zod";
import { PromotionType } from "@/generated/prisma/client";

export const adminCampaignListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminCampaignListQuery = z.infer<typeof adminCampaignListQuerySchema>;

export const campaignFormSchema = z.object({
  name: z.string().trim().min(3, "Give this campaign a name.").max(120),
  type: z.nativeEnum(PromotionType),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  stackable: z.boolean().default(false),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export const setCampaignActiveSchema = z.object({
  campaignId: z.string().min(1),
  isActive: z.boolean(),
});
