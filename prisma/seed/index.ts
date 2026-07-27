/**
 * Seed entry point — run via `pnpm db:seed` (package.json: `tsx
 * prisma/seed/index.ts`).
 *
 * Dependency order matters: taxonomy (categories/brands/spec templates)
 * must exist before catalog (products reference them), catalog must exist
 * before builder (a few ComponentPart rows link back to specific
 * Variants), and content has no dependency on the others but is seeded
 * last for a predictable, readable console log.
 *
 * Every step below is written to be safely re-runnable (`upsert` /
 * find-or-create throughout each prisma/seed/*.ts module) — running
 * `pnpm db:seed` twice against the same database updates rather than
 * duplicates.
 */
import { db } from "@/server/db";
import { seedCore } from "./core";
import { seedTaxonomy } from "./taxonomy";
import { seedCatalog } from "./catalog";
import { seedBuilder } from "./builder";
import { seedContent } from "./content";

async function main() {
  console.log("Seeding core data (settings, branch, roles & permissions, delivery zones)...");
  await seedCore();

  console.log("Seeding taxonomy (categories, brands, spec templates)...");
  await seedTaxonomy();

  console.log("Seeding catalog (demo products)...");
  await seedCatalog();

  console.log(
    "Seeding PC builder data (parts, connectors, compatibility rules, build templates)...",
  );
  await seedBuilder();

  console.log("Seeding content (policy pages, menus)...");
  await seedContent();

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
