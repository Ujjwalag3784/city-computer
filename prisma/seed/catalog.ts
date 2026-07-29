/**
 * DEV-ONLY SEED DATA — reduced from the blueprint's suggested 20 products
 * (docs/06-DATA-MODEL.md §13.3) to 10 to keep this initial seed reviewable.
 * Extend before Phase 4 QA.
 *
 * Each product gets: a translation-free EN-only base record (no
 * ProductTranslation rows seeded yet — see the judgment-call note below),
 * one default Variant with a real paisa price, one placeholder Media +
 * ProductMedia, and a handful of ProductSpec rows drawn from the
 * category's SpecTemplate.
 */
import { createHash } from "node:crypto";
import { db } from "@/server/db/seed-client";
import { slugify } from "@/lib/slug";
import { rupeesToPaisa } from "@/lib/money";

function tiptapParagraph(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function checksumFor(seedKey: string) {
  return createHash("sha256").update(`citycomputer-seed:${seedKey}`).digest("hex");
}

interface DemoSpec {
  key: string;
  label: string;
  valueText?: string;
  valueNumber?: number;
  unit?: string;
  group?: string;
}

interface DemoProduct {
  name: string;
  shortDescription: string;
  brandSlug: string;
  categorySlug: string;
  warrantyMonths: number;
  pricePaisa: number;
  compareAtPricePaisa?: number;
  sku: string;
  specs: DemoSpec[];
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: "HP Victus 15 Gaming Laptop (Ryzen 5, RTX 3050)",
    shortDescription:
      "A capable 15.6-inch gaming laptop with a Ryzen 5 processor and RTX 3050 graphics.",
    brandSlug: "hp",
    categorySlug: "laptops",
    warrantyMonths: 12,
    pricePaisa: rupeesToPaisa(124_900),
    compareAtPricePaisa: rupeesToPaisa(134_900),
    sku: "HP-VIC15-001",
    specs: [
      {
        key: "processor",
        label: "Processor",
        valueText: "AMD Ryzen 5 7535HS",
        group: "Performance",
      },
      { key: "ram_gb", label: "RAM", valueNumber: 16, unit: "GB", group: "Performance" },
      { key: "storage", label: "Storage", valueText: "512GB NVMe SSD", group: "Performance" },
      {
        key: "screen_size_in",
        label: "Display size",
        valueNumber: 15.6,
        unit: "inch",
        group: "Display",
      },
      {
        key: "graphics",
        label: "Graphics",
        valueText: "NVIDIA GeForce RTX 3050 4GB",
        group: "Performance",
      },
    ],
  },
  {
    name: "Dell Inspiron 15 3520 (Core i5, Iris Xe)",
    shortDescription: "A reliable everyday laptop for study, browsing, and office work.",
    brandSlug: "dell",
    categorySlug: "laptops",
    warrantyMonths: 12,
    pricePaisa: rupeesToPaisa(74_900),
    sku: "DELL-INS15-3520",
    specs: [
      {
        key: "processor",
        label: "Processor",
        valueText: "Intel Core i5-1235U",
        group: "Performance",
      },
      { key: "ram_gb", label: "RAM", valueNumber: 8, unit: "GB", group: "Performance" },
      { key: "storage", label: "Storage", valueText: "512GB NVMe SSD", group: "Performance" },
      {
        key: "screen_size_in",
        label: "Display size",
        valueNumber: 15.6,
        unit: "inch",
        group: "Display",
      },
    ],
  },
  {
    name: "Apple MacBook Air 13-inch (M2, 8GB, 256GB)",
    shortDescription: "Apple's thin and light everyday laptop, now with the M2 chip.",
    brandSlug: "apple",
    categorySlug: "apple-mac",
    warrantyMonths: 12,
    pricePaisa: rupeesToPaisa(184_900),
    sku: "APPLE-MBA13-M2-256",
    specs: [
      { key: "processor", label: "Processor", valueText: "Apple M2", group: "Performance" },
      { key: "ram_gb", label: "RAM", valueNumber: 8, unit: "GB", group: "Performance" },
      { key: "storage", label: "Storage", valueText: "256GB SSD", group: "Performance" },
      {
        key: "screen_size_in",
        label: "Display size",
        valueNumber: 13.6,
        unit: "inch",
        group: "Display",
      },
      { key: "operating_system", label: "Operating system", valueText: "macOS", group: "Other" },
    ],
  },
  {
    name: "City Computer Ryzen Gaming Prebuilt (Ryzen 5 7600, RTX 4060)",
    shortDescription:
      "Our in-house assembled gaming desktop, built and tested at New Road before it ships.",
    brandSlug: "asus",
    categorySlug: "desktops-prebuilts",
    warrantyMonths: 24,
    pricePaisa: rupeesToPaisa(189_900),
    compareAtPricePaisa: rupeesToPaisa(199_900),
    sku: "CC-PREBUILT-R5-4060",
    specs: [
      { key: "processor", label: "Processor", valueText: "AMD Ryzen 5 7600", group: "Performance" },
      {
        key: "graphics",
        label: "Graphics",
        valueText: "NVIDIA GeForce RTX 4060 8GB",
        group: "Performance",
      },
      { key: "ram_gb", label: "RAM", valueNumber: 16, unit: "GB", group: "Performance" },
      { key: "storage", label: "Storage", valueText: "1TB NVMe SSD", group: "Performance" },
      { key: "power_supply", label: "Power supply", valueText: "650W 80+ Bronze", group: "Other" },
    ],
  },
  {
    name: "Intel Core i5-13400F Desktop Processor",
    shortDescription: "A strong mid-range processor for gaming and everyday desktop builds.",
    brandSlug: "intel",
    categorySlug: "processors",
    warrantyMonths: 36,
    pricePaisa: rupeesToPaisa(24_500),
    sku: "INTEL-I5-13400F",
    specs: [
      { key: "socket", label: "Socket", valueText: "LGA1700", group: "Compatibility" },
      { key: "cores", label: "Cores", valueNumber: 10, group: "Performance" },
      { key: "threads", label: "Threads", valueNumber: 16, group: "Performance" },
      {
        key: "base_clock_ghz",
        label: "Base speed",
        valueNumber: 2.5,
        unit: "GHz",
        group: "Performance",
      },
      {
        key: "boost_clock_ghz",
        label: "Boost speed",
        valueNumber: 4.6,
        unit: "GHz",
        group: "Performance",
      },
    ],
  },
  {
    name: "MSI GeForce RTX 4060 Gaming X 8GB",
    shortDescription:
      "A well-cooled RTX 4060 card that comfortably handles 1080p and 1440p gaming.",
    brandSlug: "msi",
    categorySlug: "graphics-cards",
    warrantyMonths: 36,
    pricePaisa: rupeesToPaisa(52_500),
    sku: "MSI-RTX4060-GAMX",
    specs: [
      {
        key: "chipset",
        label: "Chipset",
        valueText: "NVIDIA GeForce RTX 4060",
        group: "Performance",
      },
      { key: "memory_gb", label: "Memory", valueNumber: 8, unit: "GB", group: "Performance" },
      { key: "memory_type", label: "Memory type", valueText: "GDDR6", group: "Performance" },
      { key: "length_mm", label: "Length", valueNumber: 245, unit: "mm", group: "Fit" },
      {
        key: "recommended_psu_watts",
        label: "Recommended power supply",
        valueNumber: 550,
        unit: "W",
        group: "Power",
      },
    ],
  },
  {
    name: "Corsair Vengeance 16GB (2x8GB) DDR4 3200MHz",
    shortDescription: "A dependable DDR4 memory kit for mainstream desktop builds.",
    brandSlug: "corsair",
    categorySlug: "memory",
    warrantyMonths: 60,
    pricePaisa: rupeesToPaisa(5_200),
    sku: "CORSAIR-VNG-16GB-3200",
    specs: [
      { key: "memory_type", label: "Type", valueText: "DDR4", group: "Compatibility" },
      { key: "speed_mhz", label: "Speed", valueNumber: 3200, unit: "MHz", group: "Performance" },
      { key: "capacity_gb", label: "Capacity", valueNumber: 16, unit: "GB", group: "Performance" },
      { key: "stick_count", label: "Number of sticks", valueNumber: 2, group: "Other" },
    ],
  },
  {
    name: "Samsung 970 EVO Plus 1TB NVMe SSD",
    shortDescription:
      "A fast, well-regarded NVMe SSD for a snappy Windows install and quick game loads.",
    brandSlug: "samsung",
    categorySlug: "storage",
    warrantyMonths: 60,
    pricePaisa: rupeesToPaisa(9_800),
    sku: "SAMSUNG-970EVOP-1TB",
    specs: [
      { key: "storage_type", label: "Type", valueText: "NVMe SSD", group: "Performance" },
      {
        key: "capacity_gb",
        label: "Capacity",
        valueNumber: 1000,
        unit: "GB",
        group: "Performance",
      },
      { key: "interface", label: "Interface", valueText: "PCIe 3.0", group: "Performance" },
      {
        key: "read_speed_mbps",
        label: "Read speed",
        valueNumber: 3500,
        unit: "MB/s",
        group: "Performance",
      },
      {
        key: "write_speed_mbps",
        label: "Write speed",
        valueNumber: 3300,
        unit: "MB/s",
        group: "Performance",
      },
    ],
  },
  {
    name: "Samsung 24-inch Full HD Monitor (S24R350)",
    shortDescription: "A crisp, colour-accurate 24-inch monitor for home and office use.",
    brandSlug: "samsung",
    categorySlug: "monitors",
    warrantyMonths: 36,
    pricePaisa: rupeesToPaisa(14_500),
    sku: "SAMSUNG-S24R350",
    specs: [
      {
        key: "screen_size_in",
        label: "Screen size",
        valueNumber: 24,
        unit: "inch",
        group: "Display",
      },
      { key: "resolution", label: "Resolution", valueText: "1920x1080", group: "Display" },
      { key: "panel_type", label: "Panel type", valueText: "IPS", group: "Display" },
      {
        key: "refresh_rate_hz",
        label: "Refresh rate",
        valueNumber: 75,
        unit: "Hz",
        group: "Display",
      },
    ],
  },
  {
    name: "Logitech MK270 Wireless Keyboard & Mouse Combo",
    shortDescription: "A no-fuss wireless keyboard and mouse combo for everyday desks.",
    brandSlug: "logitech",
    categorySlug: "accessories",
    warrantyMonths: 12,
    pricePaisa: rupeesToPaisa(2_200),
    sku: "LOGI-MK270",
    specs: [
      { key: "accessory_type", label: "Type", valueText: "Keyboard & mouse combo", group: "Other" },
      { key: "connectivity", label: "Connectivity", valueText: "2.4GHz Wireless", group: "Other" },
      { key: "colour", label: "Colour", valueText: "Black", group: "Other" },
    ],
  },
];

export async function seedCatalog() {
  for (const demo of DEMO_PRODUCTS) {
    await seedOneProduct(demo);
  }
}

async function seedOneProduct(demo: DemoProduct) {
  const brand = await db.brand.findUnique({ where: { slug: demo.brandSlug } });
  const category = await db.category.findUnique({ where: { slug: demo.categorySlug } });
  if (!brand || !category) {
    throw new Error(
      `seedCatalog: missing brand (${demo.brandSlug}) or category (${demo.categorySlug}) — run seedTaxonomy first.`,
    );
  }

  const slug = slugify(demo.name);
  const displayTitle = demo.name.length > 70 ? `${demo.name.slice(0, 67)}...` : demo.name;

  const product = await db.product.upsert({
    where: { slug },
    create: {
      slug,
      name: demo.name,
      displayTitle,
      h1: displayTitle,
      shortDescription: demo.shortDescription,
      description: tiptapParagraph(demo.shortDescription),
      brandId: brand.id,
      primaryCategoryId: category.id,
      type: "SIMPLE",
      status: "ACTIVE",
      publishedAt: new Date(),
      conditionType: "NEW",
      warrantyMonths: demo.warrantyMonths,
      warrantyText: `${demo.warrantyMonths} months official warranty`,
      metaTitle: `${displayTitle} Price in Nepal | ${brand.name} | City Computer`,
      metaDescription: demo.shortDescription,
    },
    update: {
      shortDescription: demo.shortDescription,
      warrantyMonths: demo.warrantyMonths,
    },
  });

  await db.productCategory.upsert({
    where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
    create: { productId: product.id, categoryId: category.id },
    update: {},
  });

  const variant = await db.variant.upsert({
    where: { sku: demo.sku },
    create: {
      productId: product.id,
      sku: demo.sku,
      title: null,
      pricePaisa: demo.pricePaisa,
      compareAtPricePaisa: demo.compareAtPricePaisa ?? null,
      isDefault: true,
      position: 0,
      isActive: true,
    },
    update: {
      pricePaisa: demo.pricePaisa,
      compareAtPricePaisa: demo.compareAtPricePaisa ?? null,
    },
  });

  // Placeholder media — real photography happens in Phase 5+. Filename
  // rule per docs/06 §4/§11.7.1: {productSlug}-{role}-{index}-{hash8}.
  const checksum = checksumFor(slug);
  const hash8 = checksum.slice(0, 8);
  const filename = `${slug}-gallery-01-${hash8}.avif`;
  const media = await db.media.upsert({
    where: { checksum },
    create: {
      key: `products/${filename}`,
      url: `/images/placeholder/${filename}`,
      mimeType: "image/avif",
      sizeBytes: 0,
      checksum,
      altText: `${displayTitle} — ${brand.name}`,
    },
    update: {},
  });
  await db.productMedia.upsert({
    where: { productId_mediaId: { productId: product.id, mediaId: media.id } },
    create: { productId: product.id, mediaId: media.id, position: 0, role: "GALLERY" },
    update: {},
  });

  for (const [specIndex, spec] of demo.specs.entries()) {
    await db.productSpec.upsert({
      where: { productId_key: { productId: product.id, key: spec.key } },
      create: {
        productId: product.id,
        key: spec.key,
        label: spec.label,
        valueText: spec.valueText,
        valueNumber: spec.valueNumber,
        unit: spec.unit,
        group: spec.group,
        position: specIndex,
        isFilterable: true,
        isComparable: true,
      },
      update: {
        valueText: spec.valueText,
        valueNumber: spec.valueNumber,
      },
    });
  }

  return { product, variant };
}
