/**
 * `Build` persistence — create/edit/share a PC build and turn it into
 * cart items, the CRUD half of the PC Builder that `validate-build.ts`
 * (the read-only engine) doesn't touch. Mirrors `commerce/cart.ts`'s own
 * "guest cookie proves ownership" pattern for anonymous builds: docs §2's
 * `Build.sessionToken` is this file's equivalent of `Cart.token`.
 *
 * Ownership model: a build belongs to either a `Customer` (signed in) or
 * a `sessionToken` (anonymous, proven by the `city_build_owner` cookie
 * this file mints). Editing (`setBuildItem`, `removeBuildItem`,
 * `shareBuild`) requires proving ownership; viewing
 * (`getBuildByShortId`) and `addBuildToCart` do not — a shared
 * `/build/[shortId]` link is meant to be viewable and purchasable by
 * anyone docs §11's "Clone this build"/"Add to cart" describes, exactly
 * like a public product page.
 */
import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/env";
import { generateBuildShortId, generateBuildSessionToken } from "@/lib/ids";
import { AppError, NotFoundError, ForbiddenError } from "@/lib/errors";
import {
  findOrCreateCustomerId,
  ensureCartForMutation,
  addItemToCart,
  type CartIdentity,
} from "@/server/services/commerce/cart";
import { validateBuild, type BuildValidationReport } from "./validate-build";
import type {
  BuildMode,
  BuildUseCase,
  BuildResolution,
  BuildVisibility,
} from "@/generated/prisma/client";

const BUILD_OWNER_COOKIE_NAME = "city_build_owner";
const BUILD_OWNER_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const SHORT_ID_MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Anonymous ownership cookie — read-safe anywhere, write-only inside a
// Server Action/Route Handler (same split as cart.ts's own cookie helpers).
// ---------------------------------------------------------------------------

export async function readBuildOwnerToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(BUILD_OWNER_COOKIE_NAME)?.value ?? null;
}

async function ensureBuildOwnerToken(): Promise<string> {
  const existing = await readBuildOwnerToken();
  if (existing) return existing;

  const token = generateBuildSessionToken();
  const store = await cookies();
  store.set(BUILD_OWNER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: BUILD_OWNER_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return token;
}

interface OwnershipRow {
  customerId: string | null;
  sessionToken: string | null;
}

/**
 * The non-throwing half of the ownership check — exported so a page (e.g.
 * `/build/[shortId]/edit`) can branch on "is this visitor allowed to edit"
 * *before* rendering (redirecting a non-owner to the read-only
 * `/build/[shortId]` share view instead of erroring), rather than only
 * being able to find out by calling a mutation and catching
 * `ForbiddenError`. `assertCanEditBuild` below is a thin wrapper of this
 * for every mutation in this file, so the two can never drift on what
 * "owns" means.
 *
 * NOTE: this reads (never writes) the `city_build_owner` cookie via
 * `readBuildOwnerToken`, unlike `assertCanEditBuild`'s siblings which
 * mutate through `ensureBuildOwnerToken` elsewhere — a page merely
 * *checking* ownership must never mint a new anonymous-owner cookie for a
 * build it doesn't actually own.
 */
export async function isBuildOwner(build: OwnershipRow, identity: CartIdentity): Promise<boolean> {
  if (identity.userId) {
    const customerId = await findOrCreateCustomerId(identity);
    return build.customerId === customerId;
  }
  if (build.sessionToken) {
    const ownerToken = await readBuildOwnerToken();
    return Boolean(ownerToken && ownerToken === build.sessionToken);
  }
  return false;
}

async function assertCanEditBuild(build: OwnershipRow, identity: CartIdentity): Promise<void> {
  if (await isBuildOwner(build, identity)) return;
  throw new ForbiddenError("You can't edit this build.");
}

export interface CreateBuildInput {
  mode: BuildMode;
  useCase: BuildUseCase;
  targetResolution: BuildResolution;
  budgetPaisa: number | null;
  name?: string;
}

/** Creates a new `Build`, retrying `shortId` generation on the (astronomically unlikely, ~1-in-58^8) collision — matches the retry-on-unique-violation convention `order-number.ts` already uses for its own short public identifier. */
export async function createBuild(input: CreateBuildInput, identity: CartIdentity) {
  const customerId = identity.userId ? await findOrCreateCustomerId(identity) : null;
  const sessionToken = customerId ? null : await ensureBuildOwnerToken();

  for (let attempt = 0; attempt < SHORT_ID_MAX_ATTEMPTS; attempt++) {
    const shortId = generateBuildShortId();
    try {
      return await db.build.create({
        data: {
          shortId,
          customerId,
          sessionToken,
          name: input.name,
          mode: input.mode,
          useCase: input.useCase,
          targetResolution: input.targetResolution,
          budgetPaisa: input.budgetPaisa,
        },
      });
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
      if (!isUniqueViolation || attempt === SHORT_ID_MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw new AppError(
    "DEPENDENCY_UNAVAILABLE",
    "Couldn't generate a unique build link — please try again.",
  );
}

/** Public, read-only lookup for `/build/[shortId]` — anyone with the link can view, matching docs §11's shareable-build page. */
export async function getBuildByShortId(shortId: string) {
  const build = await db.build.findUnique({
    where: { shortId },
    include: {
      items: { include: { part: true }, orderBy: { position: "asc" } },
    },
  });
  if (!build) throw new NotFoundError("Build");
  return build;
}

/** Fire-and-forget page-view counter — never blocks or fails the page render it's called from. */
export async function incrementBuildViewCount(buildId: string): Promise<void> {
  await db.build
    .update({ where: { id: buildId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

/**
 * Sets (or replaces) the part in one slot, snapshotting the part's linked
 * variant price at selection time (`BuildItem.unitPricePaisaSnapshot`) —
 * an informational-only part (`variantId` null) snapshots 0, matching
 * `docs §7`'s "not every part must be a variant."
 */
export async function setBuildItem(
  buildId: string,
  slotKey: string,
  partId: string,
  quantity: number,
  identity: CartIdentity,
): Promise<void> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    select: { customerId: true, sessionToken: true },
  });
  if (!build) throw new NotFoundError("Build");
  await assertCanEditBuild(build, identity);

  const part = await db.componentPart.findUnique({
    where: { id: partId },
    select: { id: true, variantId: true, isActive: true },
  });
  if (!part || !part.isActive) throw new NotFoundError("Part");

  let unitPricePaisaSnapshot = 0;
  if (part.variantId) {
    const variant = await db.variant.findUnique({
      where: { id: part.variantId },
      select: { pricePaisa: true },
    });
    unitPricePaisaSnapshot = variant?.pricePaisa ?? 0;
  }

  await db.buildItem.upsert({
    where: { buildId_slotKey: { buildId, slotKey } },
    create: { buildId, slotKey, partId, quantity, unitPricePaisaSnapshot },
    update: { partId, quantity, unitPricePaisaSnapshot },
  });

  await recomputeAndPersistTotals(buildId);
}

export async function removeBuildItem(
  buildId: string,
  slotKey: string,
  identity: CartIdentity,
): Promise<void> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    select: { customerId: true, sessionToken: true },
  });
  if (!build) throw new NotFoundError("Build");
  await assertCanEditBuild(build, identity);

  await db.buildItem.deleteMany({ where: { buildId, slotKey } });
  await recomputeAndPersistTotals(buildId);
}

/**
 * Re-runs the engine and writes its summary figures back onto `Build`
 * (`totalPaisa`, `estimatedWatts`, `recommendedPsuWatts`,
 * `compatibilityScore`, `balanceScore`) so a shared build page or an
 * order-history reference to `Build` can read a fast summary without
 * re-running the full engine — the same "cache the expensive summary,
 * recompute on write" shape `commerce/checkout.ts` already uses for order
 * totals. Full issue-level detail (`BuildValidationSnapshot`) is
 * deliberately NOT written here — persisting versioned validation
 * snapshots is real scope from docs §7 but not wired this pass (flagged
 * in PROGRESS.md); every read path that needs live issues should call
 * `validateBuild` directly instead of trusting a stale snapshot.
 */
export async function recomputeAndPersistTotals(buildId: string): Promise<BuildValidationReport> {
  const report = await validateBuild(buildId);

  await db.build.update({
    where: { id: buildId },
    data: {
      totalPaisa: report.totalPaisa,
      estimatedWatts: report.power.baseLoadWatts,
      recommendedPsuWatts: report.power.recommendedPsuWatts,
      compatibilityScore: report.compatibilityScore,
      balanceScore: Math.max(-100, Math.min(100, Math.round(report.balance.adjustedBalance))),
    },
  });

  return report;
}

export async function shareBuild(
  buildId: string,
  visibility: BuildVisibility,
  identity: CartIdentity,
): Promise<void> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    select: { customerId: true, sessionToken: true },
  });
  if (!build) throw new NotFoundError("Build");
  await assertCanEditBuild(build, identity);
  await db.build.update({ where: { id: buildId }, data: { visibility } });
}

/**
 * Switches a build's `mode` (Guided/Standard/Expert) without touching any
 * `BuildItem` — docs §9's "Mode is switchable at any time without losing
 * the build" is true almost for free here, since `mode` only ever changes
 * how `/build/[shortId]/edit` *presents* the same slot grid (see
 * `ModeSelect`'s own doc comment); nothing about part selection is keyed
 * off it. Ownership-gated exactly like `shareBuild`.
 */
export async function setBuildMode(
  buildId: string,
  mode: BuildMode,
  identity: CartIdentity,
): Promise<void> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    select: { customerId: true, sessionToken: true },
  });
  if (!build) throw new NotFoundError("Build");
  await assertCanEditBuild(build, identity);
  await db.build.update({ where: { id: buildId }, data: { mode } });
}

export interface AddBuildToCartResult {
  addedCount: number;
  skippedPartNames: string[];
}

/**
 * "Add Build to Cart" (docs §9's builder summary panel action) — loops
 * `addItemToCart` per `BuildItem` with a linked variant, tagging each
 * line with `buildId` (see `cart.ts`'s `addItemToCart` optional param).
 * Parts with no linked variant (informational-only, `variantId` null)
 * can't be purchased and are skipped, named in `skippedPartNames` so the
 * UI can tell the shopper which slots they'll need to source separately —
 * "flag rather than fake" rather than silently dropping them. No
 * ownership check: any visitor with the build's link can add it to
 * *their own* cart, same as adding any other product to cart.
 */
export async function addBuildToCart(
  buildId: string,
  identity: CartIdentity,
): Promise<AddBuildToCartResult> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    include: { items: { include: { part: true } } },
  });
  if (!build) throw new NotFoundError("Build");
  if (build.items.length === 0) {
    throw new AppError("VALIDATION_FAILED", "This build has no parts to add to cart yet.");
  }

  const cart = await ensureCartForMutation(identity);

  let addedCount = 0;
  const skippedPartNames: string[] = [];

  for (const item of build.items) {
    if (!item.part.variantId) {
      skippedPartNames.push(item.part.model);
      continue;
    }
    await addItemToCart(cart.id, item.part.variantId, item.quantity, buildId);
    addedCount += 1;
  }

  return { addedCount, skippedPartNames };
}
