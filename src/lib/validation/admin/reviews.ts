/**
 * `/admin/reviews` — docs/09-ADMIN-DAD-MODE.md §3 ("Reviews" — OWNER,
 * MANAGER) and docs/13-SECURITY.md §5's "Review spam" row ("verified-
 * purchase preference, moderation queue, rate limit, honeypot") — this
 * is that moderation queue's admin surface over the existing `Review`
 * model (created by the storefront review form, a Phase-4/6-era
 * surface this repo already has; this is its first admin-side reader).
 */
import { z } from "zod";
import { ReviewStatus } from "@/generated/prisma/client";

export const ADMIN_REVIEW_FILTERS = ["needs-approval", "approved", "rejected", "all"] as const;
export type AdminReviewFilter = (typeof ADMIN_REVIEW_FILTERS)[number];

export const adminReviewListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(ADMIN_REVIEW_FILTERS).default("needs-approval"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

export const setReviewStatusSchema = z.object({
  reviewId: z.string().min(1),
  status: z.nativeEnum(ReviewStatus),
});

export const replyToReviewSchema = z.object({
  reviewId: z.string().min(1),
  reply: z.string().trim().min(1, "Write a reply first.").max(2000),
});
