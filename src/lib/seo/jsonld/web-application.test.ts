import { describe, expect, it } from "vitest";
import { buildWebApplicationJsonLd } from "./web-application";

describe("buildWebApplicationJsonLd", () => {
  it("emits a WebApplication node with a free Offer", () => {
    const node = buildWebApplicationJsonLd({
      pathname: "/emi-calculator",
      locale: "en",
      name: "City Computer Systems EMI Calculator",
      description: "Estimate your monthly instalment.",
      applicationCategory: "FinanceApplication",
    });
    expect(node["@type"]).toBe("WebApplication");
    expect(node.applicationCategory).toBe("FinanceApplication");
    expect(node.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "NPR" });
  });

  it("builds a locale-aware, self-referencing @id", () => {
    const node = buildWebApplicationJsonLd({
      pathname: "/build/new",
      locale: "en",
      name: "PC Builder",
      description: "Build your own PC.",
      applicationCategory: "UtilitiesApplication",
    });
    expect(node["@id"]).toContain("/build/new#webapplication");
  });
});
