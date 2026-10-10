import { describe, expect, it } from "vitest";
import { defaultPageTitle, defaultSearchDescription } from "./seo-defaults";
import { computeSeoHint } from "@/lib/seo/serp-hint";

const LONG = "Lenovo IdeaPad Slim 3 (Ryzen 5 7520U, 16GB, 512GB)";

describe("defaultPageTitle", () => {
  it("uses the richest form that fits in 60 characters", () => {
    expect(defaultPageTitle("HP Victus 15", "HP")).toBe(
      "HP Victus 15 Price in Nepal | City Computer",
    );
  });

  it("drops extras for long names but keeps the full name, with no stray separator", () => {
    const title = defaultPageTitle(LONG, "Lenovo");
    expect(title).toBe(LONG);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("cuts an over-long name on a word boundary", () => {
    const title = defaultPageTitle(`${LONG} with Backlit Keyboard and Fingerprint`);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).not.toMatch(/[\s|,-]$/);
  });
});

describe("defaultSearchDescription", () => {
  it("mentions the product name and lands in Google's length range", () => {
    const description = defaultSearchDescription(
      LONG,
      "Thin and light 15.6-inch laptop for study and office work.",
    );
    expect(description.startsWith(LONG)).toBe(true);
    expect(description.length).toBeGreaterThanOrEqual(110);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("passes the wizard's own SEO check for a typical product", () => {
    const hint = computeSeoHint({
      title: defaultPageTitle(LONG),
      description: defaultSearchDescription(LONG, "Thin and light laptop."),
      entityName: LONG,
    });
    expect(hint.issues).toEqual([]);
  });

  it("doesn't repeat the name when the description already has it", () => {
    const description = defaultSearchDescription(
      "HP Victus 15",
      `HP Victus 15 gaming laptop. ${"x ".repeat(80)}`,
    );
    expect(description.match(/HP Victus 15/g)).toHaveLength(1);
  });
});
