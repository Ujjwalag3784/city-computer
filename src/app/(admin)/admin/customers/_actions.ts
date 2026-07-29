"use server";

/**
 * Server Actions backing `/admin/customers/[id]` — same
 * permission-check -> validate -> service -> revalidate -> `ActionResult`
 * shape as `admin/orders/_actions.ts`. Both mutations need `customer:update`
 * (docs/09 §12: SUPPORT only holds `customer:view`, so a support agent can
 * read a customer's file but not flip the COD flag or edit the note —
 * matches `prisma/seed/core.ts`'s `ROLE_GRANTS`).
 */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  setCustomerCodBlockedSchema,
  updateCustomerNotesSchema,
} from "@/lib/validation/admin/customers";
import { setCustomerCodBlocked, updateCustomerNotes } from "@/server/services/admin/customers";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

export async function setCustomerCodBlockedAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setCustomerCodBlockedSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("customer:update");
    await setCustomerCodBlocked(
      parsed.data.customerId,
      parsed.data.blocked,
      parsed.data.reason,
      actor,
    );

    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  });
}

export async function updateCustomerNotesAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = updateCustomerNotesSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("customer:update");
    await updateCustomerNotes(parsed.data.customerId, parsed.data.notes, actor);

    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  });
}
