import { serializeJsonLd } from "@/lib/seo/jsonld/serialize";
import type { JsonLdGraph, JsonLdNode } from "@/lib/seo/jsonld/types";

/**
 * The one Server Component every JSON-LD-emitting route renders through —
 * docs/11-SEO-STRATEGY.md §4 intro: "All JSON-LD is emitted server-side as
 * `<script type="application/ld+json">` from typed builders in
 * `lib/seo/jsonld/`."
 *
 * Deliberately a plain string child, never `dangerouslySetInnerHTML` (this
 * codebase's own eslint rule bans that outright, docs/13-SECURITY.md §4,
 * and every hand-rolled JSON-LD `<script>` elsewhere in this codebase
 * already follows the same pattern). `serializeJsonLd` has already done
 * the one escape that makes this safe against a value containing a
 * literal `</script>` — see that function's own doc comment.
 *
 * Accepts a single node, an array of nodes (rendered as one `<script>`
 * each is deliberately NOT supported here — callers that need multiple
 * top-level types on one page compose a `JsonLdGraph` with `@graph`
 * instead, matching docs/11's own root-layout example), or a full graph.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdGraph | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
