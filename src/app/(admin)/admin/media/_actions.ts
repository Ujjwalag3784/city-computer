"use server";

/**
 * Server Actions for the Photo Library (`/admin/media`) and the product
 * wizard's Photos step, which imports these directly rather than
 * duplicating them — one presigned-upload round trip, one place.
 */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { completeUploadSchema, requestUploadSchema } from "@/lib/validation/admin/media";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  completeUpload,
  requestUpload,
  updateMediaAltText,
  type CompletedUpload,
  type RequestedUpload,
} from "@/server/services/admin/media";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const MEDIA_PATH = "/admin/media";

export async function requestUploadAction(input: unknown): Promise<ActionResult<RequestedUpload>> {
  return runAdminAction(async () => {
    await requireAdminPermission("media:write");
    const parsed = requestUploadSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    return requestUpload(parsed.data);
  });
}

export async function completeUploadAction(
  input: unknown,
  altTextHint?: string,
): Promise<ActionResult<CompletedUpload>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("media:write");
    const parsed = completeUploadSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await completeUpload(parsed.data, actor, altTextHint);
    revalidatePath(MEDIA_PATH);
    return result;
  });
}

export async function updateMediaAltTextAction(
  id: string,
  altText: string,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("media:write");
    await updateMediaAltText(id, altText, actor);
    revalidatePath(MEDIA_PATH);
  });
}
