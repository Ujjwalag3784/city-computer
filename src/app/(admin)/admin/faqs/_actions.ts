"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { faqFormSchema, moveFaqSchema } from "@/lib/validation/admin/faqs";
import { createFaq, updateFaq, deleteFaq, moveFaq } from "@/server/services/admin/faqs";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const FAQS_PATH = "/admin/faqs";

export async function createFaqAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = faqFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("faq:write");
    const created = await createFaq(parsed.data, actor);

    revalidatePath(FAQS_PATH);
    revalidatePath("/faq");
    return created;
  });
}

export async function updateFaqAction(faqId: string, input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = faqFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("faq:write");
    await updateFaq(faqId, parsed.data, actor);

    revalidatePath(FAQS_PATH);
    revalidatePath("/faq");
  });
}

export async function deleteFaqAction(faqId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("faq:write");
    await deleteFaq(faqId, actor);
    revalidatePath(FAQS_PATH);
    revalidatePath("/faq");
  });
}

export async function moveFaqAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = moveFaqSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("faq:write");
    await moveFaq(parsed.data.faqId, parsed.data.direction, actor);

    revalidatePath(FAQS_PATH);
    revalidatePath("/faq");
  });
}
