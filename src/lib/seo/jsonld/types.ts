/** Loose JSON-LD node type — schema.org's vocabulary is far larger than any one closed TypeScript union would usefully model, so builders return plain objects shaped like their doc-comment examples (docs/11-SEO-STRATEGY.md §4) rather than fighting a strict interface per `@type`. */
export type JsonLdNode = Record<string, unknown>;

export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}
