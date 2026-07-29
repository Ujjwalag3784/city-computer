import { describe, expect, it } from "vitest";
import { extractPlainText, isTiptapDocumentEmpty, parseTiptapDocument } from "./schema";

function doc(content: unknown[]) {
  return { type: "doc", content };
}

describe("parseTiptapDocument", () => {
  it("accepts a simple paragraph document", () => {
    const input = doc([{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }]);
    const result = parseTiptapDocument(input);
    expect(result).not.toBeNull();
    expect(result?.content).toHaveLength(1);
  });

  it("accepts headings, lists, blockquotes, code blocks, and marks", () => {
    const input = doc([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
          },
        ],
      },
      { type: "blockquote", content: [{ type: "paragraph" }] },
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "bold and linked",
            marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
    ]);
    expect(parseTiptapDocument(input)).not.toBeNull();
  });

  it("rejects an unknown node type — this is the XSS/allow-list gate", () => {
    const input = doc([{ type: "html", content: "<script>alert(1)</script>" }]);
    expect(parseTiptapDocument(input)).toBeNull();
  });

  it("rejects a javascript: link href", () => {
    const input = doc([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click me",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ]);
    expect(parseTiptapDocument(input)).toBeNull();
  });

  it("rejects a data: image src", () => {
    const input = doc([
      { type: "image", attrs: { src: "data:text/html,<script>alert(1)</script>" } },
    ]);
    expect(parseTiptapDocument(input)).toBeNull();
  });

  it("accepts relative and mailto links", () => {
    const relative = doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "/pages/about" } }] },
        ],
      },
    ]);
    const mailto = doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "mailto:a@b.com" } }] },
        ],
      },
    ]);
    expect(parseTiptapDocument(relative)).not.toBeNull();
    expect(parseTiptapDocument(mailto)).not.toBeNull();
  });

  it("rejects a completely malformed value", () => {
    expect(parseTiptapDocument("<p>raw html string</p>")).toBeNull();
    expect(parseTiptapDocument(null)).toBeNull();
    expect(parseTiptapDocument({ type: "not-a-doc" })).toBeNull();
  });
});

describe("extractPlainText / isTiptapDocumentEmpty", () => {
  it("concatenates every text node", () => {
    const input = doc([
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "world" }] },
    ]);
    const parsed = parseTiptapDocument(input);
    expect(extractPlainText(parsed).trim()).toBe("Hello world");
  });

  it("treats an empty content array as empty", () => {
    const parsed = parseTiptapDocument(doc([]));
    expect(parsed).not.toBeNull();
    expect(isTiptapDocumentEmpty(parsed!)).toBe(true);
  });

  it("treats a document with only whitespace text as empty", () => {
    const parsed = parseTiptapDocument(
      doc([{ type: "paragraph", content: [{ type: "text", text: "   " }] }]),
    );
    expect(isTiptapDocumentEmpty(parsed!)).toBe(true);
  });
});
