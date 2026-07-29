"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { postFormSchema, authorFormSchema } from "@/lib/validation/admin/blog";
import { createPost, updatePost, deletePost, createAuthor } from "@/server/services/admin/blog";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const BLOG_LIST_PATH = "/admin/blog";

export async function createPostAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = postFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("post:write");
    const created = await createPost(parsed.data, actor);

    revalidatePath(BLOG_LIST_PATH);
    revalidatePath("/blog");
    return created;
  });
}

export async function updatePostAction(
  postId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = postFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("post:write");
    await updatePost(postId, parsed.data, actor);

    revalidatePath(BLOG_LIST_PATH);
    revalidatePath(`${BLOG_LIST_PATH}/${postId}`);
    revalidatePath("/blog");
  });
}

export async function deletePostAction(postId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("post:write");
    await deletePost(postId, actor);
    revalidatePath(BLOG_LIST_PATH);
    revalidatePath("/blog");
  });
}

export async function createAuthorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = authorFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("post:write");
    const created = await createAuthor(parsed.data, actor);

    revalidatePath(`${BLOG_LIST_PATH}/new`);
    return created;
  });
}
