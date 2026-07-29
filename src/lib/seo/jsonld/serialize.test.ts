import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./serialize";

describe("serializeJsonLd", () => {
  it("round-trips a plain object through JSON.parse unchanged", () => {
    const input = { "@type": "Thing", name: "ASUS TUF Gaming A15" };
    const serialized = serializeJsonLd(input);
    expect(JSON.parse(serialized)).toEqual(input);
  });

  // The load-bearing XSS test: a value containing a literal `</script>`
  // must never let that byte sequence reach the raw serialized output,
  // because a browser's HTML tokenizer closes the surrounding
  // `<script>` element the moment it sees that sequence, regardless of
  // where inside the "JSON" it appears.
  it("never emits a literal </script> sequence, even when a field contains one", () => {
    const input = {
      "@type": "Review",
      reviewBody: "Great laptop! </script><img src=x onerror=alert(1)>",
    };
    const serialized = serializeJsonLd(input);

    expect(serialized).not.toContain("</script");
    expect(serialized.toLowerCase()).not.toContain("</script");
    // The escaped form must still decode back to the original string —
    // this proves the escaping is reversible JSON, not data loss/mangling.
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("escapes a bare <script> opening tag the same way", () => {
    const input = { name: "<script>alert(1)</script>" };
    const serialized = serializeJsonLd(input);
    expect(serialized).not.toContain("<script");
    expect(serialized).not.toContain("</script");
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("escapes an HTML comment opener that could confuse legacy sniffers", () => {
    const input = { name: "<!--[if IE]-->" };
    const serialized = serializeJsonLd(input);
    expect(serialized).not.toContain("<!--");
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("escapes a bare ampersand", () => {
    const input = { name: "Fish & Chips" };
    const serialized = serializeJsonLd(input);
    expect(serialized).toContain("\\u0026");
    expect(serialized).not.toContain("Fish & Chips");
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("escapes U+2028 and U+2029 line/paragraph separators", () => {
    const input = { name: `line one${String.fromCharCode(0x2028)}line two` };
    const serialized = serializeJsonLd(input);
    expect(serialized).toContain("\\u2028");
    expect(serialized).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("handles a graph with an @graph array of nodes", () => {
    const input = {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Organization", name: "City Computer Systems" }],
    };
    const serialized = serializeJsonLd(input);
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("handles nested arrays and objects containing the attack string at any depth", () => {
    const input = {
      itemListElement: [{ name: "ok" }, { name: "</script><script>alert(2)</script>" }],
    };
    const serialized = serializeJsonLd(input);
    expect(serialized).not.toContain("</script");
    expect(JSON.parse(serialized)).toEqual(input);
  });
});
