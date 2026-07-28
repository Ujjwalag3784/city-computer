/**
 * The stock write primitive — docs/09-ADMIN-DAD-MODE.md §6: "Every stock
 * number in the system has inline `−1`/`+1`/`Set…` controls... **Every
 * change writes a `StockMovement`.** There is no way to change stock
 * without a recorded reason."
 *
 * SCOPE: this file is deliberately small right now. It exists early
 * (ahead of the full Phase 5e "Stock management" pass — the `+/−`
 * buttons, the "Set…" reason dialog, bulk update, spreadsheet upload,
 * low-stock thresholds, the stock history timeline) because the product
 * list's inline quick-edit (docs/09 §5.2, this session's scope) needs a
 * *real* write path today, not a placeholder — "every change writes a
 * StockMovement" has to be true from the very first caller, not added
 * retroactively once the dedicated stock screens exist. `adjustVariantStock`
 * below is that one real primitive; Phase 5e will add more callers and UI
 * around it, not replace it.
 *
 * MULTI-BRANCH SCOPE NOTE: `StockLevel` is keyed on `(variantId,
 * branchId)` — a product can have different quantities at different
 * branches. The product list's inline quick-edit (and this file's
 * `getPrimaryStockLevel`) only reads/writes the *default fulfilment*
 * branch (`Branch.isDefaultFulfilment`, falling back to the first active
 * branch). Editing every branch's stock from one table row is a real,
 * separate UI problem (a branch selector or a column per branch) —
 * flagged rather than silently only-ever-showing-one-branch without
 * saying so.
 */
import "server-only";
import { db } from "@/server/db";
import { StockMovementReason } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "./audit-log";

export interface PrimaryStockLevel {
  branchId: string;
  branchName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

let cachedDefaultBranchId: string | null | undefined;

/** The branch every quick-edit and every admin list column that only has room for one number operates against — see the module doc comment's multi-branch scope note. Cached for the life of the process: which branch is the default fulfilment branch changes rarely enough that re-querying it on every single row of every product list page would be wasteful. Exported so `admin/product.ts`'s stock-based list filters ("Out of stock", "Almost out of stock") resolve the exact same branch this file's own reads/writes use. */
export async function getDefaultBranchId(): Promise<string | null> {
  if (cachedDefaultBranchId !== undefined) return cachedDefaultBranchId;
  const branch = await db.branch.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefaultFulfilment: "desc" }, { position: "asc" }],
    select: { id: true },
  });
  cachedDefaultBranchId = branch?.id ?? null;
  return cachedDefaultBranchId;
}

/** Bulk variant of `getDefaultBranchId`'s lookup — for a product list page, one branch resolution shared by every row rather than one query per row. */
export async function getPrimaryStockLevelsByVariantId(
  variantIds: string[],
): Promise<Map<string, PrimaryStockLevel>> {
  if (variantIds.length === 0) return new Map();
  const branchId = await getDefaultBranchId();
  if (!branchId) return new Map();

  const levels = await db.stockLevel.findMany({
    where: { variantId: { in: variantIds }, branchId },
    include: { branch: { select: { name: true } } },
  });

  return new Map(
    levels.map((level) => [
      level.variantId,
      {
        branchId: level.branchId,
        branchName: level.branch.name,
        quantity: level.quantity,
        reservedQuantity: level.reservedQuantity,
        availableQuantity: Math.max(0, level.quantity - level.reservedQuantity),
      },
    ]),
  );
}

export async function getPrimaryStockLevel(variantId: string): Promise<PrimaryStockLevel | null> {
  const map = await getPrimaryStockLevelsByVariantId([variantId]);
  return map.get(variantId) ?? null;
}

/**
 * Sets `StockLevel.quantity` to `newQuantity` on the default branch,
 * creating the `StockLevel` row if this is the first stock ever recorded
 * for the variant there, and always writing a matching signed
 * `StockMovement` — the append-only ledger `StockLevel.quantity` must
 * always reconcile against (`inventory.prisma`'s own comment on
 * `StockMovement`). Runs both writes in one transaction so the level and
 * its ledger entry can never disagree even if the process crashes
 * mid-write.
 */
export async function adjustVariantStock(
  variantId: string,
  newQuantity: number,
  reason: StockMovementReason,
  actor: AuditActor,
  note?: string,
): Promise<PrimaryStockLevel> {
  const branchId = await getDefaultBranchId();
  if (!branchId) {
    throw new NotFoundError("An active branch to hold stock");
  }

  const variant = await db.variant.findUnique({ where: { id: variantId }, select: { id: true } });
  if (!variant) throw new NotFoundError("Product option");

  const existing = await db.stockLevel.findUnique({
    where: { variantId_branchId: { variantId, branchId } },
  });
  const previousQuantity = existing?.quantity ?? 0;
  const delta = newQuantity - previousQuantity;

  // Two explicit, statically-typed array literals (matching the
  // array-of-promises `$transaction` style already used elsewhere in this
  // codebase — `auth/verify-email.ts`, `auth/password-reset.ts`,
  // `admin/category.ts` — rather than the interactive callback form)
  // instead of one array conditionally `.push()`-ed into: a `delta === 0`
  // no-op edit still upserts the level (so a first-ever "0 in stock"
  // record for a variant is created) but genuinely writes no
  // `StockMovement` — a zero-delta ledger entry would be a movement that
  // moved nothing, which the append-only ledger shouldn't contain.
  const result =
    delta === 0
      ? await db.stockLevel.upsert({
          where: { variantId_branchId: { variantId, branchId } },
          create: { variantId, branchId, quantity: newQuantity },
          update: { quantity: newQuantity },
          include: { branch: { select: { name: true } } },
        })
      : (
          await db.$transaction([
            db.stockLevel.upsert({
              where: { variantId_branchId: { variantId, branchId } },
              create: { variantId, branchId, quantity: newQuantity },
              update: { quantity: newQuantity },
              include: { branch: { select: { name: true } } },
            }),
            db.stockMovement.create({
              data: { variantId, branchId, delta, reason, note: note ?? null, actorId: actor.id },
            }),
          ])
        )[0];

  if (delta !== 0) {
    await recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "stock.adjusted",
      entityType: "Variant",
      entityId: variantId,
      before: { quantity: previousQuantity },
      after: { quantity: newQuantity, delta, reason },
    });
  }

  return {
    branchId: result.branchId,
    branchName: result.branch.name,
    quantity: result.quantity,
    reservedQuantity: result.reservedQuantity,
    availableQuantity: Math.max(0, result.quantity - result.reservedQuantity),
  };
}
