import { describe, expect, it } from "vitest";
import {
  countTiptapWords,
  hasSubstantialContent,
  isBlogPostIndexable,
  isCmsPageIndexable,
  isProductIndexable,
  MIN_BLOG_POST_WORDS,
  MIN_PRODUCT_DESCRIPTION_WORDS,
} from "./thin-content";

function docWithWords(count: number) {
  const words = Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
  };
}

describe("countTiptapWords", () => {
  it("counts words across paragraphs", () => {
    expect(countTiptapWords(docWithWords(42))).toBe(42);
  });

  it("returns 0 for an empty document", () => {
    expect(countTiptapWords({ type: "doc", content: [] })).toBe(0);
  });

  it("returns 0 for null/undefined without throwing", () => {
    expect(countTiptapWords(null)).toBe(0);
    expect(countTiptapWords(undefined)).toBe(0);
  });

  it("returns 0 for a whitespace-only document", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
    };
    expect(countTiptapWords(doc)).toBe(0);
  });
});

describe("hasSubstantialContent", () => {
  it("is false just under the threshold and true just at it", () => {
    expect(hasSubstantialContent(docWithWords(149), 150)).toBe(false);
    expect(hasSubstantialContent(docWithWords(150), 150)).toBe(true);
  });
});

describe("isBlogPostIndexable / isCmsPageIndexable", () => {
  it("rejects a thin draft", () => {
    expect(isBlogPostIndexable(docWithWords(10))).toBe(false);
    expect(isCmsPageIndexable(docWithWords(10))).toBe(false);
  });

  it("accepts a substantial post", () => {
    expect(isBlogPostIndexable(docWithWords(MIN_BLOG_POST_WORDS))).toBe(true);
  });

  it("rejects an empty/null document (e.g. a brand-new draft)", () => {
    expect(isBlogPostIndexable(null)).toBe(false);
    expect(isCmsPageIndexable(undefined)).toBe(false);
  });
});

describe("isProductIndexable", () => {
  const fullDescription = docWithWords(MIN_PRODUCT_DESCRIPTION_WORDS);
  const thinDescription = docWithWords(MIN_PRODUCT_DESCRIPTION_WORDS - 1);

  it("accepts a product that clears all three docs/11 §6.5 floors", () => {
    expect(isProductIndexable({ description: fullDescription, specCount: 6, photoCount: 2 })).toBe(
      true,
    );
  });

  it("rejects a product one word short of the description floor, even with plenty of specs/photos", () => {
    expect(
      isProductIndexable({ description: thinDescription, specCount: 20, photoCount: 10 }),
    ).toBe(false);
  });

  it("rejects a product with a full description but too few spec attributes", () => {
    expect(isProductIndexable({ description: fullDescription, specCount: 5, photoCount: 2 })).toBe(
      false,
    );
  });

  it("rejects a product with a full description and specs but only one photo", () => {
    expect(isProductIndexable({ description: fullDescription, specCount: 6, photoCount: 1 })).toBe(
      false,
    );
  });

  it("rejects a product with no description at all (e.g. a brand-new draft)", () => {
    expect(isProductIndexable({ description: null, specCount: 20, photoCount: 10 })).toBe(false);
  });
});
