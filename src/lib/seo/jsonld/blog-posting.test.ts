import { describe, expect, it } from "vitest";
import { buildBlogJsonLd, buildBlogPostingJsonLd } from "./blog-posting";

describe("buildBlogPostingJsonLd", () => {
  it("emits headline, author, publisher and mainEntityOfPage", () => {
    const node = buildBlogPostingJsonLd({
      slug: "best-gaming-laptop-nepal-2026",
      locale: "en",
      headline: "Best Gaming Laptop in Nepal (2026)",
      description: "Our picks for the best gaming laptops available in Nepal this year.",
      images: ["https://cdn.citycomputer.com.np/blog/best-gaming-laptop-2026.jpg"],
      datePublished: "2026-01-15T09:00:00+05:45",
      dateModified: "2026-01-15T09:00:00+05:45",
      authorName: "Sujan Shrestha",
    });
    expect(node["@type"]).toBe("BlogPosting");
    expect(node.headline).toBe("Best Gaming Laptop in Nepal (2026)");
    expect((node.author as Record<string, unknown>).name).toBe("Sujan Shrestha");
    expect((node.publisher as Record<string, unknown>)["@id"]).toMatch(/#organization$/);
    expect((node.mainEntityOfPage as Record<string, unknown>)["@id"]).toContain(
      "/blog/best-gaming-laptop-nepal-2026",
    );
  });

  it("omits authorUrl and articleSection when not supplied", () => {
    const node = buildBlogPostingJsonLd({
      slug: "post",
      locale: "en",
      headline: "Post",
      description: "Description.",
      images: [],
      datePublished: "2026-01-01T00:00:00+05:45",
      dateModified: "2026-01-01T00:00:00+05:45",
      authorName: "Author",
    });
    expect((node.author as Record<string, unknown>).url).toBeUndefined();
    expect(node.articleSection).toBeUndefined();
  });
});

describe("buildBlogJsonLd", () => {
  it("emits a Blog node referencing the site Organization", () => {
    const node = buildBlogJsonLd({ locale: "en" });
    expect(node["@type"]).toBe("Blog");
    expect((node.publisher as Record<string, unknown>)["@id"]).toMatch(/#organization$/);
  });
});
