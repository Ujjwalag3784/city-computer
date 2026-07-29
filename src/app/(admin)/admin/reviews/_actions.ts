"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { setReviewStatusSchema, replyToReviewSchema } from "@/lib/validation/admin/reviews";
import { setReviewStatus, replyToReview } from "@/server/services/admin/reviews";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const REVIEWS_LIST_PATH = "/admin/reviews";

export async function setReviewStatusAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setReviewStatusSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("review:moderate");
    await setReviewStatus(parsed.data.reviewId, parsed.data.status, actor);

    revalidatePath(REVIEWS_LIST_PATH);
  });
}

export async function replyToReviewAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = replyToReviewSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("review:moderate");
    await replyToReview(parsed.data.reviewId, parsed.data.reply, actor);

    revalidatePath(REVIEWS_LIST_PATH);
  });
}
