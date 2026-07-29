import { describe, expect, it } from "vitest";
import { buildServiceJsonLd } from "./service";

describe("buildServiceJsonLd", () => {
  it("emits a Service node referencing the site Organization as provider", () => {
    const node = buildServiceJsonLd({ areaServedCity: "Kathmandu", storeIds: [] });
    expect(node["@type"]).toBe("Service");
    expect((node.provider as Record<string, unknown>)["@id"]).toMatch(/#organization$/);
  });

  it("never emits a priceSpecification or hasOfferCatalog (repair prices are quoted, not published)", () => {
    const node = buildServiceJsonLd({ areaServedCity: "Kathmandu", storeIds: [] });
    expect(node.priceSpecification).toBeUndefined();
    expect(node.hasOfferCatalog).toBeUndefined();
    expect(JSON.stringify(node)).not.toContain("priceSpecification");
  });

  it("includes serviceLocation references when store ids are supplied", () => {
    const node = buildServiceJsonLd({
      areaServedCity: "Kathmandu",
      storeIds: ["https://citycomputer.com.np/stores/new-road#store"],
    });
    const channel = node.availableChannel as Record<string, unknown>;
    expect(channel.serviceLocation).toEqual([
      { "@id": "https://citycomputer.com.np/stores/new-road#store" },
    ]);
  });
});
