/**
 * The one-line guard every admin Server Action opens with:
 *
 *   const actor = await requireAdminPermission("category:write");
 *
 * Composes `auth()` (this request's session) with `permissions.ts`'s pure
 * `requirePermission` check, then narrows the result down to the small
 * `{ id, email }` shape `server/services/admin/audit-log.ts`'s
 * `recordAuditLog` actually needs — docs/07-API-DESIGN.md §4.4: "Every
 * protected handler calls `requirePermission(...)`. Permission checks
 * happen in the **service layer**... so a Server Action and a Route
 * Handler cannot diverge." This file is that call site for every Server
 * Action; the service functions it feeds into (`createCategory`,
 * `updateBrand`, etc.) don't re-check permissions themselves — the
 * action layer is the one place docs/07 §4.4 asks for that check, same as
 * a Route Handler would be for `/api/v1/admin/*`.
 */
import "server-only";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import type { AuditActor } from "@/server/services/admin/audit-log";

export async function requireAdminPermission(permissionKey: string): Promise<AuditActor> {
  const session = await auth();
  const user = requirePermission(session?.user ?? null, permissionKey);
  return { id: user.id, email: user.email ?? null };
}
