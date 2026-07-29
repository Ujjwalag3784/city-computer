/**
 * Taxonomy seed: category tree, brands, and all 15 spec templates with
 * their spec fields.
 *
 * docs/06-DATA-MODEL.md §4 (Category/Brand/SpecTemplate/SpecField), §13.3
 * (seed requirements), docs/09-ADMIN-DAD-MODE.md §5 (per-category field
 * lists for 13 of the 15 templates — Projector is not itemised there; see
 * the judgment-call comment near its definition below).
 */
import { db } from "@/server/db/seed-client";
import { slugify } from "@/lib/slug";
import type { Prisma } from "@/generated/prisma/client";

export async function seedTaxonomy() {
  const categoriesBySlug = await seedCategories();
  await seedBrands();
  await seedSpecTemplates(categoriesBySlug);
  return { categoriesBySlug };
}

// ---------------------------------------------------------------------------
// Category tree
// ---------------------------------------------------------------------------

interface CategoryInput {
  name: string;
  showInFooter?: boolean;
  children?: CategoryInput[];
}

// A real, sensible tree for a Nepali computer retailer. "Webcams" lives
// under Peripherals (fixing the audit defect where the legacy site filed
// it under Motherboards), and CCTV gets its own top-level entry (the
// legacy site had no CCTV nav item at all).
const CATEGORY_TREE: CategoryInput[] = [
  { name: "Laptops", showInFooter: true },
  { name: "Desktops & Prebuilts", showInFooter: true },
  {
    name: "Components",
    showInFooter: true,
    children: [
      { name: "Processors" },
      { name: "Graphics Cards" },
      { name: "Motherboards" },
      { name: "Memory" },
      { name: "Storage" },
      { name: "Power Supplies" },
      { name: "Cases" },
      { name: "Cooling" },
    ],
  },
  { name: "Monitors", showInFooter: true },
  {
    name: "Peripherals",
    showInFooter: true,
    children: [{ name: "Keyboards" }, { name: "Mice" }, { name: "Headsets" }, { name: "Webcams" }],
  },
  { name: "Networking", showInFooter: false },
  { name: "Printers", showInFooter: false },
  { name: "CCTV & Security", showInFooter: true },
  { name: "Accessories", showInFooter: false },
  { name: "Apple & Mac", showInFooter: true },
];

type CategoryRow = { id: string; slug: string; path: string; depth: number };

async function seedCategories(): Promise<Map<string, CategoryRow>> {
  const bySlug = new Map<string, CategoryRow>();

  async function seedLevel(items: CategoryInput[], parent: CategoryRow | null) {
    for (const [index, item] of items.entries()) {
      const slug = slugify(item.name);
      const path = parent ? `${parent.path}/${slug}` : slug;
      const depth = parent ? parent.depth + 1 : 0;

      const existing = await db.category.findUnique({ where: { slug } });
      const category = existing
        ? await db.category.update({
            where: { slug },
            data: {
              parentId: parent?.id ?? null,
              path,
              depth,
              position: index,
              showInFooter: item.showInFooter ?? false,
            },
          })
        : await db.category.create({
            data: {
              slug,
              parentId: parent?.id ?? null,
              path,
              depth,
              position: index,
              isActive: true,
              showInNav: true,
              showInFooter: item.showInFooter ?? false,
            },
          });

      await db.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale: "EN" } },
        create: { categoryId: category.id, locale: "EN", name: item.name },
        update: { name: item.name },
      });

      const row: CategoryRow = { id: category.id, slug, path, depth };
      bySlug.set(slug, row);

      if (item.children?.length) {
        await seedLevel(item.children, row);
      }
    }
  }

  await seedLevel(CATEGORY_TREE, null);
  return bySlug;
}

// ---------------------------------------------------------------------------
// Brands — real, relevant brands for a Nepali PC/electronics retailer.
// ---------------------------------------------------------------------------
const BRANDS = [
  "HP",
  "Dell",
  "Lenovo",
  "Asus",
  "Acer",
  "Apple",
  "MSI",
  "Intel",
  "AMD",
  "NVIDIA",
  "Corsair",
  "Logitech",
  "Samsung",
  "WD",
  "Seagate",
  "Kingston",
];

async function seedBrands() {
  for (const name of BRANDS) {
    const slug = slugify(name);
    const brand = await db.brand.upsert({
      where: { slug },
      create: { slug, name, isActive: true },
      update: { name },
    });
    await db.brandTranslation.upsert({
      where: { brandId_locale: { brandId: brand.id, locale: "EN" } },
      create: { brandId: brand.id, locale: "EN", name },
      update: { name },
    });
  }
}

// ---------------------------------------------------------------------------
// Spec templates + fields — docs/09 §5 field lists, 13 of 15 templates.
// ---------------------------------------------------------------------------

type FieldInput = Omit<Prisma.SpecFieldCreateInput, "template" | "position"> & {
  position?: number;
};

interface TemplateInput {
  name: string;
  /// slug of the category this template is authored for (its "home"
  /// category) — see the comment on SpecTemplate.categoryId in
  /// catalog.prisma for why this is optional/loose rather than a strict
  /// 1:1.
  homeCategorySlug?: string;
  fields: FieldInput[];
}

function field(
  key: string,
  label: string,
  dataType: Prisma.SpecFieldCreateInput["dataType"],
  extra: Partial<FieldInput> = {},
): FieldInput {
  return { key, label, dataType, isFilterable: true, isComparable: true, options: [], ...extra };
}

const TEMPLATES: TemplateInput[] = [
  {
    name: "Laptop",
    homeCategorySlug: "laptops",
    fields: [
      field("processor", "Processor", "TEXT", { group: "Performance" }),
      field("ram_gb", "RAM", "NUMBER", { unit: "GB", group: "Performance" }),
      field("storage", "Storage", "TEXT", { group: "Performance" }),
      field("screen_size_in", "Display size", "NUMBER", { unit: "inch", group: "Display" }),
      field("screen_resolution", "Display resolution", "TEXT", { group: "Display" }),
      field("graphics", "Graphics", "TEXT", { group: "Performance" }),
      field("battery", "Battery", "TEXT", { group: "Other", isFilterable: false }),
      field("weight_kg", "Weight", "NUMBER", { unit: "kg", group: "Other" }),
      field("operating_system", "Operating system", "SELECT", {
        options: ["Windows 11 Home", "Windows 11 Pro", "No OS", "macOS", "Linux"],
        group: "Other",
      }),
      field("ports", "Ports", "TEXT", { group: "Other", isFilterable: false }),
      field("warranty", "Warranty", "TEXT", {
        group: "Other",
        isFilterable: false,
        isComparable: false,
      }),
    ],
  },
  {
    name: "Desktop/Prebuilt",
    homeCategorySlug: "desktops-prebuilts",
    fields: [
      field("processor", "Processor", "TEXT", { group: "Performance" }),
      field("graphics", "Graphics", "TEXT", { group: "Performance" }),
      field("motherboard", "Motherboard", "TEXT", { group: "Performance", isFilterable: false }),
      field("ram_gb", "RAM", "NUMBER", { unit: "GB", group: "Performance" }),
      field("storage", "Storage", "TEXT", { group: "Performance" }),
      field("power_supply", "Power supply", "TEXT", { group: "Other", isFilterable: false }),
      field("case", "Case", "TEXT", { group: "Other", isFilterable: false }),
      field("cooling", "Cooling", "TEXT", { group: "Other", isFilterable: false }),
      field("operating_system", "Operating system", "SELECT", {
        options: ["Windows 11 Home", "Windows 11 Pro", "No OS"],
        group: "Other",
      }),
    ],
  },
  {
    name: "Monitor",
    homeCategorySlug: "monitors",
    fields: [
      field("screen_size_in", "Screen size", "NUMBER", { unit: "inch", group: "Display" }),
      field("resolution", "Resolution", "SELECT", {
        options: ["1920x1080", "2560x1440", "3840x2160"],
        group: "Display",
      }),
      field("panel_type", "Panel type", "SELECT", {
        options: ["IPS", "VA", "OLED", "TN"],
        group: "Display",
      }),
      field("refresh_rate_hz", "Refresh rate", "NUMBER", { unit: "Hz", group: "Display" }),
      field("response_time_ms", "Response time", "NUMBER", {
        unit: "ms",
        group: "Display",
        isFilterable: false,
      }),
      field("ports", "Ports", "TEXT", { group: "Other", isFilterable: false }),
      field("adaptive_sync", "Adaptive sync", "SELECT", {
        options: ["None", "FreeSync", "G-Sync"],
        group: "Display",
      }),
      field("curved", "Curved", "BOOL", { group: "Display" }),
    ],
  },
  {
    name: "CPU",
    homeCategorySlug: "processors",
    fields: [
      field("socket", "Socket", "SELECT", {
        options: ["LGA1700", "AM5", "AM4", "LGA1200"],
        group: "Compatibility",
      }),
      field("cores", "Cores", "NUMBER", { group: "Performance" }),
      field("threads", "Threads", "NUMBER", { group: "Performance" }),
      field("base_clock_ghz", "Base speed", "NUMBER", { unit: "GHz", group: "Performance" }),
      field("boost_clock_ghz", "Boost speed", "NUMBER", { unit: "GHz", group: "Performance" }),
      field("tdp_watts", "Power draw", "NUMBER", { unit: "W", group: "Power" }),
      field("integrated_graphics", "Integrated graphics", "BOOL", { group: "Performance" }),
      field("cooler_included", "Cooler included", "BOOL", { group: "Other" }),
    ],
  },
  {
    name: "GPU",
    homeCategorySlug: "graphics-cards",
    fields: [
      field("chipset", "Chipset", "TEXT", { group: "Performance" }),
      field("memory_gb", "Memory", "NUMBER", { unit: "GB", group: "Performance" }),
      field("memory_type", "Memory type", "SELECT", {
        options: ["GDDR6", "GDDR6X"],
        group: "Performance",
      }),
      field("length_mm", "Length", "NUMBER", { unit: "mm", group: "Fit" }),
      field("power_connectors", "Power connectors", "TEXT", {
        group: "Power",
        isFilterable: false,
      }),
      field("recommended_psu_watts", "Recommended power supply", "NUMBER", {
        unit: "W",
        group: "Power",
      }),
      field("outputs", "Outputs", "TEXT", { group: "Other", isFilterable: false }),
    ],
  },
  {
    name: "Motherboard",
    homeCategorySlug: "motherboards",
    fields: [
      field("socket", "Socket", "SELECT", {
        options: ["LGA1700", "AM5", "AM4", "LGA1200"],
        group: "Compatibility",
      }),
      field("chipset", "Chipset", "TEXT", { group: "Compatibility" }),
      field("form_factor", "Size", "SELECT", {
        options: ["ATX", "Micro-ATX", "Mini-ITX"],
        group: "Fit",
      }),
      field("memory_type", "Memory type", "SELECT", {
        options: ["DDR4", "DDR5"],
        group: "Compatibility",
      }),
      field("memory_slots", "Memory slots", "NUMBER", { group: "Compatibility" }),
      field("m2_slots", "M.2 slots", "NUMBER", { group: "Storage" }),
      field("sata_ports", "SATA ports", "NUMBER", { group: "Storage" }),
      field("wifi", "Wi-Fi", "BOOL", { group: "Other" }),
    ],
  },
  {
    name: "RAM",
    homeCategorySlug: "memory",
    fields: [
      field("memory_type", "Type", "SELECT", { options: ["DDR4", "DDR5"], group: "Compatibility" }),
      field("speed_mhz", "Speed", "NUMBER", { unit: "MHz", group: "Performance" }),
      field("capacity_gb", "Capacity", "NUMBER", { unit: "GB", group: "Performance" }),
      field("stick_count", "Number of sticks", "NUMBER", { group: "Other" }),
      field("latency", "Latency", "TEXT", { group: "Performance", isFilterable: false }),
      field("height_mm", "Height", "NUMBER", { unit: "mm", group: "Fit", isFilterable: false }),
    ],
  },
  {
    name: "Storage",
    homeCategorySlug: "storage",
    fields: [
      field("storage_type", "Type", "SELECT", {
        options: ["NVMe SSD", "SATA SSD", "HDD"],
        group: "Performance",
      }),
      field("capacity_gb", "Capacity", "NUMBER", { unit: "GB", group: "Performance" }),
      field("interface", "Interface", "SELECT", {
        options: ["PCIe 3.0", "PCIe 4.0", "SATA III"],
        group: "Performance",
      }),
      field("read_speed_mbps", "Read speed", "NUMBER", { unit: "MB/s", group: "Performance" }),
      field("write_speed_mbps", "Write speed", "NUMBER", { unit: "MB/s", group: "Performance" }),
      field("form_factor", "Form factor", "SELECT", {
        options: ["M.2 2280", "2.5-inch", "3.5-inch"],
        group: "Fit",
      }),
    ],
  },
  {
    name: "PSU",
    homeCategorySlug: "power-supplies",
    fields: [
      field("wattage", "Wattage", "NUMBER", { unit: "W", group: "Power" }),
      field("efficiency_rating", "Efficiency rating", "SELECT", {
        options: ["80+ Bronze", "80+ Gold", "80+ Platinum", "80+ Titanium"],
        group: "Power",
      }),
      field("modular", "Modular", "SELECT", {
        options: ["Non-modular", "Semi-modular", "Full-modular"],
        group: "Other",
      }),
      field("form_factor", "Size", "SELECT", { options: ["ATX", "SFX"], group: "Fit" }),
      field("connectors", "Connectors", "TEXT", { group: "Power", isFilterable: false }),
    ],
  },
  {
    name: "Cooler",
    homeCategorySlug: "cooling",
    fields: [
      field("cooler_type", "Type", "SELECT", {
        options: ["Air", "AIO Liquid"],
        group: "Performance",
      }),
      field("supported_sockets", "Supported sockets", "TEXT", {
        group: "Compatibility",
        isFilterable: false,
      }),
      field("height_mm", "Height", "NUMBER", { unit: "mm", group: "Fit" }),
      field("radiator_size_mm", "Radiator size", "NUMBER", { unit: "mm", group: "Fit" }),
      field("fan_count", "Fan count", "NUMBER", { group: "Other" }),
    ],
  },
  {
    name: "Case",
    homeCategorySlug: "cases",
    fields: [
      field("form_factor", "Size", "SELECT", {
        options: ["Full Tower", "Mid Tower", "Mini Tower", "SFF"],
        group: "Fit",
      }),
      field("supported_motherboard_sizes", "Motherboard sizes supported", "TEXT", {
        group: "Compatibility",
        isFilterable: false,
      }),
      field("max_gpu_length_mm", "Max graphics card length", "NUMBER", {
        unit: "mm",
        group: "Fit",
      }),
      field("max_cooler_height_mm", "Max cooler height", "NUMBER", { unit: "mm", group: "Fit" }),
      field("radiator_support", "Radiator support", "TEXT", { group: "Fit", isFilterable: false }),
      field("drive_bays", "Drive bays", "TEXT", { group: "Storage", isFilterable: false }),
      field("front_ports", "Front ports", "TEXT", { group: "Other", isFilterable: false }),
    ],
  },
  {
    name: "Printer",
    homeCategorySlug: "printers",
    fields: [
      field("printer_type", "Type", "SELECT", {
        options: ["Inkjet", "Laser", "Ink Tank"],
        group: "Performance",
      }),
      field("print_speed_ppm", "Print speed", "NUMBER", { unit: "ppm", group: "Performance" }),
      field("resolution", "Resolution", "TEXT", { group: "Performance", isFilterable: false }),
      field("connectivity", "Connectivity", "TEXT", { group: "Other" }),
      field("duplex", "Duplex", "BOOL", { group: "Other" }),
      field("paper_sizes", "Paper sizes", "TEXT", { group: "Other", isFilterable: false }),
    ],
  },
  // JUDGMENT CALL: docs/09 §5 does not itemise a field list for
  // "Projector" (it is only named in docs/06 §4's seeded-template list).
  // Fields below are this project's best-effort first pass for a
  // computer-retail projector listing; revisit with the owner before
  // relying on these for real merchandising.
  {
    name: "Projector",
    fields: [
      field("resolution", "Resolution", "SELECT", {
        options: ["HD", "Full HD", "4K"],
        group: "Display",
      }),
      field("brightness_lumens", "Brightness", "NUMBER", { unit: "lumens", group: "Display" }),
      field("throw_type", "Throw type", "SELECT", {
        options: ["Standard", "Short throw", "Ultra short throw"],
        group: "Display",
      }),
      field("connectivity", "Connectivity", "TEXT", { group: "Other", isFilterable: false }),
      field("lamp_life_hours", "Lamp life", "NUMBER", {
        unit: "hours",
        group: "Other",
        isFilterable: false,
      }),
    ],
  },
  {
    name: "CCTV",
    homeCategorySlug: "cctv-security",
    fields: [
      field("resolution", "Resolution", "SELECT", {
        options: ["1080p", "2K", "4K"],
        group: "Performance",
      }),
      field("night_vision", "Night vision", "BOOL", { group: "Performance" }),
      field("placement", "Indoor/outdoor", "SELECT", {
        options: ["Indoor", "Outdoor", "Indoor & Outdoor"],
        group: "Other",
      }),
      field("connectivity", "Connectivity", "SELECT", {
        options: ["Wired", "Wi-Fi"],
        group: "Other",
      }),
      field("storage", "Storage", "TEXT", { group: "Other", isFilterable: false }),
    ],
  },
  {
    name: "Accessory",
    homeCategorySlug: "accessories",
    fields: [
      field("accessory_type", "Type", "TEXT", { group: "Other" }),
      field("connectivity", "Connectivity", "SELECT", {
        options: ["Wired", "Bluetooth", "2.4GHz Wireless"],
        group: "Other",
      }),
      field("compatibility", "Compatibility", "TEXT", { group: "Other", isFilterable: false }),
      field("colour", "Colour", "TEXT", { group: "Other" }),
    ],
  },
];

async function seedSpecTemplates(categoriesBySlug: Map<string, CategoryRow>) {
  for (const template of TEMPLATES) {
    const homeCategory = template.homeCategorySlug
      ? categoriesBySlug.get(template.homeCategorySlug)
      : undefined;

    const existing = await db.specTemplate.findFirst({ where: { name: template.name } });
    const row = existing
      ? await db.specTemplate.update({
          where: { id: existing.id },
          data: { categoryId: homeCategory?.id ?? null },
        })
      : await db.specTemplate.create({
          data: { name: template.name, categoryId: homeCategory?.id ?? null },
        });

    if (homeCategory) {
      await db.category.update({
        where: { id: homeCategory.id },
        data: { specTemplateId: row.id },
      });
    }

    for (const [index, f] of template.fields.entries()) {
      await db.specField.upsert({
        where: { templateId_key: { templateId: row.id, key: f.key as string } },
        create: { ...f, templateId: row.id, position: index },
        update: { ...f, position: index },
      });
    }
  }
}
