import { describe, expect, it } from "vitest";
import { buildComputerStoreJsonLd } from "./local-business";

function baseHours() {
  // Nepal's real week: Sunday-Friday open, Saturday closed — deliberately
  // NOT a Mon-Fri Western default, matching docs/11 §4.2's explicit
  // callout. dayOfWeek 0 = Sunday ... 6 = Saturday.
  return [
    { dayOfWeek: 0, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 2, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 3, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 4, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 5, isClosed: false, openTime: "10:00", closeTime: "19:00" },
    { dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null },
  ];
}

describe("buildComputerStoreJsonLd", () => {
  it("emits a ComputerStore referencing the site Organization", () => {
    const node = buildComputerStoreJsonLd({
      slug: "new-road",
      name: "City Computer Systems — New Road",
      telephone: "+977-1-4230000",
      streetAddress: "New Road",
      addressLocality: "Kathmandu",
      hours: baseHours(),
    });
    expect(node["@type"]).toBe("ComputerStore");
    expect((node.parentOrganization as Record<string, unknown>)["@id"]).toMatch(/#organization$/);
  });

  it("excludes Saturday (closed) from openingHoursSpecification and includes every open day", () => {
    const node = buildComputerStoreJsonLd({
      slug: "new-road",
      name: "City Computer Systems — New Road",
      telephone: "+977-1-4230000",
      streetAddress: "New Road",
      addressLocality: "Kathmandu",
      hours: baseHours(),
    });
    const spec = node.openingHoursSpecification as Array<Record<string, unknown>>;
    expect(spec).toHaveLength(6);
    expect(spec.some((s) => s.dayOfWeek === "https://schema.org/Saturday")).toBe(false);
    expect(spec.some((s) => s.dayOfWeek === "https://schema.org/Sunday")).toBe(true);
  });

  it("omits geo when coordinates are not supplied", () => {
    const node = buildComputerStoreJsonLd({
      slug: "new-road",
      name: "City Computer Systems — New Road",
      telephone: "+977-1-4230000",
      streetAddress: "New Road",
      addressLocality: "Kathmandu",
      hours: [],
    });
    expect(node.geo).toBeUndefined();
  });

  it("includes geo when both latitude and longitude are supplied", () => {
    const node = buildComputerStoreJsonLd({
      slug: "new-road",
      name: "City Computer Systems — New Road",
      telephone: "+977-1-4230000",
      streetAddress: "New Road",
      addressLocality: "Kathmandu",
      latitude: 27.7041,
      longitude: 85.3145,
      hours: [],
    });
    expect(node.geo).toMatchObject({ "@type": "GeoCoordinates", latitude: 27.7041 });
  });
});
