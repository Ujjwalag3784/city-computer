/**
 * `/admin/settings/*` — docs/09-ADMIN-DAD-MODE.md §3 and docs/06 §10's
 * generic `Setting` key/value store. This file is the one place that
 * knows how to coerce a `Setting.dataType` to and from the plain string
 * an HTML form actually submits — every other admin service reads
 * settings by calling into here, never `db.setting` directly, so the
 * coercion rules can't drift between screens.
 *
 * **Shipping zones** (`DeliveryZone`/`ShippingRate`) and **gateway
 * health** are deliberately NOT `Setting` rows — they're covered by
 * `listShippingZonesForAdmin`/`updateShippingRate` below (their own real
 * models) and the static `GATEWAY_STATUS` list respectively. Payment
 * gateway *integration* itself (eSewa/Khalti/Fonepay/connectIPS) is out
 * of scope for this whole project until the very end, per every prior
 * phase's own instruction — `GATEWAY_STATUS` is read-only status display,
 * not new gateway code, and honestly reports "not connected yet" for
 * every provider rather than faking a health check against nothing.
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { SettingDataType } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";

export interface AdminSettingRow {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  dataType: SettingDataType;
  value: unknown;
}

export interface AdminSettingGroup {
  group: string;
  label: string;
  settingCount: number;
}

/** Plain-language group labels — docs/09 §2's vocabulary rules apply to group names too. */
const GROUP_LABEL: Record<string, string> = {
  contact: "Contact details",
  tax: "Tax",
  payments: "Payments",
  inventory: "Stock",
  features: "Feature switches",
};

export async function listSettingGroups(): Promise<AdminSettingGroup[]> {
  const rows = await db.setting.groupBy({ by: ["group"], _count: { _all: true } });
  return rows
    .map((row) => ({
      group: row.group,
      label: GROUP_LABEL[row.group] ?? row.group,
      settingCount: row._count._all,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function listSettingsByGroup(group: string): Promise<AdminSettingRow[]> {
  const rows = await db.setting.findMany({ where: { group }, orderBy: { label: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    helpText: row.helpText,
    dataType: row.dataType,
    value: row.value,
  }));
}

function coerceRawValue(dataType: SettingDataType, rawValue: string): Prisma.InputJsonValue {
  if (dataType === SettingDataType.BOOLEAN) {
    return rawValue === "true";
  }
  if (dataType === SettingDataType.NUMBER) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) {
      throw new ValidationError([
        { field: "rawValue", code: "invalid_number", message: "Enter a number." },
      ]);
    }
    return num;
  }
  if (dataType === SettingDataType.JSON) {
    try {
      return JSON.parse(rawValue) as Prisma.InputJsonValue;
    } catch {
      throw new ValidationError([
        {
          field: "rawValue",
          code: "invalid_json",
          message: "That doesn't look like valid data. Ask a developer for help.",
        },
      ]);
    }
  }
  return rawValue;
}

export async function updateSetting(
  key: string,
  rawValue: string,
  actor: AuditActor,
): Promise<void> {
  const before = await db.setting.findUnique({ where: { key } });
  if (!before) throw new NotFoundError("Setting");

  const value = coerceRawValue(before.dataType, rawValue);
  await db.setting.update({ where: { key }, data: { value } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "setting.updated",
    entityType: "Setting",
    entityId: before.id,
    before: { key, value: before.value },
    after: { key, value },
  });
}

// ---------------------------------------------------------------------------
// Shipping zones — real models (DeliveryZone/ShippingRate), not Setting rows.
// ---------------------------------------------------------------------------

export interface AdminShippingRate {
  id: string;
  name: string;
  basePricePaisa: number;
}

export interface AdminShippingZone {
  id: string;
  name: string;
  districts: string[];
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  rates: AdminShippingRate[];
}

export async function listShippingZonesForAdmin(): Promise<AdminShippingZone[]> {
  const zones = await db.deliveryZone.findMany({
    orderBy: { position: "asc" },
    include: { rates: { where: { isActive: true } } },
  });
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    districts: zone.districts,
    estimatedDaysMin: zone.estimatedDaysMin,
    estimatedDaysMax: zone.estimatedDaysMax,
    rates: zone.rates.map((rate) => ({
      id: rate.id,
      name: rate.name,
      basePricePaisa: rate.basePaisa,
    })),
  }));
}

export async function updateShippingRate(
  rateId: string,
  basePricePaisa: number,
  estimatedDaysMin: number,
  estimatedDaysMax: number,
  actor: AuditActor,
): Promise<void> {
  const before = await db.shippingRate.findUnique({
    where: { id: rateId },
    include: { zone: true },
  });
  if (!before) throw new NotFoundError("Shipping rate");

  await db.$transaction([
    db.shippingRate.update({ where: { id: rateId }, data: { basePaisa: basePricePaisa } }),
    db.deliveryZone.update({
      where: { id: before.zoneId },
      data: { estimatedDaysMin, estimatedDaysMax },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "shipping_rate.updated",
    entityType: "ShippingRate",
    entityId: rateId,
    before: { basePaisa: before.basePaisa },
    after: { basePaisa: basePricePaisa },
  });
}

// ---------------------------------------------------------------------------
// Gateway health — static, honest "not connected yet" status.
// ---------------------------------------------------------------------------

export interface GatewayStatus {
  name: string;
  status: "not_connected";
  helperText: string;
}

/** Every Nepali gateway docs/10-PAYMENTS-NEPAL.md names — none are integrated in this codebase yet (deferred to the end of the whole project, per every prior phase's own instruction). Cash on Delivery and Bank Transfer are the two real, working payment methods today. */
export const GATEWAY_STATUS: GatewayStatus[] = [
  { name: "eSewa", status: "not_connected", helperText: "Not connected yet." },
  { name: "Khalti", status: "not_connected", helperText: "Not connected yet." },
  { name: "Fonepay", status: "not_connected", helperText: "Not connected yet." },
  { name: "connectIPS", status: "not_connected", helperText: "Not connected yet." },
];
