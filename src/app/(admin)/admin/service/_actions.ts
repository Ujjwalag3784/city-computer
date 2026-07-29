"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  createTicketSchema,
  transitionTicketSchema,
  updateTicketNotesSchema,
} from "@/lib/validation/admin/service-tickets";
import { createTicket, updateTicketInternalNotes } from "@/server/services/admin/service-tickets";
import { applyTicketTransition } from "@/server/services/service/ticket-state-machine";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const SERVICE_LIST_PATH = "/admin/service";

export async function createTicketAction(
  input: unknown,
): Promise<ActionResult<{ id: string; ticketNumber: string }>> {
  return runAdminAction(async () => {
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("service-ticket:write");
    const created = await createTicket(parsed.data, actor);

    revalidatePath(SERVICE_LIST_PATH);
    return created;
  });
}

export async function transitionTicketAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = transitionTicketSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("service-ticket:write");
    await applyTicketTransition(parsed.data.ticketId, parsed.data.to, actor, parsed.data.note);

    revalidatePath(SERVICE_LIST_PATH);
    revalidatePath(`${SERVICE_LIST_PATH}/${parsed.data.ticketId}`);
  });
}

export async function updateTicketNotesAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = updateTicketNotesSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("service-ticket:write");
    await updateTicketInternalNotes(parsed.data.ticketId, parsed.data.internalNotes, actor);

    revalidatePath(`${SERVICE_LIST_PATH}/${parsed.data.ticketId}`);
  });
}
