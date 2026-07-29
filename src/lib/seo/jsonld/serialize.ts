/**
 * docs/11-SEO-STRATEGY.md section 4 intro / section 4.14 checklist:
 * "JSON-LD is escaped safely (<, >, &, </script) - XSS gate in the
 * serialiser, covered by a test."
 *
 * This is the one place in the codebase allowed to turn a JSON-LD node
 * into the literal text that goes inside a <script type="application/
 * ld+json"> tag. The risk being guarded against is real and well known:
 * a naive JSON.stringify(data) embedded directly into HTML lets an
 * attacker-controlled string value (e.g. a product description, a review
 * body, an FAQ answer) that happens to contain the literal substring
 * </script> close the script element early and inject arbitrary HTML/JS
 * after it - the browser's HTML tokenizer looks for that byte sequence
 * inside *any* <script> element regardless of how the text got there, it
 * does not care that the content is "just JSON".
 *
 * The fix: every <, >, and & in the JSON *string output* is replaced with
 * its \uXXXX escape before the string is embedded. These are valid JSON
 * string escapes, so JSON.parse() (what Google's Rich Results parser and
 * every other consumer actually runs against the script tag's text
 * content) decodes them straight back to the original characters - this
 * changes nothing about the data a structured-data consumer sees, it only
 * changes which bytes appear in the raw HTML response. Escaping < alone
 * already defeats </script, <script>, and <!--; > and & are escaped too,
 * matching the doc's explicit four-item list, for defence in depth (e.g.
 * against a badly-configured upstream HTML minifier that treats a bare &
 * specially).
 *
 * The Unicode LINE SEPARATOR and PARAGRAPH SEPARATOR code points are also
 * escaped: both are valid inside a JSON string but are treated as line
 * terminators by some JS tokenizers, so leaving them raw inside a
 * <script> body is a long-standing, separate footgun this same pass
 * closes for free.
 *
 * Implemented as a manual character scan (not a regex) so nothing here
 * risks embedding an ambiguous literal character in this source file, and
 * so there is no dynamically-built RegExp for a static-analysis tool to
 * flag.
 */
const LINE_SEPARATOR_CODE_POINT = 0x2028;
const PARAGRAPH_SEPARATOR_CODE_POINT = 0x2029;

const SIMPLE_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["<", "\\u003c"],
  [">", "\\u003e"],
  ["&", "\\u0026"],
]);

/**
 * Serialises a JSON-LD node (or graph, or array of nodes) into the exact
 * text that should be the sole child of a <script type="application/
 * ld+json"> element. Never pass the result through
 * dangerouslySetInnerHTML - render it as a plain string child (React
 * escapes nothing extra there, nor does it need to; this function has
 * already done the one escape that matters).
 */
export function serializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data);
  let escaped = "";
  for (const char of json) {
    const codePoint = char.codePointAt(0);
    if (codePoint === LINE_SEPARATOR_CODE_POINT) {
      escaped += "\\u2028";
    } else if (codePoint === PARAGRAPH_SEPARATOR_CODE_POINT) {
      escaped += "\\u2029";
    } else {
      escaped += SIMPLE_ESCAPES.get(char) ?? char;
    }
  }
  return escaped;
}
