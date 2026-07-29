import { describe, expect, it } from "vitest";
import { absoluteAssetUrl, absoluteUrl, localePath, SITE_URL } from "./site";

describe("localePath", () => {
  it("serves the default locale (en) unprefixed", () => {
    expect(localePath("/c/laptops", "en")).toBe("/c/laptops");
  });

  it("prefixes every other locale", () => {
    expect(localePath("/c/laptops", "ne")).toBe("/ne/c/laptops");
  });

  it("returns bare / for the default locale home page", () => {
    expect(localePath("/", "en")).toBe("/");
  });

  it("returns /ne for the ne locale home page (no trailing slash)", () => {
    expect(localePath("/", "ne")).toBe("/ne");
  });

  it("strips a trailing slash from a non-root path", () => {
    expect(localePath("/c/laptops/", "en")).toBe("/c/laptops");
  });
});

describe("absoluteUrl", () => {
  it("builds an absolute URL under the configured site origin", () => {
    expect(absoluteUrl("/c/laptops", "en")).toBe(`${SITE_URL}/c/laptops`);
  });

  it("builds an absolute, locale-prefixed URL for ne", () => {
    expect(absoluteUrl("/c/laptops", "ne")).toBe(`${SITE_URL}/ne/c/laptops`);
  });

  it("never produces a double slash for the home page", () => {
    expect(absoluteUrl("/", "en")).toBe(`${SITE_URL}/`);
    expect(absoluteUrl("/", "en")).not.toMatch(/\/\/$/);
  });
});

describe("absoluteAssetUrl", () => {
  it("prefixes a leading-slash path with the site origin", () => {
    expect(absoluteAssetUrl("/brand/logo-512.png")).toBe(`${SITE_URL}/brand/logo-512.png`);
  });

  it("tolerates a path missing its leading slash", () => {
    expect(absoluteAssetUrl("brand/logo-512.png")).toBe(`${SITE_URL}/brand/logo-512.png`);
  });
});

describe("SITE_URL", () => {
  it("never has a trailing slash", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });
});
