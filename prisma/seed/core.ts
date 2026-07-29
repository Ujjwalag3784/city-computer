/**
 * Core seed: settings, the New Road branch + hours, roles + permissions +
 * role-permission grants, delivery zones + shipping rates.
 *
 * docs/06-DATA-MODEL.md §3 (roles/permissions table), §5 (Branch), §6
 * (DeliveryZone/ShippingRate — "Inside Kathmandu Valley" NPR 150 /
 * "Outside Valley" NPR 350), §13.3 (required seed data for a working dev
 * environment).
 *
 * Reuses the app's own `db` singleton (src/server/db.ts) rather than a
 * second ad-hoc `new PrismaClient()`. This keeps the seed script on the
 * exact same Prisma Client Extensions (soft-delete read filtering) as the
 * app — irrelevant for the plain `create`/`upsert` calls below, but it
 * means there is only ever one place in the whole codebase that
 * constructs a PrismaClient, matching the spirit of the "only server/db.ts
 * instantiates PrismaClient" rule even though prisma/seed/** sits outside
 * src/ and isn't linted by it.
 *
 * ASSUMPTION (please verify when first actually running this): `tsx`
 * resolves the `@/*` path aliases from tsconfig.json natively (tsx 4.7+
 * added tsconfig `paths` support without needing `tsconfig-paths`
 * registered separately). If `pnpm db:seed` fails to resolve `@/lib/...`
 * or `@/server/...` imports, add a `tsconfig-paths/register` import or an
 * explicit `--tsconfig` flag to the `db:seed` script in package.json.
 */
import { db } from "@/server/db";
import { rupeesToPaisa } from "@/lib/money";

export async function seedCore() {
  await seedSettings();
  const branch = await seedBranch();
  await seedRolesAndPermissions();
  await seedDeliveryZones();
  return { branch };
}

// ---------------------------------------------------------------------------
// Settings — typed key/value store, admin label "Settings".
// docs/06-DATA-MODEL.md §10: "contact, VAT rate, COD cap, payment tiers".
// ---------------------------------------------------------------------------
async function seedSettings() {
  const settings: Array<{
    key: string;
    value: unknown;
    group: string;
    label: string;
    helpText?: string;
    dataType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
    isPublic?: boolean;
  }> = [
    {
      key: "contact.phone",
      value: "+977-1-4123456",
      group: "contact",
      label: "Shop phone number",
      helpText: "Shown in the site footer and on order confirmation pages.",
      dataType: "STRING",
      isPublic: true,
    },
    {
      key: "contact.email",
      value: "support@citycomputer.com.np",
      group: "contact",
      label: "Shop email address",
      dataType: "STRING",
      isPublic: true,
    },
    {
      key: "contact.whatsapp",
      value: "+9779841000000",
      group: "contact",
      label: "WhatsApp number",
      helpText: "Used to build the wa.me deep link on order details.",
      dataType: "STRING",
      isPublic: true,
    },
    {
      key: "tax.vatRatePercent",
      value: 13,
      group: "tax",
      label: "VAT rate",
      helpText: "Nepal's standard VAT rate. Prices shown to customers already include this.",
      dataType: "NUMBER",
      isPublic: false,
    },
    {
      key: "payments.codCapPaisa",
      value: rupeesToPaisa(50_000),
      group: "payments",
      label: "Maximum order value for Cash on Delivery",
      helpText: "Orders above this amount cannot be placed as Cash on Delivery.",
      dataType: "NUMBER",
      isPublic: false,
    },
    {
      key: "payments.bankTransferTwoPersonThresholdPaisa",
      value: rupeesToPaisa(100_000),
      group: "payments",
      label: "When a second person must approve a bank transfer",
      helpText: "Bank transfer payments above this amount need an Owner to approve them too.",
      dataType: "NUMBER",
      isPublic: false,
    },
    {
      key: "inventory.defaultLowStockThreshold",
      value: 3,
      group: "inventory",
      label: 'Default "when to warn me" stock number',
      dataType: "NUMBER",
      isPublic: false,
    },
    // Phase 9 (docs/17) seeded these `isPublic: false`, since nothing read
    // them yet (no EMI UI existed at all). Phase 10 builds the public
    // `/emi-calculator` route against these same two keys, so both flip to
    // `isPublic: true` here, and `emiRates`' shape changes from a single
    // flat schedule to a per-bank tenure list — docs/17 Phase 10's own
    // deliverable is "EMI calculator with per-bank tenures from settings
    // (editable without deploy)," which a single shared schedule can't
    // represent (real Nepali bank EMI terms genuinely differ by issuer, not
    // just by tenure — docs/10-PAYMENTS-NEPAL.md §10's own bank table).
    // Figures below are illustrative starting values seeded from that
    // table; §10 itself warns "commercial terms that change without
    // notice — reconfirm before publishing any figure on the site," which
    // is exactly why they live here instead of in code.
    {
      key: "payments.emiEnabled",
      value: true,
      group: "payments",
      label: "Show the EMI calculator to customers",
      helpText: "Turns the public /emi-calculator page and its bank list on or off.",
      dataType: "BOOLEAN",
      isPublic: true,
    },
    {
      key: "payments.emiRates",
      value: [
        {
          bank: "Himalayan Bank",
          tenures: [
            { months: 12, interestRatePercent: 6.99, processingFeePercent: 0 },
            { months: 24, interestRatePercent: 6.99, processingFeePercent: 0 },
            { months: 36, interestRatePercent: 6.99, processingFeePercent: 0 },
          ],
        },
        {
          bank: "NIC Asia Bank (Insta Buy)",
          tenures: [
            { months: 3, interestRatePercent: 0, processingFeePercent: 1 },
            { months: 12, interestRatePercent: 0, processingFeePercent: 2 },
            { months: 24, interestRatePercent: 0, processingFeePercent: 3 },
          ],
        },
        {
          bank: "Siddhartha Bank",
          tenures: [
            { months: 6, interestRatePercent: 0, processingFeePercent: 1 },
            { months: 12, interestRatePercent: 0, processingFeePercent: 1 },
            { months: 18, interestRatePercent: 0, processingFeePercent: 1 },
          ],
        },
        {
          bank: "Nabil Bank",
          tenures: [
            { months: 3, interestRatePercent: 0, processingFeePercent: 0 },
            { months: 6, interestRatePercent: 0, processingFeePercent: 0 },
            { months: 9, interestRatePercent: 0, processingFeePercent: 0 },
            { months: 12, interestRatePercent: 0, processingFeePercent: 0 },
          ],
        },
      ],
      group: "payments",
      label: "Instalment plans by bank",
      helpText: "Per-bank tenures, interest, and processing fee — edit any time, no deploy needed.",
      dataType: "JSON",
      isPublic: true,
    },
    {
      key: "features.enableReviews",
      value: true,
      group: "features",
      label: "Let customers leave reviews",
      dataType: "BOOLEAN",
      isPublic: false,
    },
    {
      key: "features.enablePcBuilder",
      value: true,
      group: "features",
      label: "Show the PC Builder",
      dataType: "BOOLEAN",
      isPublic: false,
    },
    {
      key: "features.maintenanceMode",
      value: false,
      group: "features",
      label: "Maintenance mode",
      helpText: "Shows a 'we'll be back soon' page to customers instead of the website.",
      dataType: "BOOLEAN",
      isPublic: false,
    },
  ];

  for (const setting of settings) {
    await db.setting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value as never,
        group: setting.group,
        label: setting.label,
        helpText: setting.helpText,
        dataType: setting.dataType,
        isPublic: setting.isPublic ?? false,
      },
      update: {},
    });
  }
}

// ---------------------------------------------------------------------------
// Branch — seeded with New Road, Kathmandu (docs/06 §5).
// ---------------------------------------------------------------------------
async function seedBranch() {
  const branch = await db.branch.upsert({
    where: { slug: "new-road-kathmandu" },
    create: {
      slug: "new-road-kathmandu",
      name: "City Computer — New Road",
      addressLine: "Ganga Path, New Road, Kathmandu 44600",
      district: "Kathmandu",
      province: "BAGMATI",
      phone: "+977-1-4123456",
      email: "newroad@citycomputer.com.np",
      isPickupEnabled: true,
      isDefaultFulfilment: true,
      isActive: true,
      position: 0,
    },
    update: {},
  });

  // Sun-Fri 10:00-19:00, Saturday closed — Nepal's weekly holiday is
  // Saturday, not Sunday. dayOfWeek: 0 = Sunday ... 6 = Saturday
  // (matches the comment on BranchHours.dayOfWeek in inventory.prisma).
  const hours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    branchId: branch.id,
    dayOfWeek,
    openTime: dayOfWeek === 6 ? null : "10:00",
    closeTime: dayOfWeek === 6 ? null : "19:00",
    isClosed: dayOfWeek === 6,
  }));

  for (const h of hours) {
    await db.branchHours.upsert({
      where: { branchId_dayOfWeek: { branchId: h.branchId, dayOfWeek: h.dayOfWeek } },
      create: h,
      update: h,
    });
  }

  return branch;
}

// ---------------------------------------------------------------------------
// Roles & permissions — docs/06-DATA-MODEL.md §3 and docs/09 §12.
// ---------------------------------------------------------------------------

const ROLES = [
  {
    key: "OWNER",
    name: "Owner",
    description: "Can do everything, including changing settings and adding staff.",
  },
  {
    key: "MANAGER",
    name: "Manager",
    description:
      "Can manage products, orders, stock and content. Cannot change settings or add staff.",
  },
  {
    key: "STAFF",
    name: "Shop staff",
    description: "Can process orders and update stock. Cannot change prices or delete anything.",
  },
  {
    key: "CONTENT_EDITOR",
    name: "Content writer",
    description: "Can write blog posts and edit website pages. Cannot see orders or customers.",
  },
  {
    key: "SUPPORT",
    name: "Customer support",
    description:
      "Can view orders and customers and reply to messages. Cannot change anything else.",
  },
  { key: "TECHNICIAN", name: "Repair technician", description: "Can manage repair jobs only." },
  { key: "CUSTOMER", name: "Customer", description: "Storefront account — no admin access." },
] as const;

// Permission catalogue. The doc gives a handful as examples
// (product:create, order:refund, price:update, settings:write,
// user:manage, builder-rule:write, payment:approve, report:view,
// audit:view, service-ticket:write) — this is that set, extended to cover
// every module in the docs/09 §3 admin module map so every role's grants
// below have something concrete to point at.
const PERMISSIONS = [
  "product:view",
  "product:create",
  "product:update",
  "product:delete",
  "price:update",
  "category:write",
  "brand:write",
  "media:write",
  "order:view",
  "order:update",
  "order:refund",
  "order:cancel",
  "stock:update",
  "customer:view",
  "customer:update",
  "coupon:write",
  "promotion:write",
  "post:write",
  "page:write",
  "menu:write",
  "faq:write",
  "builder-part:write",
  "builder-rule:write",
  "builder-build:view",
  "service-ticket:write",
  "enquiry:reply",
  "review:moderate",
  "report:view",
  "branch:write",
  "user:manage",
  "settings:write",
  "audit:view",
  "payment:approve",
] as const;

type PermissionKey = (typeof PERMISSIONS)[number];

// docs/09 §3 module map + §12 role summaries, translated into grants.
// OWNER gets every permission (added separately below, not listed here).
const ROLE_GRANTS: Record<string, PermissionKey[]> = {
  MANAGER: [
    "product:view",
    "product:create",
    "product:update",
    "price:update",
    "category:write",
    "brand:write",
    "media:write",
    "order:view",
    "order:update",
    "order:refund",
    "order:cancel",
    "stock:update",
    "customer:view",
    "customer:update",
    "coupon:write",
    "promotion:write",
    "post:write",
    "page:write",
    "menu:write",
    "faq:write",
    "builder-build:view",
    "service-ticket:write",
    "enquiry:reply",
    "review:moderate",
    "report:view",
    "payment:approve",
    // Explicitly NOT granted: product:delete, branch:write, user:manage,
    // settings:write, audit:view, builder-rule:write — per docs/09 §12
    // ("Cannot change settings or add staff") and the module map
    // (branches/users/settings/activity are OWNER-only; build rules are
    // OWNER + TECHNICIAN only).
  ],
  STAFF: [
    "product:view",
    "order:view",
    "order:update",
    "stock:update",
    "customer:view",
    "service-ticket:write",
    // No price:update, no product:create/delete, no coupon/promotion —
    // "No price editing, no deletes" (docs/09 §12).
  ],
  CONTENT_EDITOR: ["media:write", "post:write", "page:write", "menu:write", "faq:write"],
  SUPPORT: ["order:view", "customer:view", "enquiry:reply"],
  TECHNICIAN: ["service-ticket:write", "builder-part:write", "builder-rule:write"],
  CUSTOMER: [],
};

async function seedRolesAndPermissions() {
  const roleRows = new Map<string, { id: string }>();
  for (const role of ROLES) {
    const row = await db.role.upsert({
      where: { key: role.key },
      create: { key: role.key, name: role.name, description: role.description },
      update: { name: role.name, description: role.description },
    });
    roleRows.set(role.key, row);
  }

  const permissionRows = new Map<string, { id: string }>();
  for (const key of PERMISSIONS) {
    const row = await db.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
    permissionRows.set(key, row);
  }

  async function grant(roleKey: string, permissionKeys: readonly string[]) {
    const role = roleRows.get(roleKey);
    if (!role) throw new Error(`seedRolesAndPermissions: unknown role ${roleKey}`);
    for (const permissionKey of permissionKeys) {
      const permission = permissionRows.get(permissionKey);
      if (!permission) {
        throw new Error(`seedRolesAndPermissions: unknown permission ${permissionKey}`);
      }
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  // OWNER: everything.
  await grant("OWNER", PERMISSIONS);
  for (const [roleKey, permissionKeys] of Object.entries(ROLE_GRANTS)) {
    await grant(roleKey, permissionKeys);
  }
}

// ---------------------------------------------------------------------------
// Delivery zones & shipping rates — docs/06 §6: "Inside Kathmandu Valley"
// NPR 150, "Outside Valley" NPR 350, matching the approved checkout design.
// ---------------------------------------------------------------------------
async function seedDeliveryZones() {
  const insideValley = await upsertZone({
    name: "Inside Kathmandu Valley",
    districts: ["Kathmandu", "Lalitpur", "Bhaktapur"],
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
    position: 0,
  });
  await upsertFlatRate(insideValley.id, "Standard delivery", rupeesToPaisa(150));

  // JUDGMENT CALL: the doc gives the zone names and rates but not an
  // exhaustive district list for "Outside Valley" — Nepal has 77 districts
  // total. Seeded with a representative sample of the districts with the
  // heaviest courier volume; the owner should extend this list from the
  // admin as more delivery data comes in, rather than this seed hard-coding
  // all 74 remaining districts.
  const outsideValley = await upsertZone({
    name: "Outside Valley",
    districts: [
      "Kaski", // Pokhara
      "Chitwan", // Bharatpur
      "Morang", // Biratnagar
      "Rupandehi", // Butwal
      "Kailali", // Dhangadhi
      "Sunsari", // Itahari
      "Jhapa",
      "Banke", // Nepalgunj
      "Makwanpur", // Hetauda
      "Dang",
    ],
    estimatedDaysMin: 2,
    estimatedDaysMax: 5,
    position: 1,
  });
  await upsertFlatRate(outsideValley.id, "Standard delivery", rupeesToPaisa(350));
}

async function upsertZone(input: {
  name: string;
  districts: string[];
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  position: number;
}) {
  const existing = await db.deliveryZone.findFirst({ where: { name: input.name } });
  if (existing) {
    return db.deliveryZone.update({ where: { id: existing.id }, data: input });
  }
  return db.deliveryZone.create({ data: input });
}

// No natural unique key on ShippingRate beyond its id, so find-or-create
// by (zoneId, name) rather than a Prisma `upsert` (which requires a
// unique/compound-unique `where`).
async function upsertFlatRate(zoneId: string, name: string, basePaisa: number) {
  const existing = await db.shippingRate.findFirst({ where: { zoneId, name } });
  if (existing) {
    return db.shippingRate.update({
      where: { id: existing.id },
      data: { basePaisa, type: "FLAT", isActive: true },
    });
  }
  return db.shippingRate.create({
    data: { zoneId, name, type: "FLAT", basePaisa, isActive: true },
  });
}
