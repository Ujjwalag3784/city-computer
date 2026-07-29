import { describe, expect, it } from "vitest";
import { SITE_URL } from "../site";
import { buildCollectionPageJsonLd, buildItemListJsonLd } from "./item-list";

describe("buildItemListJsonLd", () => {
  it("emits URL-only ListItems, never a full Product node", () => {
    const node = buildItemListJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops",
      items: [{ href: "/p/asus-tuf-a15", name: "ASUS TUF A15" }],
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]!).toMatchObject({
      "@type": "ListItem",
      position: 1,
      url: `${SITE_URL}/p/asus-tuf-a15`,
      name: "ASUS TUF A15",
    });
    expect(items[0]!.price).toBeUndefined();
    expect(items[0]!.offers).toBeUndefined();
  });

  it("numbers positions continuously from startPosition, not always from 1", () => {
    const node = buildItemListJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops?page=2",
      items: [{ href: "/p/a" }, { href: "/p/b" }],
      startPosition: 25,
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]!.position).toBe(25);
    expect(items[1]!.position).toBe(26);
  });

  it("defaults numberOfItems to the item count, but allows an explicit total", () => {
    const withDefault = buildItemListJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops",
      items: [{ href: "/p/a" }],
    });
    expect(withDefault.numberOfItems).toBe(1);

    const withTotal = buildItemListJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops",
      items: [{ href: "/p/a" }],
      numberOfItems: 50,
    });
    expect(withTotal.numberOfItems).toBe(50);
  });

  it("defaults to ascending order", () => {
    const node = buildItemListJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops",
      items: [],
    });
    expect(node.itemListOrder).toBe("https://schema.org/ItemListOrderAscending");
  });
});

describe("buildCollectionPageJsonLd", () => {
  it("references the site-wide WebSite node", () => {
    const node = buildCollectionPageJsonLd({
      locale: "en",
      pageUrl: "https://citycomputer.com.np/c/laptops",
      name: "Laptops",
    });
    expect(node["@type"]).toBe("CollectionPage");
    expect((node.isPartOf as Record<string, unknown>)["@id"]).toMatch(/#website$/);
  });
});
