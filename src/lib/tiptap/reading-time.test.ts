import { describe, expect, it } from "vitest";
import { calculateReadingMinutes } from "./reading-time";
import { parseTiptapDocument } from "./schema";

function docWithWords(count: number) {
  const words = Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
  return parseTiptapDocument({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
  })!;
}

describe("calculateReadingMinutes", () => {
  it("returns 1 minute for an empty document", () => {
    const doc = parseTiptapDocument({ type: "doc", content: [] })!;
    expect(calculateReadingMinutes(doc)).toBe(1);
  });

  it("returns 1 minute for short content well under 200 words", () => {
    expect(calculateReadingMinutes(docWithWords(50))).toBe(1);
  });

  it("rounds up to the next whole minute", () => {
    // 201 words / 200 wpm = 1.005 -> ceil -> 2
    expect(calculateReadingMinutes(docWithWords(201))).toBe(2);
  });

  it("computes multiple minutes for longer content", () => {
    expect(calculateReadingMinutes(docWithWords(1000))).toBe(5);
  });
});
