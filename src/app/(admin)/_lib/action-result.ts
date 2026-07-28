/**
 * The one return shape every admin Server Action in this route group
 * uses. Server Actions must return plain serialisable data across the
 * RSC boundary — a thrown `AppError` instance doesn't survive that trip
 * cleanly, so every action catches its own service-layer errors here and
 * hands the client a plain object instead, matching `lib/errors.ts`'s
 * "never leak a stack trace... to the client" rule one boundary further
 * out than the RFC 9457 Route Handler mapping already does for
 * `/api/v1/*`.
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

export async function runAdminAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
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
