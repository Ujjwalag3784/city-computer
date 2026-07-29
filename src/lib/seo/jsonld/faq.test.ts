import { describe, expect, it } from "vitest";
import { buildFaqPageJsonLd } from "./faq";

describe("buildFaqPageJsonLd", () => {
  it("returns null (not an empty FAQPage) when there are no questions", () => {
    expect(buildFaqPageJsonLd([])).toBeNull();
  });

  it("builds a mainEntity Question/Answer pair per FAQ", () => {
    const node = buildFaqPageJsonLd([
      { question: "Do you offer warranty?", answer: "Yes, per manufacturer terms." },
    ]);
    expect(node?.["@type"]).toBe("FAQPage");
    const mainEntity = node?.mainEntity as Array<Record<string, unknown>>;
    expect(mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Do you offer warranty?",
      acceptedAnswer: { "@type": "Answer", text: "Yes, per manufacturer terms." },
    });
  });
});
