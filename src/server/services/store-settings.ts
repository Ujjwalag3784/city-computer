/**
 * The shop details the owner edits under Admin → Settings and the website
 * actually uses: contact details in the header and footer, the bank account
 * shown to bank-transfer customers, the cash-on-delivery limit, the PAN/VAT
 * number on invoices, and maintenance mode.
 *
 * Why new keys rather than the seeded `contact.*` / `payments.codCapPaisa`
 * rows: those were seeded with made-up values (+977-1-4123456, a paisa
 * amount the owner would have to divide by 100), and nothing ever read
 * them. Wiring them up as-is would have put the fake numbers on the live
 * site. The old rows are simply hidden from the Settings screen.
 *
 * Every definition here is created in the database the first time someone
 * opens Settings (`ensureStoreSettingRows`), so a database that predates
 * this file needs no migration or seed run.
 */
import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import {
  STORE_ADDRESS_LABEL,
  STORE_EMAIL,
  STORE_INVOICE_DETAILS,
  STORE_WHATSAPP_E164,
} from "@/config/store";
import { paymentConfig } from "@/config/payment";

export const STORE_SETTINGS_TAG = "store-settings";

type DataType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON";

interface StoreSettingDefinition {
  key: string;
  group: string;
  label: string;
  helpText: string;
  dataType: DataType;
  defaultValue: string | number | boolean;
}

export const STORE_SETTING_DEFINITIONS: readonly StoreSettingDefinition[] = [
  {
    key: "store.phone",
    group: "store",
    label: "Phone number",
    helpText: "Shown at the top of every page and in the footer. Include +977.",
    dataType: "STRING",
    defaultValue: STORE_WHATSAPP_E164,
  },
  {
    key: "store.whatsapp",
    group: "store",
    label: "WhatsApp number",
    helpText: "The number the green WhatsApp buttons open. Include +977.",
    dataType: "STRING",
    defaultValue: STORE_WHATSAPP_E164,
  },
  {
    key: "store.email",
    group: "store",
    label: "Email address",
    helpText: "Shown in the footer for customers to write to.",
    dataType: "STRING",
    defaultValue: STORE_EMAIL,
  },
  {
    key: "store.address",
    group: "store",
    label: "Shop address",
    helpText: "Shown in the footer and printed on invoices.",
    dataType: "STRING",
    defaultValue: STORE_ADDRESS_LABEL,
  },
  {
    key: "store.panVatNumber",
    group: "store",
    label: "PAN / VAT number",
    helpText: "Printed on invoices. While empty, invoices say “Invoice” instead of “Tax invoice”.",
    dataType: "STRING",
    defaultValue: STORE_INVOICE_DETAILS.panVatNumber,
  },
  {
    key: "bank.bankName",
    group: "bank",
    label: "Bank name",
    helpText: "Shown to customers who choose bank transfer, e.g. “Nabil Bank”.",
    dataType: "STRING",
    defaultValue: "",
  },
  {
    key: "bank.accountName",
    group: "bank",
    label: "Account name",
    helpText: "Exactly as the bank has it.",
    dataType: "STRING",
    defaultValue: "",
  },
  {
    key: "bank.accountNumber",
    group: "bank",
    label: "Account number",
    helpText: "While this is empty, customers are asked to call or WhatsApp you for bank details.",
    dataType: "STRING",
    defaultValue: "",
  },
  {
    key: "bank.branch",
    group: "bank",
    label: "Branch",
    helpText: "Optional, e.g. “New Road”.",
    dataType: "STRING",
    defaultValue: "",
  },
  {
    key: "payments.codLimitRupees",
    group: "payments",
    label: "Cash on delivery limit (Rs.)",
    helpText: "Orders above this amount must be paid by bank transfer.",
    dataType: "NUMBER",
    defaultValue: paymentConfig.codValueCapRupees,
  },
  {
    key: "features.maintenanceMode",
    group: "features",
    label: "Maintenance mode",
    helpText:
      "When on, customers see a “we'll be back soon” page. You can still use the admin and see the shop while signed in.",
    dataType: "BOOLEAN",
    defaultValue: false,
  },
];

/**
 * Settings that the website reads but that aren't in the list above
 * (they keep their seeded rows and are edited as before).
 */
const OTHER_VISIBLE_KEYS = new Set(["payments.emiEnabled", "payments.emiRates"]);

const DEFINED_KEYS = new Set(STORE_SETTING_DEFINITIONS.map((d) => d.key));

/** Whether the Settings screen should show this row. Everything else is either unused or an internal counter. */
export function isVisibleSettingKey(key: string): boolean {
  return DEFINED_KEYS.has(key) || OTHER_VISIBLE_KEYS.has(key);
}

/** Creates any missing rows with their defaults. Never overwrites a value the owner has set. */
export async function ensureStoreSettingRows(): Promise<void> {
  await db.setting.createMany({
    data: STORE_SETTING_DEFINITIONS.map((d) => ({
      key: d.key,
      group: d.group,
      label: d.label,
      helpText: d.helpText,
      dataType: d.dataType,
      value: d.defaultValue,
      isPublic: d.group !== "features",
    })),
    skipDuplicates: true,
  });
  // A row that already existed (e.g. `features.maintenanceMode` from the
  // seed) keeps its value but gets the current label and help text.
  await Promise.all(
    STORE_SETTING_DEFINITIONS.map((d) =>
      db.setting.updateMany({
        where: { key: d.key, OR: [{ label: { not: d.label } }, { helpText: { not: d.helpText } }] },
        data: { label: d.label, helpText: d.helpText, group: d.group },
      }),
    ),
  );
}

export interface BankAccountDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
}

export interface StoreSettings {
  phoneE164: string;
  whatsappE164: string;
  email: string;
  address: string;
  panVatNumber: string;
  /** `null` until the owner has filled in at least the account number. */
  bankAccount: BankAccountDetails | null;
  codLimitRupees: number;
  maintenanceMode: boolean;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function defaultFor(key: string): string | number | boolean {
  return STORE_SETTING_DEFINITIONS.find((d) => d.key === key)?.defaultValue ?? "";
}

async function loadStoreSettings(): Promise<StoreSettings> {
  let values = new Map<string, unknown>();
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: [...DEFINED_KEYS] } },
      select: { key: true, value: true },
    });
    values = new Map(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    // The shop must still render if this one query fails; defaults are the
    // same values the site showed before these settings existed.
    logger.error({ error }, "store-settings: failed to read settings, using defaults");
  }

  const str = (key: string) => asString(values.get(key), String(defaultFor(key)));
  const bankAccountNumber = asString(values.get("bank.accountNumber"), "");

  return {
    phoneE164: str("store.phone"),
    whatsappE164: str("store.whatsapp"),
    email: str("store.email"),
    address: str("store.address"),
    panVatNumber: asString(values.get("store.panVatNumber"), ""),
    bankAccount: bankAccountNumber
      ? {
          bankName: asString(values.get("bank.bankName"), ""),
          accountName: asString(values.get("bank.accountName"), ""),
          accountNumber: bankAccountNumber,
          branch: asString(values.get("bank.branch"), ""),
        }
      : null,
    codLimitRupees: asNumber(
      values.get("payments.codLimitRupees"),
      paymentConfig.codValueCapRupees,
    ),
    maintenanceMode: values.get("features.maintenanceMode") === true,
  };
}

const loadStoreSettingsCached = unstable_cache(loadStoreSettings, ["store-settings-v1"], {
  tags: [STORE_SETTINGS_TAG],
  revalidate: 300,
});

/**
 * The current shop settings. Cached across requests (tag
 * `STORE_SETTINGS_TAG`, revalidated whenever a setting is saved) and
 * de-duplicated within one request.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  try {
    return await loadStoreSettingsCached();
  } catch {
    // `unstable_cache` is unavailable outside a Next request (scripts, tests).
    return loadStoreSettings();
  }
});

/** "wa.me" link for a +977 number. */
export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/[^\d]/g, "")}`;
}
