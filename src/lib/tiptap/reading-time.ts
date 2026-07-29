/**
 * Blog "reading time" (docs/17 Phase 10 deliverable: "reading time").
 * Pure function — no DB/React — so it's usable both server-side (when a
 * post is saved, `Post.readingMinutes` is computed and stored, per
 * docs/06 §8's `readingMinutes` field) and in tests.
 */
import { extractPlainText, type TiptapDocument } from "./schema";

/** Average adult silent-reading speed in English; Nepali retail-blog content skews toward short sentences, so this is a reasonable single constant rather than a locale-specific table. */
const WORDS_PER_MINUTE = 200;

/** Always at least 1 minute, per every reading-time convention (Medium, WordPress, etc.) — "0 min read" reads as broken, not honest. */
export function calculateReadingMinutes(doc: TiptapDocument): number {
  const text = extractPlainText(doc).trim();
  if (text.length === 0) return 1;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}
