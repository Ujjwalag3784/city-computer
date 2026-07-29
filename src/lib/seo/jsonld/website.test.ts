import { describe, expect, it } from "vitest";
import { buildWebsiteJsonLd } from "./website";

describe("buildWebsiteJsonLd", () => {
  it("emits a WebSite node referencing the Organization by @id", () => {
    const node = buildWebsiteJsonLd();
    expect(node["@type"]).toBe("WebSite");
    expect(node["@id"]).toMatch(/#website$/);
    expect((node.publisher as Record<string, unknown>)["@id"]).toMatch(/#organization$/);
  });

  it("includes a SearchAction with a well-formed urlTemplate and no double slash", () => {
    const node = buildWebsiteJsonLd();
    const action = node.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    const target = action.target as Record<string, unknown>;
    expect(target.urlTemplate).toContain("{search_term_string}");
    expect(target.urlTemplate).not.toMatch(/\/\/search/);
    expect(action["query-input"]).toBe("required name=search_term_string");
  });
});
