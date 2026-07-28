/**
 * The storefront counterpart of `app/(admin)/_lib/action-result.ts` — same
 * "Server Actions must return plain serialisable data, never a thrown
 * `AppError`" rule, kept as its own copy rather than a shared import
 * because the admin version deliberately lives under the admin route
 * group (`app/(admin)/_lib/`) and Next.js route-group-private `_lib`
 * folders aren't meant to be reached across route groups.
 */
import "server-only";
import { toSafeAppError } from "@/lib/errors";

export interface ActionFieldIssue {
  field: string;
  message: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  message?: string;
  issues?: ActionFieldIssue[];
}

export async function runStorefrontAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    const appError = toSafeAppError(error);
    return {
      ok: false,
      message: appError.detail ?? appError.message,
      issues: appError.issues?.map((issue) => ({ field: issue.field, message: issue.message })),
    };
  }
}
