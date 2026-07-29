import { describe, expect, it } from "vitest";
import { buildOrganizationJsonLd } from "./organization";

describe("buildOrganizationJsonLd", () => {
  it("emits an Organization node with a stable @id anchored to the homepage", () => {
    const node = buildOrganizationJsonLd();
    expect(node["@type"]).toBe("Organization");
    expect(node["@id"]).toMatch(/#organization$/);
    expect(node["@id"]).toMatch(/^https?:\/\//);
  });

  it("includes a logo ImageObject with explicit dimensions", () => {
    const node = buildOrganizationJsonLd();
    const logo = node.logo as Record<string, unknown>;
    expect(logo["@type"]).toBe("ImageObject");
    expect(logo.width).toBe(512);
    expect(logo.height).toBe(512);
  });

  it("includes a PostalAddress and at least one ContactPoint", () => {
    const node = buildOrganizationJsonLd();
    const address = node.address as Record<string, unknown>;
    expect(address["@type"]).toBe("PostalAddress");
    expect(address.addressCountry).toBe("NP");
    expect(Array.isArray(node.contactPoint)).toBe(true);
    expect((node.contactPoint as unknown[]).length).toBeGreaterThan(0);
  });

  it("omits sameAs entirely when no social URLs are configured", () => {
    const node = buildOrganizationJsonLd();
    // ORG_INFO.sameAs is currently an empty placeholder array (docs/11 §4.1
    // DECISION REQUIRED) — emitting an empty `sameAs: []` would be
    // technically valid but noisy, so the builder omits the key entirely.
    expect(node.sameAs).toBeUndefined();
  });
});
