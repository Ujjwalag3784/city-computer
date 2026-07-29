/**
 * `/admin/menus` — CRUD over `Menu`/`MenuItem` plus the "broken-link
 * check" docs/17 Phase 10 names as this deliverable's own acceptance bar
 * ("a nightly job flags broken links"). There is no scheduled-job runner
 * anywhere in this codebase yet (the same honest gap `PROGRESS.md` already
 * flags for the low-stock email and the bank-transfer 48h expiry sweep) —
 * `checkMenuLinks` is a real, on-demand check triggered by an admin button
 * rather than an actual nightly cron. It genuinely walks every `MenuItem`
 * and reports which ones resolve, which is the acceptance bar's substance;
 * only the "runs automatically every night" scheduling part is deferred.
 */
import "server-only";
import { db } from "@/server/db";
import { MenuKey, PostStatus } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { MenuItemFormInput } from "@/lib/validation/admin/menus";

export interface AdminMenuItem {
  id: string;
  label: string;
  targetType: "category" | "brand" | "page" | "url";
  targetLabel: string;
  isActive: boolean;
  position: number;
}

export interface AdminMenu {
  key: MenuKey;
  name: string;
  items: AdminMenuItem[];
}

function resolveTargetType(item: {
  categoryId: string | null;
  brandId: string | null;
  pageId: string | null;
  url: string | null;
}): "category" | "brand" | "page" | "url" {
  if (item.categoryId) return "category";
  if (item.brandId) return "brand";
  if (item.pageId) return "page";
  return "url";
}

export async function listMenusForAdmin(): Promise<AdminMenu[]> {
  const menus = await db.menu.findMany({
    orderBy: { key: "asc" },
    include: {
      items: {
        where: { parentId: null },
        orderBy: { position: "asc" },
        include: {
          // `Category` has no direct `name` column — display name lives on
          // `CategoryTranslation` (docs/06 §4's locale-fallback pattern).
          // The admin editor shows the category's own `slug` instead of
          // resolving a translated name, same "keep the admin's own
          // internal-facing labels simple" call `admin/blog.ts`'s
          // comma-separated-slugs picker already makes elsewhere.
          category: { select: { slug: true } },
          brand: { select: { name: true } },
          page: { select: { title: true } },
        },
      },
    },
  });

  return menus.map((menu) => ({
    key: menu.key,
    name: menu.name,
    items: menu.items.map((item) => ({
      id: item.id,
      label: item.label,
      targetType: resolveTargetType(item),
      targetLabel:
        item.category?.slug ?? item.brand?.name ?? item.page?.title ?? item.url ?? "(nothing set)",
      isActive: item.isActive,
      position: item.position,
    })),
  }));
}

async function resolveTargetIds(input: MenuItemFormInput): Promise<{
  categoryId: string | null;
  brandId: string | null;
  pageId: string | null;
  url: string | null;
}> {
  if (input.targetType === "category") {
    const category = await db.category.findUnique({ where: { slug: input.categorySlug ?? "" } });
    if (!category) {
      throw new ValidationError([
        { field: "categorySlug", code: "not_found", message: "Category not found." },
      ]);
    }
    return { categoryId: category.id, brandId: null, pageId: null, url: null };
  }
  if (input.targetType === "brand") {
    const brand = await db.brand.findUnique({ where: { slug: input.brandSlug ?? "" } });
    if (!brand) {
      throw new ValidationError([
        { field: "brandSlug", code: "not_found", message: "Brand not found." },
      ]);
    }
    return { categoryId: null, brandId: brand.id, pageId: null, url: null };
  }
  if (input.targetType === "page") {
    const page = await db.page.findUnique({ where: { slug: input.pageSlug ?? "" } });
    if (!page) {
      throw new ValidationError([
        { field: "pageSlug", code: "not_found", message: "Page not found." },
      ]);
    }
    return { categoryId: null, brandId: null, pageId: page.id, url: null };
  }
  return { categoryId: null, brandId: null, pageId: null, url: input.url ?? null };
}

export async function createMenuItem(
  input: MenuItemFormInput,
  actor: AuditActor,
): Promise<{ id: string }> {
  const menu = await db.menu.findUnique({ where: { key: input.menuKey } });
  if (!menu) throw new NotFoundError("Menu");

  const targets = await resolveTargetIds(input);
  const maxPosition = await db.menuItem.aggregate({
    where: { menuId: menu.id, parentId: null },
    _max: { position: true },
  });

  const item = await db.menuItem.create({
    data: {
      menuId: menu.id,
      label: input.label.trim(),
      isActive: input.isActive,
      position: (maxPosition._max.position ?? -1) + 1,
      ...targets,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "menu_item.created",
    entityType: "MenuItem",
    entityId: item.id,
    after: { menuKey: input.menuKey, label: item.label },
  });

  return { id: item.id };
}

export async function updateMenuItem(
  itemId: string,
  input: MenuItemFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!before) throw new NotFoundError("Menu item");

  const targets = await resolveTargetIds(input);

  await db.menuItem.update({
    where: { id: itemId },
    data: {
      label: input.label.trim(),
      isActive: input.isActive,
      ...targets,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "menu_item.updated",
    entityType: "MenuItem",
    entityId: itemId,
    before: { label: before.label },
    after: { label: input.label },
  });
}

export async function deleteMenuItem(itemId: string, actor: AuditActor): Promise<void> {
  const before = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!before) throw new NotFoundError("Menu item");

  await db.menuItem.delete({ where: { id: itemId } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "menu_item.deleted",
    entityType: "MenuItem",
    entityId: itemId,
    before: { label: before.label },
  });
}

/** Swaps this item's position with its immediate neighbour — a simpler, deliberately non-drag-and-drop reorder control (see this file's own module doc comment precedent for "a picker/richer control is coming later" simplifications elsewhere in this codebase). */
export async function moveMenuItem(
  itemId: string,
  direction: "up" | "down",
  actor: AuditActor,
): Promise<void> {
  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item) throw new NotFoundError("Menu item");

  const neighbour = await db.menuItem.findFirst({
    where: {
      menuId: item.menuId,
      parentId: item.parentId,
      position: direction === "up" ? { lt: item.position } : { gt: item.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;

  await db.$transaction([
    db.menuItem.update({ where: { id: item.id }, data: { position: neighbour.position } }),
    db.menuItem.update({ where: { id: neighbour.id }, data: { position: item.position } }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "menu_item.reordered",
    entityType: "MenuItem",
    entityId: itemId,
    before: { position: item.position },
    after: { position: neighbour.position },
  });
}

// ---------------------------------------------------------------------------
// Broken-link checker
// ---------------------------------------------------------------------------

export interface MenuLinkCheckResult {
  itemId: string;
  menuKey: MenuKey;
  label: string;
  status: "ok" | "broken" | "unknown";
  reason: string;
}

/** Internal route prefixes this app genuinely serves, whose destination is verified against real data rather than assumed. */
async function checkInternalUrl(
  url: string,
): Promise<{ status: "ok" | "broken" | "unknown"; reason: string }> {
  const staticRoutes = new Set([
    "/",
    "/build",
    "/service",
    "/stores",
    "/emi-calculator",
    "/contact",
    "/cart",
    "/checkout",
    "/search",
    "/blog",
  ]);
  if (staticRoutes.has(url)) return { status: "ok", reason: "Known page." };

  const pageMatch = /^\/pages\/([a-z0-9-]+)$/.exec(url);
  if (pageMatch) {
    const page = await db.page.findFirst({
      where: { slug: pageMatch[1], status: PostStatus.PUBLISHED, deletedAt: null },
    });
    return page
      ? { status: "ok", reason: "Page exists and is published." }
      : { status: "broken", reason: `No published page at slug "${pageMatch[1]}".` };
  }

  const categoryMatch = /^\/c\/([a-z0-9-/]+)$/.exec(url);
  if (categoryMatch) {
    const category = await db.category.findFirst({ where: { path: categoryMatch[1] } });
    return category
      ? { status: "ok", reason: "Category exists." }
      : { status: "broken", reason: `No category at path "${categoryMatch[1]}".` };
  }

  const brandMatch = /^\/b\/([a-z0-9-]+)$/.exec(url);
  if (brandMatch) {
    const brand = await db.brand.findUnique({ where: { slug: brandMatch[1] } });
    return brand
      ? { status: "ok", reason: "Brand exists." }
      : { status: "broken", reason: `No brand at slug "${brandMatch[1]}".` };
  }

  const productMatch = /^\/p\/([a-z0-9-]+)$/.exec(url);
  if (productMatch) {
    const product = await db.product.findUnique({ where: { slug: productMatch[1] } });
    return product
      ? { status: "ok", reason: "Product exists." }
      : { status: "broken", reason: `No product at slug "${productMatch[1]}".` };
  }

  const blogMatch = /^\/blog\/([a-z0-9-]+)$/.exec(url);
  if (blogMatch) {
    const post = await db.post.findFirst({
      where: { slug: blogMatch[1], status: PostStatus.PUBLISHED, deletedAt: null },
    });
    return post
      ? { status: "ok", reason: "Post exists and is published." }
      : { status: "broken", reason: `No published post at slug "${blogMatch[1]}".` };
  }

  return { status: "unknown", reason: "Not a recognised internal route pattern — check by hand." };
}

/** External (`http(s)://`) URLs are given a short-timeout HEAD request. A network failure reports "unknown", not "broken" — this sandbox's own outbound network is sometimes restricted (see PROGRESS.md's Google Fonts note), and a false "broken" report from that would be worse than an honest "couldn't check." */
async function checkExternalUrl(
  url: string,
): Promise<{ status: "ok" | "broken" | "unknown"; reason: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (response.ok) return { status: "ok", reason: `Responded ${response.status}.` };
    return { status: "broken", reason: `Responded ${response.status}.` };
  } catch {
    return {
      status: "unknown",
      reason: "Couldn't reach this URL from the server — check by hand.",
    };
  }
}

/**
 * Walks every `MenuItem` across all four menus. An item linked to a real
 * entity (`categoryId`/`brandId`/`pageId`) is checked against that same
 * entity still existing and (for pages) still published — this is the
 * common case docs/06's own comment on `MenuItem` names as the actual bug
 * being fixed ("footer 'Webcams' pointing at motherboards"). An item using
 * the raw `url` escape hatch is checked by pattern (internal) or a live
 * HEAD request (external).
 */
export async function checkMenuLinks(): Promise<MenuLinkCheckResult[]> {
  const items = await db.menuItem.findMany({
    include: {
      menu: { select: { key: true } },
      category: { select: { id: true, isActive: true } },
      brand: { select: { id: true } },
      page: { select: { id: true, status: true, deletedAt: true } },
    },
  });

  const results: MenuLinkCheckResult[] = [];
  for (const item of items) {
    if (item.categoryId) {
      results.push({
        itemId: item.id,
        menuKey: item.menu.key,
        label: item.label,
        status: item.category && item.category.isActive ? "ok" : "broken",
        reason: item.category
          ? item.category.isActive
            ? "Category exists and is live."
            : "Category exists but is turned off."
          : "Category no longer exists.",
      });
      continue;
    }
    if (item.brandId) {
      results.push({
        itemId: item.id,
        menuKey: item.menu.key,
        label: item.label,
        status: item.brand ? "ok" : "broken",
        reason: item.brand ? "Brand exists." : "Brand no longer exists.",
      });
      continue;
    }
    if (item.pageId) {
      const ok = Boolean(
        item.page && !item.page.deletedAt && item.page.status === PostStatus.PUBLISHED,
      );
      results.push({
        itemId: item.id,
        menuKey: item.menu.key,
        label: item.label,
        status: ok ? "ok" : "broken",
        reason: ok ? "Page exists and is published." : "Page no longer exists, or isn't published.",
      });
      continue;
    }
    if (item.url) {
      const check =
        item.url.startsWith("http://") || item.url.startsWith("https://")
          ? await checkExternalUrl(item.url)
          : await checkInternalUrl(item.url);
      results.push({ itemId: item.id, menuKey: item.menu.key, label: item.label, ...check });
      continue;
    }
    results.push({
      itemId: item.id,
      menuKey: item.menu.key,
      label: item.label,
      status: "broken",
      reason: "This menu item has nothing to link to.",
    });
  }

  return results;
}
