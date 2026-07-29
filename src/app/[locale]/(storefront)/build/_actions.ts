"use server";

/**
 * PC Builder Server Actions — the write-side counterpart to
 * `builder/validate-build.ts` (read-only engine) and `builder/builds.ts`
 * (persistence). Same `ActionResult<T>` contract as every other
 * storefront Server Action file: never throw an `AppError` across the
 * server/client boundary, always return a plain serialisable result.
 *
 * `validateBuildAction` is the one action a builder UI should call after
 * every part change to refresh the compatibility panel/fix drawers — it
 * does NOT persist anything, so a page that only wants a live preview
 * (e.g. before the shopper has picked every required slot) can call it
 * freely without writing to `Build` on every keystroke. `setBuildItemAction`/
 * `removeBuildItemAction` persist AND return the fresh validation report in
 * one round trip, since `builds.ts`'s `recomputeAndPersistTotals` already
 * ran the engine to fill in `Build`'s summary columns.
 */
import { z } from "zod";
import { auth } from "@/server/auth";
import { validationErrorFromZodIssues } from "@/lib/errors";
import {
  createBuild,
  setBuildItem,
  removeBuildItem,
  shareBuild,
  addBuildToCart,
  type AddBuildToCartResult,
} from "@/server/services/builder/builds";
import {
  validateBuild,
  type BuildValidationReport,
} from "@/server/services/builder/validate-build";
import { runStorefrontAction, type ActionResult } from "../_lib/action-result";

async function currentIdentity() {
  const session = await auth();
  return { userId: session?.user?.id, userEmail: session?.user?.email ?? null };
}

const createBuildSchema = z.object({
  mode: z.enum(["GUIDED", "STANDARD", "EXPERT"]),
  useCase: z.enum([
    "GAMING",
    "CONTENT_CREATION",
    "THREE_D_RENDERING",
    "STREAMING",
    "PROGRAMMING",
    "AI_ML",
    "OFFICE",
    "GENERAL",
  ]),
  targetResolution: z.enum(["FHD", "QHD", "UHD", "ULTRAWIDE"]),
  budgetPaisa: z.number().int().positive().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function createBuildAction(
  input: unknown,
): Promise<ActionResult<{ id: string; shortId: string }>> {
  return runStorefrontAction(async () => {
    const parsed = createBuildSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const build = await createBuild(parsed.data, identity);
    return { id: build.id, shortId: build.shortId };
  });
}

const setBuildItemSchema = z.object({
  buildId: z.string().min(1),
  slotKey: z.string().min(1),
  partId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

/** Persists a slot's part, then returns the same shape `validateBuildAction` does so the UI never has to make a second round trip after a selection. */
export async function setBuildItemAction(
  input: unknown,
): Promise<ActionResult<BuildValidationReport>> {
  return runStorefrontAction(async () => {
    const parsed = setBuildItemSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    await setBuildItem(
      parsed.data.buildId,
      parsed.data.slotKey,
      parsed.data.partId,
      parsed.data.quantity,
      identity,
    );
    return validateBuild(parsed.data.buildId);
  });
}

const removeBuildItemSchema = z.object({ buildId: z.string().min(1), slotKey: z.string().min(1) });

export async function removeBuildItemAction(
  input: unknown,
): Promise<ActionResult<BuildValidationReport>> {
  return runStorefrontAction(async () => {
    const parsed = removeBuildItemSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    await removeBuildItem(parsed.data.buildId, parsed.data.slotKey, identity);
    return validateBuild(parsed.data.buildId);
  });
}

const validateBuildSchema = z.object({ buildId: z.string().min(1) });

/** Read-only re-validation — safe to call on a timer/every field change without writing to the DB. */
export async function validateBuildAction(
  input: unknown,
): Promise<ActionResult<BuildValidationReport>> {
  return runStorefrontAction(async () => {
    const parsed = validateBuildSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    return validateBuild(parsed.data.buildId);
  });
}

const shareBuildSchema = z.object({
  buildId: z.string().min(1),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
});

export async function shareBuildAction(input: unknown): Promise<ActionResult<void>> {
  return runStorefrontAction(async () => {
    const parsed = shareBuildSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    await shareBuild(parsed.data.buildId, parsed.data.visibility, identity);
  });
}

const addBuildToCartSchema = z.object({ buildId: z.string().min(1) });

export async function addBuildToCartAction(
  input: unknown,
): Promise<ActionResult<AddBuildToCartResult>> {
  return runStorefrontAction(async () => {
    const parsed = addBuildToCartSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    return addBuildToCart(parsed.data.buildId, identity);
  });
}
