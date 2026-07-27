/**
 * Slug generation, including a best-effort Devanagari → Latin
 * transliteration for Nepali (`ne`) content. See docs/06-DATA-MODEL.md §1
 * and docs/11-SEO-STRATEGY.md §2.
 */

const MAX_SLUG_LENGTH = 80;

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "account",
  "checkout",
  "cart",
  "build",
  "shop",
  "search",
  "track",
  "auth",
  "blog",
  "service",
  "stores",
  "pages",
  "compare",
]);

// A pragmatic, non-exhaustive Devanagari → Latin map covering independent
// vowels, dependent vowel signs (matras), common consonants, and the
// virama (halant), which is dropped. Good enough for product/category/
// brand names; unmapped code points fall through unchanged and are then
// stripped by the slugify pass.
// A `Map` (not a plain object) so an input character can never resolve to an
// inherited property like `__proto__` or `constructor` — every lookup is a
// genuine own-entry check, with no object-injection surface.
const DEVANAGARI_MAP: ReadonlyMap<string, string> = new Map([
  ["अ", "a"],
  ["आ", "aa"],
  ["इ", "i"],
  ["ई", "ii"],
  ["उ", "u"],
  ["ऊ", "uu"],
  ["ऋ", "ri"],
  ["ए", "e"],
  ["ऐ", "ai"],
  ["ओ", "o"],
  ["औ", "au"],
  ["ा", "a"],
  ["ि", "i"],
  ["ी", "ii"],
  ["ु", "u"],
  ["ू", "uu"],
  ["ृ", "ri"],
  ["े", "e"],
  ["ै", "ai"],
  ["ो", "o"],
  ["ौ", "au"],
  ["ं", "n"],
  ["ः", "h"],
  ["ँ", "n"],
  ["क", "k"],
  ["ख", "kh"],
  ["ग", "g"],
  ["घ", "gh"],
  ["ङ", "ng"],
  ["च", "ch"],
  ["छ", "chh"],
  ["ज", "j"],
  ["झ", "jh"],
  ["ञ", "ny"],
  ["ट", "t"],
  ["ठ", "th"],
  ["ड", "d"],
  ["ढ", "dh"],
  ["ण", "n"],
  ["त", "t"],
  ["थ", "th"],
  ["द", "d"],
  ["ध", "dh"],
  ["न", "n"],
  ["प", "p"],
  ["फ", "ph"],
  ["ब", "b"],
  ["भ", "bh"],
  ["म", "m"],
  ["य", "y"],
  ["र", "r"],
  ["ल", "l"],
  ["व", "v"],
  ["श", "sh"],
  ["ष", "sh"],
  ["स", "s"],
  ["ह", "h"],
  ["क्ष", "ksha"],
  ["ज्ञ", "gya"],
  ["़", ""],
  ["्", ""], // nukta, virama
  ["०", "0"],
  ["१", "1"],
  ["२", "2"],
  ["३", "3"],
  ["४", "4"],
  ["५", "5"],
  ["६", "6"],
  ["७", "7"],
  ["८", "8"],
  ["९", "9"],
]);

/** Transliterates Devanagari characters in `input` to Latin, character by character. */
export function transliterateDevanagari(input: string): string {
  let out = "";
  for (const ch of input) {
    out += DEVANAGARI_MAP.get(ch) ?? ch;
  }
  return out;
}

export interface SlugifyOptions {
  maxLength?: number;
}

/**
 * Produces a URL-safe slug: transliterates Devanagari, lowercases, strips
 * diacritics, replaces runs of non-alphanumeric characters with a single
 * hyphen, and truncates at a word boundary within `maxLength`.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const maxLength = options.maxLength ?? MAX_SLUG_LENGTH;
  const transliterated = transliterateDevanagari(input);
  const normalized = transliterated.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // strip combining diacritics (Latin accents)
  const hyphenated = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (hyphenated.length <= maxLength) return hyphenated;

  const truncated = hyphenated.slice(0, maxLength);
  const lastHyphen = truncated.lastIndexOf("-");
  // Prefer truncating at a word boundary if one exists reasonably close to the end.
  if (lastHyphen > maxLength * 0.6) {
    return truncated.slice(0, lastHyphen);
  }
  return truncated.replace(/-+$/, "");
}

/** True if `slug` collides with a top-level application route (docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §3). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

// Anchored, single-character-class alternation with no nested/overlapping
// quantifiers — matching is linear in input length, not susceptible to
// catastrophic backtracking despite the plugin's generic ReDoS heuristic.
// eslint-disable-next-line security/detect-unsafe-regex
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates a slug against the format required by docs/07-API-DESIGN.md §8. */
export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length > 0 && slug.length <= MAX_SLUG_LENGTH;
}

/**
 * Given a base slug and a set of already-taken slugs, returns a unique
 * variant by appending `-2`, `-3`, etc. Used when a product name collides.
 */
export function uniqueSlug(baseSlug: string, taken: Set<string> | string[]): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  if (!takenSet.has(baseSlug)) return baseSlug;
  let n = 2;
  while (takenSet.has(`${baseSlug}-${n}`)) {
    n += 1;
  }
  return `${baseSlug}-${n}`;
}
