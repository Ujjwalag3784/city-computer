/**
 * Phase 10's #1 named risk (docs/17-ROADMAP-PHASES.md "Phase 10" row:
 * "Rich-text XSS (mitigate: JSON schema validation, never raw HTML)") —
 * this file IS that mitigation.
 *
 * `Post.content`/`Page.content` are typed `Json` in Prisma with the
 * comment "Tiptap JSON." (see `prisma/schema/content.prisma`) — there is
 * no raw-HTML string field anywhere in this schema, and no sanitizer
 * library (dompurify/sanitize-html) is a dependency. The architecture is
 * therefore: validate the JSON document against a strict allow-list
 * *before* it is ever written to the database, and again defensively
 * before it is ever rendered — a node/mark type or attribute that isn't
 * in this allow-list is rejected outright, never passed through.
 *
 * `dangerouslySetInnerHTML` must never appear anywhere this document is
 * rendered — `render.tsx` in this directory builds real React elements
 * node-by-node instead.
 */
import { z } from "zod";

/** Only `http:`/`https:`/relative-path links survive — blocks `javascript:`, `data:`, etc. */
function isSafeHref(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

const linkMarkSchema = z.object({
  type: z.literal("link"),
  attrs: z.object({
    href: z.string().trim().min(1).refine(isSafeHref, "Unsafe link URL."),
    target: z.literal("_blank").optional(),
    rel: z.string().optional(),
  }),
});

const simpleMarkSchema = z.object({
  type: z.enum(["bold", "italic", "underline", "strike", "code"]),
});

const markSchema = z.union([linkMarkSchema, simpleMarkSchema]);

/** A leaf text node — the only node type allowed to carry marks or plain text. */
const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z.array(markSchema).optional(),
});

const hardBreakNodeSchema = z.object({ type: z.literal("hardBreak") });
const horizontalRuleNodeSchema = z.object({ type: z.literal("horizontalRule") });

// `z.lazy` for the recursive block-node union (paragraphs contain text
// nodes, list items contain paragraphs/lists, etc.).
type TiptapNode = z.infer<typeof textNodeSchema> | { type: string; [key: string]: unknown };

const inlineContentSchema: z.ZodType<TiptapNode[]> = z.lazy(() =>
  z.array(z.union([textNodeSchema, hardBreakNodeSchema])),
);

const paragraphSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("paragraph"),
    content: inlineContentSchema.optional(),
  }),
);

const headingSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.number().int().min(1).max(4) }),
    content: inlineContentSchema.optional(),
  }),
);

const codeBlockSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("codeBlock"),
    attrs: z.object({ language: z.string().nullable().optional() }).optional(),
    content: z.array(textNodeSchema).optional(),
  }),
);

const blockquoteSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("blockquote"),
    content: z.array(topLevelBlockSchema).optional(),
  }),
);

const listItemSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("listItem"),
    content: z.array(topLevelBlockSchema).optional(),
  }),
);

const bulletListSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("bulletList"),
    content: z.array(listItemSchema).optional(),
  }),
);

const orderedListSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("orderedList"),
    attrs: z.object({ start: z.number().int().optional() }).optional(),
    content: z.array(listItemSchema).optional(),
  }),
);

const imageSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.literal("image"),
    attrs: z.object({
      src: z.string().trim().min(1).refine(isSafeHref, "Unsafe image URL."),
      alt: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
    }),
  }),
);

/** Every block-level node this renderer/editor supports — the full allow-list. */
const topLevelBlockSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.union([
    paragraphSchema,
    headingSchema,
    codeBlockSchema,
    blockquoteSchema,
    bulletListSchema,
    orderedListSchema,
    horizontalRuleNodeSchema,
    imageSchema,
  ]),
);

/** The root document — `{ type: "doc", content: [...] }`, Tiptap's own JSON shape. */
export const tiptapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(topLevelBlockSchema).default([]),
});

export type TiptapDocument = z.infer<typeof tiptapDocumentSchema>;

/**
 * Parses/validates an unknown value (typically a `JSON.parse`d editor
 * payload) into a `TiptapDocument`, or returns `null` if it doesn't match
 * the allow-list. Callers (admin blog/page save actions) MUST reject the
 * save outright on `null` — there is no partial/best-effort acceptance.
 */
export function parseTiptapDocument(value: unknown): TiptapDocument | null {
  const result = tiptapDocumentSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** True if `value` is empty or all-whitespace content (no real text anywhere). */
export function isTiptapDocumentEmpty(doc: TiptapDocument): boolean {
  return extractPlainText(doc).trim().length === 0;
}

/** Walks the whole document and concatenates every text node — used for reading time, search, and excerpt generation. */
export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as { type?: string; text?: string; content?: unknown[] };
  if (obj.type === "text" && typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.content)) {
    return obj.content.map(extractPlainText).join(" ");
  }
  return "";
}
