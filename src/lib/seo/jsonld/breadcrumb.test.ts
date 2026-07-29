import { describe, expect, it } from "vitest";
import { SITE_URL } from "../site";
import { buildBreadcrumbListJsonLd } from "./breadcrumb";

describe("buildBreadcrumbListJsonLd", () => {
  it("prepends Home and numbers positions starting at 1", () => {
    const node = buildBreadcrumbListJsonLd(
      [{ label: "Laptops", href: "/c/laptops" }, { label: "ASUS TUF A15" }],
      "en",
      { pageUrl: "https://citycomputer.com.np/p/asus-tuf-a15" },
    );
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]!).toMatchObject({ position: 1, name: "Home" });
    expect(items[1]!).toMatchObject({ position: 2, name: "Laptops" });
    expect(items[2]!).toMatchObject({ position: 3, name: "ASUS TUF A15" });
  });

  it("omits `item` (the link) on the last entry — it's the current page", () => {
    const node = buildBreadcrumbListJsonLd([{ label: "Laptops", href: "/c/laptops" }], "en", {
      pageUrl: "https://citycomputer.com.np/c/laptops",
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    const last = items[items.length - 1]!;
    expect(last.item).toBeUndefined();
  });

  it("includes an absolute item URL for every non-last entry with an href", () => {
    const node = buildBreadcrumbListJsonLd([{ label: "Laptops", href: "/c/laptops" }], "en", {
      pageUrl: "https://citycomputer.com.np/c/laptops",
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    // items[0] is Home, prepended automatically.
    expect(items[0]!.item).toBe(`${SITE_URL}/`);
  });

  it("respects includeHome: false", () => {
    const node = buildBreadcrumbListJsonLd([{ label: "Laptops", href: "/c/laptops" }], "en", {
      includeHome: false,
      pageUrl: "https://citycomputer.com.np/c/laptops",
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("Laptops");
  });

  it("builds locale-prefixed item URLs for the ne locale", () => {
    const node = buildBreadcrumbListJsonLd([{ label: "ल्यापटप", href: "/c/laptops" }], "ne", {
      pageUrl: "https://citycomputer.com.np/ne/c/laptops",
    });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]!.item).toBe(`${SITE_URL}/ne`);
  });
});
