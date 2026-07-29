import { describe, expect, it } from "vitest";
import { buildBuildProductJsonLd } from "./build-product";

describe("buildBuildProductJsonLd", () => {
  it("emits a Product node with an AggregateOffer, not a plain Offer", () => {
    const node = buildBuildProductJsonLd({
      shortId: "7Qk3Zx",
      name: "Ryzen 5 + RTX 4060 Gaming PC Build",
      description: "Custom PC build.",
      imageUrl: "https://citycomputer.com.np/build/7Qk3Zx/opengraph-image",
      totalPricePaisa: 18950000,
      availability: "InStock",
      parts: [],
    });
    expect(node["@type"]).toBe("Product");
    const offers = node.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers.lowPrice).toBe("189500.00");
    expect(offers.highPrice).toBe("189500.00");
    expect(offers.offerCount).toBe(1);
  });

  it("links isRelatedTo only for parts that are real, separately purchasable Products", () => {
    const node = buildBuildProductJsonLd({
      shortId: "7Qk3Zx",
      name: "Build",
      description: "Description.",
      imageUrl: "https://citycomputer.com.np/build/7Qk3Zx/opengraph-image",
      totalPricePaisa: 100000,
      availability: "InStock",
      parts: [{ productSlug: "amd-ryzen-5-7600" }, { productSlug: null }],
    });
    expect(node.isRelatedTo).toHaveLength(1);
  });

  it("omits isRelatedTo entirely when no parts are separately purchasable", () => {
    const node = buildBuildProductJsonLd({
      shortId: "7Qk3Zx",
      name: "Build",
      description: "Description.",
      imageUrl: "https://citycomputer.com.np/build/7Qk3Zx/opengraph-image",
      totalPricePaisa: 100000,
      availability: "InStock",
      parts: [{ productSlug: null }],
    });
    expect(node.isRelatedTo).toBeUndefined();
  });
});
