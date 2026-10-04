// No `import "server-only"` here (deliberately — see
// `../db/create-client.ts`'s header comment): this file is only ever
// imported by `create-client.ts`, which is itself shared by both the
// guarded app singleton (`@/server/db`) and the unguarded seed-script
// client (`@/server/db/seed-client`, used by `tsx`-run `pnpm db:seed`).
// Guarding this file too would make it impossible for the seed client to
// use it at all, since `server-only` throws outside Next.js's bundler
// regardless of which file in the chain carries the import.
import { Prisma } from "@/generated/prisma/client";

/**
 * Soft-delete read filter — docs/06-DATA-MODEL.md §1:
 *
 *   "Soft delete deletedAt DateTime? on Product, Variant, Category, Brand,
 *    Post, Page, Customer, ComponentPart ... All queries filter
 *    deletedAt: null via a Prisma extension."
 *
 * WHAT THIS DOES
 * For exactly the eight models above, every `findMany`, `findFirst`,
 * `findUnique`/`findUniqueOrThrow`, and `count` call is rewritten to
 * exclude soft-deleted rows (`deletedAt: null`) unless the caller opts out.
 *
 * WHY THESE FOUR OPERATIONS
 * They are the read paths that return rows to callers. `create`, `update`,
 * `delete`, `upsert`, and aggregate/groupBy are left untouched:
 *  - `delete` on these models should not be used at all in application
 *    code (the whole point of soft delete) — that is an ESLint/code-review
 *    concern, not something this extension can fix.
 *  - `update`/`upsert` need to be able to *reach* a soft-deleted row (e.g.
 *    to restore it by setting `deletedAt: null`), so filtering their
 *    `where` would make restoring a product impossible.
 *
 * OPTING OUT (admin "show hidden products" style screens)
 * Pass a non-standard `withDeleted: true` flag inside the `where` object.
 * This is deliberately NOT part of the generated Prisma Client types —
 * TypeScript will flag it, so it must be added with an explicit cast,
 * which keeps opting out visible in code review:
 *
 *   db.product.findMany({
 *     where: { ...filters, withDeleted: true } as Prisma.ProductWhereInput,
 *   })
 *
 * The extension strips `withDeleted` back off before the query reaches the
 * database (Postgres has no such column), so it never leaks into SQL.
 *
 * findUnique CAVEAT
 * Prisma's `findUnique`/`findUniqueOrThrow` only accept the model's unique
 * identifier fields in `where` — the database engine will not accept an
 * extra `deletedAt` filter bolted on. So for those two operations we run
 * the query unmodified and instead post-filter the *result*: if the row
 * came back soft-deleted and the caller did not ask for `withDeleted`, we
 * return `null` (or throw NotFound for the *OrThrow variant) exactly as if
 * the row did not exist. Callers cannot tell the difference between "no
 * such row" and "soft-deleted row" without opting in, which is the point.
 *
 * FIXED 2026-10-04: the post-filter read `row.deletedAt` straight off the
 * result. A caller passing a `select` without `deletedAt` (e.g.
 * `getCategoryDescendantIds`'s `select: { id, path }`) gets a row with no
 * such key, `undefined === null` is false, and every live row came back as
 * `null`. That made every storefront category page render "not found",
 * and broke any other `findUnique` with a narrow `select`. The extension
 * now adds `deletedAt` to a `select` (or removes it from an `omit`) for the
 * check, then strips it again so callers get exactly the shape they asked
 * for. See `ensureDeletedAtSelected`.
 */

const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>([
  "Product",
  "Variant",
  "Category",
  "Brand",
  "Post",
  "Page",
  "Customer",
  "ComponentPart",
]);

function isSoftDeleteModel(model: string): model is Prisma.ModelName {
  return SOFT_DELETE_MODELS.has(model as Prisma.ModelName);
}

/** Removes the non-standard `withDeleted` escape-hatch flag and reports whether it was set. */
function extractWithDeleted(where: Record<string, unknown> | undefined): {
  where: Record<string, unknown> | undefined;
  withDeleted: boolean;
} {
  if (!where || typeof where !== "object") {
    return { where, withDeleted: false };
  }
  const { withDeleted, ...rest } = where as Record<string, unknown> & { withDeleted?: boolean };
  return { where: rest, withDeleted: withDeleted === true };
}

type UniqueArgs = {
  where?: unknown;
  select?: Record<string, unknown> | null;
  omit?: Record<string, unknown> | null;
};

/**
 * Makes sure `deletedAt` is in the result so the post-filter can read it.
 * Returns the args to run and whether the caller's own result shape lacked
 * the field (in which case it must be stripped before returning).
 */
export function ensureDeletedAtSelected<T extends UniqueArgs>(
  args: T,
): { args: T; strip: boolean } {
  if (args.select && args.select.deletedAt !== true) {
    return { args: { ...args, select: { ...args.select, deletedAt: true } }, strip: true };
  }
  if (args.omit && args.omit.deletedAt === true) {
    const { deletedAt: _omitted, ...omit } = args.omit;
    return { args: { ...args, omit }, strip: true };
  }
  return { args, strip: false };
}

/** True when a row the caller is allowed to see (not soft-deleted). */
function isLive(row: unknown): boolean {
  return (row as { deletedAt?: Date | null }).deletedAt == null;
}

function stripDeletedAt<R>(row: R, strip: boolean): R {
  if (!strip || !row || typeof row !== "object") return row;
  const { deletedAt: _deletedAt, ...rest } = row as Record<string, unknown>;
  return rest as R;
}

/**
 * The extension itself. Applied once, in `src/server/db.ts`, to the single
 * shared PrismaClient instance.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete-read-filter",
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { where, withDeleted } = extractWithDeleted(
          args.where as Record<string, unknown> | undefined,
        );
        return query({
          ...args,
          where: withDeleted ? where : { ...where, deletedAt: null },
        });
      },

      async findFirst({ model, args, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { where, withDeleted } = extractWithDeleted(
          args.where as Record<string, unknown> | undefined,
        );
        return query({
          ...args,
          where: withDeleted ? where : { ...where, deletedAt: null },
        });
      },

      async count({ model, args, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { where, withDeleted } = extractWithDeleted(
          args.where as Record<string, unknown> | undefined,
        );
        return query({
          ...args,
          where: withDeleted ? where : { ...where, deletedAt: null },
        });
      },

      // See the findUnique CAVEAT in the module doc comment above — this
      // operation cannot accept an extra `where` field, so it post-filters
      // the result instead of rewriting the query.
      async findUnique({ model, args, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { where, withDeleted } = extractWithDeleted(
          args.where as Record<string, unknown> | undefined,
        );
        // The escape-hatch flag is not a column; never let it reach SQL.
        if (withDeleted) return query({ ...args, where } as typeof args);
        const prepared = ensureDeletedAtSelected(args as UniqueArgs);
        const result = await query(prepared.args as typeof args);
        if (!result) return result;
        return isLive(result) ? stripDeletedAt(result, prepared.strip) : null;
      },

      async findUniqueOrThrow({ model, args, query }) {
        if (!isSoftDeleteModel(model)) return query(args);
        const { where, withDeleted } = extractWithDeleted(
          args.where as Record<string, unknown> | undefined,
        );
        // The escape-hatch flag is not a column; never let it reach SQL.
        if (withDeleted) return query({ ...args, where } as typeof args);
        const prepared = ensureDeletedAtSelected(args as UniqueArgs);
        const result = await query(prepared.args as typeof args);
        if (isLive(result)) return stripDeletedAt(result, prepared.strip);
        throw new Prisma.PrismaClientKnownRequestError(
          `No ${model} found matching the given criteria (soft-deleted).`,
          { code: "P2025", clientVersion: Prisma.prismaVersion.client },
        );
      },
    },
  },
});
