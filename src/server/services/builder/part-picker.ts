/**
 * Candidate-parts service for the builder's part picker / fix drawer —
 * docs/08-PC-BUILDER-ENGINE.md §9 "Part picker" ("thumbnails, a spec column
 * set per part type... stock status") and "Fix drawer" ("candidate parts
 * with price deltas").
 *
 * The core idea: for a given slot, every active `ComponentPart` of that
 * slot's `PartType` is a "candidate". To know whether picking it would
 * actually work, this hypothetically substitutes it into the slot (in
 * memory, never written to the DB) and re-runs the *exact same* engine
 * pipeline `validate-build.ts` uses for a real save
 * (`evaluateSelectedParts`, extracted from `validateBuild` for exactly this
 * reuse) — never a second, drifted copy of the compatibility logic.
 *
 * Performance (flagged, not silently ignored): this is an
 * O(candidates × rules × build-size) loop — one full engine evaluation per
 * candidate. At this project's seed-data scale (~25 parts per type at
 * most, ~37 rules) that's comfortably fast. A real catalogue of thousands
 * of parts per slot would need a memoized/pre-filtered pass (e.g. only
 * re-evaluating rules whose subject/object type touches the candidate's
 * type, or precomputing per-candidate compatibility once per build-state
 * rather than once per picker-open) before this approach would still meet
 * docs §7's latency targets. Not attempted this pass.
 */
import "server-only";
import { db } from "@/server/db";
import type { PartType } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { findSlotDefinition } from "@/lib/builder/slots";
import { resolvePartImage } from "@/lib/builder/part-image";
import { loadSelectedParts, evaluateSelectedParts, type SelectedPart } from "./validate-build";
import type { PartRowData } from "@/components/builder/part-row";

/** Same shape `part-image.ts`'s `resolvePartImage` needs — one level up from a `Media` row through `ProductMedia`. */
interface CandidateRow {
  id: string;
  partType: PartType;
  manufacturer: string;
  model: string;
  specs: unknown;
  performanceTier: number | null;
  benchmarkScore: number | null;
  tdpWatts: number | null;
  idleWatts: number | null;
  loadWatts: number | null;
  transientMultiplier: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  dataConfidence: "VERIFIED" | "INFERRED" | "UNVERIFIED";
  variantId: string | null;
  connectors: Array<{
    direction: "PROVIDES" | "REQUIRES";
    connectorType: string;
    quantity: number;
  }>;
  variant: {
    pricePaisa: number;
    compareAtPricePaisa: number | null;
    lowStockThreshold: number;
    allowBackorder: boolean;
    product: {
      media: Array<{
        role: string;
        media: { cdnUrl: string | null; url: string; altText: string | null };
      }>;
    };
    stockLevels: Array<{ quantity: number; reservedQuantity: number }>;
  } | null;
}

/**
 * §9's "stock status" column — no reusable "variant -> StockBadge status"
 * helper exists elsewhere in this codebase (checked
 * `commerce`/`admin/inventory` service layers), so this is a small,
 * self-contained resolution rather than duplicating one that might drift.
 * Informational-only parts (no `variantId`) have no real inventory row to
 * check at all; they default to `"in-stock"` since nothing about them is
 * ever actually out of stock — they're not a purchasable SKU in the first
 * place (`addBuildToCart` already skips them). Flagged: a true "not
 * purchasable" status isn't one of `StockBadge`'s five values, so this is
 * an approximation, not a real inventory read for those rows.
 */
function stockStatusFor(variant: CandidateRow["variant"]): PartRowData["stockStatus"] {
  if (!variant) return "in-stock";
  const available = variant.stockLevels.reduce(
    (sum, level) => sum + (level.quantity - level.reservedQuantity),
    0,
  );
  if (available <= 0) return variant.allowBackorder ? "preorder" : "out-of-stock";
  if (available <= variant.lowStockThreshold) return "low-stock";
  return "in-stock";
}

/** A short, generic spec-fragment line — docs §9 wants a "spec column set per part type" driven by real per-type schemas (`part-specs.ts`'s 16 zod schemas); reproducing all 16 as display columns is real scope this pass doesn't attempt. This is a deliberately generic stand-in using the handful of fields every `ComponentPart` shares, not a per-type column set. */
function genericSpecFragments(part: CandidateRow): string[] {
  const fragments: string[] = [];
  if (part.performanceTier != null) fragments.push(`Tier ${part.performanceTier}/10`);
  if (part.tdpWatts != null) fragments.push(`${part.tdpWatts}W TDP`);
  if (part.dataConfidence !== "VERIFIED") fragments.push("Unverified specs");
  return fragments;
}

function toSelectedPart(slotKey: string, part: CandidateRow, unitPricePaisa: number): SelectedPart {
  return {
    slotKey,
    quantity: 1,
    isUserSelected: true,
    unitPricePaisaSnapshot: unitPricePaisa,
    part: {
      id: part.id,
      partType: part.partType,
      manufacturer: part.manufacturer,
      model: part.model,
      specs: part.specs,
      performanceTier: part.performanceTier,
      benchmarkScore: part.benchmarkScore,
      tdpWatts: part.tdpWatts,
      idleWatts: part.idleWatts,
      loadWatts: part.loadWatts,
      transientMultiplier: part.transientMultiplier,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      dataConfidence: part.dataConfidence,
      connectors: part.connectors.map((c) => ({
        direction: c.direction as never,
        connectorType: c.connectorType as never,
        quantity: c.quantity,
      })),
    },
  };
}

export interface CandidatePartRow extends PartRowData {
  /** The candidate's raw `ComponentPart.id` — same as `PartRowData.id`, restated with an unambiguous name for callers (e.g. `setBuildItemAction`) that need it distinct from a `Variant.id`. */
  partId: string;
}

/**
 * Lists every active `ComponentPart` of `slotKey`'s `PartType`, each
 * annotated with a real `compatible`/`incompatibleReason` computed by
 * hypothetically dropping it into the build in place of whatever currently
 * occupies that slot (if anything) and re-running the full engine.
 */
export async function listCandidatePartsForSlot(
  buildId: string,
  slotKey: string,
): Promise<CandidatePartRow[]> {
  const slot = findSlotDefinition(slotKey);
  if (!slot) {
    throw new ValidationError([
      { field: "slotKey", code: "invalid_slot", message: "Unknown builder slot." },
    ]);
  }

  const { parts: currentParts, settings } = await loadSelectedParts(buildId);
  const build = await db.build.findUnique({ where: { id: buildId }, select: { id: true } });
  if (!build) throw new NotFoundError("Build");

  const otherParts = currentParts.filter((p) => p.slotKey !== slotKey);

  const candidates = (await db.componentPart.findMany({
    where: { partType: slot.partType, isActive: true },
    select: {
      id: true,
      partType: true,
      manufacturer: true,
      model: true,
      specs: true,
      performanceTier: true,
      benchmarkScore: true,
      tdpWatts: true,
      idleWatts: true,
      loadWatts: true,
      transientMultiplier: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
      dataConfidence: true,
      variantId: true,
      connectors: {
        select: { direction: true, connectorType: true, quantity: true },
      },
      variant: {
        select: {
          pricePaisa: true,
          compareAtPricePaisa: true,
          lowStockThreshold: true,
          allowBackorder: true,
          product: {
            select: {
              media: {
                select: {
                  role: true,
                  media: { select: { cdnUrl: true, url: true, altText: true } },
                },
              },
            },
          },
          stockLevels: { select: { quantity: true, reservedQuantity: true } },
        },
      },
    },
    orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
  })) as unknown as CandidateRow[];

  const rows: CandidatePartRow[] = [];

  for (const candidate of candidates) {
    const unitPricePaisa = candidate.variant?.pricePaisa ?? 0;
    const hypothetical = [...otherParts, toSelectedPart(slotKey, candidate, unitPricePaisa)];
    const report = await evaluateSelectedParts(buildId, hypothetical, settings);

    const attributedRuleIssue = report.issues.find(
      (issue) =>
        issue.severity === "ERROR" &&
        (issue.subjectPartId === candidate.id || issue.objectPartId === candidate.id),
    );

    // Connector shortfalls don't carry a partId (the check is build-wide,
    // not part-scoped — see connector-check.ts's header comment), so as a
    // documented heuristic: a shortfall on a connector type this candidate
    // itself provides or requires is attributed to the candidate. This can
    // over-attribute in rare multi-part scenarios; it never under-attributes
    // a real ERROR away entirely, since `compatible` still reflects the
    // rule-issue check above regardless.
    const candidateConnectorTypes = new Set(candidate.connectors.map((c) => c.connectorType));
    const attributedShortfall = report.connectorShortfalls.find(
      (shortfall) =>
        shortfall.severity === "ERROR" && candidateConnectorTypes.has(shortfall.connectorType),
    );

    const incompatibleReason = attributedRuleIssue?.message ?? attributedShortfall?.message;
    const imageAlt = `${candidate.manufacturer} ${candidate.model}`;
    const image = resolvePartImage(candidate.variant?.product.media, imageAlt);

    rows.push({
      id: candidate.id,
      partId: candidate.id,
      imageUrl: image.url,
      imageAlt: image.alt,
      name: imageAlt,
      specs: genericSpecFragments(candidate),
      price: unitPricePaisa,
      compareAtPrice: candidate.variant?.compareAtPricePaisa ?? undefined,
      stockStatus: stockStatusFor(candidate.variant),
      compatible: !incompatibleReason,
      incompatibleReason,
    });
  }

  return rows;
}

/** Same list, but each row also carries `priceDeltaPaisa` vs. `currentPartId`'s price in that slot — the `FixDrawer` case (docs §9 "each row expandable into a Fix drawer listing candidate parts with price deltas"). `currentPartId` is optional so an empty slot can still list candidates with all-zero deltas rather than requiring a part to already be selected. Money stays an integer number of paisa throughout; formatting to a rupee string is the caller's job via `formatNPR`, matching every other service in this codebase. */
export async function listCandidatePartsWithPriceDelta(
  buildId: string,
  slotKey: string,
  currentPartId?: string,
): Promise<Array<CandidatePartRow & { priceDeltaPaisa: number }>> {
  const rows = await listCandidatePartsForSlot(buildId, slotKey);
  const currentPrice = currentPartId
    ? (rows.find((r) => r.partId === currentPartId)?.price ?? 0)
    : 0;
  return rows.map((row) => ({
    ...row,
    priceDeltaPaisa: row.price - currentPrice,
  }));
}

/**
 * Builds a `slotKey -> PartRowData` map for every part currently in a
 * build — the `/build/[shortId]/edit` workspace's "filled slot" display
 * (`BuilderSlotCard`'s `state: "filled"` case needs a real `PartRowData`,
 * not just the raw `BuildItem`/`ComponentPart` rows `getBuildByShortId`
 * returns). Reuses this file's own `genericSpecFragments`/`stockStatusFor`/
 * `resolvePartImage` so a part's card here and its row in the picker/fix
 * drawer never show different specs or a different image for the same
 * part. `price` is deliberately the build's own frozen
 * `unitPricePaisaSnapshot`, not a fresh live-variant read — the same figure
 * `BuildItem` charges if added to cart, per this codebase's "snapshot
 * price at selection time" rule (`builds.ts`'s `setBuildItem`).
 */
export async function getSelectedPartRows(buildId: string): Promise<Record<string, PartRowData>> {
  const items = (await db.buildItem.findMany({
    where: { buildId },
    select: {
      slotKey: true,
      unitPricePaisaSnapshot: true,
      part: {
        select: {
          id: true,
          partType: true,
          manufacturer: true,
          model: true,
          specs: true,
          performanceTier: true,
          benchmarkScore: true,
          tdpWatts: true,
          idleWatts: true,
          loadWatts: true,
          transientMultiplier: true,
          lengthMm: true,
          widthMm: true,
          heightMm: true,
          dataConfidence: true,
          variantId: true,
          connectors: { select: { direction: true, connectorType: true, quantity: true } },
          variant: {
            select: {
              pricePaisa: true,
              compareAtPricePaisa: true,
              lowStockThreshold: true,
              allowBackorder: true,
              product: {
                select: {
                  media: {
                    select: {
                      role: true,
                      media: { select: { cdnUrl: true, url: true, altText: true } },
                    },
                  },
                },
              },
              stockLevels: { select: { quantity: true, reservedQuantity: true } },
            },
          },
        },
      },
    },
  })) as unknown as Array<{ slotKey: string; unitPricePaisaSnapshot: number; part: CandidateRow }>;

  const rows: Record<string, PartRowData> = {};
  for (const item of items) {
    const candidate = item.part;
    const imageAlt = `${candidate.manufacturer} ${candidate.model}`;
    const image = resolvePartImage(candidate.variant?.product.media, imageAlt);
    rows[item.slotKey] = {
      id: candidate.id,
      imageUrl: image.url,
      imageAlt: image.alt,
      name: imageAlt,
      specs: genericSpecFragments(candidate),
      price: item.unitPricePaisaSnapshot,
      compareAtPrice: candidate.variant?.compareAtPricePaisa ?? undefined,
      stockStatus: stockStatusFor(candidate.variant),
      compatible: true,
    };
  }
  return rows;
}
