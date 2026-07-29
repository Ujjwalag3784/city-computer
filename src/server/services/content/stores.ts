/**
 * Public store locator (`/stores`, `/stores/[slug]` — docs/02's route
 * table, ISR 3600s, LocalBusiness schema). Built on Phase 9's `Branch`/
 * `BranchHours` data, but as its own read path rather than reusing
 * `admin/branches.ts` directly — that file's own `AdminBranchDetail` DTO
 * intentionally omits `latitude`/`longitude`/`mapEmbedUrl`/`slug`/SEO
 * fields (fine for an internal edit screen, useless for a public map
 * page), and is scoped by internal `id`, not the public `slug`.
 */
import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";

export interface PublicBranchListItem {
  slug: string;
  name: string;
  addressLine: string;
  district: string;
  phone: string;
  isPickupEnabled: boolean;
}

export async function listActiveBranches(): Promise<PublicBranchListItem[]> {
  const branches = await db.branch.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
  });
  return branches.map((b) => ({
    slug: b.slug,
    name: b.name,
    addressLine: b.addressLine,
    district: b.district,
    phone: b.phone,
    isPickupEnabled: b.isPickupEnabled,
  }));
}

export interface PublicBranchHours {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface PublicBranchDetail {
  slug: string;
  name: string;
  addressLine: string;
  district: string;
  province: string;
  phone: string;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  mapEmbedUrl: string | null;
  isPickupEnabled: boolean;
  hours: PublicBranchHours[];
  metaTitle: string | null;
  metaDescription: string | null;
}

export async function getActiveBranchBySlug(slug: string): Promise<PublicBranchDetail> {
  const branch = await db.branch.findFirst({
    where: { slug, isActive: true },
    include: { hours: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!branch) throw new NotFoundError("Store");

  return {
    slug: branch.slug,
    name: branch.name,
    addressLine: branch.addressLine,
    district: branch.district,
    province: branch.province,
    phone: branch.phone,
    email: branch.email,
    latitude: branch.latitude,
    longitude: branch.longitude,
    mapEmbedUrl: branch.mapEmbedUrl,
    isPickupEnabled: branch.isPickupEnabled,
    hours: branch.hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: h.isClosed,
    })),
    metaTitle: branch.metaTitle,
    metaDescription: branch.metaDescription,
  };
}
