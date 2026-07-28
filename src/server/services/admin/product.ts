/**
 * Product write path — the four-step wizard (docs/09-ADMIN-DAD-MODE.md
 * §5.1) and the product list's inline price edit (§5.2's stock edit is
 * `admin/stock.ts`'s `adjustVariantStock`, reused directly by the
 * product list's Server Action rather than duplicated here).
 *
 * ONE PRODUCT, ONE VARIANT in this pass: `ProductType.VARIABLE` (multiple
 * option combinations, e.g. "16GB/512GB" vs "32GB/1TB") is real in the
 * schema and the storefront PDP already renders it, but the wizard this
 * file backs only ever creates/edits a product's single default
 * `Variant` — building the option-matrix UI (add an "Option type", add
 * "Option values", generate every combination as its own priced/stocked
 * row) is real, separate work, out of scope for this pass. Every product
 * created here is `ProductType.SIMPLE`.
 *
 * SLUG IS IMMUTABLE after creation, same policy as `admin/category.ts`
 * and `admin/brand.ts` — set once from `name` at creation time, never
 * recomputed on an edit even if the name changes later. `ProductSlugHistory`
 * exists in the schema for the eventuality that changes; wiring it up is
 * a follow-up, not silently ignored.
 */
import "server-only";
import { db } from "@/server/db";
import {
  ConditionType,
  Locale,
  Prisma,
  ProductStatus,
  ProductType,
} from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { buildProductCodePrefix } from "@/lib/ids";
import { slugify, uniqueSlug } from "@/lib/slug";
import type {
  ProductBasicInfoInput,
  ProductListQuery,
  ProductPhotosInput,
  ProductSeoInput,
  ProductSpecsInput,
} from "@/lib/validation/admin/product";
import { resolveTranslated } from "@/server/services/catalog/locale-helpers";
import { recordAuditLog, type AuditActor } from "./audit-log";
import { adjustVariantStock, getDefaultBranchId, getPrimaryStockLevelsByVariantId } from "./stock";

function tiptapParagraph(text: string): Prisma.InputJsonValue {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

// ---------------------------------------------------------------------------
// Duplicate-name detection (docs/09 §5.1 Step 1, §8's error-prevention table)
// ---------------------------------------------------------------------------

export interface SimilarProductCandidate {
  id: string;
  name: string;
  slug: string;
  similarity: number;
}

interface SimilarityRow {
  id: string;
  name: string;
  slug: string;
  similarity: number;
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;

/**
 * "On blur, checks for similar existing products and warns... directly
 * prevents the duplicate-product defect found on the live site" — the
 * intended mechanism per docs/06-DATA-MODEL.md §11 and §13.3 is Postgres
 * `pg_trgm` trigram `similarity()`, and `prisma/sql/manual-constraints.sql`
 * already declares the extension and a GIN trigram index for exactly
 * this. Like `catalog/search.ts`'s full-text search, that SQL has never
 * been applied to a real database from this sandbox — so this genuinely
 * runs the intended query, and fails open (logs, returns no candidates)
 * if `pg_trgm` isn't installed yet, rather than crashing product
 * creation over a nice-to-have warning.
 */
export async function findSimilarProductNames(
  name: string,
  excludeProductId?: string,
): Promise<SimilarProductCandidate[]> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return [];

  try {
    const rows = await db.$queryRaw<SimilarityRow[]>(Prisma.sql`
      SELECT id, name, slug, similarity(name, ${trimmed}) AS similarity
      FROM products
      WHERE deleted_at IS NULL
        AND similarity(name, ${trimmed}) >= ${DUPLICATE_SIMILARITY_THRESHOLD}
        ${excludeProductId ? Prisma.sql`AND id != ${excludeProductId}` : Prisma.empty}
      ORDER BY similarity DESC
      LIMIT 5
    `);
    return rows;
  } catch {
    // pg_trgm unavailable on this database (not yet migrated) — fail
    // open. See the function doc comment above.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Basic information
// ---------------------------------------------------------------------------

async function generateUniqueProductCode(brandName: string, productName: string): Promise<string> {
  const prefix = buildProductCodePrefix(brandName, productName);
  const existing = await db.variant.findMany({
    where: { sku: { startsWith: `${prefix}-` } },
    select: { sku: true },
  });
  const usedNumbers = new Set(
    existing
      .map((row) => row.sku.slice(prefix.length + 1))
      .filter((suffix) => /^\d{3,}$/.test(suffix))
      .map(Number),
  );
  let n = 1;
  while (usedNumbers.has(n)) n += 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export interface ProductWizardSummary {
  id: string;
  slug: string;
  variantId: string;
  status: ProductStatus;
}

/**
 * Creates a brand-new draft product (`existingProductId` omitted) or
 * updates Step 1's fields on one already in progress. `name`/`brandId`/
 * `primaryCategoryId` are the only fields that can't be blanked out once
 * set (the Zod schema already requires them); everything else can be
 * revised freely across "Save as draft" calls, matching docs/09 §5.1's
 * "no step that can't be skipped and returned to."
 */
export async function saveBasicInfo(
  input: ProductBasicInfoInput,
  actor: AuditActor,
  existingProductId?: string,
): Promise<ProductWizardSummary> {
  const brand = await db.brand.findUnique({ where: { id: input.brandId }, select: { name: true } });
  if (!brand) throw new NotFoundError("Brand");
  const category = await db.category.findUnique({
    where: { id: input.primaryCategoryId },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Category");

  const displayTitle = (input.shortTitle?.trim() || input.name).slice(0, 70);
  const shortDescription = (input.description?.trim() || displayTitle).slice(0, 200);
  const description = tiptapParagraph(input.description?.trim() || shortDescription);

  const categoryIds = [
    input.primaryCategoryId,
    ...input.additionalCategoryIds.filter((id) => id !== input.primaryCategoryId),
  ];

  if (!existingProductId) {
    const slug = uniqueSlug(
      slugify(input.name),
      (await db.product.findMany({ select: { slug: true } })).map((row) => row.slug),
    );
    const sku = input.productCode?.trim()
      ? input.productCode.trim()
      : await generateUniqueProductCode(brand.name, input.name);

    const skuTaken = await db.variant.findUnique({ where: { sku } });
    if (skuTaken) {
      throw new ValidationError([
        {
          field: "productCode",
          code: "taken",
          message: "That product code is already used by another product.",
        },
      ]);
    }

    const product = await db.product.create({
      data: {
        slug,
        name: input.name,
        displayTitle,
        h1: displayTitle,
        shortDescription,
        description,
        brandId: input.brandId,
        primaryCategoryId: input.primaryCategoryId,
        type: ProductType.SIMPLE,
        status: ProductStatus.DRAFT,
        conditionType: input.conditionType,
        warrantyMonths: input.warrantyMonths ?? null,
        warrantyText: input.warrantyText ?? null,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        variants: {
          create: {
            sku,
            pricePaisa: input.pricePaisa,
            compareAtPricePaisa: input.compareAtPricePaisa ?? null,
            isDefault: true,
            position: 0,
          },
        },
      },
      include: { variants: true },
    });

    if (input.stockQuantity > 0) {
      // `adjustVariantStock` (admin/stock.ts) is the one place that
      // writes `StockLevel` + `StockMovement` together — reused here
      // rather than re-implemented, so "every stock change writes a
      // StockMovement" has exactly one code path to stay true, not two
      // that could drift. `INITIAL` per `StockMovementReason`'s own
      // purpose: the very first quantity ever recorded for a variant.
      await adjustVariantStock(product.variants[0]!.id, input.stockQuantity, "INITIAL", actor);
    }

    await recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      after: { name: input.name, slug, status: "DRAFT" },
    });

    return {
      id: product.id,
      slug: product.slug,
      variantId: product.variants[0]!.id,
      status: product.status,
    };
  }

  const existing = await db.product.findUnique({
    where: { id: existingProductId },
    include: { variants: { where: { isDefault: true }, take: 1 }, categories: true },
  });
  if (!existing) throw new NotFoundError("Product");
  const variant = existing.variants[0];
  if (!variant) throw new NotFoundError("Product option");

  if (input.productCode?.trim() && input.productCode.trim() !== variant.sku) {
    const skuTaken = await db.variant.findUnique({ where: { sku: input.productCode.trim() } });
    if (skuTaken) {
      throw new ValidationError([
        {
          field: "productCode",
          code: "taken",
          message: "That product code is already used by another product.",
        },
      ]);
    }
  }

  const before = {
    name: existing.name,
    pricePaisa: variant.pricePaisa,
    compareAtPricePaisa: variant.compareAtPricePaisa,
  };

  const desiredCategoryIds = new Set(categoryIds);
  const currentCategoryIds = new Set(existing.categories.map((row) => row.categoryId));
  const toRemove = existing.categories.filter((row) => !desiredCategoryIds.has(row.categoryId));
  const toAdd = [...desiredCategoryIds].filter((id) => !currentCategoryIds.has(id));

  await db.$transaction([
    db.product.update({
      where: { id: existingProductId },
      data: {
        name: input.name,
        displayTitle,
        h1: displayTitle,
        shortDescription,
        description,
        brandId: input.brandId,
        primaryCategoryId: input.primaryCategoryId,
        conditionType: input.conditionType,
        warrantyMonths: input.warrantyMonths ?? null,
        warrantyText: input.warrantyText ?? null,
      },
    }),
    db.variant.update({
      where: { id: variant.id },
      data: {
        sku: input.productCode?.trim() || variant.sku,
        pricePaisa: input.pricePaisa,
        compareAtPricePaisa: input.compareAtPricePaisa ?? null,
      },
    }),
    ...toRemove.map((row) =>
      db.productCategory.delete({
        where: {
          productId_categoryId: { productId: existingProductId, categoryId: row.categoryId },
        },
      }),
    ),
    ...toAdd.map((categoryId) =>
      db.productCategory.create({ data: { productId: existingProductId, categoryId } }),
    ),
  ]);

  // Same reused primitive as the create path above; `adjustVariantStock`
  // itself is a no-op write (no `StockMovement` at all) when the
  // quantity hasn't actually changed, so it's safe to call unconditionally
  // here rather than pre-checking the current quantity ourselves.
  await adjustVariantStock(variant.id, input.stockQuantity, "CORRECTION", actor);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.updated",
    entityType: "Product",
    entityId: existingProductId,
    before,
    after: {
      name: input.name,
      pricePaisa: input.pricePaisa,
      compareAtPricePaisa: input.compareAtPricePaisa ?? null,
    },
  });

  return { id: existing.id, slug: existing.slug, variantId: variant.id, status: existing.status };
}

// ---------------------------------------------------------------------------
// Step 2 — Photos
// ---------------------------------------------------------------------------

/**
 * Replaces the product's full `ProductMedia` set with `input.photos`, in
 * the given order (`position` = array index; `role: GALLERY` throughout —
 * this pass doesn't distinguish a separate hero/banner role). A photo's
 * `description` field writes to the shared `Media.altText` column, not
 * anything product-specific — `Media` rows are shared and de-duplicated
 * by checksum (`admin/media.ts`), so editing a description here can
 * change what another product using the same photo shows too. Worth
 * knowing, not a bug: the alternative (a per-product-use description
 * override) would need a new column this pass doesn't add.
 */
export async function savePhotos(
  productId: string,
  input: ProductPhotosInput,
  actor: AuditActor,
): Promise<void> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new NotFoundError("Product");

  await db.$transaction([
    db.productMedia.deleteMany({ where: { productId } }),
    ...input.photos.map((photo, index) =>
      db.productMedia.create({ data: { productId, mediaId: photo.mediaId, position: index } }),
    ),
    ...input.photos
      .filter((photo) => photo.description !== undefined)
      .map((photo) =>
        db.media.update({ where: { id: photo.mediaId }, data: { altText: photo.description } }),
      ),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.photosUpdated",
    entityType: "Product",
    entityId: productId,
    after: { photoCount: input.photos.length },
  });
}

// ---------------------------------------------------------------------------
// Step 3 — Details (specifications)
// ---------------------------------------------------------------------------

export interface AdminSpecFieldOption {
  key: string;
  label: string;
  helpText: string | null;
  dataType: "TEXT" | "NUMBER" | "BOOL" | "SELECT";
  unit: string | null;
  options: string[];
  isRequired: boolean;
  group: string | null;
}

/**
 * "The category chosen in step 1 loads the right template automatically.
 * The owner never designs a spec sheet." — returns `null` when the
 * category has no `specTemplateId` set. Every category the dev seed
 * creates has one (`prisma/seed/taxonomy.ts`'s `seedSpecTemplates`); a
 * category created via `/admin/categories` (this codebase's Phase 5b)
 * does not, since that form has no field for it yet — a real,
 * documented gap, not an oversight. `null` here means Step 3 falls back
 * to *only* the "+ Add another detail" escape hatch, with no
 * template-driven fields above it.
 */
export async function getSpecTemplateFields(categoryId: string): Promise<AdminSpecFieldOption[]> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { specTemplateId: true },
  });
  if (!category?.specTemplateId) return [];

  const fields = await db.specField.findMany({
    where: { templateId: category.specTemplateId },
    orderBy: { position: "asc" },
  });

  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    helpText: field.helpText,
    dataType: field.dataType,
    unit: field.unit,
    options: field.options,
    isRequired: field.isRequired,
    group: field.group,
  }));
}

export async function getProductSpecs(productId: string): Promise<ProductSpecsInput["specs"]> {
  const specs = await db.productSpec.findMany({
    where: { productId },
    orderBy: { position: "asc" },
  });
  return specs.map((spec) => ({
    key: spec.key,
    label: spec.label,
    valueText: spec.valueText ?? undefined,
    valueNumber: spec.valueNumber ? Number(spec.valueNumber) : undefined,
    valueBool: spec.valueBool ?? undefined,
    unit: spec.unit ?? undefined,
    group: spec.group ?? undefined,
  }));
}

/** Delete-and-recreate, in one transaction — simpler and just as correct as a diff for a per-product spec sheet capped at 60 rows. */
export async function saveSpecs(
  productId: string,
  input: ProductSpecsInput,
  actor: AuditActor,
): Promise<void> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new NotFoundError("Product");

  await db.$transaction([
    db.productSpec.deleteMany({ where: { productId } }),
    ...input.specs.map((spec, index) =>
      db.productSpec.create({
        data: {
          productId,
          key: spec.key,
          label: spec.label,
          valueText: spec.valueText ?? null,
          valueNumber: spec.valueNumber ?? null,
          valueBool: spec.valueBool ?? null,
          unit: spec.unit ?? null,
          group: spec.group ?? null,
          position: index,
        },
      }),
    ),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.specsUpdated",
    entityType: "Product",
    entityId: productId,
    after: { specCount: input.specs.length },
  });
}

// ---------------------------------------------------------------------------
// Step 4 — Search information
// ---------------------------------------------------------------------------

export async function saveSeo(
  productId: string,
  input: ProductSeoInput,
  actor: AuditActor,
): Promise<void> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { metaTitle: true, metaDescription: true },
  });
  if (!product) throw new NotFoundError("Product");

  await db.product.update({
    where: { id: productId },
    data: {
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      canonicalOverride: input.canonicalOverride ?? null,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.seoUpdated",
    entityType: "Product",
    entityId: productId,
    before: { metaTitle: product.metaTitle, metaDescription: product.metaDescription },
    after: { metaTitle: input.metaTitle ?? null, metaDescription: input.metaDescription ?? null },
  });
}

// ---------------------------------------------------------------------------
// Publish readiness + publish/unpublish
// ---------------------------------------------------------------------------

export type ReadinessStatus = "ok" | "missing" | "warning";
export interface PublishReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
}
export interface PublishReadiness {
  items: PublishReadinessItem[];
  allOk: boolean;
}

const SEARCH_DESCRIPTION_MIN = 50;

/** docs/09 §5.1 "Publishing": the checklist that renders instead of blocking — every item here is informational, never a hard gate ("Publish anyway" is always available). */
export async function getPublishReadiness(productId: string): Promise<PublishReadiness> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { media: { take: 1 }, specs: { take: 1 } },
  });
  if (!product) throw new NotFoundError("Product");

  const hasPhotos = product.media.length > 0;
  const hasDetails = product.specs.length > 0;
  const descriptionLength = product.metaDescription?.trim().length ?? 0;

  const items: PublishReadinessItem[] = [
    { id: "basics", label: "Name and price", status: "ok" },
    { id: "category", label: "Category", status: "ok" },
    {
      id: "photos",
      label: hasPhotos ? "Photos" : "No photos yet — customers rarely buy products without photos",
      status: hasPhotos ? "ok" : "missing",
    },
    {
      id: "details",
      label: hasDetails ? "Details filled in" : "No details filled in yet",
      status: hasDetails ? "ok" : "warning",
    },
    {
      id: "search-description",
      label:
        descriptionLength === 0
          ? "Add a search description"
          : descriptionLength < SEARCH_DESCRIPTION_MIN
            ? "Search description is a bit short"
            : "Search description",
      status: descriptionLength >= SEARCH_DESCRIPTION_MIN ? "ok" : "warning",
    },
  ];

  return { items, allOk: items.every((item) => item.status === "ok") };
}

export async function publishProduct(productId: string, actor: AuditActor): Promise<void> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product");

  await db.product.update({
    where: { id: productId },
    data: { status: ProductStatus.ACTIVE, publishedAt: product.publishedAt ?? new Date() },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.published",
    entityType: "Product",
    entityId: productId,
    before: { status: product.status },
    after: { status: "ACTIVE" },
  });
}

/** Admin label "Not published yet" — docs/09 §2.1's vocabulary table maps `Draft`/`Published` to exactly that pair; this never deletes anything. */
export async function unpublishProduct(productId: string, actor: AuditActor): Promise<void> {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product");

  await db.product.update({ where: { id: productId }, data: { status: ProductStatus.DRAFT } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.unpublished",
    entityType: "Product",
    entityId: productId,
    before: { status: product.status },
    after: { status: "DRAFT" },
  });
}

// ---------------------------------------------------------------------------
// Wizard load (resuming a draft, or editing a published product)
// ---------------------------------------------------------------------------

export interface ProductWizardData {
  id: string;
  slug: string;
  status: ProductStatus;
  variantId: string;
  basicInfo: {
    name: string;
    shortTitle: string;
    description: string;
    brandId: string;
    primaryCategoryId: string;
    additionalCategoryIds: string[];
    pricePaisa: number;
    compareAtPricePaisa: number | null;
    stockQuantity: number;
    productCode: string;
    conditionType: ConditionType;
    warrantyMonths: number | null;
    warrantyText: string | null;
  };
  photos: { mediaId: string; url: string; description: string }[];
  seo: { metaTitle: string; metaDescription: string; canonicalOverride: string };
}

export async function getProductWizardData(productId: string): Promise<ProductWizardData> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      variants: { where: { isDefault: true }, take: 1 },
      categories: true,
      media: { orderBy: { position: "asc" }, include: { media: true } },
    },
  });
  if (!product) throw new NotFoundError("Product");
  const variant = product.variants[0];
  if (!variant) throw new NotFoundError("Product option");

  const branchId = await getDefaultBranchId();
  const stockLevel = branchId
    ? await db.stockLevel.findUnique({
        where: { variantId_branchId: { variantId: variant.id, branchId } },
      })
    : null;

  return {
    id: product.id,
    slug: product.slug,
    status: product.status,
    variantId: variant.id,
    basicInfo: {
      name: product.name,
      shortTitle: product.displayTitle,
      description: extractPlainTextFromTiptap(product.description),
      brandId: product.brandId,
      primaryCategoryId: product.primaryCategoryId,
      additionalCategoryIds: product.categories
        .map((row) => row.categoryId)
        .filter((id) => id !== product.primaryCategoryId),
      pricePaisa: variant.pricePaisa,
      compareAtPricePaisa: variant.compareAtPricePaisa,
      stockQuantity: stockLevel?.quantity ?? 0,
      productCode: variant.sku,
      conditionType: product.conditionType,
      warrantyMonths: product.warrantyMonths,
      warrantyText: product.warrantyText,
    },
    photos: product.media.map((row) => ({
      mediaId: row.mediaId,
      url: row.media.url,
      description: row.media.altText ?? "",
    })),
    seo: {
      metaTitle: product.metaTitle ?? "",
      metaDescription: product.metaDescription ?? "",
      canonicalOverride: product.canonicalOverride ?? "",
    },
  };
}

/** Best-effort plain-text extraction from a Tiptap doc for re-editing — this only needs to round-trip what `saveBasicInfo`'s own `tiptapParagraph` produces (a single paragraph of plain text), not arbitrary rich-text Tiptap documents. */
function extractPlainTextFromTiptap(doc: Prisma.JsonValue): string {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "";
  const content = (doc as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    const inner = (node as { content?: unknown }).content;
    if (!Array.isArray(inner)) continue;
    for (const textNode of inner) {
      if (
        textNode &&
        typeof textNode === "object" &&
        typeof (textNode as { text?: unknown }).text === "string"
      ) {
        texts.push((textNode as { text: string }).text);
      }
    }
  }
  return texts.join("\n");
}

// ---------------------------------------------------------------------------
// Product list (docs/09 §5.2) — search, filter chips, inline price edit
// ---------------------------------------------------------------------------

export interface AdminProductListItem {
  id: string;
  slug: string;
  variantId: string;
  name: string;
  brandName: string;
  categoryName: string;
  pricePaisa: number;
  compareAtPricePaisa: number | null;
  status: ProductStatus;
  hasPhoto: boolean;
  /** The main photo's URL, or `null` — docs/09 §5.2's row spec leads with "photo", not just a has-a-photo flag. */
  photoUrl: string | null;
  stockQuantity: number;
}

export interface AdminProductListResult {
  items: AdminProductListItem[];
  total: number;
  page: number;
  perPage: number;
  hasNext: boolean;
}

const PRODUCT_LIST_PAGE_SIZE = 24;

async function getProductIdsForStockFilter(
  filter: "out-of-stock" | "low-stock",
): Promise<string[]> {
  const branchId = await getDefaultBranchId();
  if (!branchId) return [];

  const condition =
    filter === "out-of-stock"
      ? Prisma.sql`sl.quantity <= 0`
      : Prisma.sql`sl.quantity <= v.low_stock_threshold`;

  const rows = await db.$queryRaw<{ product_id: string }[]>(Prisma.sql`
    SELECT DISTINCT v.product_id
    FROM variants v
    JOIN stock_levels sl ON sl.variant_id = v.id AND sl.branch_id = ${branchId}
    WHERE v.deleted_at IS NULL AND v.is_active = true AND ${condition}
  `);
  return rows.map((row) => row.product_id);
}

export async function listProductsForAdmin(
  query: ProductListQuery,
): Promise<AdminProductListResult> {
  const where: Prisma.ProductWhereInput = {};

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: query.q, mode: "insensitive" } } } },
    ];
  }
  if (query.filter === "live") where.status = ProductStatus.ACTIVE;
  if (query.filter === "draft") where.status = ProductStatus.DRAFT;
  if (query.filter === "no-photo") where.media = { none: {} };
  if (query.filter === "on-offer")
    where.variants = { some: { compareAtPricePaisa: { not: null } } };
  if (query.filter === "out-of-stock" || query.filter === "low-stock") {
    where.id = { in: await getProductIdsForStockFilter(query.filter) };
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * PRODUCT_LIST_PAGE_SIZE,
      take: PRODUCT_LIST_PAGE_SIZE,
      include: {
        brand: { select: { name: true } },
        primaryCategory: { include: { translations: true } },
        variants: { where: { isDefault: true }, take: 1 },
        media: { take: 1, include: { media: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  const variantIds = products
    .map((product) => product.variants[0]?.id)
    .filter((id): id is string => Boolean(id));
  const stockByVariantId = await getPrimaryStockLevelsByVariantId(variantIds);

  const items: AdminProductListItem[] = products.map((product) => {
    const variant = product.variants[0];
    return {
      id: product.id,
      slug: product.slug,
      variantId: variant?.id ?? "",
      name: product.name,
      brandName: product.brand.name,
      categoryName: resolveTranslated(
        product.primaryCategory.translations,
        Locale.EN,
        "name",
        product.primaryCategory.slug,
      ),
      pricePaisa: variant?.pricePaisa ?? 0,
      compareAtPricePaisa: variant?.compareAtPricePaisa ?? null,
      status: product.status,
      hasPhoto: product.media.length > 0,
      photoUrl: product.media[0]?.media.url ?? null,
      stockQuantity: variant ? (stockByVariantId.get(variant.id)?.quantity ?? 0) : 0,
    };
  });

  return {
    items,
    total,
    page: query.page,
    perPage: PRODUCT_LIST_PAGE_SIZE,
    hasNext: query.page * PRODUCT_LIST_PAGE_SIZE < total,
  };
}

export interface QuickPriceUpdateResult {
  pricePaisa: number;
  compareAtPricePaisa: number | null;
  /** docs/09 §8: "Warn if the new price differs from the old by more than 50%." A non-blocking heads-up, not a rejected save — the caller already saved by the time this is populated. */
  warning?: string;
}

/** The product list's inline price cell (docs/09 §5.2). */
export async function quickUpdatePrice(
  variantId: string,
  pricePaisa: number,
  compareAtPricePaisa: number | undefined,
  actor: AuditActor,
): Promise<QuickPriceUpdateResult> {
  const variant = await db.variant.findUnique({ where: { id: variantId } });
  if (!variant) throw new NotFoundError("Product option");

  const previousPrice = variant.pricePaisa;
  await db.variant.update({
    where: { id: variantId },
    data: { pricePaisa, compareAtPricePaisa: compareAtPricePaisa ?? null },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.priceChanged",
    entityType: "Variant",
    entityId: variantId,
    before: { pricePaisa: previousPrice },
    after: { pricePaisa, compareAtPricePaisa: compareAtPricePaisa ?? null },
  });

  let warning: string | undefined;
  if (previousPrice > 0) {
    const changeRatio = Math.abs(pricePaisa - previousPrice) / previousPrice;
    if (changeRatio > 0.5) {
      const direction = pricePaisa > previousPrice ? "higher" : "lower";
      const percent = Math.round(changeRatio * 100);
      warning = `That's ${percent}% ${direction} than the current price. Is that right?`;
    }
  }

  return { pricePaisa, compareAtPricePaisa: compareAtPricePaisa ?? null, warning };
}
